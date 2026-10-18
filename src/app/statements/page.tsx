import Link from "next/link";
import { asc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Filter } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { parties, partyLedger } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ partyId?: string; from?: string; to?: string }>;
}) {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("parties", "view");

  const query = await searchParams;
  const accounts = await db
    .select({
      id: parties.id,
      name: parties.name,
      type: parties.type,
      openingBalance: parties.openingBalance,
    })
    .from(parties)
    .where(isNull(parties.deletedAt))
    .orderBy(parties.type, parties.name)
    .limit(1000);

  const party = query.partyId ? accounts.find((account) => account.id === query.partyId) : undefined;
  const entries = party
    ? await db
        .select()
        .from(partyLedger)
        .where(eq(partyLedger.partyId, party.id))
        .orderBy(asc(partyLedger.createdAt), asc(partyLedger.id))
    : [];

  const hasOpening = entries.some((entry) => entry.kind === "opening");
  const ledger =
    party && !hasOpening
      ? [
          {
            id: "opening",
            partyId: party.id,
            invoiceId: null,
            kind: "opening",
            debit: party.type === "customer" ? party.openingBalance : "0",
            credit: party.type === "supplier" ? party.openingBalance : "0",
            notes: "رصيد افتتاحي",
            createdAt: new Date(0),
          },
          ...entries,
        ]
      : entries;

  const computed = ledger.reduce<{ balance: number; rows: ((typeof ledger)[number] & { balance: number })[] }>(
    (state, entry) => {
      const balance =
        state.balance +
        (party?.type === "customer"
          ? Number(entry.debit) - Number(entry.credit)
          : Number(entry.credit) - Number(entry.debit));
      return { balance, rows: [...state.rows, { ...entry, balance }] };
    },
    { balance: 0, rows: [] }
  );

  const rows = computed.rows.filter(
    (entry) =>
      entry.id === "opening" ||
      ((!query.from || entry.createdAt >= new Date(`${query.from}T00:00:00`)) &&
        (!query.to || entry.createdAt <= new Date(`${query.to}T23:59:59.999`)))
  );

  const balance = rows.at(-1)?.balance ?? 0;

  return (
    <main className="main standalone">
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">المحاسبة والتقارير المالية</p>
          <h1>كشوف حسابات العملاء والموردين</h1>
        </div>
        <div className="top-actions">
          {party && <PrintButton label="طباعة الكشف المحدد" />}
          <Link className="secondary" href="/parties">
            <ArrowRight size={15} />
            <span>العملاء والموردون</span>
          </Link>
        </div>
      </header>

      {/* Account Selection and Filter Bar */}
      <section className="panel print-hide">
        <div className="panel-title mb-3">
          <div>
            <h3>تحديد الحساب والفترة</h3>
            <p>اختر العميل أو المورد لعرض دفتر الحركات التفصيلي مع الرصيد الجاري</p>
          </div>
        </div>

        <form className="date-filter mb-0" method="get">
          <label className="min-w-[260px]">
            <span>اختيار الحساب *</span>
            <select name="partyId" defaultValue={party?.id ?? ""} required>
              <option value="" disabled>
                -- اختر عميلًا أو موردًا من الدليل --
              </option>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.type === "customer" ? "عميل" : "مورد"} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>من تاريخ</span>
            <input type="date" name="from" defaultValue={query.from ?? new Date().toISOString().slice(0, 10)} />
          </label>
          <label>
            <span>إلى تاريخ</span>
            <input type="date" name="to" defaultValue={query.to ?? new Date().toISOString().slice(0, 10)} />
          </label>
          <button className="primary flex items-center gap-1.5 h-[36px]">
            <Filter size={14} />
            <span>استعراض الكشف</span>
          </button>
        </form>
      </section>

      {/* Statement Document */}
      <section className="panel statement-paper">
        <div className="paper-header">
          <div>
            <h2>{party ? `كشف حساب: ${party.name}` : "كشف الحساب المالي"}</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              {party
                ? party.type === "customer"
                  ? "سجل حساب عميل — مبيعات ومسحوبات"
                  : "سجل حساب مورد — توريدات ومستحقات"
                : "يرجى اختيار حساب من القائمة أعلاه"}
            </p>
          </div>
          {party && (
            <div className="text-left">
              <span className="text-xs text-[var(--muted)] block mb-1">الرصيد الختامي</span>
              <strong className={`text-xl font-extrabold ${balance > 0 ? "text-indigo-700" : balance < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {balance.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م
              </strong>
            </div>
          )}
        </div>

        {party ? (
          <div className="table-wrap my-4">
            <table>
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>البيان والتفاصيل</th>
                  <th className="text-center">مدين (+)</th>
                  <th className="text-center">دائن (−)</th>
                  <th className="text-center">الرصيد الجاري</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-xs text-[var(--muted)]">
                      {entry.createdAt.getTime() === 0
                        ? "رصيد افتتاحي سابق"
                        : new Date(entry.createdAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="font-semibold text-[var(--ink)]">
                      {entry.notes ??
                        (entry.kind === "sale"
                          ? "فاتورة بيع"
                          : entry.kind === "purchase"
                          ? "فاتورة شراء"
                          : entry.kind === "payment"
                          ? "سند دفعة"
                          : "حركة")}
                    </td>
                    <td className="text-center font-semibold">
                      {Number(entry.debit) > 0 ? `${Number(entry.debit).toFixed(2)} ج.م` : "—"}
                    </td>
                    <td className="text-center font-semibold">
                      {Number(entry.credit) > 0 ? `${Number(entry.credit).toFixed(2)} ج.م` : "—"}
                    </td>
                    <td className="text-center font-bold text-[var(--ink)]">
                      {entry.balance.toFixed(2)} ج.م
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      لا توجد حركات مالية مسجلة لهذا الحساب خلال الفترة المحددة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state py-12">
            <div className="empty-icon">
              <BookOpen size={20} />
            </div>
            <b>اختر عميلًا أو موردًا من القائمة أعلاه</b>
            <p className="text-xs text-[var(--muted)] mt-1">
              سيظهر لك كشف الحساب التراكمي مفصلًا بالحركات، مع إمكانية طباعة تقرير رسمي فوري.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
