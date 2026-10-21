import Link from "next/link";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Filter,
  Flame,
  Layers,
  TrendingUp,
  Coins,
  Percent,
  CreditCard,
  ShoppingBag,
  Building2,
  Users,
  Package,
  Clock,
  PieChart,
  BarChart3,
  Calendar,
} from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { categories, invoiceLines, invoices, parties, products, settings } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { PrintButton } from "@/components/print-button";
import { translate, Locale } from "@/lib/i18n";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("reports", "view");

  const [settingsRow] = await db
    .select({ locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const locale = (settingsRow?.locale ?? "ar") as Locale;
  const isRtl = locale === "ar";
  const localeCode = "en-US";

  const range = await searchParams;
  
  // Calculate today's date in local time (Egypt / Middle East timezone)
  const nowInCairo = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const todayStr = `${nowInCairo.getFullYear()}-${String(nowInCairo.getMonth() + 1).padStart(2, "0")}-${String(nowInCairo.getDate()).padStart(2, "0")}`;

  // Default to today unless explicitly provided
  const fromDate = range.from || todayStr;
  const toDate = range.to || todayStr;

  const saleConditions = [
    eq(invoices.type, "sale"),
    sql`(${invoices.createdAt} AT TIME ZONE 'Africa/Cairo')::date >= ${fromDate}::date`,
    sql`(${invoices.createdAt} AT TIME ZONE 'Africa/Cairo')::date <= ${toDate}::date`,
  ];

  const purchaseConditions = [
    eq(invoices.type, "purchase"),
    sql`(${invoices.createdAt} AT TIME ZONE 'Africa/Cairo')::date >= ${fromDate}::date`,
    sql`(${invoices.createdAt} AT TIME ZONE 'Africa/Cairo')::date <= ${toDate}::date`,
  ];

  const [
    categoriesReport,
    topProducts,
    salesSummary,
    purchaseSummary,
    inventoryCapitalRow,
    topCustomers,
    topSuppliers,
  ] = await Promise.all([
    db
      .select({
        name: sql<string>`coalesce(${categories.name}, 'بدون تصنيف')`,
        revenue: sql<string>`coalesce(sum(${invoiceLines.lineTotal}), 0)`,
        cost: sql<string>`coalesce(sum(${invoiceLines.quantity} * ${invoiceLines.costPrice}), 0)`,
        quantity: sql<string>`coalesce(sum(${invoiceLines.quantity}), 0)`,
        count: sql<number>`count(distinct ${invoiceLines.invoiceId})`,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .leftJoin(products, eq(products.id, invoiceLines.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(...saleConditions))
      .groupBy(categories.id, categories.name)
      .orderBy(desc(sql`sum(${invoiceLines.lineTotal})`)),

    db
      .select({
        name: invoiceLines.description,
        quantity: sql<string>`coalesce(sum(${invoiceLines.quantity}), 0)`,
        revenue: sql<string>`coalesce(sum(${invoiceLines.lineTotal}), 0)`,
        cost: sql<string>`coalesce(sum(${invoiceLines.quantity} * ${invoiceLines.costPrice}), 0)`,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(and(...saleConditions))
      .groupBy(invoiceLines.description)
      .orderBy(desc(sql`sum(${invoiceLines.lineTotal})`))
      .limit(10),

    db
      .select({
        totalSales: sql<string>`coalesce(sum(${invoices.total}), 0)`,
        totalPaid: sql<string>`coalesce(sum(${invoices.paid}), 0)`,
        totalDiscount: sql<string>`coalesce(sum(${invoices.discount}), 0)`,
        invoicesCount: sql<number>`count(*)`,
      })
      .from(invoices)
      .where(and(...saleConditions)),

    db
      .select({
        totalPurchases: sql<string>`coalesce(sum(${invoices.total}), 0)`,
        purchasesCount: sql<number>`count(*)`,
      })
      .from(invoices)
      .where(and(...purchaseConditions)),

    db
      .select({
        capitalCost: sql<string>`coalesce(sum(${products.stock} * ${products.costPrice}), 0)`,
        retailValuation: sql<string>`coalesce(sum(${products.stock} * ${products.salePrice}), 0)`,
        totalPieces: sql<string>`coalesce(sum(${products.stock}), 0)`,
        totalProductsCount: sql<number>`count(*)`,
      })
      .from(products)
      .where(and(eq(products.active, true), isNull(products.deletedAt))),

    db
      .select({
        partyId: parties.id,
        partyName: parties.name,
        partyPhone: parties.phone,
        totalPurchased: sql<string>`coalesce(sum(${invoices.total}), 0)`,
        totalPaid: sql<string>`coalesce(sum(${invoices.paid}), 0)`,
        invoicesCount: sql<number>`count(${invoices.id})`,
      })
      .from(invoices)
      .innerJoin(parties, eq(parties.id, invoices.partyId))
      .where(and(...saleConditions, eq(parties.type, "customer")))
      .groupBy(parties.id, parties.name, parties.phone)
      .orderBy(desc(sql`sum(${invoices.total})`))
      .limit(5),

    db
      .select({
        partyId: parties.id,
        partyName: parties.name,
        partyPhone: parties.phone,
        totalSupplied: sql<string>`coalesce(sum(${invoices.total}), 0)`,
        invoicesCount: sql<number>`count(${invoices.id})`,
      })
      .from(invoices)
      .innerJoin(parties, eq(parties.id, invoices.partyId))
      .where(and(...purchaseConditions, eq(parties.type, "supplier")))
      .groupBy(parties.id, parties.name, parties.phone)
      .orderBy(desc(sql`sum(${invoices.total})`))
      .limit(5),
  ]);

  const salesAgg = salesSummary[0] ?? { totalSales: "0", totalPaid: "0", totalDiscount: "0", invoicesCount: 0 };
  const purchasesAgg = purchaseSummary[0] ?? { totalPurchases: "0", purchasesCount: 0 };
  const invCapital = inventoryCapitalRow[0] ?? { capitalCost: "0", retailValuation: "0", totalPieces: "0", totalProductsCount: 0 };

  const totalPeriodRevenue = Number(salesAgg.totalSales);
  const totalPeriodPaid = Number(salesAgg.totalPaid);
  const totalPeriodRemaining = Math.max(0, totalPeriodRevenue - totalPeriodPaid);
  const totalInvoicesCount = Number(salesAgg.invoicesCount);
  const averageOrderValue = totalInvoicesCount > 0 ? totalPeriodRevenue / totalInvoicesCount : 0;
  const cashCollectionRate = totalPeriodRevenue > 0 ? Math.round((totalPeriodPaid / totalPeriodRevenue) * 100) : 0;
  const creditRate = totalPeriodRevenue > 0 ? 100 - cashCollectionRate : 0;

  const totalPeriodPurchases = Number(purchasesAgg.totalPurchases);
  const totalPurchasesCount = Number(purchasesAgg.purchasesCount);
  const netTradeFlow = totalPeriodRevenue - totalPeriodPurchases;

  const totalPeriodCost = categoriesReport.reduce((acc, item) => acc + Number(item.cost), 0);
  const totalPeriodGrossProfit = Math.max(0, totalPeriodRevenue - totalPeriodCost);
  const overallMarginRate = totalPeriodRevenue > 0 ? Math.round((totalPeriodGrossProfit / totalPeriodRevenue) * 100) : 0;

  const totalPeriodUnits = categoriesReport.reduce((acc, item) => acc + Number(item.quantity), 0);
  const maxRevenue = Math.max(1, ...categoriesReport.map((item) => Number(item.revenue)));

  const inventoryWorkingCapital = Number(invCapital.capitalCost);
  const inventoryRetailValuation = Number(invCapital.retailValuation);

  // Helper date shortcuts based on local date
  const d7 = new Date(`${todayStr}T12:00:00Z`);
  d7.setUTCDate(d7.getUTCDate() - 7);
  const past7Days = d7.toISOString().slice(0, 10);
  const monthStart = `${todayStr.slice(0, 8)}01`;

  return (
    <main className="main standalone">
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">{translate("reports.subtitle", locale)}</p>
          <h1>{translate("reports.title", locale)}</h1>
        </div>
        <div className="top-actions">
          <PrintButton label={locale === "en" ? "Print Official Report" : "طباعة التقرير الرسمي"} />
          <Link className="secondary" href="/">
            <ArrowRight size={15} className={isRtl ? "" : "rotate-180"} />
            <span>{translate("common.home", locale)}</span>
          </Link>
        </div>
      </header>

      {/* Date Filter & Fast Shortcuts */}
      <section className="panel print-hide">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" />
              <span>{locale === "en" ? "Report Time Period" : "تحديد الفترة الزمنية للتقرير"}</span>
            </h3>
            <p className="text-xs text-[var(--muted)]">{locale === "en" ? "Defaults to Today, quick shortcuts available to jump back" : "النظام يفلتر تلقائياً على اليوم (Default)، ويمكنك الانتقال لفترات سابقة فوراً"}</p>
          </div>

          {/* Quick Date Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <Link
              href={`/reports?from=${todayStr}&to=${todayStr}`}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                fromDate === todayStr && toDate === todayStr
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                  : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink)] hover:border-indigo-400"
              }`}
            >
              {locale === "en" ? "Today (Default)" : "اليوم (افتراضي)"}
            </Link>
            <Link
              href={`/reports?from=${past7Days}&to=${todayStr}`}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                fromDate === past7Days && toDate === todayStr
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                  : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink)] hover:border-indigo-400"
              }`}
            >
              {locale === "en" ? "Past 7 Days" : "آخر 7 أيام"}
            </Link>
            <Link
              href={`/reports?from=${monthStart}&to=${todayStr}`}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                fromDate === monthStart && toDate === todayStr
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                  : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink)] hover:border-indigo-400"
              }`}
            >
              {locale === "en" ? "This Month" : "هذا الشهر"}
            </Link>
          </div>
        </div>

        <form method="get" className="date-filter mb-0">
          <label>
            <span>{locale === "en" ? "From Date:" : "من تاريخ:"}</span>
            <input type="date" name="from" defaultValue={fromDate} />
          </label>
          <label>
            <span>{locale === "en" ? "To Date:" : "إلى تاريخ:"}</span>
            <input type="date" name="to" defaultValue={toDate} />
          </label>
          <button className="primary flex items-center gap-1.5 h-[36px]">
            <Filter size={14} />
            <span>{translate("reports.filterBtn", locale)}</span>
          </button>
        </form>
      </section>

      {/* Primary KPI Grid (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {/* Card 1: Sales */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">مبيعات الفترة</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <b className="text-xl text-indigo-700 dark:text-indigo-400 block font-bold">
            {totalPeriodRevenue.toLocaleString("en-US")} <small className="text-[10px] text-[var(--muted)] font-normal">ج.م</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] font-medium">
            {totalInvoicesCount.toLocaleString("en-US")} فاتورة بيع
          </span>
        </div>

        {/* Card 2: Gross Profit */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">مجمل الأرباح</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins size={14} />
            </div>
          </div>
          <b className="text-xl text-emerald-600 dark:text-emerald-400 block font-bold">
            +{totalPeriodGrossProfit.toLocaleString("en-US")} <small className="text-[10px] text-[var(--muted)] font-normal">ج.م</small>
          </b>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-500 font-semibold">
            هامش ربح: %{overallMarginRate}
          </span>
        </div>

        {/* Card 3: Purchases */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">المشتريات والتوريد</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ShoppingBag size={14} />
            </div>
          </div>
          <b className="text-xl text-purple-700 dark:text-purple-400 block font-bold">
            {totalPeriodPurchases.toLocaleString("en-US")} <small className="text-[10px] text-[var(--muted)] font-normal">ج.م</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] font-medium">
            {totalPurchasesCount.toLocaleString("en-US")} فاتورة توريد
          </span>
        </div>

        {/* Card 4: Cash Collected */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">التحصيل (كاش)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CreditCard size={14} />
            </div>
          </div>
          <b className="text-xl text-[var(--ink)] block font-bold">
            {totalPeriodPaid.toLocaleString("en-US")} <small className="text-[10px] text-[var(--muted)] font-normal">ج.م</small>
          </b>
          <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
            معدل الكاش: %{cashCollectionRate}
          </span>
        </div>

        {/* Card 5: Credit / Deferred */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">الآجل على العملاء</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Percent size={14} />
            </div>
          </div>
          <b className="text-xl text-rose-600 dark:text-rose-400 block font-bold">
            {totalPeriodRemaining.toLocaleString("en-US")} <small className="text-[10px] text-[var(--muted)] font-normal">ج.م</small>
          </b>
          <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
            مديونيات جديدة بالفترة
          </span>
        </div>

        {/* Card 6: Business Working Capital */}
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[var(--muted)] font-bold">رأس مال المخزون</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Package size={14} />
            </div>
          </div>
          <b className="text-xl text-amber-700 dark:text-amber-400 block font-bold">
            {inventoryWorkingCapital.toLocaleString("en-US")} <small className="text-[10px] text-[var(--muted)] font-normal">ج.م</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] font-medium">
            تكلفة بضاعة المستودع
          </span>
        </div>
      </div>

      {/* Visual Analytics & Donut Circle Charts Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {/* Circle Chart 1: Cash vs Credit Payment Types */}
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
              <PieChart size={15} className="text-indigo-600" />
              <span>توزيع المبيعات (كاش نقدي vs آجل)</span>
            </h4>
          </div>

          <div className="flex items-center justify-around py-3">
            {/* SVG Donut Circle */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.8"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#3b49df"
                  strokeWidth="3.8"
                  strokeDasharray={`${cashCollectionRate} ${100 - cashCollectionRate}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-sm font-black text-indigo-700">%{cashCollectionRate}</span>
                <span className="block text-[9px] text-[var(--muted)] font-semibold">نقداً</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                <span className="text-[var(--ink)]">نقدي فوري (كاش):</span>
                <b className="text-indigo-700">{totalPeriodPaid.toLocaleString("en-US")} ج.م</b>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                <span className="text-[var(--muted)]">آجل على الحساب:</span>
                <b className="text-rose-600">{totalPeriodRemaining.toLocaleString("en-US")} ج.م</b>
              </div>
            </div>
          </div>
        </div>

        {/* Circle Chart 2: Net Trade Balance Comparison */}
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
              <BarChart3 size={15} className="text-emerald-600" />
              <span>مقارنة مؤشرات الفترة المالية</span>
            </h4>
          </div>

          <div className="space-y-2 py-1">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>المبيعات:</span>
                <span className="text-indigo-600">{totalPeriodRevenue.toLocaleString("en-US")} ج.م</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>المشتريات:</span>
                <span className="text-purple-600">{totalPeriodPurchases.toLocaleString("en-US")} ج.م</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((totalPeriodPurchases / Math.max(1, totalPeriodRevenue)) * 100))}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>مجمل الأرباح:</span>
                <span className="text-emerald-600">+{totalPeriodGrossProfit.toLocaleString("en-US")} ج.م</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((totalPeriodGrossProfit / Math.max(1, totalPeriodRevenue)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card: Total Working Capital & Valuation Details */}
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Package size={15} className="text-amber-600" />
              <span>تفاصيل رأس المال وقيمة البضاعة</span>
            </h4>
          </div>

          <div className="space-y-2 py-1 text-xs">
            <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <span className="font-semibold text-[var(--muted)]">رأس مال المخزون بالتكلفة:</span>
              <b className="font-bold text-[var(--ink)]">{inventoryWorkingCapital.toLocaleString("en-US")} ج.م</b>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <span className="font-semibold text-[var(--muted)]">القيمة التقديرية بالبيع القطاعي:</span>
              <b className="font-bold text-emerald-700">{inventoryRetailValuation.toLocaleString("en-US")} ج.م</b>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
              <span className="font-semibold text-[var(--muted)]">إجمالي وحدات المخزن:</span>
              <b className="font-bold text-indigo-700">{Number(invCapital.totalPieces).toLocaleString("en-US")} قطعة</b>
            </div>
          </div>
        </div>
      </div>

      {/* Top Active Customers & Top Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {/* Top Active Customers */}
        <section className="panel">
          <div className="panel-title mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold">أكثر العملاء نشاطاً ومبيعات</h3>
                <p className="text-xs text-[var(--muted)]">ترتيب العملاء بحسب إجمالي حجم المشتريات خلال الفترة</p>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>اسم العميل</th>
                  <th>الهاتف</th>
                  <th className="text-center">الفواتير</th>
                  <th className="text-left">إجمالي المشتريات</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.length ? (
                  topCustomers.map((c) => (
                    <tr key={c.partyId} className="transition-colors">
                      <td>
                        <b className="text-[var(--ink)] text-xs block">{c.partyName}</b>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-[var(--muted)]" dir="ltr">
                          {c.partyPhone ?? "—"}
                        </span>
                      </td>
                      <td className="text-center text-xs font-bold text-[var(--muted)]">
                        {c.invoicesCount} فاتورة
                      </td>
                      <td className="text-left font-bold text-xs text-indigo-700">
                        {Number(c.totalPurchased).toLocaleString("en-US")} ج.م
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="table-empty py-4">
                      لا توجد مشتريات لعملاء مسجلين بالفترة المحددة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Suppliers */}
        <section className="panel">
          <div className="panel-title mb-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-purple-600" />
              <div>
                <h3 className="text-sm font-bold">أبرز الموردين وشركات التوريد</h3>
                <p className="text-xs text-[var(--muted)]">ترتيب الموردين بحسب إجمالي حجم التوريدات للمستودع</p>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>اسم المورد / الشركة</th>
                  <th>الهاتف</th>
                  <th className="text-center">أوامر التوريد</th>
                  <th className="text-left">إجمالي التوريد</th>
                </tr>
              </thead>
              <tbody>
                {topSuppliers.length ? (
                  topSuppliers.map((s) => (
                    <tr key={s.partyId} className="transition-colors">
                      <td>
                        <b className="text-[var(--ink)] text-xs block">{s.partyName}</b>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-[var(--muted)]" dir="ltr">
                          {s.partyPhone ?? "—"}
                        </span>
                      </td>
                      <td className="text-center text-xs font-bold text-[var(--muted)]">
                        {s.invoicesCount} أمر توريد
                      </td>
                      <td className="text-left font-bold text-xs text-purple-700">
                        {Number(s.totalSupplied).toLocaleString("en-US")} ج.م
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="table-empty py-4">
                      لا توجد فواتير توريد مسجلة بالفترة المحددة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Categories Breakdown */}
      <section className="panel mb-5">
        <div className="panel-title">
          <div>
            <h3>المبيعات والربحية حسب القسم والتصنيف</h3>
            <p>مقارنة القيمة الإجمالية، التكلفة، مجمل الأرباح، وحجم الوحدات لكل قسم</p>
          </div>
          <span className="date-pill">{categoriesReport.length} أقسام محققة للمبيعات</span>
        </div>

        {categoriesReport.length ? (
          <div className="category-report space-y-3">
            {categoriesReport.map((item) => {
              const rev = Number(item.revenue);
              const cost = Number(item.cost);
              const profit = Math.max(0, rev - cost);
              const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
              const contribution = totalPeriodRevenue > 0 ? Math.round((rev / totalPeriodRevenue) * 100) : 0;
              const barWidth = Math.max(5, Math.round((rev / maxRevenue) * 100));

              return (
                <article className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]" key={item.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--ink)] text-sm">{item.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                        مساهمة: %{contribution}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-3">
                      <span>المبيعات: {rev.toLocaleString("en-US")} ج.م</span>
                      <span className="text-emerald-700">الربح: {profit.toLocaleString("en-US")} ج.م (%{margin})</span>
                      <span className="text-[var(--muted)] font-normal">
                        ({Number(item.quantity).toLocaleString("en-US")} قطعة · {item.count} فاتورة)
                      </span>
                    </div>
                  </div>
                  <div className="category-track">
                    <span style={{ width: `${barWidth}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state py-10">
            <div className="empty-icon">
              <Layers size={20} />
            </div>
            <b>لا توجد مبيعات مسجلة في هذه الفترة</b>
            <p className="text-xs text-[var(--muted)] mt-1">سجّل فواتير بيع أو وسّع نطاق التاريخ لعرض أداء الأقسام.</p>
          </div>
        )}
      </section>

      {/* Top 10 Selling Products Table with Profit Breakdown */}
      <section className="panel">
        <div className="panel-title">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-amber-500" />
            <div>
              <h3>أعلى 10 أصناف مبيعاً وتحقيقاً للأرباح</h3>
              <p>تحليل تفصيلي للكميات، إجمالي الإيرادات، التكلفة، وصافي الربح المحقق لكل منتج</p>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th>اسم المنتج</th>
                <th className="text-center">الكمية المباعة</th>
                <th className="text-center">إجمالي المبيعات</th>
                <th className="text-center">التكلفة التقديرية</th>
                <th className="text-center">صافي الربح</th>
                <th className="text-center">هامش الربح</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length ? (
                topProducts.map((item, index) => {
                  const rev = Number(item.revenue);
                  const cost = Number(item.cost);
                  const profit = Math.max(0, rev - cost);
                  const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

                  return (
                    <tr key={item.name} className="transition-colors">
                      <td className="text-center font-bold text-[var(--muted)]">{index + 1}</td>
                      <td className="font-bold text-[var(--ink)]">{item.name}</td>
                      <td className="text-center font-semibold">
                        {Number(item.quantity).toLocaleString("en-US")} قطعة
                      </td>
                      <td className="text-center font-bold text-indigo-700">
                        {rev.toLocaleString("en-US")} ج.م
                      </td>
                      <td className="text-center font-medium text-slate-600">
                        {cost.toLocaleString("en-US")} ج.م
                      </td>
                      <td className="text-center font-bold text-emerald-700">
                        +{profit.toLocaleString("en-US")} ج.م
                      </td>
                      <td className="text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          %{margin}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty">
                    لا توجد بيانات حركة مبيعات مسجلة في هذه الفترة.
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
