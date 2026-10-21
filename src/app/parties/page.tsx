import Link from "next/link";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenText, Building2, UserPlus, Users } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashboxes, parties, partyLedger, permissions, settings, users } from "@/server/db/schema";
import { deleteParty, saveParty } from "@/features/parties/actions";
import { registerPartyPayment } from "@/features/finance/actions";
import { requirePermission } from "@/server/permissions";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";
import { PartiesTabsView } from "@/features/parties/parties-tabs-view";
import { translate, Locale } from "@/lib/i18n";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: "all" | "customers" | "suppliers" | "debtors" | "statement";
    partyId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("parties", "view");

  const query = await searchParams;
  const todayStr = new Date().toISOString().slice(0, 10);

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

  const can = (action: string) => grants.some((grant) => grant.action === action);

  const [rows, boxes, ledgerRows, [settingsRow]] = await Promise.all([
    db
      .select()
      .from(parties)
      .where(isNull(parties.deletedAt))
      .orderBy(desc(parties.createdAt))
      .limit(300),
    db.select().from(cashboxes).where(eq(cashboxes.active, true)),
    db
      .select({
        partyId: partyLedger.partyId,
        type: parties.type,
        openingBalance: parties.openingBalance,
        kind: partyLedger.kind,
        debit: partyLedger.debit,
        credit: partyLedger.credit,
      })
      .from(partyLedger)
      .innerJoin(parties, eq(parties.id, partyLedger.partyId)),
    db.select().from(settings).limit(1),
  ]);

  const balanceByParty = new Map<string, { balance: number; hasOpeningEntry: boolean; openingBalance: number }>();
  for (const entry of ledgerRows) {
    const account = balanceByParty.get(entry.partyId) ?? {
      balance: 0,
      hasOpeningEntry: false,
      openingBalance: Number(entry.openingBalance),
    };
    account.balance +=
      entry.type === "customer"
        ? Number(entry.debit) - Number(entry.credit)
        : Number(entry.credit) - Number(entry.debit);
    account.hasOpeningEntry ||= entry.kind === "opening";
    balanceByParty.set(entry.partyId, account);
  }

  const balances: Record<string, number> = {};
  for (const party of rows) {
    const account = balanceByParty.get(party.id);
    let finalBal = Number(party.openingBalance);
    if (account) {
      if (!account.hasOpeningEntry) {
        account.balance += Number(party.openingBalance);
      }
      finalBal = account.balance;
    }
    balances[party.id] = finalBal;
  }

  // Handle Statement Query if partyId is provided or tab is statement
  const selectedParty = query.partyId ? rows.find((p) => p.id === query.partyId) : undefined;
  type StatementEntry = typeof partyLedger.$inferSelect | {
    id: string;
    partyId: string;
    invoiceId: string | null;
    kind: string;
    debit: string;
    credit: string;
    notes: string | null;
    createdAt: Date;
  };
  let statementEntries: (StatementEntry & { balance: number })[] = [];

  if (selectedParty) {
    const rawEntries = await db
      .select()
      .from(partyLedger)
      .where(eq(partyLedger.partyId, selectedParty.id))
      .orderBy(asc(partyLedger.createdAt), asc(partyLedger.id));

    const hasOpening = rawEntries.some((entry) => entry.kind === "opening");
    const ledger = !hasOpening
      ? [
          {
            id: "opening",
            partyId: selectedParty.id,
            invoiceId: null,
            kind: "opening",
            debit: selectedParty.type === "customer" ? selectedParty.openingBalance : "0",
            credit: selectedParty.type === "supplier" ? selectedParty.openingBalance : "0",
            notes: "رصيد افتتاحي أول المدة",
            createdAt: new Date(0),
          },
          ...rawEntries,
        ]
      : rawEntries;

    const computed = ledger.reduce<{ balance: number; rows: (StatementEntry & { balance: number })[] }>(
      (state, entry) => {
        const balance =
          state.balance +
          (selectedParty.type === "customer"
            ? Number(entry.debit) - Number(entry.credit)
            : Number(entry.credit) - Number(entry.debit));
        return { balance, rows: [...state.rows, { ...entry, balance }] };
      },
      { balance: 0, rows: [] }
    );

    statementEntries = computed.rows.filter(
      (entry) =>
        entry.id === "opening" ||
        ((!query.from || entry.createdAt >= new Date(`${query.from}T00:00:00`)) &&
          (!query.to || entry.createdAt <= new Date(`${query.to}T23:59:59.999`)))
    );
  }

  const customers = rows.filter((p) => p.type === "customer");
  const suppliers = rows.filter((p) => p.type === "supplier");

  const locale = (settingsRow?.locale === "en" ? "en" : "ar") as Locale;

  return (
    <main className="main standalone">
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">{translate("parties.subtitle", locale, "دليل الحسابات والتعاملات المالية")}</p>
          <h1>{translate("parties.title", locale, "العملاء والموردون وكشوف الحسابات")}</h1>
        </div>
        <div className="top-actions">
          {can("create") && (
            <details className="editor">
              <summary className="primary">
                <UserPlus size={15} />
                <span>{translate("parties.newParty", locale, "إضافة عميل أو مورد جديد")}</span>
              </summary>
              <form action={saveParty} className="form-grid">
                <CloseDisclosureButton title={translate("parties.newParty", locale, "إضافة حساب عميل أو مورد جديد")} />
                <label>
                  {translate("parties.type", locale, "نوع الحساب")}
                  <select name="type">
                    <option value="customer">{translate("parties.customer", locale, "عميل")}</option>
                    <option value="supplier">{translate("parties.supplier", locale, "مورد")}</option>
                  </select>
                </label>
                <label>
                  {locale === "en" ? "Full Name / Organization" : "اسم العميل أو اسم المؤسسة الموردة"}
                  <input name="name" required minLength={2} placeholder={locale === "en" ? "e.g. Hope Pharmacy" : "مثال: صيدلية الأمل"} />
                </label>
                <label>
                  {translate("parties.phone", locale, "رقم الهاتف")}
                  <input name="phone" placeholder="01xxxxxxxxx" />
                </label>
                <label>
                  {translate("parties.email", locale, "البريد الإلكتروني")}
                  <input name="email" type="email" placeholder="example@domain.com" />
                </label>
                <label>
                  {translate("parties.address", locale, "العنوان أو المقر")}
                  <input name="address" placeholder={locale === "en" ? "City, District, Street" : "المدينة، الحي، الشارع"} />
                </label>
                <label>
                  {translate("parties.openingBalance", locale, "الرصيد الافتتاحي (ج.م)")}
                  <input name="openingBalance" type="number" step="1" defaultValue="0" />
                </label>
                <div className="form-actions">
                  <button className="primary" type="submit">
                    {translate("parties.saveParty", locale, "حفظ الحساب في الدليل")}
                  </button>
                </div>
              </form>
            </details>
          )}

          <Link className="secondary" href="/">
            <ArrowRight size={15} />
            <span>{translate("common.home", locale, "الرئيسية")}</span>
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 print-hide">
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-[var(--muted)] font-bold block mb-1">
              {locale === "en" ? "Registered Customers" : "العملاء المسجلون"}
            </span>
            <b className="text-2xl text-[var(--ink)] font-black">
              {customers.length} {locale === "en" ? "Customers" : "عميل"}
            </b>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
            <Users size={18} />
          </div>
        </div>
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-[var(--muted)] font-bold block mb-1">
              {locale === "en" ? "Suppliers & Vendors" : "الموردون وشركات التوريد"}
            </span>
            <b className="text-2xl text-[var(--ink)] font-black">
              {suppliers.length} {locale === "en" ? "Suppliers" : "مورد"}
            </b>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
            <Building2 size={18} />
          </div>
        </div>
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-[var(--muted)] font-bold block mb-1">
              {locale === "en" ? "Total Accounts" : "إجمالي الحسابات المسجلة"}
            </span>
            <b className="text-2xl text-[var(--ink)] font-black">
              {rows.length} {locale === "en" ? "Accounts" : "حساب"}
            </b>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <BookOpenText size={18} />
          </div>
        </div>
      </div>

      {/* Main Panel with Tabs (Customers, Suppliers, Statement) & Search */}
      <section className="panel">
        <div className="panel-title mb-4 print-hide">
          <div>
            <h3>{locale === "en" ? "Accounts & Balances Directory" : "دليل الحسابات والأرصدة"}</h3>
            <p>
              {locale === "en"
                ? "Search by name or phone, track liabilities, view instant account statements, and record cash receipts"
                : "البحث بالاسم أو الهاتف، متابعة المديونيات، استعراض كشف الحساب الفوري، وتسجيل السندات"}
            </p>
          </div>
          <span className="date-pill">
            {rows.length} {locale === "en" ? "Accounts" : "حساب"}
          </span>
        </div>

        <PartiesTabsView
          key={`${query.tab ?? (selectedParty ? "statement" : "all")}:${selectedParty?.id ?? ""}`}
          parties={rows}
          cashboxes={boxes}
          balances={balances}
          can={{ create: can("create"), edit: can("edit"), delete: can("delete") }}
          selectedParty={selectedParty}
          statementEntries={statementEntries}
          initialTab={query.tab ?? (selectedParty ? "statement" : "all")}
          savePartyAction={saveParty}
          deletePartyAction={deleteParty}
          registerPaymentAction={registerPartyPayment}
          todayStr={todayStr}
          currentFrom={query.from ?? ""}
          currentTo={query.to ?? ""}
          organization={{
            name: settingsRow?.organizationName ?? "متجر الجمال",
            logo: settingsRow?.logoPath,
          }}
        />
      </section>
    </main>
  );
}
