"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  Edit,
  FolderPlus,
  FolderTree,
  Package,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  Plus,
  Check,
  Sparkles,
} from "lucide-react";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { useI18n } from "@/lib/i18n-client";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  unitId: string | null;
  costPrice: string;
  salePrice: string;
  stock: string;
  reorderLevel: string;
  active: boolean;
};

type Category = {
  id: string;
  name: string;
};

type Unit = {
  id: string;
  name: string;
  factor: string;
};

export function InventoryTabsView({
  products,
  categories,
  units,
  can,
  saveProductAction,
  deleteProductAction,
  adjustStockAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createUnitAction,
  updateUnitAction,
  deleteUnitAction,
  initialBarcode,
}: {
  products: Product[];
  categories: Category[];
  units: Unit[];
  can: { create?: boolean; edit?: boolean; delete?: boolean } | ((action: string) => boolean);
  saveProductAction: (formData: FormData) => Promise<void>;
  deleteProductAction: (formData: FormData) => Promise<void>;
  adjustStockAction: (formData: FormData) => Promise<void>;
  createCategoryAction: (formData: FormData) => Promise<void>;
  updateCategoryAction: (formData: FormData) => Promise<void>;
  deleteCategoryAction: (formData: FormData) => Promise<void>;
  createUnitAction: (formData: FormData) => Promise<void>;
  updateUnitAction: (formData: FormData) => Promise<void>;
  deleteUnitAction: (formData: FormData) => Promise<void>;
  initialBarcode?: string;
}) {
  const canCheck = (action: string) => {
    if (typeof can === "function") return can(action);
    return Boolean(can?.[action as keyof typeof can]);
  };

  const { t, locale, isRtl } = useI18n();
  const localeCode = "en-US";

  const [activeTab, setActiveTab] = useState<"products" | "categories" | "units">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  const suggestedSku = useMemo(() => {
    if (initialBarcode) return `SKU-${initialBarcode}`;
    let maxNum = 0;
    for (const p of products) {
      const match = p.sku.match(/(?:SKN|SKU|PRD)-?(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }
    const nextNum = maxNum > 0 ? maxNum + 1 : products.length + 1;
    return `SKN-${String(nextNum).padStart(3, "0")}`;
  }, [products, initialBarcode]);

  const [skuInput, setSkuInput] = useState(suggestedSku);

  // Mappings
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const catCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const unitCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.unitId) counts.set(p.unitId, (counts.get(p.unitId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCatFilter && p.categoryId !== selectedCatFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku.toLowerCase().includes(q);
        const barcodeMatch = p.barcode?.toLowerCase().includes(q) ?? false;
        return nameMatch || skuMatch || barcodeMatch;
      }
      return true;
    });
  }, [products, selectedCatFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Main Navigation Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-[var(--line)] pb-3">
        <div className="w-full sm:w-auto overflow-x-auto pb-1 scrollbar-none">
          <div className="inline-flex items-center gap-1.5 p-1 bg-[var(--bg)] border border-[var(--line)] rounded-xl font-bold text-xs shrink-0 flex-nowrap min-w-full sm:min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold whitespace-nowrap shrink-0 flex-1 sm:flex-initial ${
                activeTab === "products"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
              }`}
            >
              <Package size={14} />
              <span>{t("inventory.productsTab")}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "products" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {products.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold whitespace-nowrap shrink-0 flex-1 sm:flex-initial ${
                activeTab === "categories"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
              }`}
            >
              <FolderTree size={14} />
              <span>{t("inventory.categoriesTab")}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "categories" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {categories.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("units")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold whitespace-nowrap shrink-0 flex-1 sm:flex-initial ${
                activeTab === "units"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--surface-muted)] border border-[var(--line)]"
              }`}
            >
              <Boxes size={14} />
              <span>{t("inventory.unitsTab")}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "units" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {units.length}
              </span>
            </button>
          </div>
        </div>

        {/* Global Action Triggers depending on active tab */}
        {activeTab === "products" && canCheck("create") && (
          <details className="editor" open={Boolean(initialBarcode)}>
            <summary className="primary text-xs py-2 px-3">
              <PackagePlus size={14} />
              <span>{t("inventory.addProduct")}</span>
            </summary>
            <form action={saveProductAction} className="form-grid">
              <CloseDisclosureButton title={t("inventory.addProduct")} />
              {initialBarcode && (
                <div className="wide-field p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800">
                  {t("inventory.barcodeScannedPrompt")}: «{initialBarcode}»
                </div>
              )}
              <label>
                {t("inventory.productName")}
                <input name="name" required minLength={2} placeholder={locale === "en" ? "e.g., Vitamin C Serum" : "مثال: سيروم فيتامين سي"} autoFocus={Boolean(initialBarcode)} />
              </label>
              <label>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[var(--ink)]">{t("inventory.sku")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const rnd = Math.floor(100 + Math.random() * 900);
                      setSkuInput(`SKN-${String(products.length + 1).padStart(3, "0")}-${rnd}`);
                    }}
                    className="text-[11px] text-indigo-700 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                    title={t("inventory.generateSku")}
                  >
                    <Sparkles size={11} />
                    <span>{t("inventory.generateSku")}</span>
                  </button>
                </div>
                <input
                  name="sku"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  placeholder="SKN-006"
                  required
                  className="font-mono font-bold"
                />
                <span className="text-[10px] text-[var(--muted)]">{t("inventory.skuHint")}</span>
              </label>
              <label>
                {t("inventory.barcode")}
                <input name="barcode" placeholder={t("inventory.barcodePlaceholder")} defaultValue={initialBarcode ?? ""} />
              </label>
              <label>
                {t("inventory.category")}
                <select name="categoryId">
                  <option value="">{t("inventory.noCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("inventory.unit")}
                <select name="unitId">
                  <option value="">{t("inventory.defaultUnit")}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({locale === "en" ? `Factor: ${Number(u.factor)} pcs` : `معامل التحويل: ${Number(u.factor)} قطعة`})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("inventory.costPrice")}
                <input name="costPrice" type="number" min="0" step="0.01" required defaultValue="0" />
              </label>
              <label>
                {t("inventory.salePrice")}
                <input name="salePrice" type="number" min="0" step="0.01" required defaultValue="0" />
              </label>
              <label>
                {t("inventory.openingStock")}
                <input name="stock" type="number" min="0" step="1" defaultValue="0" />
              </label>
              <label>
                {t("inventory.reorderLevel")}
                <input name="reorderLevel" type="number" min="0" step="1" defaultValue="5" />
              </label>
              <div className="form-actions">
                <button className="primary" type="submit">
                  {t("inventory.saveProduct")}
                </button>
              </div>
            </form>
          </details>
        )}
      </div>

      {/* =========================================================================
          TAB 1: PRODUCTS TABLE
          ========================================================================= */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Filters Bar: Search & Category */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
              <Search size={15} className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-[var(--muted)]`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("inventory.searchPlaceholder")}
                className={`w-full ${isRtl ? "pr-9 pl-8" : "pl-9 pr-8"} py-2 text-xs bg-[var(--panel)] border border-[var(--line)] rounded-xl focus:border-[var(--primary)] font-medium`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={`absolute ${isRtl ? "left-2.5" : "right-2.5"} top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]`}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="w-full sm:w-auto">
              <select
                value={selectedCatFilter}
                onChange={(e) => setSelectedCatFilter(e.target.value)}
                className="w-full sm:w-56 py-2 px-3 text-xs bg-[var(--panel)] border border-[var(--line)] rounded-xl"
              >
                <option value="">{t("inventory.allCategories")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({catCounts.get(c.id) ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Table */}
          <div className="desktop-table-only table-wrap">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr>
                  <th>{t("inventory.colProduct")}</th>
                  <th>{t("inventory.colSkuBarcode")}</th>
                  <th>{t("inventory.colCategory")}</th>
                  <th>{t("inventory.colCost")}</th>
                  <th>{t("inventory.colPrice")}</th>
                  <th>{t("inventory.colStock")}</th>
                  <th>{t("inventory.colReorder")}</th>
                  <th>{t("inventory.colStatus")}</th>
                  {canCheck("edit") || canCheck("delete") ? <th>{t("inventory.colActions")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length ? (
                  filteredProducts.map((p) => {
                    const stockNum = Number(p.stock);
                    const isOut = stockNum <= 0;
                    const isLow = stockNum <= Number(p.reorderLevel);
                    const catName = p.categoryId ? catMap.get(p.categoryId) : null;
                    const unit = p.unitId ? unitMap.get(p.unitId) : null;
                    const unitFactor = unit ? Number(unit.factor) : 1;

                    let packagingText = "";
                    if (unitFactor > 1 && stockNum > 0) {
                      const boxesCount = Math.floor(stockNum / unitFactor);
                      const remainder = stockNum % unitFactor;
                      packagingText = ` (${boxesCount} ${unit?.name || (locale === "en" ? "carton" : "كرتونة")}${
                        remainder > 0 ? (locale === "en" ? ` & ${remainder} pcs` : ` و ${remainder} قطعة`) : ""
                      })`;
                    }

                    return (
                      <tr key={p.id} className="transition-colors">
                        <td>
                          <b className="text-[var(--ink)] block font-bold">{p.name}</b>
                          {unit && (
                            <span className="text-[11px] text-indigo-700 font-semibold block mt-0.5">
                              {t("inventory.unitPrefix")} {unit.name}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 block w-fit mb-1">
                            {p.sku}
                          </span>
                          {p.barcode && <span className="text-[11px] text-[var(--muted)] font-mono block">{p.barcode}</span>}
                        </td>
                        <td>
                          {catName ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50/70 text-indigo-700 border border-indigo-200/70">
                              {catName}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">{t("inventory.generalCat")}</span>
                          )}
                        </td>
                        <td>{Number(p.costPrice).toLocaleString(localeCode)} {t("common.egp")}</td>
                        <td className="font-bold text-[var(--ink)]">
                          {Number(p.salePrice).toLocaleString(localeCode)} {t("common.egp")}
                        </td>
                        <td className="font-bold">
                          <span className={isOut ? "text-rose-600 font-extrabold" : isLow ? "text-amber-600 font-extrabold" : "text-emerald-700"}>
                            {stockNum.toLocaleString(localeCode)} {t("common.piece")}
                          </span>
                          {packagingText && (
                            <span className="text-xs text-[var(--muted)] block font-normal">
                              {packagingText}
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-[var(--muted)]">{p.reorderLevel}</td>
                        <td>
                          <span className={`status ${isOut ? "unpaid" : isLow ? "partial" : "paid"}`}>
                            {isOut ? t("common.outOfStock") : isLow ? t("common.low") : t("common.available")}
                          </span>
                        </td>
                        {canCheck("edit") || canCheck("delete") ? (
                          <td className="row-actions">
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              {canCheck("edit") && (
                                <details className="row-editor">
                                  <summary className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap">
                                    <Edit size={12} />
                                    <span>{t("common.edit")}</span>
                                  </summary>
                                  <form action={saveProductAction} className="form-grid">
                                    <CloseDisclosureButton title={`${t("common.edit")}: ${p.name}`} />
                                    <input type="hidden" name="id" value={p.id} />
                                    <label>
                                      {t("inventory.productName")}
                                      <input name="name" defaultValue={p.name} required />
                                    </label>
                                    <label>
                                      {t("inventory.sku")}
                                      <input name="sku" defaultValue={p.sku} required />
                                    </label>
                                    <label>
                                      {t("inventory.barcode")}
                                      <input name="barcode" defaultValue={p.barcode ?? ""} />
                                    </label>
                                    <label>
                                      {t("inventory.category")}
                                      <select name="categoryId" defaultValue={p.categoryId ?? ""}>
                                        <option value="">{t("inventory.noCategory")}</option>
                                        {categories.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      {t("inventory.unit")}
                                      <select name="unitId" defaultValue={p.unitId ?? ""}>
                                        <option value="">{t("inventory.defaultUnit")}</option>
                                        {units.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            {u.name} ({locale === "en" ? `Factor: ${Number(u.factor)} pcs` : `معامل التحويل: ${Number(u.factor)} قطعة`})
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      {t("inventory.costPrice")}
                                      <input
                                        name="costPrice"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={p.costPrice}
                                      />
                                    </label>
                                    <label>
                                      {t("inventory.salePrice")}
                                      <input
                                        name="salePrice"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={p.salePrice}
                                      />
                                    </label>
                                    <label>
                                      {t("inventory.reorderLevel")}
                                      <input
                                        name="reorderLevel"
                                        type="number"
                                        step="1"
                                        min="0"
                                        defaultValue={p.reorderLevel}
                                      />
                                    </label>
                                    <label className="check-label">
                                      <input type="hidden" name="active" value="off" />
                                      <input
                                        name="active"
                                        type="checkbox"
                                        value="on"
                                        defaultChecked={p.active}
                                      />
                                      <span>{t("inventory.activeInSales")}</span>
                                    </label>
                                    <div className="form-actions">
                                      <button className="primary" type="submit">
                                        {t("inventory.saveEdits")}
                                      </button>
                                    </div>
                                  </form>
                                </details>
                              )}

                              {canCheck("edit") && (
                                <details className="row-editor">
                                  <summary className="h-8 px-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap">
                                    <SlidersHorizontal size={12} />
                                    <span>{t("inventory.adjustStock")}</span>
                                  </summary>
                                  <form action={adjustStockAction} className="inline-form">
                                    <CloseDisclosureButton title={`${t("inventory.adjustStockTitle")}: ${p.name}`} />
                                    <input type="hidden" name="productId" value={p.id} />
                                    <div className="p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs">
                                      <span>{t("inventory.currentRecordedStock")}: </span>
                                      <b>{Math.floor(Number(p.stock))} {t("common.piece")}</b>
                                    </div>
                                    <label>
                                      {t("inventory.quantityDiff")}
                                      <input
                                        name="quantity"
                                        type="number"
                                        step="1"
                                        required
                                        placeholder={locale === "en" ? "+5 or -2" : "مثال: +5 أو -2"}
                                      />
                                    </label>
                                    <label>
                                      {t("inventory.adjustNote")}
                                      <input
                                        name="reason"
                                        minLength={4}
                                        required
                                        placeholder={locale === "en" ? "Routine audit, damaged goods, stock entry" : "مثال: جرد دوري، عجز تلف، إدخال مخزني"}
                                      />
                                    </label>
                                    <button className="primary">{t("inventory.saveAdjustment")}</button>
                                  </form>
                                </details>
                              )}

                              {canCheck("delete") && (
                                <form action={deleteProductAction} className="inline-flex">
                                  <input type="hidden" name="id" value={p.id} />
                                  <ConfirmSubmitButton
                                    confirmMessage={locale === "en" ? `Are you sure you want to permanently delete "${p.name}"?` : `هل أنت متأكد من رغبتك في حذف الصنف «${p.name}» نهائياً من المستودع؟`}
                                    className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap"
                                    title={t("common.delete")}
                                    ariaLabel={`${t("common.delete")} ${p.name}`}
                                  >
                                    <Trash2 size={12} />
                                    <span>{t("common.delete")}</span>
                                  </ConfirmSubmitButton>
                                </form>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="table-empty">
                      {t("inventory.emptyProducts")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Products Mobile Cards */}
          <div className="mobile-cards-only space-y-3">
            {filteredProducts.length ? (
              filteredProducts.map((p) => {
                const stockNum = Number(p.stock);
                const isOut = stockNum <= 0;
                const isLow = stockNum <= Number(p.reorderLevel);
                const catName = p.categoryId ? catMap.get(p.categoryId) : null;
                const unit = p.unitId ? unitMap.get(p.unitId) : null;
                const unitFactor = unit ? Number(unit.factor) : 1;

                let packagingText = "";
                if (unitFactor > 1 && stockNum > 0) {
                  const boxesCount = Math.floor(stockNum / unitFactor);
                  const remainder = stockNum % unitFactor;
                  packagingText = ` (${boxesCount} ${unit?.name || (locale === "en" ? "carton" : "كرتونة")}${
                    remainder > 0 ? (locale === "en" ? ` & ${remainder} pcs` : ` و ${remainder} قطعة`) : ""
                  })`;
                }

                return (
                  <div key={`mob-${p.id}`} className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-sm space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <b className="text-sm font-bold text-[var(--ink)] block truncate">{p.name}</b>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {p.sku}
                          </span>
                          {catName && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                              {catName}
                            </span>
                          )}
                          {unit && (
                            <span className="text-[11px] text-indigo-700 font-semibold">
                              {unit.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`status shrink-0 text-[11px] ${isOut ? "unpaid" : isLow ? "partial" : "paid"}`}>
                        {isOut ? t("common.outOfStock") : isLow ? t("common.low") : t("common.available")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-[var(--bg)] rounded-lg text-center border border-[var(--line)]">
                      <div>
                        <span className="text-[10px] text-[var(--muted)] block">{t("inventory.colPrice")}</span>
                        <b className="text-xs font-bold text-[var(--ink)]">{Number(p.salePrice).toLocaleString(localeCode)} {t("common.egp")}</b>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--muted)] block">{t("inventory.colCost")}</span>
                        <span className="text-xs text-[var(--muted)]">{Number(p.costPrice).toLocaleString(localeCode)} {t("common.egp")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--muted)] block">{t("inventory.colStock")}</span>
                        <b className={`text-xs font-extrabold ${isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-emerald-700"}`}>
                          {stockNum.toLocaleString(localeCode)}
                        </b>
                      </div>
                    </div>

                    {packagingText && (
                      <div className="text-[11px] text-[var(--muted)] text-center">
                        {packagingText}
                      </div>
                    )}

                    {(canCheck("edit") || canCheck("delete")) && (
                      <div className="pt-2 border-t border-[var(--line)] flex items-center justify-end gap-2 flex-wrap">
                        {canCheck("edit") && (
                          <details className="row-editor">
                            <summary className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer">
                              <Edit size={12} />
                              <span>{t("common.edit")}</span>
                            </summary>
                            <form action={saveProductAction} className="form-grid">
                              <CloseDisclosureButton title={`${t("common.edit")}: ${p.name}`} />
                              <input type="hidden" name="id" value={p.id} />
                              <label>
                                {t("inventory.productName")}
                                <input name="name" defaultValue={p.name} required />
                              </label>
                              <label>
                                {t("inventory.sku")}
                                <input name="sku" defaultValue={p.sku} required />
                              </label>
                              <label>
                                {t("inventory.barcode")}
                                <input name="barcode" defaultValue={p.barcode ?? ""} />
                              </label>
                              <label>
                                {t("inventory.category")}
                                <select name="categoryId" defaultValue={p.categoryId ?? ""}>
                                  <option value="">{t("inventory.noCategory")}</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                {t("inventory.unit")}
                                <select name="unitId" defaultValue={p.unitId ?? ""}>
                                  <option value="">{t("inventory.defaultUnit")}</option>
                                  {units.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({locale === "en" ? `Factor: ${Number(u.factor)} pcs` : `معامل التحويل: ${Number(u.factor)} قطعة`})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                {t("inventory.costPrice")}
                                <input
                                  name="costPrice"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  defaultValue={p.costPrice}
                                  required
                                />
                              </label>
                              <label>
                                {t("inventory.salePrice")}
                                <input
                                  name="salePrice"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  defaultValue={p.salePrice}
                                  required
                                />
                              </label>
                              <label>
                                {t("inventory.reorderLevel")}
                                <input
                                  name="reorderLevel"
                                  type="number"
                                  step="1"
                                  min="0"
                                  defaultValue={p.reorderLevel}
                                />
                              </label>
                              <label className="check-label">
                                <input type="hidden" name="active" value="off" />
                                <input
                                  name="active"
                                  type="checkbox"
                                  value="on"
                                  defaultChecked={p.active}
                                />
                                <span>{t("inventory.activeInSales")}</span>
                              </label>
                              <div className="form-actions">
                                <button className="primary" type="submit">
                                  {t("inventory.saveEdits")}
                                </button>
                              </div>
                            </form>
                          </details>
                        )}

                        {canCheck("edit") && (
                          <details className="row-editor">
                            <summary className="h-8 px-2.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer">
                              <SlidersHorizontal size={12} />
                              <span>{t("inventory.adjustStock")}</span>
                            </summary>
                            <form action={adjustStockAction} className="inline-form">
                              <CloseDisclosureButton title={`${t("inventory.adjustStockTitle")}: ${p.name}`} />
                              <input type="hidden" name="productId" value={p.id} />
                              <div className="p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs">
                                <span>{t("inventory.currentRecordedStock")}: </span>
                                <b>{Math.floor(Number(p.stock))} {t("common.piece")}</b>
                              </div>
                              <label>
                                <span>{t("inventory.actualStockFound")} ({t("common.pieces")}):</span>
                                <input
                                  name="actualStock"
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder={String(Math.floor(Number(p.stock)))}
                                  required
                                  autoFocus
                                  className="font-mono font-bold"
                                />
                              </label>
                              <label>
                                <span>{t("inventory.reason")}:</span>
                                <input
                                  name="reason"
                                  placeholder={t("inventory.reasonPlaceholder")}
                                  defaultValue={locale === "en" ? "Inventory recount audit" : "جرد فعلي للمخزن"}
                                  required
                                />
                              </label>
                              <div className="form-actions">
                                <button className="primary" type="submit">
                                  {t("inventory.saveStockAdjustment")}
                                </button>
                              </div>
                            </form>
                          </details>
                        )}

                        {canCheck("delete") && (
                          <form action={deleteProductAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <ConfirmSubmitButton
                              confirmMessage={locale === "en" ? `Are you sure you want to delete product "${p.name}"?` : `هل أنت متأكد من رغبتك في حذف الصنف «${p.name}»؟`}
                              className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                              title={t("common.delete")}
                              ariaLabel={`${t("common.delete")} ${p.name}`}
                            >
                              <Trash2 size={12} />
                              <span>{t("common.delete")}</span>
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-[var(--muted)] bg-[var(--panel)] border border-[var(--line)] rounded-xl">
                {t("inventory.emptyProducts")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CATEGORIES FULL TABLE
          ========================================================================= */}
      {activeTab === "categories" && (
        <div className="space-y-5">
          {/* Add Category Card */}
          {canCheck("create") && (
            <div className="bg-[var(--panel)] border border-[var(--line-strong)] rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-indigo-50/70 via-slate-50/50 to-transparent border-b border-[var(--line)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <FolderPlus size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)]">إضافة قسم أو تصنيف جديد</h3>
                    <p className="text-[11px] text-[var(--muted)]">تنظيم المنتجات في مجموعات لتسهيل الفرز والتقارير</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  نموذج تسجيل سريع
                </span>
              </div>
              <form action={createCategoryAction} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <label className="flex-1 w-full space-y-1.5">
                    <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1">
                      <span>{t("inventory.newCategoryName")}</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </span>
                    <input
                      name="name"
                      required
                      minLength={2}
                      placeholder={locale === "en" ? "e.g., Skincare, Makeup, Perfumes..." : "مثال: عناية بالبشرة، مستحضرات تجميل، عطور..."}
                      className="w-full text-xs h-11 px-3.5 rounded-xl border border-[var(--line-strong)] bg-white focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 transition-all"
                    />
                  </label>
                  <button
                    className="primary px-6 h-11 text-xs font-bold flex items-center justify-center gap-2 shrink-0 rounded-xl cursor-pointer shadow-xs active:scale-97 transition-all w-full sm:w-auto"
                    type="submit"
                  >
                    <FolderPlus size={15} />
                    <span>{t("inventory.saveCategory")}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Categories Full Table Header */}
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
              <FolderTree size={15} className="text-indigo-600" />
              <span>الأقسام والتصنيفات المسجلة</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              {categories.length} تصنيف
            </span>
          </div>

          {/* Categories Full Table */}
          <div className="desktop-table-only table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-16 text-center">#</th>
                  <th>{t("inventory.colCategory")}</th>
                  <th className="text-center w-36">{t("inventory.categoryCount")}</th>
                  <th className="w-48 text-center">{t("inventory.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {categories.length ? (
                  categories.map((c, idx) => {
                    const count = catCounts.get(c.id) ?? 0;
                    const isEditing = editingCatId === c.id;

                    return (
                      <tr key={c.id} className="transition-colors">
                        <td className="text-center font-mono text-xs text-[var(--muted)]">{idx + 1}</td>
                        <td>
                          {isEditing ? (
                            <form action={updateCategoryAction} className="flex items-center gap-2">
                              <input type="hidden" name="id" value={c.id} />
                              <input
                                name="name"
                                defaultValue={c.name}
                                required
                                className="text-xs py-1 px-2.5 rounded border border-indigo-400 font-bold"
                                autoFocus
                              />
                              <button type="submit" className="primary px-2.5 py-1 text-xs flex items-center gap-1">
                                <Check size={12} />
                                <span>{t("common.save")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCatId(null)}
                                className="secondary px-2 py-1 text-xs"
                              >
                                {t("common.cancel")}
                              </button>
                            </form>
                          ) : (
                            <b className="text-sm font-bold text-[var(--ink)]">{c.name}</b>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {count} {locale === "en" ? "items" : "صنف"}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2 flex-nowrap">
                            {canCheck("edit") && !isEditing && (
                              <button
                                type="button"
                                onClick={() => setEditingCatId(c.id)}
                                className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap"
                              >
                                <Edit size={12} />
                                <span>{t("common.edit")}</span>
                              </button>
                            )}

                            {canCheck("delete") && (
                              <form action={deleteCategoryAction}>
                                <input type="hidden" name="id" value={c.id} />
                                <ConfirmSubmitButton
                                  confirmMessage={locale === "en" ? `Are you sure you want to delete category "${c.name}"?` : `هل أنت متأكد من رغبتك في حذف قسم «${c.name}»؟`}
                                  className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap"
                                  title={t("common.delete")}
                                  ariaLabel={`${t("common.delete")} ${c.name}`}
                                >
                                  <Trash2 size={12} />
                                  <span>{t("common.delete")}</span>
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
                    <td colSpan={4} className="table-empty">
                      {t("inventory.emptyCategories")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Categories Mobile Cards */}
          <div className="mobile-cards-only space-y-2.5">
            {categories.length ? (
              categories.map((c, idx) => {
                const count = catCounts.get(c.id) ?? 0;
                const isEditing = editingCatId === c.id;

                return (
                  <div key={`mob-cat-${c.id}`} className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs space-y-2.5">
                    {isEditing ? (
                      <form action={updateCategoryAction} className="space-y-2">
                        <input type="hidden" name="id" value={c.id} />
                        <label className="block">
                          <span className="text-xs text-[var(--muted)] font-semibold block mb-1">{t("inventory.colCategory")}:</span>
                          <input
                            name="name"
                            defaultValue={c.name}
                            required
                            className="w-full text-xs py-2 px-3 rounded-lg border border-indigo-400 font-bold"
                            autoFocus
                          />
                        </label>
                        <div className="flex items-center gap-2 justify-end">
                          <button type="submit" className="primary px-3 py-1.5 text-xs flex items-center gap-1 font-bold">
                            <Check size={12} />
                            <span>{t("common.save")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="secondary px-3 py-1.5 text-xs font-bold"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                              {idx + 1}
                            </span>
                            <b className="text-sm font-bold text-[var(--ink)]">{c.name}</b>
                          </div>
                          <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            {count} {locale === "en" ? "items" : "صنف"}
                          </span>
                        </div>

                        {(canCheck("edit") || canCheck("delete")) && (
                          <div className="pt-2 border-t border-[var(--line)] flex items-center justify-end gap-2">
                            {canCheck("edit") && (
                              <button
                                type="button"
                                onClick={() => setEditingCatId(c.id)}
                                className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                              >
                                <Edit size={12} />
                                <span>{t("common.edit")}</span>
                              </button>
                            )}

                            {canCheck("delete") && (
                              <form action={deleteCategoryAction} className="inline-flex">
                                <input type="hidden" name="id" value={c.id} />
                                <ConfirmSubmitButton
                                  confirmMessage={locale === "en" ? `Are you sure you want to delete category "${c.name}"?` : `هل أنت متأكد من رغبتك في حذف قسم «${c.name}»؟`}
                                  className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                                  title={t("common.delete")}
                                  ariaLabel={`${t("common.delete")} ${c.name}`}
                                >
                                  <Trash2 size={12} />
                                  <span>{t("common.delete")}</span>
                                </ConfirmSubmitButton>
                              </form>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-[var(--muted)] bg-[var(--panel)] border border-[var(--line)] rounded-xl">
                {t("inventory.emptyCategories")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: UNITS & PACKAGING FULL TABLE
          ========================================================================= */}
      {activeTab === "units" && (
        <div className="space-y-5">
          {/* Add Unit Card */}
          {canCheck("create") && (
            <div className="bg-[var(--panel)] border border-[var(--line-strong)] rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-indigo-50/70 via-slate-50/50 to-transparent border-b border-[var(--line)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Boxes size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--ink)]">تسجيل وحدة قياس وعبوة جديدة</h3>
                    <p className="text-[11px] text-[var(--muted)]">تعريف معاملات الكراتين والعلب لتحويل الكميات تلقائياً إلى قطع</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  معامل التعبئة والتجزئة
                </span>
              </div>
              <form action={createUnitAction} className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                  <label className="sm:col-span-6 space-y-1.5">
                    <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1">
                      <span>{t("inventory.newUnitName")}</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </span>
                    <input
                      name="name"
                      required
                      minLength={1}
                      placeholder={locale === "en" ? "e.g., Carton 24 pcs, Pack of 6, Dozen..." : "مثال: كرتونة 24 قطعة، علبة 6، دستة..."}
                      className="w-full text-xs h-11 px-3.5 rounded-xl border border-[var(--line-strong)] bg-white focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 transition-all"
                    />
                  </label>
                  <label className="sm:col-span-3 space-y-1.5">
                    <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1">
                      <span>{t("inventory.unitPackagingFactor")}</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </span>
                    <input
                      name="factor"
                      type="number"
                      min="1"
                      step="1"
                      required
                      defaultValue="1"
                      className="w-full text-xs h-11 px-3.5 rounded-xl border border-[var(--line-strong)] bg-white font-mono font-bold focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 transition-all text-center"
                    />
                  </label>
                  <div className="sm:col-span-3">
                    <button
                      className="primary w-full h-11 text-xs font-bold flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-xs active:scale-97 transition-all"
                      type="submit"
                    >
                      <Plus size={15} />
                      <span>{t("inventory.saveUnit")}</span>
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--line)] flex items-center gap-2 text-[11px] text-[var(--muted)]">
                  <span className="text-indigo-600 font-bold">💡 إرشاد:</span>
                  <span>اكتب اسم العبوة (مثال: كرتونة)، وحدد كم قطعة بداخلها في معامل التحويل (مثال: 24).</span>
                </div>
              </form>
            </div>
          )}

          {/* Units Full Table Header */}
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
              <Boxes size={15} className="text-indigo-600" />
              <span>وحدات القياس والعبوات المسجلة</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              {units.length} وحدة
            </span>
          </div>

          {/* Units Full Table */}
          <div className="desktop-table-only table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-16 text-center">#</th>
                  <th>{t("inventory.newUnitName")}</th>
                  <th className="text-center w-44">{t("inventory.unitPackagingFactor")}</th>
                  <th className="text-center w-36">{t("inventory.categoryCount")}</th>
                  <th className="w-48 text-center">{t("inventory.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {units.length ? (
                  units.map((u, idx) => {
                    const count = unitCounts.get(u.id) ?? 0;
                    const isEditing = editingUnitId === u.id;

                    return (
                      <tr key={u.id} className="transition-colors">
                        <td className="text-center font-mono text-xs text-[var(--muted)]">{idx + 1}</td>
                        <td>
                          {isEditing ? (
                            <form action={updateUnitAction} className="flex items-center gap-2 flex-wrap">
                              <input type="hidden" name="id" value={u.id} />
                              <input
                                name="name"
                                defaultValue={u.name}
                                required
                                className="text-xs py-1 px-2.5 rounded border border-indigo-400 font-bold"
                              />
                              <input
                                name="factor"
                                type="number"
                                min="1"
                                defaultValue={u.factor}
                                required
                                className="text-xs py-1 px-2 w-20 rounded border border-indigo-400 font-bold font-mono"
                              />
                              <button type="submit" className="primary px-2.5 py-1 text-xs flex items-center gap-1">
                                <Check size={12} />
                                <span>{t("common.save")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUnitId(null)}
                                className="secondary px-2 py-1 text-xs"
                              >
                                {t("common.cancel")}
                              </button>
                            </form>
                          ) : (
                            <b className="text-sm font-bold text-[var(--ink)]">{u.name}</b>
                          )}
                        </td>
                        <td className="text-center font-mono font-bold text-sm text-indigo-700">
                          {Number(u.factor)} {t("common.pieces")}
                        </td>
                        <td className="text-center">
                          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {count} {locale === "en" ? "items" : "صنف"}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2 flex-nowrap">
                            {canCheck("edit") && !isEditing && (
                              <button
                                type="button"
                                onClick={() => setEditingUnitId(u.id)}
                                className="h-8 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap"
                              >
                                <Edit size={12} />
                                <span>{t("common.edit")}</span>
                              </button>
                            )}

                            {canCheck("delete") && (
                              <form action={deleteUnitAction}>
                                <input type="hidden" name="id" value={u.id} />
                                <ConfirmSubmitButton
                                  confirmMessage={locale === "en" ? `Are you sure you want to delete unit "${u.name}"? It will be unlinked from existing products.` : `هل أنت متأكد من حذف وحدة «${u.name}»؟ سيتم فك ارتباطها عن الأصناف المسجلة.`}
                                  className="h-8 px-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer flex-nowrap whitespace-nowrap"
                                  title={t("common.delete")}
                                  ariaLabel={`${t("common.delete")} ${u.name}`}
                                >
                                  <Trash2 size={12} />
                                  <span>{t("common.delete")}</span>
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
                    <td colSpan={5} className="table-empty">
                      {t("inventory.emptyUnits")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Units Mobile Cards */}
          <div className="mobile-cards-only space-y-2.5">
            {units.length ? (
              units.map((u, idx) => {
                const count = unitCounts.get(u.id) ?? 0;
                const isEditing = editingUnitId === u.id;

                return (
                  <div key={`mob-unit-${u.id}`} className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xs space-y-2.5">
                    {isEditing ? (
                      <form action={updateUnitAction} className="space-y-2">
                        <input type="hidden" name="id" value={u.id} />
                        <label className="block">
                          <span className="text-xs text-[var(--muted)] font-semibold block mb-1">{t("inventory.newUnitName")}:</span>
                          <input
                            name="name"
                            defaultValue={u.name}
                            required
                            className="w-full text-xs py-2 px-3 rounded-lg border border-indigo-400 font-bold"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-[var(--muted)] font-semibold block mb-1">{t("inventory.unitPackagingFactor")}:</span>
                          <input
                            name="factor"
                            type="number"
                            min="1"
                            defaultValue={u.factor}
                            required
                            className="w-full text-xs py-2 px-3 rounded-lg border border-indigo-400 font-bold font-mono"
                          />
                        </label>
                        <div className="flex items-center gap-2 justify-end">
                          <button type="submit" className="primary px-3 py-1.5 text-xs flex items-center gap-1 font-bold">
                            <Check size={12} />
                            <span>{t("common.save")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUnitId(null)}
                            className="secondary px-3 py-1.5 text-xs font-bold"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                              {idx + 1}
                            </span>
                            <div>
                              <b className="text-sm font-bold text-[var(--ink)] block">{u.name}</b>
                              <span className="text-xs font-mono font-bold text-indigo-700 block mt-0.5">
                                {Number(u.factor)} {t("common.pieces")}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            {count} {locale === "en" ? "items" : "صنف"}
                          </span>
                        </div>

                        {(canCheck("edit") || canCheck("delete")) && (
                          <div className="pt-2 border-t border-[var(--line)] flex items-center justify-end gap-2">
                            {canCheck("edit") && (
                              <button
                                type="button"
                                onClick={() => setEditingUnitId(u.id)}
                                className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                              >
                                <Edit size={12} />
                                <span>{t("common.edit")}</span>
                              </button>
                            )}

                            {canCheck("delete") && (
                              <form action={deleteUnitAction} className="inline-flex">
                                <input type="hidden" name="id" value={u.id} />
                                <ConfirmSubmitButton
                                  confirmMessage={locale === "en" ? `Are you sure you want to delete unit "${u.name}"? It will be unlinked from existing products.` : `هل أنت متأكد من حذف وحدة «${u.name}»؟ سيتم فك ارتباطها عن الأصناف المسجلة.`}
                                  className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                                  title={t("common.delete")}
                                  ariaLabel={`${t("common.delete")} ${u.name}`}
                                >
                                  <Trash2 size={12} />
                                  <span>{t("common.delete")}</span>
                                </ConfirmSubmitButton>
                              </form>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-sm text-[var(--muted)] bg-[var(--panel)] border border-[var(--line)] rounded-xl">
                {t("inventory.emptyUnits")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
