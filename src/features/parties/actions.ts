"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { parties, partyLedger } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";

const partySchema = z.object({ id: z.string().uuid().optional().or(z.literal("")), type: z.enum(["customer", "supplier"]), name: z.string().trim().min(2).max(180), phone: z.string().trim().max(40).optional(), email: z.string().trim().email().or(z.literal("")).optional(), address: z.string().trim().max(1000).optional(), openingBalance: z.coerce.number().finite().min(0) });
export async function saveParty(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await requirePermission("parties", id ? "edit" : "create");
  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("INVALID_PARTY");
  const input = parsed.data;
  const values = { type: input.type, name: input.name, phone: input.phone || null, email: input.email || null, address: input.address || null, openingBalance: input.openingBalance.toFixed(2) };
  if (id) await db.transaction(async (tx) => {
    await tx.update(parties).set(values).where(eq(parties.id, id));
    const [opening] = await tx.select().from(partyLedger).where(and(eq(partyLedger.partyId, id), eq(partyLedger.kind, "opening"))).limit(1);
    const debit = input.type === "customer" ? input.openingBalance.toFixed(2) : "0.00";
    const credit = input.type === "supplier" ? input.openingBalance.toFixed(2) : "0.00";
    if (opening && input.openingBalance > 0) await tx.update(partyLedger).set({ debit, credit, notes: "رصيد افتتاحي" }).where(eq(partyLedger.id, opening.id));
    else if (opening) await tx.delete(partyLedger).where(eq(partyLedger.id, opening.id));
    else if (input.openingBalance > 0) await tx.insert(partyLedger).values({ partyId: id, kind: "opening", debit, credit, notes: "رصيد افتتاحي" });
  });
  else {
    const [party] = await db.insert(parties).values(values).returning({ id: parties.id });
    if (input.openingBalance > 0) await db.insert(partyLedger).values({ partyId: party.id, kind: "opening", debit: input.type === "customer" ? input.openingBalance.toFixed(2) : "0", credit: input.type === "supplier" ? input.openingBalance.toFixed(2) : "0", notes: "رصيد افتتاحي" });
  }
  revalidatePath("/parties"); revalidatePath("/");
}

export async function deleteParty(formData: FormData) {
  await requirePermission("parties", "delete");
  const id = z.string().uuid().parse(formData.get("id"));
  await db.update(parties).set({ deletedAt: new Date() }).where(eq(parties.id, id));
  revalidatePath("/parties");
}
