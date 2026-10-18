import Link from "next/link";
import Image from "next/image";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Edit3, Store } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  cashTransactions,
  cashboxes,
  invoiceLines,
  invoices,
  parties,
  permissions,
  products,
  settings,
  units,
  users,
} from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import { InvoicePrintView } from "@/features/invoices/invoice-print-view";
import { localLogoUrl } from "@/server/services/branding";

export default async function InvoiceDetails({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("invoices", "view");

  const { id } = await params;
  const [row] = await db
    .select({ invoice: invoices, party: parties, org: settings })
    .from(invoices)
    .leftJoin(parties, eq(invoices.partyId, parties.id))
    .leftJoin(settings, eq(settings.id, 1))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!row) notFound();
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));

  const [editGrant, activeProducts, originalProducts, activeCashboxes, invoiceCash, activeParties, allUnits] = await Promise.all([
    db
      .select({ id: permissions.id })
      .from(users)
      .innerJoin(permissions, eq(users.roleId, permissions.roleId))
      .where(
        and(
          eq(users.id, userId),
          eq(users.active, true),
          eq(permissions.module, "invoices"),
          eq(permissions.action, "edit")
        )
      )
      .limit(1),
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
      .where(and(eq(products.active, true), isNull(products.deletedAt))),
    lines.some((line) => line.productId)
      ? db
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
          .where(
            inArray(
              products.id,
              lines.flatMap((line) => (line.productId ? [line.productId] : []))
            )
          )
      : Promise.resolve([]),
    db.select({ id: cashboxes.id, name: cashboxes.name }).from(cashboxes).where(eq(cashboxes.active, true)),
    db
      .select()
      .from(cashTransactions)
      .where(eq(cashTransactions.invoiceId, id))
      .orderBy(desc(cashTransactions.createdAt)),
    db
      .select({ id: parties.id, name: parties.name, type: parties.type })
      .from(parties)
      .where(isNull(parties.deletedAt)),
    db
      .select({ id: units.id, name: units.name, factor: units.factor })
      .from(units)
      .orderBy(units.factor),
  ]);

  const productOptions = [
    ...new Map([...activeProducts, ...originalProducts].map((product) => [product.id, product])).values(),
  ];
  const defaultCashbox =
    invoiceCash.find((entry) => activeCashboxes.some((box) => box.id === entry.cashboxId))?.cashboxId ?? "";
  const invoiceLogo = localLogoUrl(row.org?.logoPath);
  const invoice = row.invoice;
  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid));

  return (
    <main className="main standalone">
      {/* Top Header & Actions (Hidden on Print) */}
      <header className="topbar print-hide">
        <div>
          <p className="eyebrow">معاينة الفاتورة والطباعة</p>
          <h1>فاتورة {invoice.number}</h1>
        </div>
        <div className="top-actions">
          {editGrant.length > 0 && (invoice.type === "sale" || invoice.type === "purchase") && (
            <details className="editor print-hide">
              <summary className="primary">
                <Edit3 size={15} />
                <span>تعديل الفاتورة</span>
              </summary>
              <InvoiceForm
                products={productOptions}
                parties={activeParties}
                cashboxes={activeCashboxes}
                units={allUnits}
                initial={{
                  id: invoice.id,
                  type: invoice.type,
                  partyId: invoice.partyId,
                  cashboxId: defaultCashbox,
                  paid: invoice.paid,
                  discount: invoice.discount,
                  tax: invoice.tax,
                  lines: lines.map((line) => {
                    const unitMatch = line.description.match(/\[(.*?) × (\d+(\.\d+)?)\]/);
                    const unitName = unitMatch ? unitMatch[1] : undefined;
                    const unitFactor = unitMatch ? unitMatch[2] : undefined;
                    const matchedUnit = unitName ? allUnits.find((u) => u.name === unitName) : undefined;
                    return {
                      productId: line.productId ?? "",
                      name: line.description,
                      quantity: line.quantity,
                      unitPrice: line.unitPrice,
                      unitId: matchedUnit?.id,
                      unitName,
                      unitFactor,
                    };
                  }),
                }}
              />
            </details>
          )}
          <Link className="secondary" href="/invoices">
            <ArrowRight size={15} />
            <span>سجل الفواتير</span>
          </Link>
        </div>
      </header>

      {/* Invoice Multi-Format View & Print Component */}
      <InvoicePrintView
        data={{
          invoice: row.invoice,
          party: row.party,
          org: row.org,
          lines,
          invoiceLogo,
        }}
      />
    </main>
  );
}

