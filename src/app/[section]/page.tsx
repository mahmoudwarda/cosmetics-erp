import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashTransactions, cashboxes, invoices, parties, settings } from "@/server/db/schema";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">لمسة جمال</p>
          <h1>{title}</h1>
        </div>
        <Link className="secondary" href="/">
          <ArrowRight size={15} />
          <span>العودة للوحة التحكم</span>
        </Link>
      </header>
      {children}
    </main>
  );
}

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  if (!(await getSessionUserId())) redirect("/login");
  const { section } = await params;

  if (section === "invoices") {
    const rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(100);
    return (
      <Shell title="الفواتير">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>سجل الفواتير</h3>
              <p>أحدث ١٠٠ عملية مسجلة</p>
            </div>
            <span className="date-pill">{rows.length} فاتورة</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>النوع</th>
                  <th>التاريخ</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((x) => (
                    <tr key={x.id}>
                      <td className="font-bold">{x.number}</td>
                      <td>{x.type}</td>
                      <td>{new Date(x.createdAt).toLocaleDateString("ar-EG")}</td>
                      <td className="font-bold">{Number(x.total).toLocaleString("ar-EG")} ج.م</td>
                      <td className="font-semibold text-emerald-600">{Number(x.paid).toLocaleString("ar-EG")} ج.م</td>
                      <td>
                        <span className={`status ${x.status}`}>{x.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      لا توجد فواتير مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Shell>
    );
  }

  if (section === "parties") {
    const rows = await db.select().from(parties).orderBy(desc(parties.createdAt)).limit(100);
    return (
      <Shell title="العملاء والموردون">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>دليل الحسابات</h3>
              <p>العملاء والموردون المسجلون</p>
            </div>
            <span className="date-pill">{rows.length} حساب</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الصفة</th>
                  <th>الهاتف</th>
                  <th>البريد</th>
                  <th>رصيد أول المدة</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((x) => (
                    <tr key={x.id}>
                      <td className="font-bold">{x.name}</td>
                      <td>{x.type === "customer" ? "عميل" : "مورد"}</td>
                      <td className="font-mono text-xs">{x.phone || "—"}</td>
                      <td className="text-xs">{x.email || "—"}</td>
                      <td className="font-bold">{Number(x.openingBalance).toLocaleString("ar-EG")} ج.م</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      لا توجد حسابات مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Shell>
    );
  }

  if (section === "finance") {
    const boxes = await db.select().from(cashboxes).where(eq(cashboxes.active, true));
    const txs = await db.select().from(cashTransactions).orderBy(desc(cashTransactions.createdAt)).limit(100);
    const total =
      boxes.reduce((sum, b) => sum + Number(b.openingBalance), 0) +
      txs.reduce(
        (sum, t) =>
          sum +
          (["income", "transfer_in", "invoice_payment", "party_payment"].includes(t.kind)
            ? Number(t.amount)
            : -Number(t.amount)),
        0
      );

    return (
      <Shell title="المالية">
        <section className="kpis">
          <article className="kpi">
            <div className="kpi-head">
              <span>إجمالي السيولة النقدية</span>
            </div>
            <strong>
              {total.toLocaleString("ar-EG")} <small>ج.م</small>
            </strong>
          </article>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>الصناديق والحركات الأخيرة</h3>
              <p>الرصيد الافتتاحي مضاف إليه حركات الدفتر</p>
            </div>
          </div>
          <div className="table-wrap mb-4">
            <table>
              <thead>
                <tr>
                  <th>الصندوق</th>
                  <th>النوع</th>
                  <th>الرصيد الافتتاحي</th>
                </tr>
              </thead>
              <tbody>
                {boxes.length ? (
                  boxes.map((x) => (
                    <tr key={x.id}>
                      <td className="font-bold">{x.name}</td>
                      <td>{x.kind}</td>
                      <td className="font-bold">{Number(x.openingBalance).toLocaleString("ar-EG")} ج.م</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      لا توجد صناديق نقدية مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {txs.length ? (
                  txs.map((x) => (
                    <tr key={x.id}>
                      <td className="text-xs">{new Date(x.createdAt).toLocaleString("ar-EG")}</td>
                      <td>{x.kind}</td>
                      <td className="font-bold">{Number(x.amount).toLocaleString("ar-EG")} ج.م</td>
                      <td className="text-xs">{x.notes || x.category || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      لا توجد حركات نقدية مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </Shell>
    );
  }

  if (section === "settings") {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    return (
      <Shell title="الإعدادات">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>إعدادات المؤسسة</h3>
            </div>
          </div>
          {row ? (
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <th>اسم المؤسسة</th>
                    <td className="font-bold">{row.organizationName}</td>
                  </tr>
                  <tr>
                    <th>اللغة</th>
                    <td>{row.locale === "ar" ? "العربية" : "English"}</td>
                  </tr>
                  <tr>
                    <th>العملة</th>
                    <td className="font-mono">{row.currency}</td>
                  </tr>
                  <tr>
                    <th>نسبة الضريبة</th>
                    <td>{row.taxRate}%</td>
                  </tr>
                  <tr>
                    <th>نص تذييل الفاتورة</th>
                    <td>{row.invoiceFooter || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">لا توجد إعدادات محفوظة.</p>
          )}
        </section>
      </Shell>
    );
  }

  redirect("/");
}
