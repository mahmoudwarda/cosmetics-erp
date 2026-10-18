import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { cashboxes, parties, products, settings, units } from "@/server/db/schema";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import { requirePermission } from "@/server/permissions";
import { translate, Locale } from "@/lib/i18n";

export default async function NewInvoicePage() {
  if (!(await getSessionUserId())) redirect("/login");
  await requirePermission("invoices", "create");

  const [settingsRow] = await db
    .select({ locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const locale = (settingsRow?.locale ?? "ar") as Locale;

  const [items, accounts, boxes, unitList] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        stock: products.stock,
        salePrice: products.salePrice,
        costPrice: products.costPrice,
        unitId: products.unitId,
      })
      .from(products)
      .where(and(eq(products.active, true), isNull(products.deletedAt)))
      .orderBy(products.name),
    db
      .select({ id: parties.id, name: parties.name, type: parties.type })
      .from(parties)
      .where(isNull(parties.deletedAt))
      .orderBy(parties.name),
    db
      .select({ id: cashboxes.id, name: cashboxes.name })
      .from(cashboxes)
      .where(eq(cashboxes.active, true)),
    db
      .select({ id: units.id, name: units.name, factor: units.factor })
      .from(units)
      .orderBy(units.factor),
  ]);

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{translate("invoices.eyebrow", locale, "إدارة العمليات التجارية والفوترة")}</p>
          <h1>{translate("invoices.newTitle", locale, "إنشاء فاتورة جديدة")}</h1>
        </div>
        <Link className="secondary" href="/invoices">
          <ArrowRight size={15} />
          <span>{translate("invoices.backToList", locale, "سجل الفواتير")}</span>
        </Link>
      </header>

      <section className="panel">
        <InvoiceForm products={items} parties={accounts} cashboxes={boxes} units={unitList} />
      </section>
    </main>
  );
}
