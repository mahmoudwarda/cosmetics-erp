import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeftRight, ArrowRight, Banknote, Landmark, Plus, Receipt, Wallet, Pencil, Trash2 } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashTransactions, cashboxes, permissions, users } from "@/server/db/schema";
import { addCashTransaction, createCashbox, deactivateCashbox, transferCash, updateCashbox } from "@/features/finance/actions";
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
  const canEdit = grants.some((grant) => grant.action === "edit");
  const canDelete = grants.some((grant) => grant.action === "delete");

  const [boxes, txs, aggregates, allBoxes] = await Promise.all([
    db.select().from(cashboxes).where(eq(cashboxes.active, true)),
    db.select().from(cashTransactions).orderBy(desc(cashTransactions.createdAt)).limit(100),
    db
      .select({
        cashboxId: cashTransactions.cashboxId,
        balance: sql<string>`coalesce(sum(case when ${cashTransactions.kind} in ('income','transfer_in','invoice_payment','party_payment') then ${cashTransactions.amount} else -${cashTransactions.amount} end),0)`,
      })
      .from(cashTransactions)
      .groupBy(cashTransactions.cashboxId),
    db.select({ id: cashboxes.id, name: cashboxes.name }).from(cashboxes),
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

      {/* Cashbox Balance Cards (Themed & Enlarged) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {boxes.map((box) => {
          const balance = Number(box.openingBalance) + (totals.get(box.id) ?? 0);
          const isBank = box.kind === "bank";
          const isWallet = box.kind === "wallet";
          const themeClasses = isBank
            ? "bg-blue-50/70 border-blue-200 text-blue-950"
            : isWallet
            ? "bg-purple-50/70 border-purple-200 text-purple-950"
            : "bg-teal-50/70 border-teal-200 text-teal-950";
          const iconClasses = isBank
            ? "bg-blue-100 text-blue-700"
            : isWallet
            ? "bg-purple-100 text-purple-700"
            : "bg-teal-100 text-teal-700";
          const balanceColor = isBank
            ? "text-blue-900"
            : isWallet
            ? "text-purple-900"
            : "text-teal-900";

          return (
            <article className={`p-5 rounded-2xl border ${themeClasses} flex flex-col justify-between`} key={box.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{box.name}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${iconClasses}`}>
                  {isBank ? <Landmark size={18} /> : isWallet ? <Wallet size={18} /> : <Banknote size={18} />}
                </div>
              </div>
              <div>
                <strong className={`text-2xl lg:text-3xl font-black font-mono tracking-tight block ${balanceColor}`}>
                  {balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} <small className="text-xs font-bold opacity-80">ج.م</small>
                </strong>
                <p className="text-xs font-medium opacity-75 mt-1">
                  {box.kind === "cash" ? "صندوق كاشير نقدي" : isBank ? "حساب بنكي معتمد" : "محفظة إلكترونية"} · رصيد فعلي
                </p>
              </div>
              {(canEdit || canDelete) && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-current/10 pt-3">
                  {canEdit && (
                    <details className="group w-full">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-current/20 bg-white/70 px-3 py-2 text-xs font-bold"><Pencil size={13} /> تعديل بيانات الخزنة</summary>
                      <form action={updateCashbox} className="form-grid mt-3 rounded-xl border border-current/15 bg-white/80 p-3">
                        <input type="hidden" name="id" value={box.id} />
                        <label>اسم الخزنة<input name="name" defaultValue={box.name} required minLength={2} maxLength={100} /></label>
                        <label>نوع الخزنة<select name="kind" defaultValue={box.kind}><option value="cash">نقدي</option><option value="bank">حساب بنكي</option><option value="wallet">محفظة إلكترونية</option></select></label>
                        <label className="wide-field">الرصيد الافتتاحي (ج.م)<input name="openingBalance" type="number" min="0" step="0.01" defaultValue={box.openingBalance} required /></label>
                        <button className="primary"><Pencil size={13} /> حفظ التعديلات</button>
                      </form>
                    </details>
                  )}
                  {canDelete && (
                    <form action={deactivateCashbox} className="inline-flex">
                      <input type="hidden" name="id" value={box.id} />
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        <Trash2 size={13} /> حذف الخزنة
                      </button>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* Action Buttons for Finance Operations (Themed & Interactive Transformation) */}
      {canCreate && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Button 1: Add Cashbox / Bank */}
          <details className="group editor" name="finance-action-modal">
            <summary className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center gap-2 border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 group-open:bg-emerald-600 group-open:text-white group-open:border-emerald-700 group-open:ring-2 group-open:ring-emerald-400 group-open:ring-offset-2 active:scale-95 transition-all cursor-pointer select-none">
              <span className="w-5 h-5 rounded-lg bg-emerald-200/80 group-open:bg-emerald-500 text-emerald-800 group-open:text-white flex items-center justify-center transition-colors">
                <Plus size={13} className="transition-transform duration-200 group-open:rotate-45" />
              </span>
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
              <button className="primary w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-0 cursor-pointer active:scale-98 transition-all">
                حفظ الصندوق وتفعيله
              </button>
            </form>
          </details>

          {/* Button 2: Record Income / Expense */}
          <details className="group editor" name="finance-action-modal">
            <summary className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center gap-2 border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 group-open:bg-indigo-600 group-open:text-white group-open:border-indigo-700 group-open:ring-2 group-open:ring-indigo-400 group-open:ring-offset-2 active:scale-95 transition-all cursor-pointer select-none">
              <span className="w-5 h-5 rounded-lg bg-indigo-200/80 group-open:bg-indigo-500 text-indigo-800 group-open:text-white flex items-center justify-center transition-colors">
                <Receipt size={13} className="transition-transform duration-200 group-open:scale-110" />
              </span>
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
              <button className="primary w-full py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white border-0 cursor-pointer active:scale-98 transition-all">
                تسجيل الحركة وترحيلها
              </button>
            </form>
          </details>

          {/* Button 3: Transfer between Cashboxes */}
          <details className="group editor" name="finance-action-modal">
            <summary className="h-10 px-4 rounded-xl font-bold text-xs inline-flex items-center gap-2 border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 group-open:bg-purple-600 group-open:text-white group-open:border-purple-700 group-open:ring-2 group-open:ring-purple-400 group-open:ring-offset-2 active:scale-95 transition-all cursor-pointer select-none">
              <span className="w-5 h-5 rounded-lg bg-purple-200/80 group-open:bg-purple-500 text-purple-800 group-open:text-white flex items-center justify-center transition-colors">
                <ArrowLeftRight size={13} className="transition-transform duration-300 group-open:rotate-180" />
              </span>
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
              <button className="primary w-full py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white border-0 cursor-pointer active:scale-98 transition-all">
                تنفيذ التحويل المالي
              </button>
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
          <span className="date-pill">إجمالي السيولة: {grandTotalCash.toLocaleString("en-US")} ج.م</span>
        </div>

        <div className="desktop-table-only table-wrap">
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
                        {new Date(tx.createdAt).toLocaleString("en-US")}
                      </td>
                      <td className="font-bold text-[var(--ink)]">
                        {allBoxes.find((box) => box.id === tx.cashboxId)?.name ?? "خزنة محذوفة"}
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
                        {isPositive ? "+" : "−"} {Number(tx.amount).toLocaleString("en-US")} ج.م
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

        {/* Mobile Cash Transactions Cards */}
        <div className="mobile-cards-only space-y-2.5">
          {txs.length ? (
            txs.map((tx) => {
              const isPositive = ["income", "transfer_in", "invoice_payment", "party_payment"].includes(tx.kind);
              const boxName = allBoxes.find((box) => box.id === tx.cashboxId)?.name ?? "خزنة محذوفة";
              return (
                <div key={`mob-tx-${tx.id}`} className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className="text-xs font-bold text-[var(--ink)] block">{boxName}</b>
                      <span className="text-[11px] text-[var(--muted)] font-mono">
                        {new Date(tx.createdAt).toLocaleString("en-US")}
                      </span>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
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
                  </div>

                  <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                    <span className="text-xs text-[var(--muted)] font-semibold truncate max-w-[60%]">
                      {tx.category ? `${tx.category} · ` : ""}{tx.notes ?? "بدون ملاحظات"}
                    </span>
                    <b className={`text-sm font-black font-mono shrink-0 ${isPositive ? "text-emerald-700" : "text-rose-600"}`}>
                      {isPositive ? "+" : "−"} {Number(tx.amount).toLocaleString("en-US")} ج.م
                    </b>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-sm text-[var(--muted)] bg-[var(--panel)] border border-[var(--line)] rounded-xl">
              لا توجد حركات مسجلة.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
