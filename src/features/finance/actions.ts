"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { cashTransactions, cashboxes, parties, partyLedger } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { cashboxBalance } from "@/server/services/ledger-math";

export async function createCashbox(formData: FormData) {
  await requirePermission("finance", "create");
  const input = z.object({ name: z.string().trim().min(2).max(100), kind: z.enum(["cash", "bank", "wallet"]), openingBalance: z.coerce.number().finite().min(0) }).parse(Object.fromEntries(formData));
  await db.insert(cashboxes).values({ name: input.name, kind: input.kind, openingBalance: input.openingBalance.toFixed(2) });
  revalidatePath("/finance"); revalidatePath("/");
}

export async function updateCashbox(formData: FormData) {
  await requirePermission("finance", "edit");
  const input = z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(100), kind: z.enum(["cash", "bank", "wallet"]), openingBalance: z.coerce.number().finite().min(0) }).parse(Object.fromEntries(formData));
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(cashboxes).where(and(eq(cashboxes.id, input.id), eq(cashboxes.active, true))).for("update").limit(1);
    if (!existing) throw new Error("CASHBOX_NOT_FOUND");
    const [history] = await tx.select({ id: cashTransactions.id }).from(cashTransactions).where(eq(cashTransactions.cashboxId, input.id)).limit(1);
    if (history && Number(existing.openingBalance) !== input.openingBalance) throw new Error("CASHBOX_OPENING_BALANCE_LOCKED");
    await tx.update(cashboxes).set({ name: input.name, kind: input.kind, openingBalance: input.openingBalance.toFixed(2) }).where(eq(cashboxes.id, input.id));
  });
  revalidatePath("/finance"); revalidatePath("/");
}

export async function deactivateCashbox(formData: FormData) {
  await requirePermission("finance", "delete");
  const id = z.string().uuid().parse(formData.get("id"));
  await db.transaction(async (tx) => {
    const [box] = await tx.select({ id: cashboxes.id, active: cashboxes.active }).from(cashboxes).where(eq(cashboxes.id, id)).for("update").limit(1);
    if (!box || !box.active) throw new Error("CASHBOX_NOT_FOUND");
    await tx.update(cashboxes).set({ active: false }).where(eq(cashboxes.id, id));
  });
  revalidatePath("/finance"); revalidatePath("/");
}

export async function addCashTransaction(formData: FormData) {
  const userId = await requirePermission("finance", "create");
  const input = z.object({ cashboxId: z.string().uuid(), kind: z.enum(["income", "expense"]), amount: z.coerce.number().finite().positive(), category: z.string().trim().min(2).max(100), notes: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(formData));
  await db.transaction(async (tx) => {
    const [box] = await tx.select().from(cashboxes).where(and(eq(cashboxes.id, input.cashboxId), eq(cashboxes.active, true))).for("update").limit(1);
    if (!box) throw new Error("CASHBOX_NOT_FOUND");
    if (input.kind === "expense") {
      const txs = await tx.select({ kind: cashTransactions.kind, amount: cashTransactions.amount }).from(cashTransactions).where(eq(cashTransactions.cashboxId, input.cashboxId));
      if (cashboxBalance(box.openingBalance, txs) < input.amount) throw new Error("INSUFFICIENT_CASHBOX_BALANCE");
    }
    await tx.insert(cashTransactions).values({ ...input, amount: input.amount.toFixed(2), userId });
  });
  revalidatePath("/finance"); revalidatePath("/");
}

export async function transferCash(formData: FormData) {
  const userId = await requirePermission("finance", "create");
  const input = z.object({ from: z.string().uuid(), to: z.string().uuid(), amount: z.coerce.number().finite().positive(), notes: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(formData));
  if (input.from === input.to) throw new Error("TRANSFER_SAME_CASHBOX");
  await db.transaction(async (tx) => {
    const locked = await tx.select().from(cashboxes).where(and(eq(cashboxes.active, true), inArray(cashboxes.id, [input.from, input.to]))).orderBy(cashboxes.id).for("update");
    const source = locked.find((box) => box.id === input.from);
    const destination = locked.find((box) => box.id === input.to);
    if (!source || !destination) throw new Error("CASHBOX_NOT_FOUND");
    const txs = await tx.select({ kind: cashTransactions.kind, amount: cashTransactions.amount }).from(cashTransactions).where(eq(cashTransactions.cashboxId, input.from));
    if (cashboxBalance(source.openingBalance, txs) < input.amount) throw new Error("INSUFFICIENT_CASHBOX_BALANCE");
    const transferId = crypto.randomUUID();
    await tx.insert(cashTransactions).values([
      { cashboxId: input.from, kind: "transfer_out", amount: input.amount.toFixed(2), transferId, notes: input.notes || "تحويل إلى صندوق آخر", userId },
      { cashboxId: input.to, kind: "transfer_in", amount: input.amount.toFixed(2), transferId, notes: input.notes || "تحويل من صندوق آخر", userId },
    ]);
  });
  revalidatePath("/finance");
}

export async function registerPartyPayment(formData: FormData) {
  const userId = await requirePermission("parties", "create");
  const input = z.object({ partyId: z.string().uuid(), cashboxId: z.string().uuid(), amount: z.coerce.number().finite().positive(), notes: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(formData));
  const [party] = await db.select().from(parties).where(eq(parties.id, input.partyId)).limit(1);
  if (!party) throw new Error("ACCOUNT_NOT_FOUND");
  await db.transaction(async (tx) => {
    const [cashbox] = await tx.select().from(cashboxes).where(and(eq(cashboxes.id, input.cashboxId), eq(cashboxes.active, true))).for("update").limit(1);
    if (!cashbox) throw new Error("ACCOUNT_NOT_FOUND");
    if (party.type === "supplier") {
      const txs = await tx.select({ kind: cashTransactions.kind, amount: cashTransactions.amount }).from(cashTransactions).where(eq(cashTransactions.cashboxId, cashbox.id));
      if (cashboxBalance(cashbox.openingBalance, txs) < input.amount) throw new Error("INSUFFICIENT_CASHBOX_BALANCE");
    }
    await tx.insert(partyLedger).values({ partyId: party.id, kind: "payment", debit: party.type === "supplier" ? input.amount.toFixed(2) : "0", credit: party.type === "customer" ? input.amount.toFixed(2) : "0", notes: input.notes || "دفعة حساب" });
    await tx.insert(cashTransactions).values({ cashboxId: cashbox.id, kind: party.type === "customer" ? "party_payment" : "expense", amount: input.amount.toFixed(2), category: party.type === "customer" ? "تحصيل من عميل" : "سداد مورد", notes: input.notes || `دفعة ${party.name}`, partyId: party.id, userId });
  });
  revalidatePath(`/parties/${party.id}`); revalidatePath("/parties"); revalidatePath("/finance"); revalidatePath("/");
}
