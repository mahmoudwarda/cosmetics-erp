import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Banknote, Landmark, Plus, Receipt, Wallet } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashTransactions, cashboxes, permissions, users } from "@/server/db/schema";
import { addCashTransaction, createCashbox, transferCash } from "@/features/finance/actions";
import { requirePermission } from "@/server/permissions";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";

export default async function FinancePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("finance", "view");

  const [user] = await db
    .select({ roleId: users.roleId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const grants = user
    ? await db
        .select({ action: permissions.action })
        .from(permissions)
        .where(eq(permissions.roleId, user.roleId))
    : [];

  const canCreate = grants.some((grant) => grant.action === "create");

  const [boxes, txs, aggregates] = await Promise.all([
    db.select().from(cashboxes).where(eq(cashboxes.active, true)),
    db.select().from(cashTransactions).orderBy(desc(cashTransactions.createdAt)).limit(100),
    db
      .select({
        cashboxId: cashTransactions.cashboxId,
        balance: sql<string>`coalesce(sum(case when ${cashTransactions.kind} in ('income','transfer_in','invoice_payment','party_payment') then ${cashTransactions.amount} else -${cashTransactions.amount} end),0)`,
      })
      .from(cashTransactions)
      .groupBy(cashTransactions.cashboxId),
  ]);

  const totals = new Map(aggregates.map((x) => [x.cashboxId, Number(x.balance)]));
  const grandTotalCash = boxes.reduce(
    (sum, box) => sum + (Number(box.openingBalance) + (totals.get(box.id) ?? 0)),
    0
  );

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">الخزينة والمقبوضات</p>
          <h1>المالية والصناديق النقدية</h1>
        </div>
        <div className="top-actions">
          <Link className="secondary" href="/">
            <ArrowRight size={15} />
            <span>الرئيسية</span>
          </Link>
        </div>
      </header>

      {/* Cashbox Balance Cards */}
      <section className="kpis">
        {boxes.map((box) => {
          const balance = Number(box.openingBalance) + (totals.get(box.id) ?? 0);
          return (
            <article className="kpi" key={box.id}>
              <div className="kpi-head">
                <span className="font-bold text-[var(--ink)]">{box.name}</span>
                <div className="icon">
                  {box.kind === "bank" ? (
                    <Landmark size={15} className="text-indigo-600" />
                  ) : box.kind === "wallet" ? (
                    <Wallet size={15} className="text-emerald-600" />
                  ) : (
                    <Banknote size={15} className="text-amber-600" />
                  )}
                </div>
              </div>
              <strong>
                {balance.toLocaleString("ar-EG")} <small>ج.م</small>
              </strong>
              <p className="muted">
                {box.kind === "cash" ? "صندوق كاشير نقدي" : box.kind === "bank" ? "حساب بنكي" : "محفظة إلكترونية"} · رصيد فعلي
              </p>
            </article>
          );
        })}
      </section>

      {/* Action Buttons for Finance Operations */}
      {canCreate && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <details className="editor">
            <summary className="primary">
              <Plus size={15} />
              <span>إضافة صندوق نقدية / بنك</span>
            </summary>
            <form action={createCashbox} className="form-grid">
              <CloseDisclosureButton title="إضافة صندوق أو حساب مالي جديد" />
              <label>
                اسم الصندوق أو الحساب
                <input name="name" required minLength={2} placeholder="مثال: الخزينة الرئيسية، كاشير الصالة" />
              </label>
              <label>
                نوع الصندوق
                <select name="kind">
                  <option value="cash">نقدي (كاشير / خزينة)</option>
                  <option value="bank">حساب بنكي</option>
                  <option value="wallet">محفظة إلكترونية / فودافون كاش</option>
                </select>
              </label>
              <label className="wide-field">
                الرصيد الافتتاحي المبدئي (ج.م)
                <input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" required />
              </label>
              <button className="primary">حفظ الصندوق وتفعيله</button>
            </form>
          </details>

          <details className="editor">
            <summary className="primary">
              <Receipt size={15} />
              <span>تسجيل دخل أو مصروف</span>
            </summary>
            <form action={addCashTransaction} className="form-grid">
              <CloseDisclosureButton title="تسجيل سند دخل أو مصروف نقدي" />
              <label>
                الصندوق المتأثر
                <select name="cashboxId" required>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                نوع الحركة
                <select name="kind">
                  <option value="income">إيراد / دخل نقدي (+)</option>
                  <option value="expense">مصروف تشغيلي / نثريات (−)</option>
                </select>
              </label>
              <label>
                التصنيف أو بند الصرف
                <input name="category" required minLength={2} placeholder="مثال: كهرباء، إيجار، بوفيه، إيراد صيانة" />
              </label>
              <label>
                المبلغ (ج.م)
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="wide-field">
                ملاحظات وتفاصيل إضافية
                <input name="notes" placeholder="ملاحظات توضيحية لدفتر الحسابات" />
              </label>
              <button className="primary">تسجيل الحركة وترحيلها</button>
            </form>
          </details>

          <details className="editor">
            <summary className="secondary">
              <ArrowLeftRight size={15} />
              <span>تحويل مالي بين الصناديق</span>
            </summary>
            <form action={transferCash} className="form-grid">
              <CloseDisclosureButton title="سند تحويل نقدية بين الصناديق" />
              <label>
                من الصندوق (المُحوِّل)
                <select name="from" required>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                إلى الصندوق (المُستلِم)
                <select name="to" required>
                  {boxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide-field">
                المبلغ المراد تحويله (ج.م)
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="wide-field">
                ملاحظات التحويل
                <input name="notes" placeholder="مثال: إيداع نقدي في البنك، تغذية عهدة الكاشير" />
              </label>
              <button className="primary">تنفيذ التحويل المالي</button>
            </form>
          </details>
        </div>
      )}

      {/* Cash Transactions Table */}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h3>دفتر الحركات النقدية</h3>
            <p>سجل المقبوضات والمصروفات والتحويلات المسجلة</p>
          </div>
          <span className="date-pill">إجمالي السيولة: {grandTotalCash.toLocaleString("ar-EG")} ج.م</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>الصندوق</th>
                <th>نوع الحركة</th>
                <th>التصنيف</th>
                <th>المبلغ</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {txs.length ? (
                txs.map((tx) => {
                  const isPositive = ["income", "transfer_in", "invoice_payment", "party_payment"].includes(tx.kind);
                  return (
                    <tr key={tx.id}>
                      <td className="text-xs text-[var(--muted)] font-medium">
                        {new Date(tx.createdAt).toLocaleString("ar-EG")}
                      </td>
                      <td className="font-bold text-[var(--ink)]">
                        {boxes.find((box) => box.id === tx.cashboxId)?.name ?? "صندوق مؤرشف"}
                      </td>
                      <td>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {tx.kind === "income"
                            ? "إيراد"
                            : tx.kind === "expense"
                            ? "مصروف"
                            : tx.kind === "transfer_in"
                            ? "تحويل وارد"
                            : tx.kind === "transfer_out"
                            ? "تحويل صادر"
                            : tx.kind === "invoice_payment"
                            ? "تحصيل فاتورة"
                            : tx.kind === "party_payment"
                            ? "سند عميل/مورد"
                            : tx.kind}
                        </span>
                      </td>
                      <td className="text-xs font-semibold text-[var(--ink)]">{tx.category ?? "—"}</td>
                      <td className={`font-bold ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                        {isPositive ? "+" : "−"} {Number(tx.amount).toLocaleString("ar-EG")} ج.م
                      </td>
                      <td className="text-xs text-[var(--muted)]">{tx.notes ?? "—"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    لا توجد حركات مسجلة. أضف صندوقًا أو سجل عملية نقدية للبدء.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
