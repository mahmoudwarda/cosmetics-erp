"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/permissions";
import { createInvoice, updateInvoice } from "@/server/services/invoices";
import { zUuid, zOptionalUuid } from "@/lib/validation";

const schema = z.object({
  id: zOptionalUuid,
  type: z.enum(["sale", "purchase", "sale_return", "purchase_return"]),
  partyId: zUuid.or(z.literal("")),
  cashboxId: zUuid.or(z.literal("")),
  paid: z.coerce.number().finite().min(0),
  discount: z.coerce.number().finite().min(0),
  tax: z.coerce.number().finite().min(0),
  lines: z
    .array(
      z.object({
        productId: zUuid,
        quantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
        unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        unitName: z.string().optional(),
        unitFactor: z.string().optional(),
      })
    )
    .min(1),
});
export async function saveInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const userId = await requirePermission("invoices", id ? "edit" : "create");
  const lines = JSON.parse(String(formData.get("lines") ?? "[]")) as unknown;
  const parsed = schema.safeParse({ id, type: formData.get("type"), partyId: formData.get("partyId") ?? "", cashboxId: formData.get("cashboxId") ?? "", paid: formData.get("paid"), discount: formData.get("discount") ?? 0, tax: formData.get("tax") ?? 0, lines });
  if (!parsed.success) throw new Error("INVALID_INVOICE");
  const input = { ...parsed.data, partyId: parsed.data.partyId || null, cashboxId: parsed.data.cashboxId || null, paid: String(parsed.data.paid), discount: String(parsed.data.discount), tax: String(parsed.data.tax) };
  const invoice = id ? await updateInvoice(id, input, userId) : await createInvoice(input, userId);
  const { id: invoiceId } = invoice;
  revalidatePath("/invoices"); revalidatePath("/parties"); revalidatePath("/finance"); revalidatePath("/inventory"); revalidatePath("/", "layout");
  redirect(`/invoices/${invoiceId}`);
}
