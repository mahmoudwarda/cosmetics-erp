import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { restoreEditedInvoiceStock, reverseCashKind } from "@/server/services/ledger-math";
import { cashTransactions, cashboxes, invoiceLines, invoices, parties, partyLedger, products, stockMovements } from "@/server/db/schema";

export type InvoiceInput = {
  type: "sale" | "purchase" | "sale_return" | "purchase_return";
  partyId?: string | null;
  cashboxId?: string | null;
  paid: string;
  discount?: string;
  tax?: string;
  lines: {
    productId: string;
    quantity: string;
    unitPrice: string;
    unitName?: string;
    unitFactor?: string;
  }[];
};
const money = (n: number) => n.toFixed(2);
export async function createInvoice(input: InvoiceInput, userId: string) {
  if (input.lines.length === 0) throw new Error("INVOICE_REQUIRES_LINES");
  if (!["sale", "purchase", "sale_return", "purchase_return"].includes(input.type)) {
    throw new Error("INVALID_INVOICE_TYPE");
  }
  const disc = Number(input.discount ?? 0),
    tax = Number(input.tax ?? 0),
    paid = Number(input.paid);
  if ([disc, tax, paid].some((n) => !Number.isFinite(n) || n < 0)) throw new Error("INVALID_AMOUNT");
  if (paid > 0 && !input.cashboxId) throw new Error("CASHBOX_REQUIRED_FOR_PAYMENT");

  return db.transaction(async (tx) => {
    const normalized = [];
    const quantitiesByProduct = new Map<string, number>();
    let subtotal = 0;

    for (const line of input.lines) {
      const qty = Number(line.quantity),
        price = Number(line.unitPrice);
      const factor = Number(line.unitFactor ?? 1) || 1;
      const stockQty = qty * factor;

      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
        throw new Error("INVALID_LINE");
      }
      const [p] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, line.productId), eq(products.active, true)))
        .limit(1);
      if (!p) throw new Error("PRODUCT_NOT_FOUND");
      quantitiesByProduct.set(p.id, (quantitiesByProduct.get(p.id) ?? 0) + stockQty);
      const total = Math.round(qty * price * 100) / 100;
      subtotal += total;
      normalized.push({ p, qty, price, factor, unitName: line.unitName, stockQty, total });
    }

    // Check stock for sales and purchase returns (where items leave the warehouse)
    if (input.type === "sale" || input.type === "purchase_return") {
      for (const line of normalized) {
        const needed = quantitiesByProduct.get(line.p.id) ?? 0;
        if (Number(line.p.stock) < needed) {
          const detail =
            line.factor > 1 && line.unitName
              ? ` (${line.qty} ${line.unitName} = ${line.stockQty} قطعة)`
              : ` (${line.stockQty} قطعة)`;
          throw new Error(`INSUFFICIENT_STOCK:${line.p.name}${detail}`);
        }
      }
    }

    const total = Math.max(0, Math.round((subtotal - disc + tax) * 100) / 100);
    if (disc > subtotal || paid > total) throw new Error("AMOUNT_OUT_OF_RANGE");

    if (paid < total && !input.partyId) {
      throw new Error("ANONYMOUS_CREDIT_NOT_ALLOWED");
    }

    if (input.type === "sale") {
      for (const line of normalized) {
        const minCost = Number(line.p.costPrice) * line.factor;
        if (line.price < minCost - 0.005) {
          throw new Error(`PRICE_BELOW_COST:${line.p.name}:${minCost.toFixed(2)}`);
        }
      }
    }

    if (input.partyId) {
      const [party] = await tx.select().from(parties).where(eq(parties.id, input.partyId)).limit(1);
      if (!party) throw new Error("PARTY_NOT_FOUND");
      const isCustomerType = input.type === "sale" || input.type === "sale_return";
      if (isCustomerType && party.type !== "customer") throw new Error("PARTY_TYPE_MISMATCH");
      if (!isCustomerType && party.type !== "supplier") throw new Error("PARTY_TYPE_MISMATCH");
    }

    const prefix =
      input.type === "sale"
        ? "SAL"
        : input.type === "purchase"
        ? "PUR"
        : input.type === "sale_return"
        ? "SRT"
        : "PRT";

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.type}))`);
    const [last] = await tx
      .select({ maxNum: sql<number>`coalesce(max(substring(${invoices.number} from '[0-9]+')::integer), 0)` })
      .from(invoices)
      .where(eq(invoices.type, input.type));
    const number = `${prefix}-${String(Number(last?.maxNum ?? 0) + 1).padStart(7, "0")}`;

    const [invoice] = await tx
      .insert(invoices)
      .values({
        number,
        type: input.type,
        partyId: input.partyId ?? null,
        subtotal: money(subtotal),
        discount: money(disc),
        tax: money(tax),
        total: money(total),
        paid: money(paid),
        status: paid === 0 ? "unpaid" : paid >= total ? "paid" : "partial",
        createdBy: userId,
      })
      .returning();

    for (const line of normalized) {
      const description =
        line.factor > 1 && line.unitName
          ? `${line.p.name} [${line.unitName} × ${line.factor}]`
          : line.unitName && line.unitName !== "قطعة"
          ? `${line.p.name} [${line.unitName}]`
          : line.p.name;

      await tx.insert(invoiceLines).values({
        invoiceId: invoice.id,
        productId: line.p.id,
        description,
        quantity: String(line.qty),
        unitPrice: money(line.price),
        costPrice: money(Number(line.p.costPrice) * line.factor),
        lineTotal: money(line.total),
      });

      // Stock Delta:
      // sale or purchase_return -> stock decreases (-stockQty pieces)
      // purchase or sale_return -> stock increases (+stockQty pieces)
      const isDeduction = input.type === "sale" || input.type === "purchase_return";
      const delta = isDeduction ? -line.stockQty : line.stockQty;

      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${delta}`,
          ...(input.type === "purchase" ? { costPrice: money(line.price / line.factor) } : {}),
        })
        .where(eq(products.id, line.p.id));

      await tx.insert(stockMovements).values({
        productId: line.p.id,
        type: input.type,
        quantity: String(Math.abs(delta)),
        unitCost: money(input.type === "purchase" ? line.price / line.factor : Number(line.p.costPrice)),
        invoiceId: invoice.id,
        reason:
          line.factor > 1
            ? `فاتورة ${input.type}: ${line.qty} ${line.unitName ?? "كرتونة"} (${line.stockQty} قطعة)`
            : `فاتورة ${input.type}: ${line.qty} قطعة`,
        userId,
      });
    }

    if (input.partyId) {
      const isDebitInvoice = input.type === "sale" || input.type === "purchase_return";
      const debit = isDebitInvoice ? total : 0;
      const credit = isDebitInvoice ? 0 : total;

      await tx.insert(partyLedger).values({
        partyId: input.partyId,
        invoiceId: invoice.id,
        kind: input.type,
        debit: money(debit),
        credit: money(credit),
      });

      if (paid > 0) {
        const paidDebit = isDebitInvoice ? 0 : paid;
        const paidCredit = isDebitInvoice ? paid : 0;

        await tx.insert(partyLedger).values({
          partyId: input.partyId,
          invoiceId: invoice.id,
          kind: "payment",
          debit: money(paidDebit),
          credit: money(paidCredit),
        });
      }
    }

    if (paid > 0 && input.cashboxId) {
      const cashKind =
        input.type === "sale"
          ? "invoice_payment"
          : input.type === "purchase_return"
          ? "income"
          : "expense";

      await tx.insert(cashTransactions).values({
        cashboxId: input.cashboxId,
        kind: cashKind,
        amount: money(paid),
        invoiceId: invoice.id,
        partyId: input.partyId ?? null,
        category: input.type,
        userId,
      });
    }

    return invoice;
  });
}


export async function updateInvoice(invoiceId:string,input:InvoiceInput,userId:string) {
 if(input.lines.length===0) throw new Error("INVOICE_REQUIRES_LINES");
 const disc=Number(input.discount??0),tax=Number(input.tax??0),paid=Number(input.paid);
 if([disc,tax,paid].some(n=>!Number.isFinite(n)||n<0)) throw new Error("INVALID_AMOUNT");
 if(paid>0&&!input.cashboxId) throw new Error("CASHBOX_REQUIRED_FOR_PAYMENT");
 return db.transaction(async tx=>{
  const [invoice]=await tx.select().from(invoices).where(eq(invoices.id,invoiceId)).for("update").limit(1);
  if(!invoice) throw new Error("INVOICE_NOT_FOUND");
  if(invoice.type!=="sale"&&invoice.type!=="purchase") throw new Error("RETURNS_CANNOT_BE_EDITED");
  if(input.type!==invoice.type) throw new Error("INVOICE_TYPE_CANNOT_CHANGE");
  const oldLines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id));
  const oldQuantities = new Map<string, number>();
  const currentProducts = new Map<string, typeof products.$inferSelect>();

  // Check recorded stock movements for the exact previous stock quantities
  const oldMovements = await tx
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.invoiceId, invoice.id), sql`${stockMovements.type} != 'adjustment'`));

  if (oldMovements.length > 0) {
    for (const sm of oldMovements) {
      oldQuantities.set(sm.productId, (oldQuantities.get(sm.productId) ?? 0) + Number(sm.quantity));
      if (!currentProducts.has(sm.productId)) {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, sm.productId))
          .for("update")
          .limit(1);
        if (product) currentProducts.set(product.id, product);
      }
    }
  } else {
    for (const line of oldLines) if (line.productId) {
      const factorMatch = line.description.match(/×\s*(\d+(\.\d+)?)/);
      const factor = factorMatch ? Number(factorMatch[1]) : 1;
      const totalPcs = Number(line.quantity) * factor;
      oldQuantities.set(line.productId, (oldQuantities.get(line.productId) ?? 0) + totalPcs);
      if (!currentProducts.has(line.productId)) {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, line.productId))
          .for("update")
          .limit(1);
        if (product) currentProducts.set(product.id, product);
      }
    }
  }

  for (const [productId, quantity] of oldQuantities) {
    const product = currentProducts.get(productId);
    if (!product) continue;
    let restoredStock: number;
    try {
      restoredStock = restoreEditedInvoiceStock(Number(product.stock), quantity, invoice.type);
    } catch {
      throw new Error(`CANNOT_REVERSE_PURCHASE_STOCK:${product.name}`);
    }
    await tx.update(products).set({ stock: String(restoredStock) }).where(eq(products.id, productId));
    currentProducts.set(productId, { ...product, stock: String(restoredStock) });
    await tx.insert(stockMovements).values({
      productId,
      type: "adjustment",
      quantity: String(quantity),
      reason: `تعديل الفاتورة ${invoice.number}: عكس ${invoice.type === "sale" ? "بيع" : "شراء"}`,
      invoiceId: invoice.id,
      userId,
    });
  }

  const normalized = [] as {
    product: typeof products.$inferSelect;
    quantity: number;
    price: number;
    factor: number;
    unitName?: string;
    stockQty: number;
    lineTotal: number;
  }[];
  const newQuantities = new Map<string, number>();
  let subtotal = 0;
  for (const line of input.lines) {
    const quantity = Number(line.quantity),
      price = Number(line.unitPrice);
    const factor = Number(line.unitFactor ?? 1) || 1;
    const stockQty = quantity * factor;

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
      throw new Error("INVALID_LINE");
    }
    let product = currentProducts.get(line.productId);
    if (!product) {
      const [found] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, line.productId), eq(products.active, true)))
        .for("update")
        .limit(1);
      if (!found) throw new Error("PRODUCT_NOT_FOUND");
      product = found;
      currentProducts.set(product.id, product);
    }
    newQuantities.set(product.id, (newQuantities.get(product.id) ?? 0) + stockQty);
    const lineTotal = Math.round(quantity * price * 100) / 100;
    subtotal += lineTotal;
    normalized.push({ product, quantity, price, factor, unitName: line.unitName, stockQty, lineTotal });
  }

  if (invoice.type === "sale") {
    for (const [productId, quantity] of newQuantities) {
      const product = currentProducts.get(productId)!;
      if (Number(product.stock) < quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
      }
    }
  }

  const total = Math.max(0, Math.round((subtotal - disc + tax) * 100) / 100);
  if (disc > subtotal || paid > total) throw new Error("AMOUNT_OUT_OF_RANGE");

  if (paid < total && !input.partyId) {
    throw new Error("ANONYMOUS_CREDIT_NOT_ALLOWED");
  }

  if (invoice.type === "sale") {
    for (const line of normalized) {
      const minCost = Number(line.product.costPrice) * line.factor;
      if (line.price < minCost - 0.005) {
        throw new Error(`PRICE_BELOW_COST:${line.product.name}:${minCost.toFixed(2)}`);
      }
    }
  }

  if (input.partyId) {
    const [party] = await tx.select().from(parties).where(eq(parties.id, input.partyId)).limit(1);
    if (!party) throw new Error("PARTY_NOT_FOUND");
    if (
      (invoice.type === "sale" && party.type !== "customer") ||
      (invoice.type === "purchase" && party.type !== "supplier")
    ) {
      throw new Error("PARTY_TYPE_MISMATCH");
    }
  }
  if (paid > 0 && input.cashboxId) {
    const [box] = await tx
      .select({ id: cashboxes.id })
      .from(cashboxes)
      .where(and(eq(cashboxes.id, input.cashboxId), eq(cashboxes.active, true)))
      .limit(1);
    if (!box) throw new Error("CASHBOX_NOT_FOUND");
  }
  const previousCash = await tx.select().from(cashTransactions).where(eq(cashTransactions.invoiceId, invoice.id));
  for (const entry of previousCash) {
    const reverseKind = reverseCashKind(entry.kind);
    if (reverseKind)
      await tx.insert(cashTransactions).values({
        cashboxId: entry.cashboxId,
        kind: reverseKind,
        amount: entry.amount,
        category: "عكس دفعة فاتورة معدلة",
        notes: `عكس دفعة ${invoice.number} قبل التعديل`,
        invoiceId: invoice.id,
        partyId: entry.partyId,
        userId,
      });
  }
  const oldLedger = await tx.select().from(partyLedger).where(eq(partyLedger.invoiceId, invoice.id));
  for (const entry of oldLedger)
    await tx.insert(partyLedger).values({
      partyId: entry.partyId,
      invoiceId: invoice.id,
      kind: "adjustment",
      debit: entry.credit,
      credit: entry.debit,
      notes: `عكس قيد الفاتورة ${invoice.number} قبل التعديل`,
    });
  // Keep original and reversing ledger rows so every edit remains auditable.
  await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id));
  await tx.update(invoices).set({
    partyId: input.partyId ?? null,
    subtotal: money(subtotal),
    discount: money(disc),
    tax: money(tax),
    total: money(total),
    paid: money(paid),
    status: paid === 0 ? "unpaid" : paid >= total ? "paid" : "partial",
  }).where(eq(invoices.id, invoice.id));

  for (const line of normalized) {
    const desc =
      line.factor > 1 && line.unitName
        ? `${line.product.name} [${line.unitName} × ${line.factor}]`
        : line.unitName && line.unitName !== "قطعة"
        ? `${line.product.name} [${line.unitName}]`
        : line.product.name;

    await tx.insert(invoiceLines).values({
      invoiceId: invoice.id,
      productId: line.product.id,
      description: desc,
      quantity: String(line.quantity),
      unitPrice: money(line.price),
      costPrice: money(Number(line.product.costPrice) * line.factor),
      lineTotal: money(line.lineTotal),
    });
    const delta = invoice.type === "sale" ? -line.stockQty : line.stockQty;
    await tx
      .update(products)
      .set({
        stock: sql`${products.stock} + ${delta}`,
        ...(invoice.type === "purchase" ? { costPrice: money(line.price / line.factor) } : {}),
      })
      .where(eq(products.id, line.product.id));

    await tx.insert(stockMovements).values({
      productId: line.product.id,
      type: invoice.type,
      quantity: String(Math.abs(delta)),
      unitCost: money(invoice.type === "purchase" ? line.price / line.factor : Number(line.product.costPrice)),
      invoiceId: invoice.id,
      reason:
        line.factor > 1
          ? `تحديث الفاتورة ${invoice.number}: ${line.quantity} ${line.unitName} (${line.stockQty} قطعة)`
          : `تحديث الفاتورة ${invoice.number}: ${line.quantity} قطعة`,
      userId,
    });
  }
  if(input.partyId) {
   await tx.insert(partyLedger).values({partyId:input.partyId,invoiceId:invoice.id,kind:invoice.type,debit:money(invoice.type==="sale"?total:0),credit:money(invoice.type==="purchase"?total:0),notes:`فاتورة ${invoice.number} بعد التعديل`});
   if(paid>0) await tx.insert(partyLedger).values({partyId:input.partyId,invoiceId:invoice.id,kind:"payment",debit:money(invoice.type==="purchase"?paid:0),credit:money(invoice.type==="sale"?paid:0),notes:`دفعة فاتورة ${invoice.number}`});
  }
  if(paid>0&&input.cashboxId) await tx.insert(cashTransactions).values({cashboxId:input.cashboxId,kind:invoice.type==="sale"?"invoice_payment":"expense",amount:money(paid),invoiceId:invoice.id,partyId:input.partyId??null,category:`تعديل ${invoice.type}`,notes:`دفعة فاتورة ${invoice.number} بعد التعديل`,userId});
  return {...invoice,partyId:input.partyId??null,subtotal:money(subtotal),discount:money(disc),tax:money(tax),total:money(total),paid:money(paid),status:paid===0?"unpaid":paid>=total?"paid":"partial"};
 });
}
