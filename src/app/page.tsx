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
  CreditCard,
  BarChart3,
  Sparkles,
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
  let topSellingProducts: { id: string; name: string; sku: string; stock: string; soldQty: number }[] = [];

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
      topSoldRows,
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
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          stock: products.stock,
          soldQty: sql<number>`coalesce(sum(${invoiceLines.quantity}), 0)`,
        })
        .from(invoiceLines)
        .innerJoin(products, eq(products.id, invoiceLines.productId))
        .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
        .where(eq(invoices.type, "sale"))
        .groupBy(products.id, products.name, products.sku, products.stock)
        .orderBy(desc(sql`sum(${invoiceLines.quantity})`))
        .limit(4),
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
    topSellingProducts = topSoldRows.map((r) => ({
      ...r,
      soldQty: Number(r.soldQty),
    }));
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
  const todaySalesCredit = Math.max(0, todaySalesTotal - todaySalesPaid);
  const todayCashRatio = todaySalesTotal > 0 ? Math.round((todaySalesPaid / todaySalesTotal) * 100) : 100;
  const todayCreditRatio = todaySalesTotal > 0 ? Math.round((todaySalesCredit / todaySalesTotal) * 100) : 0;

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
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0 font-bold">
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
      <section className="mb-6 p-6 md:p-7 bg-gradient-to-br from-indigo-50/80 via-[var(--panel)] to-sky-50/60 border border-indigo-200 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pb-5 border-b border-indigo-100">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                {translate("dash.liquidationIndex", locale, "مؤشر التصفية الشامل للنشاط")}
              </span>
              <span className="text-xs text-[var(--muted)] font-semibold">
                {translate("dash.liquidationSubtitle", locale, "حساب صافي رأس المال المسترد في حال تصفية أو إغلاق المشروع اليوم")}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--ink)]">
              {translate("dash.liquidationTitle", locale, "صافي قيمة تصفية المشروع الحالية (حقوق الملكية)")}
            </h2>
            <p className="text-xs text-[var(--muted)] max-w-2xl leading-relaxed">
              {translate("dash.liquidationExplanation", locale, "يمثل هذا الرقم ما سيؤول إليك كمالك في اللحظة الراهنة بعد استرداد كاش الخزائن وتسييل بضاعة المستودع بسعر التكلفة وتحصيل كافة ديون العملاء وسداد جميع مستحقات الموردين.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2.5 shrink-0">
            <div className="p-4 bg-[var(--panel)] border-2 border-indigo-200 rounded-2xl text-right lg:text-left min-w-[240px]">
              <span className="text-xs text-[var(--muted)] font-bold block mb-1">
                {translate("dash.immediateLiquidationAtCost", locale, "صافي التصفية الفورية (بالتكلفة):")}
              </span>
              <b className="text-3xl md:text-4xl font-black text-indigo-700 font-mono tracking-tight block">
                {netLiquidationAtCost.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-sm font-bold text-indigo-600/70">{translate("common.egp", locale, "ج.م")}</small>
              </b>
            </div>
            <div className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl">
              <span>{translate("dash.liquidationAtRetail", locale, "التصفية بالبيع القطاعي:")}</span>
              <b className="text-emerald-700 font-black font-mono text-sm">
                {netLiquidationAtRetail.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
              </b>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Capital / Liquidation Equation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-5">
          {/* Pillar 1: Cash in Hand - EMERALD THEME */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-black">+</span>
                <span>{translate("dash.cashboxLiquidity", locale, "سيولة الخزائن الفورية")}</span>
              </span>
              <b className="text-xl md:text-2xl font-black text-emerald-800 block mt-1.5 font-mono">
                {totalCashBalance.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-bold text-emerald-700/80">{translate("common.egp", locale, "ج.م")}</small>
              </b>
              <small className="text-[11px] text-emerald-700 font-medium">
                {locale === "en" ? `In ${activeBoxesWithBalance.length} cashboxes` : `في ${activeBoxesWithBalance.length} خزائن نقدية`}
              </small>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Wallet size={22} />
            </div>
          </div>

          {/* Pillar 2: Inventory at Cost - AMBER THEME */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-black">+</span>
                <span>{translate("dash.inventoryAtCost", locale, "بضاعة المخزن (بالتكلفة)")}</span>
              </span>
              <b className="text-xl md:text-2xl font-black text-amber-900 block mt-1.5 font-mono">
                {inventoryCostValuation.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-bold text-amber-800/80">{translate("common.egp", locale, "ج.م")}</small>
              </b>
              <small className="text-[11px] text-amber-800 font-medium">
                {totalStockUnits.toLocaleString(localeCode)} {locale === "en" ? `pcs (${totalProductsCount} items)` : `قطعة (${totalProductsCount} صنف)`}
              </small>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Package size={22} />
            </div>
          </div>

          {/* Pillar 3: Customer Receivables - SKY THEME */}
          <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-200 text-sky-900 flex items-center justify-center text-xs font-black">+</span>
                <span>{translate("dash.marketReceivables", locale, "فلوسنا بالسوق (آجل العملاء)")}</span>
              </span>
              <b className="text-xl md:text-2xl font-black text-sky-900 block mt-1.5 font-mono">
                {customerReceivablesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-bold text-sky-800/80">{translate("common.egp", locale, "ج.م")}</small>
              </b>
              <small className="text-[11px] text-sky-800 font-medium">
                {locale === "en" ? "Receivables from customers" : "ديون مستحقة لنا بالخارج"}
              </small>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
          </div>

          {/* Pillar 4: Supplier Payables - ROSE THEME */}
          <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-900 flex items-center justify-center text-xs font-black">−</span>
                <span>{translate("dash.supplierPayables", locale, "مستحقات الموردين (علينا)")}</span>
              </span>
              <b className="text-xl md:text-2xl font-black text-rose-700 block mt-1.5 font-mono">
                {supplierPayablesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-bold text-rose-600/80">{translate("common.egp", locale, "ج.م")}</small>
              </b>
              <small className="text-[11px] text-rose-800 font-medium">
                {locale === "en" ? "Payable obligations" : "التزامات واجبة السداد"}
              </small>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Landmark size={22} />
            </div>
          </div>
        </div>
      </section>

      {/* 6 High-Performance Enterprise Operational KPI Cards (Themed & Enlarged) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6">
        {/* Card 1: Today Sales - BLUE THEME */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-blue-900 font-bold">{translate("dash.todaySales", locale, "مبيعات اليوم")}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <b className="text-2xl lg:text-3xl text-blue-900 block font-black font-mono tracking-tight">
              {todaySalesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs text-blue-700/80 font-bold">{translate("common.egp", locale, "ج.م")}</small>
            </b>
            <span className="text-xs text-blue-700 font-semibold block mt-1">
              {todaySalesCount} {locale === "en" ? "sales invoices" : "فاتورة بيع"}
            </span>
          </div>
        </div>

        {/* Card 2: Today Gross Profit - EMERALD THEME */}
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-900 font-bold">{translate("dash.todayProfit", locale, "أرباح اليوم")}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div>
            <b className="text-2xl lg:text-3xl text-emerald-800 block font-black font-mono tracking-tight">
              +{todayProfitTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs text-emerald-700/80 font-bold">{translate("common.egp", locale, "ج.م")}</small>
            </b>
            <span className="text-xs text-emerald-800 font-bold block mt-1">
              {locale === "en" ? `Margin: ${todayMarginRate}%` : `هامش: %${todayMarginRate}`}
            </span>
          </div>
        </div>

        {/* Card 3: Today Purchases - PURPLE THEME */}
        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-purple-900 font-bold">{translate("dash.todayPurchases", locale, "مشتريات اليوم")}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <TrendingDown size={16} />
            </div>
          </div>
          <div>
            <b className="text-2xl lg:text-3xl text-purple-900 block font-black font-mono tracking-tight">
              {todayPurchasesTotal.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs text-purple-700/80 font-bold">{translate("common.egp", locale, "ج.م")}</small>
            </b>
            <span className="text-xs text-purple-700 font-semibold block mt-1">
              {todayPurchasesCount} {locale === "en" ? "purchase orders" : "أمر توريد"}
            </span>
          </div>
        </div>

        {/* Card 4: Cash Liquidity - TEAL THEME */}
        <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-teal-900 font-bold">{translate("dash.cashboxLiquidity", locale, "السيولة النقدية")}</span>
            <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <b className="text-2xl lg:text-3xl text-teal-900 block font-black font-mono tracking-tight">
              {totalCashBalance.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs text-teal-700/80 font-bold">{translate("common.egp", locale, "ج.م")}</small>
            </b>
            <span className="text-xs text-teal-700 font-semibold block mt-1">
              {locale === "en" ? `In ${activeBoxesWithBalance.length} active cashboxes` : `في ${activeBoxesWithBalance.length} خزائن نشطة`}
            </span>
          </div>
        </div>

        {/* Card 5: Inventory Valuation - AMBER THEME */}
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-900 font-bold">{translate("dash.inventoryAtCost", locale, "قيمة بضاعة المخزن")}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <div>
            <b className="text-2xl lg:text-3xl text-amber-900 block font-black font-mono tracking-tight">
              {inventoryCostValuation.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs text-amber-800/80 font-bold">{translate("common.egp", locale, "ج.م")}</small>
            </b>
            <span className="text-xs text-amber-800 font-semibold block mt-1">
              {totalStockUnits.toLocaleString(localeCode)} {locale === "en" ? `pcs (${totalProductsCount} items)` : `قطعة (${totalProductsCount} صنف)`}
            </span>
          </div>
        </div>

        {/* Card 6: Reorder Alert - ROSE / EMERALD THEME */}
        <div
          className={`p-4 border rounded-2xl relative overflow-hidden flex flex-col justify-between ${
            lowCount > 0 ? "bg-rose-50/70 border-rose-200" : "bg-emerald-50/70 border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${lowCount > 0 ? "text-rose-900" : "text-emerald-900"}`}>
              {translate("dash.lowStockCount", locale, "نواقص المخزون")}
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                lowCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {lowCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            </div>
          </div>
          <div>
            <b
              className={`text-2xl lg:text-3xl block font-black font-mono tracking-tight ${
                lowCount > 0 ? "text-rose-700" : "text-emerald-800"
              }`}
            >
              {lowCount.toLocaleString(localeCode)} <small className="text-xs font-bold">{locale === "en" ? "items" : "صنف"}</small>
            </b>
            <span
              className={`text-xs block mt-1 font-semibold ${
                lowCount > 0 ? "text-rose-800" : "text-emerald-800"
              }`}
            >
              {lowCount > 0
                ? (locale === "en" ? "Needs reordering" : "بحاجة لإعادة الطلب")
                : (locale === "en" ? "Stock levels healthy" : "المستويات ممتازة")}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Operational Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Card 1: Today Sales Payment Distribution (Cash vs Credit) */}
        <div className="p-5 bg-[var(--panel)] border border-[var(--line)] rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Coins size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  {locale === "en" ? "Today's Revenue & Payment Split" : "توزيع تدفق مبيعات اليوم (نقدي وآجل)"}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {locale === "en" ? "Cash collections vs outstanding market receivables" : "مقارنة السيولة النقدية المحصلة فوراً مقابل مبيعات الآجل بالسوق"}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {locale === "en" ? `Margin: %${todayMarginRate}` : `هامش الربح: %${todayMarginRate}`}
            </span>
          </div>

          {/* Visual Stacked Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${todayCashRatio}%` }}
                title={locale === "en" ? `Cash: ${todayCashRatio}%` : `كاش: %${todayCashRatio}`}
              />
              <div
                className="bg-indigo-500 h-full transition-all duration-500"
                style={{ width: `${todayCreditRatio}%` }}
                title={locale === "en" ? `Credit: ${todayCreditRatio}%` : `آجل: %${todayCreditRatio}`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--muted)] font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>{locale === "en" ? `Cash Collections (%${todayCashRatio})` : `تحصيل نقدي بالخزينة (%${todayCashRatio})`}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <span>{locale === "en" ? `Credit / Receivables (%${todayCreditRatio})` : `مبيعات بالآجل للسوق (%${todayCreditRatio})`}</span>
              </span>
            </div>
          </div>

          {/* Financial Breakdown Metric Strips (Enlarged & Themed) */}
          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl">
              <span className="text-xs text-emerald-900 font-bold block mb-1">
                {locale === "en" ? "Cash Collected" : "المدفوع نقداً:"}
              </span>
              <b className="text-xl md:text-2xl font-black text-emerald-800 font-mono block">
                {todaySalesPaid.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-bold text-emerald-700/80">{translate("common.egp", locale, "ج.م")}</small>
              </b>
            </div>
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl">
              <span className="text-xs text-indigo-900 font-bold block mb-1">
                {locale === "en" ? "Credit / Remaining" : "المتبقي آجل بالسوق:"}
              </span>
              <b className="text-xl md:text-2xl font-black text-indigo-800 font-mono block">
                {todaySalesCredit.toLocaleString(localeCode, { minimumFractionDigits: 2 })} <small className="text-xs font-bold text-indigo-700/80">{translate("common.egp", locale, "ج.م")}</small>
              </b>
            </div>
          </div>
        </div>

        {/* Card 2: Top Selling / Fast Moving Products */}
        <div className="p-5 bg-[var(--panel)] border border-[var(--line)] rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Package size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  {locale === "en" ? "Fast-Moving & Top Products" : "الأصناف الأكثر طلباً ونشاطاً بالمبيعات"}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {locale === "en" ? "Top selling items with current inventory stock" : "معدل دوران المخزون والكميات المباعة"}
                </p>
              </div>
            </div>
            <Link href="/inventory" className="text-link text-xs">
              <span>{locale === "en" ? "Full Catalog" : "دليل الأصناف"}</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="space-y-2 pt-1">
            {topSellingProducts.length ? (
              topSellingProducts.map((p) => {
                const stockNum = Number(p.stock);
                return (
                  <div
                    key={p.id}
                    className="p-3 border border-[var(--line)] rounded-xl flex items-center justify-between bg-[var(--surface-muted)]/50"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <b className="text-xs font-bold text-[var(--ink)] truncate max-w-[180px]">{p.name}</b>
                        <span className="font-mono text-[10px] text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded border border-slate-300">
                          {p.sku}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--muted)] font-medium">
                        {locale === "en" ? `Warehouse stock: ${stockNum.toLocaleString(localeCode)} pcs` : `المخزون بالمستودع: ${stockNum.toLocaleString(localeCode)} قطعة`}
                      </span>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                        {p.soldQty.toLocaleString(localeCode)} {locale === "en" ? "sold" : "مباع"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-[var(--muted)]">
                {locale === "en" ? "No sales recorded yet to calculate top products" : "لا توجد حركات بيع مسجلة بعد لتحديد الأصناف الأكثر طلباً"}
              </div>
            )}
          </div>
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
                      <tr key={i.number} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50/80 text-indigo-700 border border-indigo-200">
                            {i.number}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                              i.type === "sale"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : i.type === "purchase"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5">
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
                  className="p-3 border border-[var(--line)] rounded-xl flex items-center justify-between hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                        box.kind === "cash"
                          ? "bg-teal-50 text-teal-700 border border-teal-200"
                          : box.kind === "bank"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}
                    >
                      <Wallet size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[var(--ink)] block">{box.name}</span>
                      <small className="text-[11px] text-[var(--muted)] font-medium">
                        {box.kind === "cash"
                          ? (locale === "en" ? "Cash Box" : "صندوق نقدي")
                          : box.kind === "bank"
                          ? (locale === "en" ? "Bank Account" : "حساب بنكي")
                          : (locale === "en" ? "E-Wallet" : "محفظة إلكترونية")}
                      </small>
                    </div>
                  </div>
                  <div className="text-left">
                    <b className="text-sm font-bold text-emerald-700 block font-mono">
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
                        <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{p.sku}</span>
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
