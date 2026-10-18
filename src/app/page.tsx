import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull, lte, gte, sql, desc } from "drizzle-orm";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FilePlus,
  FileText,
  Landmark,
  TrendingDown,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ExternalLink,
  Coins,
  ReceiptText,
  Clock,
  Package,
  Store,
} from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  cashboxes,
  cashTransactions,
  invoiceLines,
  invoices,
  parties,
  partyLedger,
  permissions,
  products,
  settings,
  users,
} from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { cashboxBalance } from "@/server/services/ledger-math";
import { localLogoUrl } from "@/server/services/branding";
import { translate, Locale } from "@/lib/i18n";

export default async function Home() {
  const uid = await getSessionUserId();
  if (!uid) redirect("/login");
  await requirePermission("reports", "view");

  const [user] = await db
    .select({ name: users.name, roleId: users.roleId })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);

  const grants = user
    ? await db
        .select({ module: permissions.module })
        .from(permissions)
        .where(and(eq(permissions.roleId, user.roleId), eq(permissions.action, "view")))
    : [];

  if (!grants.some((grant) => grant.module === "reports")) {
    const routeByModule = {
      inventory: "/inventory",
      invoices: "/invoices",
      parties: "/parties",
      finance: "/finance",
      users: "/users",
      settings: "/settings",
    } as const;
    const first = grants.map((grant) => routeByModule[grant.module as keyof typeof routeByModule]).find(Boolean);
    if (first) redirect(first);
    redirect("/login?error=permissions");
  }

  const [organization] = await db
    .select({ name: settings.organizationName, logo: settings.logoPath, locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  const organizationName = organization?.name ?? (organization?.locale === "en" ? "Beauty Touch" : "لمسة جمال");
  const locale = (organization?.locale ?? "ar") as Locale;
  const localeCode = locale === "en" ? "en-US" : "ar-EG";

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  let lowCount = 0;
  let totalCashBalance = 0;
  let todaySalesTotal = 0;
  let todaySalesPaid = 0;
  let todaySalesCount = 0;
  let todayPurchasesTotal = 0;
  let todayPurchasesCount = 0;
  let todayProfitTotal = 0;
  let inventoryCostValuation = 0;
  let inventorySaleValuation = 0;
  let totalProductsCount = 0;
  let totalStockUnits = 0;
  let customerReceivablesTotal = 0;
  let supplierPayablesTotal = 0;

  let recentInvoices: {
    id: string;
    number: string;
    type: "sale" | "purchase" | "sale_return" | "purchase_return";
    total: string;
    paid: string;
    status: string;
    createdAt: Date;
    partyName: string | null;
  }[] = [];
  let lowStockProducts: { id: string; name: string; sku: string; stock: string; reorderLevel: string }[] = [];
  let activeBoxesWithBalance: { id: string; name: string; kind: string; balance: number }[] = [];

  try {
    const [
      lowRows,
      cashRows,
      cashTxRows,
      todaySalesRows,
      todayPurchasesRows,
      todayProfitRows,
      inventoryValuationRows,
      latestInvoices,
      lowItems,
      ledgerEntries,
    ] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)` })
        .from(products)
        .where(and(eq(products.active, true), isNull(products.deletedAt), lte(products.stock, products.reorderLevel))),
      db
        .select({ id: cashboxes.id, name: cashboxes.name, kind: cashboxes.kind, openingBalance: cashboxes.openingBalance })
        .from(cashboxes)
        .where(eq(cashboxes.active, true)),
      db
        .select({ cashboxId: cashTransactions.cashboxId, kind: cashTransactions.kind, amount: cashTransactions.amount })
        .from(cashTransactions),
      db
        .select({
          total: sql<string>`coalesce(sum(${invoices.total}),0)`,
          paid: sql<string>`coalesce(sum(${invoices.paid}),0)`,
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(and(eq(invoices.type, "sale"), gte(invoices.createdAt, todayStart))),
      db
        .select({
          total: sql<string>`coalesce(sum(${invoices.total}),0)`,
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(and(eq(invoices.type, "purchase"), gte(invoices.createdAt, todayStart))),
      db
        .select({
          profit: sql<string>`coalesce(sum(${invoiceLines.lineTotal} - (${invoiceLines.quantity} * ${invoiceLines.costPrice})), 0)`,
        })
        .from(invoiceLines)
        .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
        .where(and(eq(invoices.type, "sale"), gte(invoices.createdAt, todayStart))),
      db
        .select({
          costValuation: sql<string>`coalesce(sum(${products.stock} * ${products.costPrice}), 0)`,
          saleValuation: sql<string>`coalesce(sum(${products.stock} * ${products.salePrice}), 0)`,
          productsCount: sql<number>`count(*)`,
          totalUnits: sql<string>`coalesce(sum(${products.stock}), 0)`,
        })
        .from(products)
        .where(and(eq(products.active, true), isNull(products.deletedAt))),
      db
        .select({
          id: invoices.id,
          number: invoices.number,
          type: invoices.type,
          total: invoices.total,
          paid: invoices.paid,
          status: invoices.status,
          createdAt: invoices.createdAt,
          partyName: parties.name,
        })
        .from(invoices)
        .leftJoin(parties, eq(invoices.partyId, parties.id))
        .orderBy(desc(invoices.createdAt))
        .limit(8),
      db
        .select({ id: products.id, name: products.name, sku: products.sku, stock: products.stock, reorderLevel: products.reorderLevel })
        .from(products)
        .where(and(eq(products.active, true), isNull(products.deletedAt), lte(products.stock, products.reorderLevel)))
        .limit(5),
      db
        .select({
          partyId: partyLedger.partyId,
          partyType: parties.type,
          openingBalance: parties.openingBalance,
          debit: partyLedger.debit,
          credit: partyLedger.credit,
          kind: partyLedger.kind,
        })
        .from(partyLedger)
        .innerJoin(parties, eq(parties.id, partyLedger.partyId))
        .where(isNull(parties.deletedAt)),
    ]);

    lowCount = Number(lowRows[0]?.n ?? 0);
    todaySalesTotal = Number(todaySalesRows[0]?.total ?? 0);
    todaySalesPaid = Number(todaySalesRows[0]?.paid ?? 0);
    todaySalesCount = Number(todaySalesRows[0]?.count ?? 0);
    todayPurchasesTotal = Number(todayPurchasesRows[0]?.total ?? 0);
    todayPurchasesCount = Number(todayPurchasesRows[0]?.count ?? 0);
    todayProfitTotal = Math.max(0, Number(todayProfitRows[0]?.profit ?? 0));

    inventoryCostValuation = Number(inventoryValuationRows[0]?.costValuation ?? 0);
    inventorySaleValuation = Number(inventoryValuationRows[0]?.saleValuation ?? 0);
    totalProductsCount = Number(inventoryValuationRows[0]?.productsCount ?? 0);
    totalStockUnits = Number(inventoryValuationRows[0]?.totalUnits ?? 0);

    // Calculate individual cashbox live balances
    const txByBox = new Map<string, { kind: string; amount: string }[]>();
    for (const tx of cashTxRows) {
      const list = txByBox.get(tx.cashboxId) ?? [];
      list.push(tx);
      txByBox.set(tx.cashboxId, list);
    }

    activeBoxesWithBalance = cashRows.map((box) => {
      const boxTxs = txByBox.get(box.id) ?? [];
      const balance = cashboxBalance(box.openingBalance, boxTxs);
      totalCashBalance += balance;
      return { id: box.id, name: box.name, kind: box.kind, balance };
    });

    // Calculate Customer Receivables & Supplier Payables
    const partyBalMap = new Map<string, { balance: number; type: string }>();
    for (const row of ledgerEntries) {
      const p = partyBalMap.get(row.partyId) ?? { balance: 0, type: row.partyType };
      p.balance +=
        row.partyType === "customer"
          ? Number(row.debit) - Number(row.credit)
          : Number(row.credit) - Number(row.debit);
      partyBalMap.set(row.partyId, p);
    }
    for (const p of partyBalMap.values()) {
      if (p.type === "customer" && p.balance > 0) customerReceivablesTotal += p.balance;
      if (p.type === "supplier" && p.balance > 0) supplierPayablesTotal += p.balance;
    }

    recentInvoices = latestInvoices;
    lowStockProducts = lowItems;
  } catch {
    /* database safety fallback */
  }

  const todayFormatted = new Intl.DateTimeFormat(localeCode, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const todayMarginRate = todaySalesTotal > 0 ? Math.round((todayProfitTotal / todaySalesTotal) * 100) : 0;

  const totalAssetsAtCost = totalCashBalance + inventoryCostValuation + customerReceivablesTotal;
  const totalLiabilities = supplierPayablesTotal;
  const netLiquidationAtCost = totalAssetsAtCost - totalLiabilities;
  const netLiquidationAtRetail = totalCashBalance + inventorySaleValuation + customerReceivablesTotal - totalLiabilities;
  const logoUrl = localLogoUrl(organization?.logo);

  return (
    <main className="main dashboard-main">
      {/* Header Bar with Store Logo */}
      <header className="topbar">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={organizationName}
              className="w-12 h-12 rounded-xl object-contain border border-[var(--line)] bg-[var(--panel)] p-1 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs shrink-0 font-bold">
              <Store size={22} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-black text-[var(--ink)]">{organizationName}</h1>
            <p className="eyebrow">{todayFormatted} · {translate("dash.subtitle", locale, "لوحة العمليات والنبض المالي الشامل للنشاط")}</p>
          </div>
        </div>
        <div className="top-actions">
          <Link href="/invoices/new" className="primary">
            <FilePlus size={16} />
            <span>{translate("dash.newInvoiceShortcut", locale, "فاتورة جديدة (F2)")}</span>
          </Link>
          <div className="date-pill">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{translate("dash.liveSystem", locale, "نظام مباشر")}</span>
          </div>
        </div>
      </header>

      {/* Executive Net Liquidation Value & Total Capital Worth Banner */}
      <section className="mb-5 p-5 md:p-6 bg-gradient-to-br from-[var(--panel)] to-[var(--bg)] border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {translate("dash.liquidationIndex", locale, "مؤشر التصفية الشامل للنشاط")}
              </span>
              <span className="text-xs text-[var(--muted)] font-semibold">
                {translate("dash.liquidationSubtitle", locale, "حساب صافي رأس المال المسترد في حال تصفية أو إغلاق المشروع اليوم")}
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black text-[var(--ink)]">
              {translate("dash.liquidationTitle", locale, "صافي قيمة تصفية المشروع الحالية (حقوق الملكية)")}
            </h2>
            <p className="text-xs text-[var(--muted)] max-w-2xl leading-relaxed">
              {translate("dash.liquidationExplanation", locale, "يمثل هذا الرقم ما سيؤول إليك كمالك في اللحظة الراهنة بعد استرداد كاش الخزائن وتسييل بضاعة المستودع بسعر التكلفة وتحصيل كافة ديون العملاء وسداد جميع مستحقات الموردين.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 shrink-0">
            <div className="p-3 bg-[var(--bg)] border border-indigo-200 dark:border-indigo-900 rounded-xl text-right lg:text-left">
              <span className="text-[11px] text-[var(--muted)] font-bold block mb-0.5">
                {translate("dash.immediateLiquidationAtCost", locale, "صافي التصفية الفورية (بالتكلفة):")}
              </span>
              <b className="text-2xl md:text-3xl font-black text-indigo-700 dark:text-indigo-400">
                {netLiquidationAtCost.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-normal">{translate("common.egp", locale, "ج.م")}</small>
              </b>
            </div>
            <div className="text-xs text-[var(--muted)] font-medium">
              {translate("dash.liquidationAtRetail", locale, "التصفية بالبيع القطاعي:")}{" "}
              <b className="text-emerald-600 dark:text-emerald-400 font-bold">
                {netLiquidationAtRetail.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
              </b>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Capital / Liquidation Equation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Pillar 1: Cash in Hand */}
          <div className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[11px] text-[var(--muted)] font-semibold flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold">+</span>
                <span>{translate("dash.cashboxLiquidity", locale, "سيولة الخزائن الفورية")}</span>
              </span>
              <b className="text-base font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                {totalCashBalance.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
              </b>
              <small className="text-[10px] text-[var(--muted)]">
                {locale === "en" ? `In ${activeBoxesWithBalance.length} cashboxes` : `في ${activeBoxesWithBalance.length} خزائن نقدية`}
              </small>
            </div>
            <Wallet size={18} className="text-emerald-600/50" />
          </div>

          {/* Pillar 2: Inventory at Cost */}
          <div className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[11px] text-[var(--muted)] font-semibold flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 flex items-center justify-center text-[10px] font-bold">+</span>
                <span>{translate("dash.inventoryAtCost", locale, "بضاعة المخزن (بالتكلفة)")}</span>
              </span>
              <b className="text-base font-bold text-sky-700 dark:text-sky-400 block mt-0.5">
                {inventoryCostValuation.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
              </b>
              <small className="text-[10px] text-[var(--muted)]">
                {totalStockUnits.toLocaleString(localeCode)} {locale === "en" ? `pcs (${totalProductsCount} items)` : `قطعة (${totalProductsCount} صنف)`}
              </small>
            </div>
            <Package size={18} className="text-sky-600/50" />
          </div>

          {/* Pillar 3: Customer Receivables */}
          <div className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[11px] text-[var(--muted)] font-semibold flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">+</span>
                <span>{translate("dash.marketReceivables", locale, "فلوسنا بالسوق (آجل العملاء)")}</span>
              </span>
              <b className="text-base font-bold text-indigo-700 dark:text-indigo-400 block mt-0.5">
                {customerReceivablesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
              </b>
              <small className="text-[10px] text-[var(--muted)]">{locale === "en" ? "Receivables from customers" : "ديون مستحقة لنا بالخارج"}</small>
            </div>
            <Clock size={18} className="text-indigo-600/50" />
          </div>

          {/* Pillar 4: Supplier Payables */}
          <div className="p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[11px] text-[var(--muted)] font-semibold flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center justify-center text-[10px] font-bold">−</span>
                <span>{translate("dash.supplierPayables", locale, "مستحقات الموردين (علينا)")}</span>
              </span>
              <b className="text-base font-bold text-rose-600 dark:text-rose-400 block mt-0.5">
                {supplierPayablesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
              </b>
              <small className="text-[10px] text-[var(--muted)]">{locale === "en" ? "Payable obligations" : "التزامات واجبة السداد"}</small>
            </div>
            <Landmark size={18} className="text-rose-600/50" />
          </div>
        </div>
      </section>

      {/* 6 High-Performance Enterprise Operational KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {/* Card 1: Today Sales */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("dash.todaySales", locale, "مبيعات اليوم")}</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <b className="text-xl text-indigo-700 dark:text-indigo-400 block font-bold">
            {todaySalesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-[10px] text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] block mt-0.5 font-medium">
            {todaySalesCount} {locale === "en" ? "sales invoices" : "فاتورة بيع"}
          </span>
        </div>

        {/* Card 2: Today Gross Profit */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("dash.todayProfit", locale, "أرباح اليوم")}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins size={14} />
            </div>
          </div>
          <b className="text-xl text-emerald-600 dark:text-emerald-400 block font-bold">
            +{todayProfitTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-[10px] text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-500 block mt-0.5 font-semibold">
            {locale === "en" ? `Margin: ${todayMarginRate}%` : `هامش: %${todayMarginRate}`}
          </span>
        </div>

        {/* Card 3: Today Purchases */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("dash.todayPurchases", locale, "مشتريات اليوم")}</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingDown size={14} />
            </div>
          </div>
          <b className="text-xl text-purple-700 dark:text-purple-400 block font-bold">
            {todayPurchasesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-[10px] text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] block mt-0.5 font-medium">
            {todayPurchasesCount} {locale === "en" ? "purchase orders" : "أمر توريد"}
          </span>
        </div>

        {/* Card 4: Cash Liquidity */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("dash.cashboxLiquidity", locale, "السيولة النقدية")}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet size={14} />
            </div>
          </div>
          <b className="text-xl text-[var(--ink)] block font-bold">
            {totalCashBalance.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-[10px] text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-blue-700 dark:text-blue-400 block mt-0.5 font-medium">
            {locale === "en" ? `In ${activeBoxesWithBalance.length} active cashboxes` : `في ${activeBoxesWithBalance.length} خزائن نشطة`}
          </span>
        </div>

        {/* Card 5: Inventory Valuation */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("dash.inventoryAtCost", locale, "قيمة بضاعة المخزن")}</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Package size={14} />
            </div>
          </div>
          <b className="text-xl text-[var(--ink)] block font-bold">
            {inventoryCostValuation.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-[10px] text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] block mt-0.5 font-medium">
            {totalStockUnits.toLocaleString(localeCode)} {locale === "en" ? `pcs (${totalProductsCount} items)` : `قطعة (${totalProductsCount} صنف)`}
          </span>
        </div>

        {/* Card 6: Reorder Alert */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("dash.lowStockCount", locale, "نواقص المخزون")}</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${lowCount > 0 ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"}`}>
              {lowCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            </div>
          </div>
          <b className={`text-xl block font-bold ${lowCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {lowCount.toLocaleString(localeCode)} <small className="text-[10px] font-normal">{locale === "en" ? "items" : "صنف"}</small>
          </b>
          <span className="text-[11px] block mt-0.5 font-medium">
            {lowCount > 0 ? (locale === "en" ? "Needs reordering" : "بحاجة لإعادة الطلب") : (locale === "en" ? "Stock levels healthy" : "مستويات المخزون ممتازة")}
          </span>
        </div>
      </div>

      {/* High-Density Content Split */}
      <section className="content-grid">
        {/* Recent Invoices Panel */}
        <article className="panel">
          <div className="panel-title">
            <div>
              <h2>{translate("dash.recentInvoices", locale, "أحدث الفواتير المسجلة")}</h2>
              <p>{locale === "en" ? "Recent commercial transactions with instant view and print" : "سجل العمليات الأخير مع إمكانية فتح الفاتورة وطباعتها فوراً"}</p>
            </div>
            <Link href="/invoices" className="text-link">
              <span>{locale === "en" ? "View all invoices" : "عرض كل الفواتير"}</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{translate("invoices.colNumber", locale, "رقم الفاتورة")}</th>
                  <th>{translate("invoices.colType", locale, "النوع")}</th>
                  <th>{translate("invoices.colParty", locale, "الطرف")}</th>
                  <th>{translate("common.date", locale, "التاريخ")}</th>
                  <th>{translate("invoices.colTotal", locale, "الإجمالي")}</th>
                  <th>{translate("invoices.colStatus", locale, "الحالة")}</th>
                  <th>{translate("invoices.colActions", locale, "إجراء")}</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length ? (
                  recentInvoices.map((i) => {
                    return (
                      <tr key={i.number} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {i.number}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                              i.type === "sale"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                                : i.type === "purchase"
                                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                            }`}
                          >
                            {i.type === "sale"
                              ? translate("invoices.salesBadge", locale, "بيع")
                              : i.type === "purchase"
                              ? translate("invoices.purchaseBadge", locale, "شراء")
                              : translate("invoices.saleReturnBadge", locale, "مرتجع")}
                          </span>
                        </td>
                        <td className="font-semibold text-xs text-[var(--ink)]">
                          {i.partyName ?? (locale === "en" ? "Cash / Walk-in" : "نقدي / صالة")}
                        </td>
                        <td className="text-xs text-[var(--muted)] font-mono">
                          {new Date(i.createdAt).toLocaleDateString(localeCode, { month: "short", day: "numeric" })}
                        </td>
                        <td className="font-bold text-sm text-[var(--ink)] font-mono">
                          {Number(i.total).toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-[10px] text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
                        </td>
                        <td>
                          <span className={`status ${i.status}`}>
                            {i.status === "paid"
                              ? translate("invoices.fullyPaid", locale, "مدفوعة")
                              : i.status === "partial"
                              ? translate("invoices.partiallyPaid", locale, "جزئية")
                              : translate("invoices.unpaidStatus", locale, "غير مدفوعة")}
                          </span>
                        </td>
                        <td>
                          <Link href={`/invoices/${i.id}`} className="secondary btn-sm py-1 px-2.5 font-bold">
                            <span>{translate("common.view", locale, "عرض")}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="table-empty py-6 text-center text-[var(--muted)]">
                      {locale === "en" ? "No invoices recorded yet. Use 'New Invoice' button to begin." : "لا توجد فواتير مسجلة بعد. استخدم زر «فاتورة جديدة» لبدء التسجيل."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* Operational Side Column */}
        <div className="flex flex-col gap-5">
          {/* Active Cashboxes with Exact Real Balances */}
          <article className="panel mb-0">
            <div className="panel-title">
              <div>
                <h2>{translate("dash.cashboxesBreakdown", locale, "أرصدة الصناديق والخزائن")}</h2>
                <p>{locale === "en" ? "Instant real-time cash liquidity available" : "السيولة النقدية الفعلية المتاحة حالياً"}</p>
              </div>
              <Link href="/finance" className="text-link text-xs">
                <span>{locale === "en" ? "Manage Treasuries" : "إدارة الخزائن"}</span>
              </Link>
            </div>

            <div className="space-y-2">
              {activeBoxesWithBalance.map((box) => (
                <div
                  key={box.id}
                  className="p-3 border border-[var(--line)] rounded-xl flex items-center justify-between hover:bg-[var(--surface-muted)] transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[var(--primary)] flex items-center justify-center">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[var(--ink)] block">{box.name}</span>
                      <small className="text-[11px] text-[var(--muted)]">
                        {box.kind === "cash"
                          ? (locale === "en" ? "Cash Box" : "صندوق نقدي")
                          : box.kind === "bank"
                          ? (locale === "en" ? "Bank Account" : "حساب بنكي")
                          : (locale === "en" ? "E-Wallet" : "محفظة إلكترونية")}
                      </small>
                    </div>
                  </div>
                  <div className="text-left">
                    <b className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block font-mono">
                      {box.balance.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
                    </b>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Reorder Alerts */}
          <article className="panel mb-0">
            <div className="panel-title">
              <div>
                <h2>{translate("dash.lowStockAlerts", locale, "أصناف قاربت على النفاد")}</h2>
                <p>{locale === "en" ? "Alert to replenish stock before depletion" : "تنبيه لإعادة التوريد قبل نفاد الكمية"}</p>
              </div>
              <Link href="/inventory" className="text-link text-xs">
                <span>{translate("nav.inventory", locale, "إدارة المخزن")}</span>
              </Link>
            </div>

            {lowStockProducts.length ? (
              <div className="space-y-2.5">
                {lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-[var(--surface-muted)] border border-[var(--line)] rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <b className="text-xs text-[var(--ink)] block font-bold">{p.name}</b>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">{p.sku}</span>
                      </div>
                      <small className="text-[11px] text-[var(--muted)]">
                        {locale === "en" ? `Reorder level: ${Number(p.reorderLevel).toLocaleString(localeCode)} pcs` : `حد الطلب: ${Number(p.reorderLevel).toLocaleString(localeCode)} قطعة`}
                      </small>
                    </div>
                    <span className="status stock-low font-mono text-xs font-bold">
                      {locale === "en" ? `Remaining: ${Number(p.stock).toLocaleString(localeCode)}` : `المتبقي: ${Number(p.stock).toLocaleString(localeCode)}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[var(--muted)]">
                {locale === "en" ? "All inventory stock is above reorder thresholds" : "جميع أصناف المستودع تفوق حد إعادة الطلب"}
              </div>
            )}
          </article>
        </div>
      </section>

      {/* Global Operational Footer */}
      <footer className="mt-10 pt-4 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--muted)]">
        <span>{organizationName} · ERP Management System</span>
        <span className="font-mono text-[11px]">ERP v2.0 • Offline Local & Fast</span>
      </footer>
    </main>
  );
}
