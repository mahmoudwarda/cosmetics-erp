"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Search, ShoppingCart, Truck, RotateCcw, ArrowDownLeft, X, Eye } from "lucide-react";
import { useI18n } from "@/lib/i18n-client";

type InvoiceItem = {
  invoice: {
    id: string;
    number: string;
    type: "sale" | "purchase" | "sale_return" | "purchase_return";
    partyId: string | null;
    total: string;
    paid: string;
    status: string;
    createdAt: Date | string;
  };
  partyName: string | null;
};

export function InvoicesTableView({ rows }: { rows: InvoiceItem[] }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<"all" | "sale" | "purchase" | "sale_return" | "purchase_return">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const counts = useMemo(() => {
    return {
      all: rows.length,
      sale: rows.filter((r) => r.invoice.type === "sale").length,
      purchase: rows.filter((r) => r.invoice.type === "purchase").length,
      sale_return: rows.filter((r) => r.invoice.type === "sale_return").length,
      purchase_return: rows.filter((r) => r.invoice.type === "purchase_return").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((item) => {
      // Filter by Tab
      if (tab !== "all" && item.invoice.type !== tab) {
        return false;
      }
      // Filter by Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const numberMatch = item.invoice.number.toLowerCase().includes(query);
        const partyMatch = item.partyName?.toLowerCase().includes(query) ?? false;
        return numberMatch || partyMatch;
      }
      return true;
    });
  }, [rows, tab, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-x-auto text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "all"
                ? "bg-[var(--panel)] text-[var(--ink)] shadow-2xs border border-[var(--line)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <span>{t("invoices.allTabs", "الكل")}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("sale")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "sale"
                ? "bg-blue-600 text-white shadow-2xs font-extrabold"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <ShoppingCart size={13} />
            <span>{t("invoices.saleTabs", "فواتير البيع")}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-900/40 text-white">
              {counts.sale}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("purchase")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "purchase"
                ? "bg-purple-600 text-white shadow-2xs font-extrabold"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Truck size={13} />
            <span>{t("invoices.purchaseTabs", "فواتير الشراء")}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-900/40 text-white">
              {counts.purchase}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("sale_return")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "sale_return"
                ? "bg-amber-600 text-white shadow-2xs font-extrabold"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <RotateCcw size={13} />
            <span>{t("invoices.saleReturnTabs", "مرتجع بيع")}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-900/40 text-white">
              {counts.sale_return}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("purchase_return")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === "purchase_return"
                ? "bg-rose-600 text-white shadow-2xs font-extrabold"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <ArrowDownLeft size={13} />
            <span>{t("invoices.purchaseReturnTabs", "مرتجع شراء")}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-900/40 text-white">
              {counts.purchase_return}
            </span>
          </button>
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className={`absolute ${locale === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-[var(--muted)]`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("invoices.searchPlaceholder", "بحث برقم الفاتورة أو اسم العميل / المورد...")}
            className={`w-full ${locale === "ar" ? "pr-9 pl-8" : "pl-9 pr-8"} py-2 text-xs bg-[var(--panel)] border border-[var(--line)] rounded-xl focus:border-[var(--primary)] transition-all font-semibold`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className={`absolute ${locale === "ar" ? "left-2.5" : "right-2.5"} top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-0.5 cursor-pointer`}
              title={t("common.cancel", "مسح البحث")}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("invoices.colNumber", "رقم الفاتورة")}</th>
              <th>{t("invoices.colType", "النوع")}</th>
              <th>{t("invoices.colParty", "الطرف (العميل / المورد)")}</th>
              <th>{t("invoices.colDate", "التاريخ والوقت")}</th>
              <th>{t("invoices.colTotal", "الإجمالي")}</th>
              <th>{t("invoices.colPaid", "المدفوع")}</th>
              <th>{t("invoices.colRemaining", "المتبقي")}</th>
              <th>{t("invoices.colStatus", "الحالة")}</th>
              <th>{t("invoices.colActions", "الإجراءات")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map(({ invoice: row, partyName }) => {
                const remaining = Math.max(0, Number(row.total) - Number(row.paid));
                const dateObj = new Date(row.createdAt);
                const localeCode = locale === "en" ? "en-US" : "ar-EG";

                return (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td>
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                        {row.number}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black border ${
                          row.type === "sale"
                            ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800"
                            : row.type === "purchase"
                            ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800"
                            : row.type === "sale_return"
                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                            : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800"
                        }`}
                      >
                        {row.type === "sale"
                          ? t("invoices.salesBadge", "مبيعات")
                          : row.type === "purchase"
                          ? t("invoices.purchaseBadge", "مشتريات")
                          : row.type === "sale_return"
                          ? t("invoices.saleReturnBadge", "مرتجع بيع")
                          : t("invoices.purchaseReturnBadge", "مرتجع شراء")}
                      </span>
                    </td>
                    <td>
                      <b className="text-[var(--ink)] block font-bold">
                        {partyName ?? (row.type.includes("sale") ? t("invoices.walkInCustomer", "عميل نقدي") : t("invoices.walkInSupplier", "مورد نقدي"))}
                      </b>
                    </td>
                    <td className="text-xs text-[var(--muted)] font-mono font-medium">
                      {dateObj.toLocaleDateString(localeCode, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="font-black text-[var(--ink)] font-mono">
                      {Number(row.total).toLocaleString(localeCode, { minimumFractionDigits: 2 })} {t("common.egp", "ج.م")}
                    </td>
                    <td className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">
                      {Number(row.paid).toLocaleString(localeCode, { minimumFractionDigits: 2 })} {t("common.egp", "ج.م")}
                    </td>
                    <td className="font-bold">
                      {remaining > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-black font-mono">
                          {remaining.toLocaleString(localeCode, { minimumFractionDigits: 2 })} {t("common.egp", "ج.م")}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                          {t("invoices.settled", "خالص")}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status ${row.status}`}>
                        {row.status === "paid"
                          ? t("invoices.fullyPaid", "مدفوعة بالكامل")
                          : row.status === "partial"
                          ? t("invoices.partiallyPaid", "مدفوعة جزئياً")
                          : t("invoices.unpaidStatus", "غير مدفوعة")}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="h-8 px-3 rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-200 hover:bg-sky-600 hover:text-white inline-flex items-center gap-1.5 text-xs font-extrabold transition-all shadow-2xs shrink-0"
                        href={`/invoices/${row.id}`}
                        title={t("invoices.openPrint", "فتح وطباعة")}
                      >
                        <Eye size={13} />
                        <span>{t("invoices.openPrint", "فتح وطباعة")}</span>
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="table-empty py-8 text-center text-[var(--muted)]">
                  {searchTerm ? t("common.noMatchingResults", "لا توجد فواتير تطابق معايير البحث الحالية.") : t("common.noData", "لا توجد فواتير مسجلة في هذا القسم.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
