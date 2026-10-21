"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { categories, products, stockMovements, units } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";

const productSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(180),
  sku: z.string().trim().max(80).optional().or(z.literal("")),
  barcode: z.string().trim().max(100).optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  unitId: z.string().uuid().optional().or(z.literal("")),
  costPrice: z.coerce.number().finite().min(0),
  salePrice: z.coerce.number().finite().min(0),
  stock: z
    .preprocess((val) => (val === "" || val === undefined || val === null ? 0 : val), z.coerce.number().finite().min(0))
    .optional()
    .default(0),
  reorderLevel: z
    .preprocess((val) => (val === "" || val === undefined || val === null ? 5 : val), z.coerce.number().finite().min(0))
    .optional()
    .default(5),
  active: z.enum(["on", "off"]).optional(),
});

export async function saveProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const userId = await requirePermission("inventory", id ? "edit" : "create");
  const rawData = Object.fromEntries(formData);
  const parsed = productSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(`INVALID_PRODUCT: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  const input = parsed.data;
  let finalSku = (input.sku || "").trim();
  if (!finalSku) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    finalSku = `SKN-${Date.now().toString().slice(-4)}-${randomSuffix}`;
  }
  const values = {
    name: input.name,
    sku: finalSku,
    barcode: input.barcode || null,
    categoryId: input.categoryId || null,
    unitId: input.unitId || null,
    costPrice: input.costPrice.toFixed(2),
    salePrice: input.salePrice.toFixed(2),
    reorderLevel: String(input.reorderLevel),
    active: input.active !== "off",
  };

  if (id) {
    await db.update(products).set(values).where(and(eq(products.id, id), isNull(products.deletedAt)));
  } else {
    await db.transaction(async (tx) => {
      const [product] = await tx.insert(products).values({ ...values, stock: String(input.stock) }).returning({ id: products.id });
      if (input.stock > 0) {
        await tx.insert(stockMovements).values({
          productId: product.id,
          type: "adjustment",
          quantity: String(input.stock),
          reason: "رصيد افتتاحي عند إنشاء المنتج",
          userId,
        });
      }
    });
  }
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function deleteProduct(formData: FormData) {
  await requirePermission("inventory", "delete");
  const id = z.string().uuid().parse(formData.get("id"));
  await db.update(products).set({ active: false, deletedAt: new Date() }).where(eq(products.id, id));
  revalidatePath("/inventory");
  revalidatePath("/");
}

const adjustmentSchema = z.object({ productId: z.string().uuid(), quantity: z.number().finite().refine((n) => n !== 0), reason: z.string().trim().min(4) });
export async function adjustStock(raw: unknown) {
  const userId = await requirePermission("inventory", "edit");
  const input = adjustmentSchema.parse(raw);
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, input.productId)).for("update").limit(1);
    if (!p) throw new Error("PRODUCT_NOT_FOUND");
    if (Number(p.stock) + input.quantity < 0) throw new Error("NEGATIVE_STOCK");
    await tx.update(products).set({ stock: String(Number(p.stock) + input.quantity) }).where(eq(products.id, p.id));
    await tx.insert(stockMovements).values({ productId: p.id, type: "adjustment", quantity: String(Math.abs(input.quantity)), reason: input.reason, userId });
  });
  revalidatePath("/"); revalidatePath("/inventory");
  return { ok: true };
}

export async function adjustStockFromForm(formData: FormData) {
  const quantity = Number(formData.get("quantity"));
  await adjustStock({ productId: String(formData.get("productId")), quantity, reason: String(formData.get("reason") ?? "") });
}

export async function createCategory(formData: FormData) {
  await requirePermission("inventory", "create");
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  await db.insert(categories).values({ name });
  revalidatePath("/inventory");
}

export async function updateCategory(formData: FormData) {
  await requirePermission("inventory", "edit");
  const id = z.string().uuid().parse(formData.get("id"));
  const name = z.string().trim().min(2).max(120).parse(formData.get("name"));
  await db.update(categories).set({ name }).where(eq(categories.id, id));
  revalidatePath("/inventory");
}

export async function deleteCategory(formData: FormData) {
  await requirePermission("inventory", "delete");
  const id = z.string().uuid().parse(formData.get("id"));
  await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, id));
  revalidatePath("/inventory");
}

export async function createUnit(formData: FormData) {
  await requirePermission("inventory", "create");
  const name = z.string().trim().min(1).max(80).parse(formData.get("name"));
  const factor = z.coerce.number().positive().parse(formData.get("factor") ?? 1);
  await db.insert(units).values({ name, factor: String(factor) });
  revalidatePath("/inventory");
}

export async function updateUnit(formData: FormData) {
  await requirePermission("inventory", "edit");
  const id = z.string().uuid().parse(formData.get("id"));
  const name = z.string().trim().min(1).max(80).parse(formData.get("name"));
  const factor = z.coerce.number().positive().parse(formData.get("factor") ?? 1);
  await db.update(units).set({ name, factor: String(factor) }).where(eq(units.id, id));
  revalidatePath("/inventory");
}

export async function deleteUnit(formData: FormData) {
  await requirePermission("inventory", "delete");
  const id = z.string().uuid().parse(formData.get("id"));
  await db.transaction(async (tx) => {
    await tx.update(products).set({ unitId: null }).where(eq(products.unitId, id));
    await tx.delete(units).where(eq(units.id, id));
  });
  revalidatePath("/inventory");
}


