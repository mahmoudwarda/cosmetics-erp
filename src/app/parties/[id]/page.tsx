import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Filter } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { invoices, parties, partyLedger } from "@/server/db/schema";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/server/permissions";

export default async function PartyStatement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("parties", "view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [party] = await db.select().from(parties).where(eq(parties.id, id)).limit(1);
  if (!party) notFound();

  const [ledgerEntries, linkedInvoices] = await Promise.all([
    db.select().from(partyLedger).where(eq(partyLedger.partyId, id)).orderBy(asc(partyLedger.createdAt)),
    db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(eq(invoices.partyId, id)),
  ]);

  const hasOpening = ledgerEntries.some((entry) => entry.kind === "opening");
  const allEntries = (
    !hasOpening && Number(party.openingBalance) > 0
      ? [
          {
            id: "opening",
            partyId: id,
            invoiceId: null,
            kind: "opening",
            debit: party.type === "customer" ? party.openingBalance : "0",
            credit: party.type === "supplier" ? party.openingBalance : "0",
            notes: "رصيد افتتاحي",
            createdAt: party.createdAt,
          },
          ...ledgerEntries,
        ]
      : ledgerEntries
  ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const invoiceNumbers = new Map(linkedInvoices.map((item) => [item.id, item.number]));
  const filtered = allEntries.filter(
    (entry) =>
      (!query.from || entry.createdAt >= new Date(`${query.from}T00:00:00`)) &&
      (!query.to || entry.createdAt <= new Date(`${query.to}T23:59:59`))
  );

  const rows = filtered.map((entry) => {
    const debit = Number(entry.debit);
    const credit = Number(entry.credit);
    const balance = allEntries
      .slice(0, allEntries.indexOf(entry) + 1)
      .reduce(
        (total, item) =>
          total +
          (party.type === "customer"
            ? Number(item.debit) - Number(item.credit)
            : Number(item.credit) - Number(item.debit)),
        0
      );
    return { ...entry, debit, credit, balance };
  });

  const finalBalance = rows.at(-1)?.balance ?? 0;

  return (
    <main className="main standalone">
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">كشف حساب {party.type === "customer" ? "عميل" : "مورد"}</p>
          <h1>{party.name}</h1>
        </div>
        <div className="top-actions">
          <PrintButton label="طباعة كشف الحساب" />
          <Link className="secondary" href="/parties">
            <ArrowRight size={15} />
            <span>رجوع للأطراف</span>
          </Link>
        </div>
      </header>

      {/* Printable Statement Sheet */}
      <section className="panel statement-paper">
        <div className="paper-header">
          <div>
            <h2>كشف حساب تفصيلي: {party.name}</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              {party.type === "customer" ? "حساب عميل (مبيعات)" : "حساب مورد (مشتريات وتوريد)"}
              {party.phone && ` · الهاتف: ${party.phone}`}
              {party.email && ` · البريد: ${party.email}`}
            </p>
          </div>
          <div className="text-left">
            <span className="text-xs text-[var(--muted)] block mb-1">الرصيد الصافي الحالي</span>
            <span className={`text-xl font-extrabold ${finalBalance > 0 ? "text-indigo-700" : finalBalance < 0 ? "text-rose-600" : "text-emerald-700"}`}>
              {finalBalance.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م
            </span>
          </div>
        </div>

        {/* Date Filter Bar */}
        <form className="date-filter print-hide" method="get">
          <label>
            <span>من تاريخ</span>
            <input type="date" name="from" defaultValue={query.from} />
          </label>
          <label>
            <span>إلى تاريخ</span>
            <input type="date" name="to" defaultValue={query.to} />
          </label>
          <button className="secondary flex items-center gap-1.5 h-[36px]">
            <Filter size={13} />
            <span>تصفية الفترة</span>
          </button>
        </form>

        {/* Ledger Entries Table */}
        <div className="table-wrap my-4">
          <table>
            <thead>
              <tr>
                <th>التاريخ والوقت</th>
                <th>البيان والتفاصيل</th>
                <th>رقم الفاتورة المرتبطة</th>
                <th className="text-center">مدين (+)</th>
                <th className="text-center">دائن (−)</th>
                <th className="text-center">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-xs text-[var(--muted)]">
                      {new Date(entry.createdAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="font-semibold text-[var(--ink)]">
                      {entry.notes ??
                        (entry.kind === "sale"
                          ? "فاتورة بيع"
                          : entry.kind === "purchase"
                          ? "فاتورة شراء"
                          : entry.kind === "payment"
                          ? "دفعة مالية"
                          : "حركة حساب")}
                    </td>
                    <td className="font-mono text-xs">
                      {entry.invoiceId ? (
                        <Link href={`/invoices/${entry.invoiceId}`} className="text-link">
                          {invoiceNumbers.get(entry.invoiceId) ?? entry.invoiceId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-center font-semibold">
                      {entry.debit > 0 ? `${entry.debit.toFixed(2)} ج.م` : "—"}
                    </td>
                    <td className="text-center font-semibold">
                      {entry.credit > 0 ? `${entry.credit.toFixed(2)} ج.م` : "—"}
                    </td>
                    <td className="text-center font-bold text-[var(--ink)]">
                      {entry.balance.toFixed(2)} ج.م
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    لا توجد حركات مالية مسجلة في الفترة المحددة لهذا الحساب.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[var(--muted)] mt-4 pt-3 border-t border-[var(--line)]">
          * ملاحظة محاسبية: الرصيد الموجب يمثل مديونية مستحقة للتحصيل من العميل، أو مستحقات للمورد واجبة السداد.
        </p>
      </section>
    </main>
  );
}
