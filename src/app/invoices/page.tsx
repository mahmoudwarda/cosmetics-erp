import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FilePlus, ArrowRight, Printer, ReceiptText, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { invoices, parties, settings } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { InvoicesTableView } from "@/features/invoices/invoices-table-view";
import { translate, Locale } from "@/lib/i18n";

export default async function InvoicesPage() {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("invoices", "view");

  const [settingsRow] = await db
    .select({ locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const locale = (settingsRow?.locale ?? "ar") as Locale;
  const localeCode = locale === "en" ? "en-US" : "ar-EG";

  const rows = await db
    .select({ invoice: invoices, partyName: parties.name })
    .from(invoices)
    .leftJoin(parties, eq(invoices.partyId, parties.id))
    .orderBy(desc(invoices.createdAt))
    .limit(150);

  const saleRows = rows.filter((r) => r.invoice.type === "sale");
  const totalSales = saleRows.reduce((sum, r) => sum + Number(r.invoice.total), 0);
  const totalPaid = saleRows.reduce((sum, r) => sum + Number(r.invoice.paid), 0);
  const totalRemaining = Math.max(0, totalSales - totalPaid);
  const paidCount = rows.filter((r) => r.invoice.status === "paid").length;

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{translate("invoices.eyebrow", locale, "إدارة العمليات التجارية والفوترة")}</p>
          <h1>{translate("invoices.listTitle", locale, "سجل الفواتير والمبيعات")}</h1>
        </div>
        <div className="top-actions">
          <Link className="primary" href="/invoices/new">
            <FilePlus size={16} />
            <span>{translate("invoices.newInvoiceBtn", locale, "فاتورة جديدة")}</span>
          </Link>
          <Link className="secondary" href="/">
            <ArrowRight size={15} />
            <span>{translate("common.home", locale, "الرئيسية")}</span>
          </Link>
        </div>
      </header>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("invoices.totalCount", locale, "عدد العمليات المسجلة")}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ReceiptText size={16} />
            </div>
          </div>
          <b className="text-2xl text-[var(--ink)] block mb-1 font-bold">
            {rows.length.toLocaleString(localeCode)}{" "}
            <small className="text-xs text-[var(--muted)] font-normal">{locale === "en" ? "invoices" : "فاتورة"}</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] font-medium">{locale === "en" ? "Sales & Purchase Log" : "سجل المبيعات والتوريدات"}</span>
        </div>

        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("invoices.totalSales", locale, "إجمالي المبيعات")}</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <b className="text-2xl text-indigo-700 dark:text-indigo-400 block mb-1 font-bold">
            {totalSales.toLocaleString(localeCode, { minimumFractionDigits: 2 })}{" "}
            <small className="text-xs text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-[var(--muted)] font-medium">{locale === "en" ? "Gross Invoices Value" : "قيمة الفواتير بالقائمة"}</span>
        </div>

        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("invoices.collectedCash", locale, "المحصل في الخزائن")}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <b className="text-2xl text-emerald-600 dark:text-emerald-400 block mb-1 font-bold">
            {totalPaid.toLocaleString(localeCode, { minimumFractionDigits: 2 })}{" "}
            <small className="text-xs text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-500 font-semibold">
            {paidCount} {locale === "en" ? "fully settled" : "مسددة بالكامل"}
          </span>
        </div>

        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl relative overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">{translate("invoices.remainingCredit", locale, "المتبقي الآجل للتحصيل")}</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <b className="text-2xl text-rose-600 dark:text-rose-400 block mb-1 font-bold">
            {totalRemaining.toLocaleString(localeCode, { minimumFractionDigits: 2 })}{" "}
            <small className="text-xs text-[var(--muted)] font-normal">{translate("common.egp", locale, "ج.م")}</small>
          </b>
          <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
            {locale === "en" ? "Pending Customer Receivables" : "مديونيات فواتير معلقة"}
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title mb-4">
          <div>
            <h3>{translate("invoices.journalTitle", locale, "قائمة وسجل العمليات")}</h3>
            <p>{translate("invoices.journalDesc", locale, "فرز الفواتير حسب النوع (بيع، شراء، مرتجع) والبحث الفوري برقم الفاتورة أو اسم الطرف")}</p>
          </div>
          <span className="date-pill">
            {rows.length} {locale === "en" ? "operations" : "عملية"}
          </span>
        </div>

        <InvoicesTableView rows={rows} />
      </section>
    </main>
  );
}
