"use client";

import { useState } from "react";
import Image from "next/image";
import {
  FileText,
  Printer,
  Receipt,
  Store,
  Truck,
  CheckSquare,
  Building,
} from "lucide-react";
import { useI18n } from "@/lib/i18n-client";
import { formatAmount } from "@/lib/number-format";

type InvoiceData = {
  invoice: {
    id: string;
    number: string;
    type: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    paid: string;
    status: string;
    notes: string | null;
    createdAt: Date | string;
  };
  party: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    type: string;
  } | null;
  org: {
    organizationName: string;
    logoPath: string | null;
    invoiceFooter: string | null;
  } | null;
  lines: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    costPrice: string;
    lineTotal: string;
  }[];
  invoiceLogo: string | null;
};

export function InvoicePrintView({ data }: { data: InvoiceData }) {
  const { t, locale } = useI18n();
  const [format, setFormat] = useState<"a4" | "thermal" | "dispatch">("a4");
  const { invoice, party, org, lines, invoiceLogo } = data;
  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid));
  const dateFormatted = new Date(invoice.createdAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = (mode: "a4" | "thermal" | "dispatch") => {
    if (mode === "thermal") {
      document.documentElement.classList.add("thermal-print");
    } else {
      document.documentElement.classList.remove("thermal-print");
    }
    window.print();
    window.setTimeout(() => {
      document.documentElement.classList.remove("thermal-print");
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Format Selector Bar (Hidden on Print) */}
      <div className="print-hide flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-bold">
          <button
            type="button"
            onClick={() => setFormat("a4")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "a4"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <FileText size={14} />
            <span>{t("invoices.formatA4", "فاتورة رسمية A4")}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("thermal")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "thermal"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Receipt size={14} />
            <span>{t("invoices.formatThermal", "إيصال حراري (80mm)")}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("dispatch")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              format === "dispatch"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Truck size={14} />
            <span>{t("invoices.formatDispatch", "إذن تسليم وصرف مخزني")}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePrint(format)}
            className="primary w-full sm:w-auto px-4 py-2 text-xs inline-flex items-center justify-center gap-1.5 font-bold shadow-xs cursor-pointer rounded-lg"
          >
            <Printer size={15} />
            <span>{t("invoices.printThis", "طباعة هذا النموذج")}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          FORMAT 1: A4 Commercial Tax Invoice
          ========================================================================= */}
      {format === "a4" && (
        <article className="panel invoice-paper p-4 sm:p-6 md:p-8">
          <header className="paper-header pb-6 border-b border-[var(--line)]">
            <div className="flex items-center gap-4">
              {invoiceLogo ? (
                <Image
                  src={invoiceLogo}
                  alt="شعار المؤسسة"
                  width={64}
                  height={64}
                  unoptimized
                  className="rounded-xl object-contain border border-slate-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
                  <Store size={28} />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-[var(--ink)]">{org?.organizationName ?? "Apex Software"}</h2>
                <p className="text-xs font-bold text-[var(--muted)] mt-1">
                  {invoice.type === "sale"
                    ? "فاتورة مبيعات ضريبية تجارية"
                    : invoice.type === "purchase"
                    ? "فاتورة مشتريات وتوريد بضائع"
                    : invoice.type === "sale_return"
                    ? "إشعار دائن — مرتجع مبيعات"
                    : "إشعار مدين — مرتجع مشتريات"}
                </p>
              </div>
            </div>

            <div className="paper-meta text-left">
              <strong className="block text-base font-black text-[var(--ink)]">
                رقم الفاتورة: <span className="font-mono text-indigo-700">{invoice.number}</span>
              </strong>
              <span className="block text-xs text-[var(--muted)] mt-1">التاريخ: {dateFormatted}</span>
              <span className="block text-xs text-[var(--muted)]">الطرف: <b className="text-[var(--ink)]">{party?.name ?? "عميل صالة نقدي"}</b></span>
              {party?.phone && <span className="block text-xs text-[var(--muted)]">الهاتف: {party.phone}</span>}
              {party?.address && <span className="block text-xs text-[var(--muted)]">العنوان: {party.address}</span>}
              <div className="mt-2">
                <span className={`status ${invoice.status}`}>
                  {invoice.status === "paid" ? "مدفوعة بالكامل" : invoice.status === "partial" ? "مدفوعة جزئياً" : "غير مدفوعة"}
                </span>
              </div>
            </div>
          </header>

          {/* Table */}
          <div className="table-wrap my-6">
            <table>
              <thead>
                <tr>
                  <th className="w-12 text-center">#</th>
                  <th>اسم الصنف والبيان</th>
                  <th className="text-center w-28">الكمية</th>
                  <th className="text-center w-32">سعر الوحدة</th>
                  <th className="text-center w-36">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id}>
                    <td className="text-center text-xs text-[var(--muted)] font-mono">{idx + 1}</td>
                    <td className="font-bold text-[var(--ink)]">{line.description}</td>
                    <td className="text-center font-bold">{Number(line.quantity).toLocaleString("en-US")}</td>
                    <td className="text-center font-semibold">{Number(line.unitPrice).toLocaleString("en-US")} ج.م</td>
                    <td className="text-center font-bold text-[var(--ink)]">
                      {Number(line.lineTotal).toLocaleString("en-US")} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <section className="invoice-totals">
            <p>
              <span>المجموع قبل الخصم:</span>
              <b>{Number(invoice.subtotal).toLocaleString("en-US")} ج.م</b>
            </p>
            {Number(invoice.discount) > 0 && (
              <p>
                <span>الخصم الممنوح:</span>
                <b className="text-rose-600">− {Number(invoice.discount).toLocaleString("en-US")} ج.م</b>
              </p>
            )}
            {Number(invoice.tax) > 0 && (
              <p>
                <span>ضريبة القيمة المضافة:</span>
                <b>+ {Number(invoice.tax).toLocaleString("en-US")} ج.م</b>
              </p>
            )}
            <p className="grand-total">
              <span>الصافي المطلوب:</span>
              <b>{Number(invoice.total).toLocaleString("en-US")} ج.م</b>
            </p>
            <p>
              <span>المسدد نقداً:</span>
              <b className="text-emerald-700">{Number(invoice.paid).toLocaleString("en-US")} ج.م</b>
            </p>
            {remaining > 0 && (
              <p className="font-bold text-rose-600">
                <span>المتبقي في الذمة:</span>
                <b>{remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م</b>
              </p>
            )}
          </section>

          {/* Signatures & Footer */}
          <div className="mt-12 pt-6 border-t border-[var(--line)] grid grid-cols-2 gap-8 text-center text-xs text-[var(--muted)]">
            <div>
              <p className="mb-8 font-semibold">توقيع المستلم بما يفيد المعاينة والاستلام:</p>
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
            </div>
            <div>
              <p className="mb-8 font-semibold">توقيع المحاسب / إدارة المبيعات:</p>
              <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
            </div>
          </div>

          {org?.invoiceFooter && (
            <footer className="paper-footer mt-6 text-center text-xs text-[var(--muted)]">
              <p className="whitespace-pre-line">{org.invoiceFooter}</p>
            </footer>
          )}
        </article>
      )}

      {/* =========================================================================
          FORMAT 2: 80mm Thermal Receipt POS
          ========================================================================= */}
      {format === "thermal" && (
        <article className="panel max-w-[340px] mx-auto p-4 font-mono text-xs bg-white text-black border border-slate-300 shadow-md">
          <div className="text-center pb-3 border-b border-dashed border-black">
            {invoiceLogo && (
              <div className="flex justify-center mb-2">
                <Image
                  src={invoiceLogo}
                  alt="شعار"
                  width={48}
                  height={48}
                  unoptimized
                  className="object-contain"
                />
              </div>
            )}
            <h2 className="text-base font-black">{org?.organizationName ?? "Apex Software"}</h2>
            <p className="text-[11px] mt-0.5">
              {invoice.type === "sale" ? "إيصال مبيعات نقدية" : "إيصال توريد"}
            </p>
            <p className="text-[10px] text-slate-600 mt-1">رقم الفاتورة: #{invoice.number}</p>
            <p className="text-[10px] text-slate-600">{dateFormatted}</p>
            <p className="text-[11px] font-bold mt-1">الطرف: {party?.name ?? "عميل صالة"}</p>
          </div>

          <div className="py-2 border-b border-dashed border-black">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-400">
                  <th className="text-right py-1">الصنف</th>
                  <th className="text-center py-1">الكمية</th>
                  <th className="text-left py-1">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-300">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1 font-bold">{l.description}</td>
                    <td className="py-1 text-center font-bold">{l.quantity}</td>
                    <td className="py-1 text-left">{formatAmount(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="py-2 space-y-1 text-xs border-b border-dashed border-black">
            <div className="flex justify-between">
              <span>المجموع:</span>
              <span>{formatAmount(invoice.subtotal)} ج.م</span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>الخصم:</span>
                <span>−{formatAmount(invoice.discount)} ج.م</span>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between">
                <span>الضريبة:</span>
                <span>+{formatAmount(invoice.tax)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-black">
              <span>الصافي المطلوب:</span>
              <span>{formatAmount(invoice.total)} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>المدفوع:</span>
              <span>{formatAmount(invoice.paid)} ج.م</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between font-bold text-rose-700">
                <span>المتبقي:</span>
                <span>{formatAmount(remaining)} ج.م</span>
              </div>
            )}
          </div>

          <div className="pt-3 text-center text-[10px] space-y-1">
            <p className="font-bold">شكراً لتعاملكم معنا!</p>
            {org?.invoiceFooter && <p className="whitespace-pre-line">{org.invoiceFooter}</p>}
          </div>
        </article>
      )}

      {/* =========================================================================
          FORMAT 3: Warehouse Dispatch Slip (إذن صرف وتسليم مستودع)
          ========================================================================= */}
      {format === "dispatch" && (
        <article className="panel invoice-paper p-6 md:p-8">
          <header className="paper-header pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              {invoiceLogo ? (
                <Image
                  src={invoiceLogo}
                  alt="شعار المؤسسة"
                  width={52}
                  height={52}
                  unoptimized
                  className="rounded-lg object-contain border border-slate-300"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Truck size={24} />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-[var(--ink)]">إذن صرف وتسليم بضاعة من المستودع</h2>
                <p className="text-xs text-[var(--muted)] font-bold">مستند تحضير ومطابقة المخزون والتسليم للعميل</p>
              </div>
            </div>

            <div className="paper-meta text-left">
              <strong className="block text-lg font-black text-[var(--ink)] font-mono">
                كود الإذن: {invoice.number}
              </strong>
              <span className="block text-xs text-[var(--muted)]">تاريخ ووقت التحضير: {dateFormatted}</span>
              <span className="block text-xs font-bold text-indigo-700">
                اسم المستلم: {party?.name ?? "عميل صالة"}
              </span>
              {party?.phone && <span className="block text-xs text-[var(--muted)]">هاتف التواصل: {party.phone}</span>}
              {party?.address && <span className="block text-xs text-[var(--muted)]">عنوان التسليم: {party.address}</span>}
            </div>
          </header>

          {/* Warehouse Checklist Table */}
          <div className="table-wrap my-6">
            <table>
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="w-16 text-center">فحص</th>
                  <th className="w-12 text-center">#</th>
                  <th>اسم الصنف ومواصفات البند</th>
                  <th className="text-center w-36">الكمية المصروفة</th>
                  <th className="text-center w-32">الحالة المخزنية</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.id} className="border-b border-slate-200">
                    <td className="text-center">
                      <div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto" />
                    </td>
                    <td className="text-center text-xs text-[var(--muted)] font-mono">{idx + 1}</td>
                    <td className="font-bold text-[var(--ink)] text-sm">{line.description}</td>
                    <td className="text-center font-mono font-black text-base text-indigo-700">
                      {Number(line.quantity).toLocaleString("en-US")} قطعة
                    </td>
                    <td className="text-center text-xs font-semibold text-emerald-700">
                      تم الصرف من المستودع
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg mb-6 text-xs">
              <span className="font-bold block mb-1">ملاحظات التحضير والشحن:</span>
              <span>{invoice.notes}</span>
            </div>
          )}

          {/* Warehouse Signatures */}
          <div className="mt-8 pt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-4 text-center text-xs">
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
              <p className="font-bold text-[var(--ink)] mb-10">أمين المستودع (المحضّر)</p>
              <p className="border-t border-dashed border-slate-400 pt-2 text-[11px] text-[var(--muted)]">التوقيع والاسم</p>
            </div>
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
              <p className="font-bold text-[var(--ink)] mb-10">مندوب الشحن / السائق</p>
              <p className="border-t border-dashed border-slate-400 pt-2 text-[11px] text-[var(--muted)]">التوقيع ورقم المركبة</p>
            </div>
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-lg">
              <p className="font-bold text-[var(--ink)] mb-10">توقيع العميل / المستلم</p>
              <p className="border-t border-dashed border-slate-400 pt-2 text-[11px] text-[var(--muted)]">تم الاستلام بحالة سليمة</p>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
