import { redirect } from "next/navigation";
import { desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { categories, permissions, products, settings, units, users } from "@/server/db/schema";
import {
  saveProduct,
  deleteProduct,
  adjustStockFromForm,
  createCategory,
  updateCategory,
  deleteCategory,
  createUnit,
  updateUnit,
  deleteUnit,
} from "@/features/inventory/actions";
import { requirePermission } from "@/server/permissions";
import { InventoryTabsView } from "@/features/inventory/inventory-tabs-view";
import { translate, Locale } from "@/lib/i18n";

export default async function Inventory({
  searchParams,
}: {
  searchParams?: Promise<{ newBarcode?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("inventory", "view");

  const [settingsRow] = await db
    .select({ locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const locale = (settingsRow?.locale ?? "ar") as Locale;
  const localeCode = "en-US";

  const query = searchParams ? await searchParams : {};

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

  const [rows, cats, initialUnitRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(isNull(products.deletedAt))
      .orderBy(desc(products.createdAt))
      .limit(300),
    db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(categories.name),
    db
      .select()
      .from(units)
      .orderBy(units.factor),
  ]);
  let unitRows = initialUnitRows;

  // Seed standard packaging units if empty
  if (unitRows.length === 0) {
    try {
      await db
        .insert(units)
        .values([
          { name: "قطعة", factor: "1" },
          { name: "علبة (6 قطع)", factor: "6" },
          { name: "دستة (12 قطعة)", factor: "12" },
          { name: "كرتونة (24 قطعة)", factor: "24" },
        ])
        .onConflictDoNothing();
      unitRows = await db.select().from(units).orderBy(units.factor);
    } catch {
      // Fallback
    }
  }

  const lowStockCount = rows.filter((p) => Number(p.stock) <= Number(p.reorderLevel)).length;
  const totalStockUnits = rows.reduce((acc, p) => acc + Number(p.stock), 0);
  const totalInventoryCost = rows.reduce((acc, p) => acc + Number(p.stock) * Number(p.costPrice), 0);

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{translate("inventory.subtitle", locale, "الجرد والمستودعات والتصنيفات ووحدات التعبئة")}</p>
          <h1>{translate("inventory.title", locale, "المخزن وإدارة الأصناف")}</h1>
        </div>
        <div className="top-actions">
          <Link className="secondary" href="/">
            <ArrowRight size={15} />
            <span>{translate("common.home", locale, "الرئيسية")}</span>
          </Link>
        </div>
      </header>

      {/* Inventory KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
          <span className="text-xs text-[var(--muted)] font-semibold block mb-1">
            {locale === "en" ? "Total Registered Products" : "إجمالي الأصناف المسجلة"}
          </span>
          <b className="text-xl text-[var(--ink)] font-bold">
            {rows.length} {locale === "en" ? `items (${totalStockUnits.toLocaleString(localeCode)} units)` : `صنف (${totalStockUnits.toLocaleString(localeCode)} قطعة)`}
          </b>
        </div>
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
          <span className="text-xs text-[var(--muted)] font-semibold block mb-1">
            {translate("dash.lowStockCount", locale, "نواقص المخزون")}
          </span>
          <b className={`text-xl font-bold ${lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {lowStockCount} {lowStockCount > 0 ? (locale === "en" ? "low items" : "صنف منخفض") : (locale === "en" ? "Stock healthy" : "المخزون مكتمل")}
          </b>
        </div>
        <div className="p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
          <span className="text-xs text-[var(--muted)] font-semibold block mb-1">
            {translate("reports.inventoryCapital", locale, "رأس مال البضاعة بالمخزن")}
          </span>
          <b className="text-xl text-[var(--ink)] font-bold">
            {totalInventoryCost.toLocaleString(localeCode, { maximumFractionDigits: 2 })} {translate("common.egp", locale, "ج.م")}
          </b>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title mb-4">
          <div>
            <h3>{locale === "en" ? "Warehouse Catalog & Controls" : "دليل وإدارة المستودع"}</h3>
            <p>{locale === "en" ? "Manage products, categories, packaging units, and live inventory auditing" : "إدارة المنتجات، الأقسام، وحدات القياس والتعبئة، والتحكم المباشر في المخزون"}</p>
          </div>
          <span className="date-pill">
            {rows.length} {locale === "en" ? "registered items" : "صنف مسجل"}
          </span>
        </div>

        {/* 3-Tab Comprehensive Inventory View */}
        <InventoryTabsView
          products={rows}
          categories={cats}
          units={unitRows}
          can={{ create: can("create"), edit: can("edit"), delete: can("delete") }}
          saveProductAction={saveProduct}
          deleteProductAction={deleteProduct}
          adjustStockAction={adjustStockFromForm}
          createCategoryAction={createCategory}
          updateCategoryAction={updateCategory}
          deleteCategoryAction={deleteCategory}
          createUnitAction={createUnit}
          updateUnitAction={updateUnit}
          deleteUnitAction={deleteUnit}
          initialBarcode={query.newBarcode}
        />
      </section>
    </main>
  );
}
