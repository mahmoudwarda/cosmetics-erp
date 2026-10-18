"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  BookOpenText,
  Phone,
  Mail,
  Coins,
  Edit,
  Trash2,
  X,
  Filter,
  Printer,
  Building2,
  Eye,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  ArrowRight,
  User,
} from "lucide-react";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { localLogoUrl } from "@/server/services/branding";
import { useI18n } from "@/lib/i18n-client";

type PartyItem = {
  id: string;
  type: "customer" | "supplier";
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingBalance: string;
  createdAt: Date | string;
};

type CashboxItem = {
  id: string;
  name: string;
};

type LedgerEntry = {
  id: string;
  partyId: string;
  invoiceId: string | null;
  kind: string;
  debit: string;
  credit: string;
  balance: number;
  notes: string | null;
  createdAt: Date | string;
};

type TabKey = "all" | "customers" | "suppliers" | "debtors" | "statement";

export function PartiesTabsView({
  parties,
  cashboxes,
  balances,
  can,
  selectedParty,
  statementEntries,
  initialTab = "all",
  savePartyAction,
  deletePartyAction,
  registerPaymentAction,
  todayStr,
  currentFrom,
  currentTo,
  organization,
}: {
  parties: PartyItem[];
  cashboxes: CashboxItem[];
  balances: Record<string, number>;
  can: { create?: boolean; edit?: boolean; delete?: boolean } | ((action: string) => boolean);
  selectedParty?: PartyItem;
  statementEntries: LedgerEntry[];
  initialTab?: TabKey;
  savePartyAction: (formData: FormData) => Promise<void>;
  deletePartyAction: (formData: FormData) => Promise<void>;
  registerPaymentAction: (formData: FormData) => Promise<void>;
  todayStr: string;
  currentFrom: string;
  currentTo: string;
  organization?: { name: string; logo?: string | null };
}) {
  const { t, locale, isRtl } = useI18n();

  const canCheck = (action: string) => {
    if (typeof can === "function") return can(action);
    return Boolean(can?.[action as keyof typeof can]);
  };

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingParty, setViewingParty] = useState<PartyItem | null>(null);
  const [statementPartySearch, setStatementPartySearch] = useState("");
  const [statementRowSearch, setStatementRowSearch] = useState("");

  // Sync tab state when initialTab changes (e.g. from URL navigation)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const customers = useMemo(() => parties.filter((p) => p.type === "customer"), [parties]);
  const suppliers = useMemo(() => parties.filter((p) => p.type === "supplier"), [parties]);
  const debtors = useMemo(
    () => parties.filter((p) => Math.abs(balances[p.id] ?? Number(p.openingBalance)) > 0.005),
    [parties, balances]
  );

  const filteredParties = useMemo(() => {
    let list: PartyItem[] = parties;
    if (activeTab === "customers") list = customers;
    else if (activeTab === "suppliers") list = suppliers;
    else if (activeTab === "debtors") list = debtors;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.trim().toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
    );
  }, [activeTab, parties, customers, suppliers, debtors, searchTerm]);

  const filteredStatementCustomers = useMemo(() => {
    if (!statementPartySearch.trim()) return customers;
    const q = statementPartySearch.trim().toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }, [customers, statementPartySearch]);

  const filteredStatementSuppliers = useMemo(() => {
    if (!statementPartySearch.trim()) return suppliers;
    const q = statementPartySearch.trim().toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
    );
  }, [suppliers, statementPartySearch]);

  const displayStatementEntries = useMemo(() => {
    if (!statementRowSearch.trim()) return statementEntries;
    const q = statementRowSearch.trim().toLowerCase();
    return statementEntries.filter(
      (row) =>
        row.id === "opening" ||
        (row.notes && row.notes.toLowerCase().includes(q)) ||
        (row.kind && row.kind.toLowerCase().includes(q)) ||
        (row.invoiceId && row.invoiceId.toLowerCase().includes(q))
    );
  }, [statementEntries, statementRowSearch]);

  const handlePrint = () => {
    window.print();
  };

  const storeLogo = localLogoUrl(organization?.logo);

  return (
    <div className="space-y-4">
      {/* Primary Navigation & Filter Chips Row (High Contrast & Clear Badges) */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between print-hide">
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[var(--bg)] border border-[var(--line-strong)] rounded-xl font-bold text-xs shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              activeTab === "all"
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
            }`}
          >
            <span>{t("common.all", "الكل")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {parties.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              activeTab === "customers"
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
            }`}
          >
            <Users size={14} className={activeTab === "customers" ? "text-white" : "text-indigo-600"} />
            <span>{t("parties.customers", "العملاء")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "customers" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {customers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              activeTab === "suppliers"
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
            }`}
          >
            <Building2 size={14} className={activeTab === "suppliers" ? "text-white" : "text-emerald-600"} />
            <span>{t("parties.suppliers", "الموردون")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "suppliers" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {suppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("debtors")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              activeTab === "debtors"
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
            }`}
          >
            <AlertCircle size={14} className={activeTab === "debtors" ? "text-white" : "text-rose-600"} />
            <span>{t("parties.debtors", "عليهم مديونية / مستحقات")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "debtors" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {debtors.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("statement")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-bold ${
              activeTab === "statement"
                ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
            }`}
          >
            <BookOpenText size={14} className={activeTab === "statement" ? "text-white" : "text-indigo-600"} />
            <span>{t("parties.statement", "كشف الحساب المالي")}</span>
          </button>
        </div>

        {/* Live Search Bar for Directory Tables */}
        {activeTab !== "statement" && (
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("parties.searchPlaceholder", "بحث بالاسم أو رقم الهاتف أو العنوان...")}
              className="w-full pr-9 pl-8 py-2 text-xs bg-[var(--panel)] border border-[var(--line-strong)] rounded-xl focus:border-[var(--primary)] transition-all font-semibold shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-0.5 cursor-pointer"
                title={t("common.cancel", "مسح")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          DIRECTORY TABLE (All, Customers, Suppliers, Debtors)
          ========================================================================= */}
      {activeTab !== "statement" && (
        <div className="space-y-4">
          <div className="table-wrap overflow-x-auto shadow-xs border border-[var(--line)] rounded-xl">
            <table>
              <thead>
                <tr>
                  <th className="min-w-[190px]">{t("parties.accountName", "الحساب / الاسم")}</th>
                  <th className="w-[100px] min-w-[100px] text-center">{t("parties.type", "النوع")}</th>
                  <th className="min-w-[140px]">{t("parties.contact", "بيانات الاتصال")}</th>
                  <th className="min-w-[160px]">{t("parties.currentBalance", "الرصيد المالي الجاري")}</th>
                  <th className="w-[330px] min-w-[330px] text-left">{t("parties.actions", "الإجراءات والمعاملات")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.length ? (
                  filteredParties.map((p) => {
                    const balance = balances[p.id] ?? Number(p.openingBalance);
                    const isDebit = balance > 0.005;
                    const isCredit = balance < -0.005;
                    const isZero = !isDebit && !isCredit;

                    return (
                      <tr key={p.id} className="transition-colors">
                        <td>
                          <b className="text-[var(--ink)] block font-bold text-sm">{p.name}</b>
                          {p.address && (
                            <span className="text-xs text-[var(--muted)] flex items-center gap-1 mt-0.5">
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span>{p.address}</span>
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          {p.type === "customer" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Users size={12} />
                              <span>{t("parties.customer", "عميل")}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Building2 size={12} />
                              <span>{t("parties.supplier", "مورد")}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          {p.phone ? (
                            <span className="font-mono text-xs text-[var(--ink)] font-bold flex items-center gap-1.5">
                              <Phone size={12} className="text-indigo-600" />
                              <span dir="ltr">{p.phone}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">—</span>
                          )}
                          {p.email && (
                            <span className="text-[11px] text-[var(--muted)] flex items-center gap-1 mt-0.5">
                              <Mail size={11} className="text-slate-400" />
                              <span>{p.email}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="space-y-1">
                            <b
                              className={`text-sm block font-black font-mono ${
                                isDebit
                                  ? p.type === "customer"
                                    ? "text-rose-600"
                                    : "text-emerald-700"
                                  : isCredit
                                  ? p.type === "customer"
                                    ? "text-emerald-700"
                                    : "text-rose-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {Math.abs(balance).toLocaleString(locale === "en" ? "en-US" : "ar-EG", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              {t("common.egp", "ج.م")}
                            </b>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                isDebit
                                  ? p.type === "customer"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : isCredit
                                  ? p.type === "customer"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {isZero
                                ? t("parties.settled", "الحساب خالص")
                                : p.type === "customer"
                                ? isDebit
                                  ? t("parties.hasDebt", "عليه مديونية")
                                  : t("parties.hasCredit", "رصيد دائن لصالحه")
                                : isDebit
                                ? t("parties.weOwe", "له مستحقات علينا")
                                : t("parties.owesUs", "مستحق لنا عليه")}
                            </span>
                          </div>
                        </td>
                        <td className="row-actions text-left">
                          {/* Single non-wrapping horizontal flex row with vibrant distinct colors */}
                          <div className="flex items-center gap-1.5 justify-end flex-nowrap whitespace-nowrap">
                            {/* [عرض] View Full Details & Printable Profile */}
                            <button
                              type="button"
                              onClick={() => setViewingParty(p)}
                              className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer"
                              title={t("parties.viewDetails", "عرض التفاصيل الكاملة وطباعة كشف الحساب")}
                            >
                              <Eye size={13} />
                              <span>{t("common.view", "عرض")}</span>
                            </button>

                            {/* [كشف حساب] Immediate Statement Tab Link (no date restriction) */}
                            <Link
                              href={`/parties?tab=statement&partyId=${p.id}`}
                              className="h-8 px-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 inline-flex items-center gap-1 text-xs font-bold shrink-0"
                              title={t("parties.statementBtn", "استعراض كشف الحساب الكامل للعميل/المورد")}
                            >
                              <BookOpenText size={13} />
                              <span>{t("parties.statementBtn", "كشف حساب")}</span>
                            </Link>

                            {/* [قبض نقدية / صرف] Quick Cash Movement */}
                            {canCheck("create") && (
                              <details className="row-editor">
                                <summary className="h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer">
                                  <Coins size={13} />
                                  <span>{p.type === "customer" ? t("parties.cashReceipt", "قبض نقدية") : t("parties.cashPayment", "صرف نقدية")}</span>
                                </summary>
                                <form action={registerPaymentAction} className="inline-form">
                                  <CloseDisclosureButton
                                    title={`تسجيل سند ${p.type === "customer" ? "قبض" : "صرف"} لـ: ${p.name}`}
                                  />
                                  <input type="hidden" name="partyId" value={p.id} />
                                  <label>
                                    المبلغ (ج.م)
                                    <input name="amount" type="number" step="0.01" min="0.01" required />
                                  </label>
                                  <label>
                                    الصندوق / الخزينة
                                    <select name="cashboxId" required>
                                      {cashboxes.map((b) => (
                                        <option key={b.id} value={b.id}>
                                          {b.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    البيان / ملاحظات السند
                                    <input
                                      name="notes"
                                      defaultValue={p.type === "customer" ? "تحصيل دفعة حساب" : "سداد دفعة للمورد"}
                                    />
                                  </label>
                                  <button className="primary">تأكيد وترحيل السند</button>
                                </form>
                              </details>
                            )}

                            {/* [تعديل] Edit Party */}
                            {canCheck("edit") && (
                              <details className="row-editor">
                                <summary className="h-8 px-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 inline-flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer">
                                  <Edit size={13} />
                                  <span>{t("common.edit", "تعديل")}</span>
                                </summary>
                                <form action={savePartyAction} className="form-grid">
                                  <CloseDisclosureButton title={`تعديل بيانات: ${p.name}`} />
                                  <input type="hidden" name="id" value={p.id} />
                                  <label>
                                    نوع الحساب
                                    <select name="type" defaultValue={p.type}>
                                      <option value="customer">عميل</option>
                                      <option value="supplier">مورد</option>
                                    </select>
                                  </label>
                                  <label>
                                    الاسم بالكامل
                                    <input name="name" defaultValue={p.name} required />
                                  </label>
                                  <label>
                                    رقم الهاتف
                                    <input name="phone" defaultValue={p.phone ?? ""} />
                                  </label>
                                  <label>
                                    البريد الإلكتروني
                                    <input name="email" defaultValue={p.email ?? ""} />
                                  </label>
                                  <label>
                                    العنوان
                                    <input name="address" defaultValue={p.address ?? ""} />
                                  </label>
                                  <div className="form-actions">
                                    <button className="primary" type="submit">
                                      حفظ التعديلات
                                    </button>
                                  </div>
                                </form>
                              </details>
                            )}

                            {/* [حذف] Delete Party */}
                            {canCheck("delete") && (
                              <form action={deletePartyAction} className="inline-flex">
                                <input type="hidden" name="id" value={p.id} />
                                <ConfirmSubmitButton
                                  confirmMessage={`هل أنت متأكد من رغبتك في حذف الحساب «${p.name}»؟`}
                                  className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer"
                                  title={t("common.delete", "حذف")}
                                  ariaLabel={`حذف الحساب ${p.name}`}
                                >
                                  <Trash2 size={13} />
                                  <span>{t("common.delete", "حذف")}</span>
                                </ConfirmSubmitButton>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="table-empty py-8 text-center text-slate-500 font-bold">
                      {searchTerm
                        ? `لا توجد نتائج مطابقة للبحث عن «${searchTerm}».`
                        : "لا توجد حسابات مسجلة في هذا القسم حالياً."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: Account Statement (كشف الحساب المالي)
          ========================================================================= */}
      {activeTab === "statement" && (
        <div className="space-y-4">
          {/* Query Filter Form */}
          <div className="p-4 bg-[var(--panel)] border border-[var(--line-strong)] rounded-xl print-hide shadow-xs">
            <form method="get" className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <input type="hidden" name="tab" value="statement" />
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--ink)]">
                    {t("parties.accountName", "اختيار الحساب (عميل أو مورد)")} *
                  </span>
                  {statementPartySearch && (
                    <button
                      type="button"
                      onClick={() => setStatementPartySearch("")}
                      className="text-[11px] text-[var(--muted)] hover:text-rose-500 inline-flex items-center gap-0.5 cursor-pointer font-bold"
                    >
                      <X size={12} />
                      <span>{t("common.cancel", "مسح الفلتر")}</span>
                    </button>
                  )}
                </div>

                {/* Fast live search input to filter accounts dropdown */}
                <div className="relative">
                  <Search size={14} className="absolute right-2.5 top-2.5 text-[var(--muted)] pointer-events-none" />
                  <input
                    type="text"
                    value={statementPartySearch}
                    onChange={(e) => setStatementPartySearch(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم الهاتف لفلترة القائمة..."
                    className="w-full pr-8 pl-3 py-2 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg font-bold"
                  />
                </div>

                <select name="partyId" defaultValue={selectedParty?.id ?? ""} required className="w-full font-bold">
                  <option value="" disabled>
                    -- اختر عميلاً أو مورداً ({filteredStatementCustomers.length + filteredStatementSuppliers.length} حساب متاح) --
                  </option>
                  {selectedParty &&
                    !filteredStatementCustomers.some((c) => c.id === selectedParty.id) &&
                    !filteredStatementSuppliers.some((s) => s.id === selectedParty.id) && (
                      <option value={selectedParty.id}>
                        {selectedParty.type === "customer" ? "عميل" : "مورد"}: {selectedParty.name}{" "}
                        {selectedParty.phone ? `(${selectedParty.phone})` : ""}
                      </option>
                    )}
                  {filteredStatementCustomers.length > 0 && (
                    <optgroup label={`العملاء (${filteredStatementCustomers.length})`}>
                      {filteredStatementCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          عميل: {c.name} {c.phone ? `(${c.phone})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {filteredStatementSuppliers.length > 0 && (
                    <optgroup label={`الموردون (${filteredStatementSuppliers.length})`}>
                      {filteredStatementSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          مورد: {s.name} {s.phone ? `(${s.phone})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <label>
                <span className="text-xs font-bold text-[var(--ink)] block mb-1">{t("parties.fromDate", "من تاريخ (اختياري):")}</span>
                <input type="date" name="from" defaultValue={currentFrom} className="font-bold" />
              </label>

              <label>
                <span className="text-xs font-bold text-[var(--ink)] block mb-1">{t("parties.toDate", "إلى تاريخ (اختياري):")}</span>
                <input type="date" name="to" defaultValue={currentTo} className="font-bold" />
              </label>

              <div className="md:col-span-4 flex items-center justify-between pt-2">
                <button className="primary px-5 py-2.5 text-xs flex items-center gap-1.5 font-bold cursor-pointer" type="submit">
                  <Filter size={14} />
                  <span>{t("parties.filterStatement", "استعراض كشف الحساب")}</span>
                </button>
                {selectedParty && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="secondary px-4 py-2.5 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>{t("parties.printSelected", "طباعة الكشف المحدد")}</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Statement Sheet */}
          {selectedParty ? (
            <article className="panel statement-paper p-6 md:p-8 bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-md">
              <header className="paper-header pb-4 border-b-2 border-slate-800">
                <div className="flex items-start gap-3">
                  {storeLogo && (
                    <img
                      src={storeLogo}
                      alt={organization?.name ?? "متجر"}
                      className="w-12 h-12 rounded-lg object-contain border border-slate-200 p-0.5 shrink-0"
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      كشف حساب: {selectedParty.name}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">
                      النوع: {selectedParty.type === "customer" ? "عميل" : "مورد وشركة توريد"}
                      {selectedParty.phone && ` · هاتف: ${selectedParty.phone}`}
                      {selectedParty.address && ` · العنوان: ${selectedParty.address}`}
                    </p>
                  </div>
                </div>
                <div className="paper-meta text-left">
                  <span className="text-xs text-slate-500 font-bold block">الفترة المستعرضة:</span>
                  <strong className="text-xs font-black text-indigo-700 block">
                    {currentFrom || currentTo
                      ? `من ${currentFrom || "البداية"} إلى ${currentTo || "اليوم"}`
                      : "كامل السجل والمعاملات (شامل)"}
                  </strong>
                </div>
              </header>

              {/* Statement Row Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 my-3 print-hide">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={statementRowSearch}
                    onChange={(e) => setStatementRowSearch(e.target.value)}
                    placeholder="بحث في قيود الكشف (رقم الفاتورة، البيان، الملاحظات)..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div className="text-xs text-slate-600 font-bold">
                  عدد القيود المعروضة: {displayStatementEntries.length}{" "}
                  {displayStatementEntries.length !== statementEntries.length
                    ? `(من إجمالي ${statementEntries.length})`
                    : ""}
                </div>
              </div>

              <div className="table-wrap my-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50">
                      <th className="p-2 text-right">{t("common.date", "التاريخ")}</th>
                      <th className="p-2 text-right">{t("parties.transactionType", "نوع المعاملة")}</th>
                      <th className="p-2 text-right">{t("parties.notes", "البيان والملاحظات")}</th>
                      <th className="p-2 text-center w-28">{t("parties.debit", "مدين (لنا)")}</th>
                      <th className="p-2 text-center w-28">{t("parties.credit", "دائن (له)")}</th>
                      <th className="p-2 text-center w-36">{t("parties.runningBalance", "الرصيد الجاري")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayStatementEntries.length ? (
                      displayStatementEntries.map((row) => {
                        const dateFormatted =
                          row.id === "opening"
                            ? "رصيد افتتاحي"
                            : new Date(row.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              });

                        return (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 text-xs font-mono font-bold">{dateFormatted}</td>
                            <td className="p-2">
                              <span className="text-xs font-black text-slate-900">
                                {row.kind === "opening"
                                  ? "رصيد أول المدة"
                                  : row.kind === "invoice"
                                  ? "فاتورة تجارية"
                                  : row.kind === "payment"
                                  ? "سند قبض / دفع"
                                  : row.kind}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-slate-600 font-semibold">{row.notes ?? "—"}</td>
                            <td className="p-2 text-center font-black text-rose-600 font-mono">
                              {Number(row.debit) > 0 ? `${Number(row.debit).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} ج.م` : "—"}
                            </td>
                            <td className="p-2 text-center font-black text-emerald-700 font-mono">
                              {Number(row.credit) > 0 ? `${Number(row.credit).toLocaleString(locale === "en" ? "en-US" : "ar-EG")} ج.م` : "—"}
                            </td>
                            <td className="p-2 text-center font-black text-slate-900 font-mono">
                              {Math.abs(row.balance).toLocaleString(locale === "en" ? "en-US" : "ar-EG", { minimumFractionDigits: 2 })} ج.م
                              <small className="block text-[10px] text-slate-500 font-bold">
                                {row.balance > 0.005
                                  ? selectedParty.type === "customer"
                                    ? "مدين (عليه)"
                                    : "دائن (له)"
                                  : row.balance < -0.005
                                  ? selectedParty.type === "customer"
                                    ? "دائن (له)"
                                    : "مدين (عليه)"
                                  : "متوازن"}
                              </small>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500 font-bold">
                          لا توجد حركات مسجلة لهذا الحساب خلال الفترة المحددة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {statementEntries.length > 0 && (
                <div className="flex justify-end p-4 bg-slate-50 border border-slate-200 rounded-xl mt-4">
                  <div className="text-left">
                    <span className="text-xs text-slate-500 font-bold block mb-1">صافي الرصيد الختامي:</span>
                    <b className="text-2xl font-black text-indigo-700 font-mono">
                      {Math.abs(statementEntries.at(-1)?.balance ?? 0).toLocaleString(locale === "en" ? "en-US" : "ar-EG", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </b>
                  </div>
                </div>
              )}
            </article>
          ) : (
            <div className="p-8 text-center bg-[var(--panel)] border border-[var(--line)] rounded-xl text-[var(--muted)] shadow-xs">
              <BookOpenText size={32} className="mx-auto mb-2 opacity-50 text-indigo-600" />
              <p className="font-bold text-sm text-[var(--ink)]">يرجى اختيار عميل أو مورد من القائمة أعلاه</p>
              <p className="text-xs mt-1">سيتم استعراض كشف الحساب التفصيلي مع الرصيد الجاري وإمكانية الطباعة فور الاختيار.</p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          [عرض] MODAL: Party Full Details & Printable Sheet (Redesigned with High Contrast)
          ========================================================================= */}
      {viewingParty && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  {viewingParty.type === "customer" ? <Users size={20} /> : <Building2 size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
                    <span>{viewingParty.name}</span>
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        viewingParty.type === "customer"
                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      }`}
                    >
                      {viewingParty.type === "customer" ? t("parties.customer", "عميل") : t("parties.supplier", "مورد وشركة توريد")}
                    </span>
                  </h3>
                  <span className="text-xs text-[var(--muted)] font-semibold">
                    {t("parties.profileModalTitle", "معاينة بطاقة الحساب والبيانات المالية الكاملة")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title={t("common.print", "طباعة")}
                >
                  <Printer size={13} />
                  <span>{t("common.print", "طباعة")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingParty(null)}
                  className="w-8 h-8 rounded-lg border border-[var(--line)] hover:bg-[var(--surface-muted)] text-[var(--ink)] grid place-items-center cursor-pointer font-bold"
                  title={t("common.close", "إغلاق")}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body / High Contrast Cards */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Financial KPI Strip */}
              {(() => {
                const bal = balances[viewingParty.id] ?? Number(viewingParty.openingBalance);
                const isDebit = bal > 0.005;
                const isCredit = bal < -0.005;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-[var(--panel)] border-2 border-[var(--line)] shadow-xs">
                      <span className="text-xs text-[var(--muted)] font-extrabold block mb-1">
                        {t("parties.currentBalance", "الرصيد المالي الحالي")}
                      </span>
                      <b
                        className={`text-2xl font-black font-mono block ${
                          isDebit
                            ? viewingParty.type === "customer"
                              ? "text-rose-600"
                              : "text-emerald-700"
                            : isCredit
                            ? viewingParty.type === "customer"
                              ? "text-emerald-700"
                              : "text-rose-600"
                            : "text-slate-600"
                        }`}
                      >
                        {Math.abs(bal).toLocaleString(locale === "en" ? "en-US" : "ar-EG", { minimumFractionDigits: 2 })}{" "}
                        {t("common.egp", "ج.م")}
                      </b>
                      <span
                        className={`inline-block mt-2 px-2.5 py-1 rounded-md text-xs font-extrabold ${
                          isDebit
                            ? viewingParty.type === "customer"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isCredit
                            ? viewingParty.type === "customer"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                            : "bg-slate-100 text-slate-800 border border-slate-200"
                        }`}
                      >
                        {bal === 0
                          ? t("parties.settled", "الحساب متوازن وخالص تماماً")
                          : viewingParty.type === "customer"
                          ? isDebit
                            ? t("parties.hasDebt", "عليه مديونية مستحقة للمتجر")
                            : t("parties.hasCredit", "له رصيد دائن لصالحه")
                          : isDebit
                          ? t("parties.weOwe", "له مستحقات علينا واجبة السداد")
                          : t("parties.owesUs", "مستحق لنا عليه دفعات")}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--panel)] border-2 border-[var(--line)] shadow-xs">
                      <span className="text-xs text-[var(--muted)] font-extrabold block mb-1">
                        {t("parties.openingBalance", "الرصيد الافتتاحي عند التسجيل")}
                      </span>
                      <b className="text-2xl font-black text-[var(--ink)] font-mono block">
                        {Number(viewingParty.openingBalance).toLocaleString(locale === "en" ? "en-US" : "ar-EG", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {t("common.egp", "ج.م")}
                      </b>
                      <span className="block mt-2 text-xs text-[var(--muted)] font-bold">
                        {t("parties.registrationDate", "تاريخ التسجيل")}:{" "}
                        {new Date(viewingParty.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Contact & Profile Information Card */}
              <div className="p-4 rounded-xl bg-[var(--surface-muted)] border border-[var(--line)] space-y-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  {t("parties.contact", "بيانات الاتصال والعنوان")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-600 block mb-0.5 font-bold">
                      {t("parties.phone", "رقم الهاتف")}:
                    </span>
                    {viewingParty.phone ? (
                      <a
                        href={`tel:${viewingParty.phone}`}
                        className="font-mono font-black text-indigo-700 hover:underline inline-flex items-center gap-1.5 text-sm"
                        dir="ltr"
                      >
                        <Phone size={14} className="text-indigo-600" />
                        <span>{viewingParty.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 font-bold">{t("parties.unspecified", "غير محدد")}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-600 block mb-0.5 font-bold">
                      {t("parties.email", "البريد الإلكتروني")}:
                    </span>
                    {viewingParty.email ? (
                      <span className="font-mono text-slate-800 inline-flex items-center gap-1.5 font-bold">
                        <Mail size={13} className="text-slate-400" />
                        <span>{viewingParty.email}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold">{t("parties.unspecified", "غير محدد")}</span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-600 block mb-0.5 font-bold">
                      {t("parties.address", "العنوان والمقر")}:
                    </span>
                    {viewingParty.address ? (
                      <span className="text-slate-900 font-bold inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-rose-500 shrink-0" />
                        <span>{viewingParty.address}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold">{t("parties.unspecified", "غير محدد")}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions Preview / Jump to Statement Callout */}
              {selectedParty?.id === viewingParty.id && statementEntries.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-[var(--ink)]">
                      {t("parties.statement", "سجل القيود المالية المسجلة")} ({statementEntries.length})
                    </h4>
                  </div>
                  <div className="table-wrap max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("common.date", "التاريخ")}</th>
                          <th>{t("parties.transactionType", "النوع")}</th>
                          <th>{t("parties.notes", "البيان")}</th>
                          <th className="text-center">{t("parties.debit", "مدين")}</th>
                          <th className="text-center">{t("parties.credit", "دائن")}</th>
                          <th className="text-center">{t("parties.runningBalance", "الرصيد")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementEntries.map((row) => (
                          <tr key={row.id}>
                            <td className="text-[11px] font-mono font-bold">
                              {row.id === "opening"
                                ? "افتتاحي"
                                : new Date(row.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-EG")}
                            </td>
                            <td className="text-[11px] font-black">{row.kind}</td>
                            <td className="text-[11px] text-[var(--muted)] font-bold">{row.notes ?? "—"}</td>
                            <td className="text-center text-[11px] font-black text-rose-600 font-mono">
                              {Number(row.debit) > 0 ? Number(row.debit).toLocaleString(locale === "en" ? "en-US" : "ar-EG") : "—"}
                            </td>
                            <td className="text-center text-[11px] font-black text-emerald-700 font-mono">
                              {Number(row.credit) > 0 ? Number(row.credit).toLocaleString(locale === "en" ? "en-US" : "ar-EG") : "—"}
                            </td>
                            <td className="text-center text-[11px] font-black font-mono">
                              {Math.abs(row.balance).toLocaleString(locale === "en" ? "en-US" : "ar-EG", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-indigo-50 border-2 border-indigo-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div>
                    <b className="text-xs font-black text-indigo-900 block">
                      هل ترغب في فحص قيود الفواتير وسندات القبض تفصيلياً؟
                    </b>
                    <span className="text-[11px] text-indigo-700 font-bold">
                      يمكنك فتح كشف الحساب المالي الكامل وتصديره أو طباعته بتقرير محاسبي رسمي.
                    </span>
                  </div>
                  <Link
                    href={`/parties?tab=statement&partyId=${viewingParty.id}`}
                    onClick={() => setViewingParty(null)}
                    className="h-8 px-4 rounded-lg bg-indigo-600 text-white font-black text-xs inline-flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <BookOpenText size={14} />
                    <span>{t("parties.openFullStatement", "فتح كشف الحساب الكامل")}</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrint}
                className="secondary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer size={14} />
                <span>{t("parties.printReport", "طباعة هذا التقرير")}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingParty(null)}
                className="primary px-6 py-2 text-xs font-bold cursor-pointer shadow-xs"
              >
                {t("common.close", "إغلاق")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
