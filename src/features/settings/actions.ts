"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { settings, users } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";

export async function saveSettings(formData: FormData) {
  await requirePermission("settings", "edit");
  const input = z.object({
    organizationName: z.string().trim().min(2).max(180),
    currency: z.string().trim().min(1).max(8),
    locale: z.enum(["ar", "en"]).default("ar"),
    taxRate: z.coerce.number().finite().min(0).max(100),
    invoiceFooter: z.string().trim().max(2000).optional(),
  }).parse(Object.fromEntries(formData));
  const file = formData.get("logo");
  let logoPath: string | undefined;
  if (file instanceof File && file.size > 0) {
    const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const extension = extensions[file.type];
    if (!extension || file.size > 3 * 1024 * 1024) throw new Error("LOGO_MUST_BE_PNG_JPG_WEBP_UNDER_3MB");
    const fileName = `${randomUUID()}.${extension}`;
    const uploadDirectory = path.resolve(process.cwd(), process.env.UPLOADS_DIR || "data/uploads");
    const bytes = Buffer.from(await file.arrayBuffer());
    const hasValidSignature = file.type === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : file.type === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!hasValidSignature) throw new Error("INVALID_LOGO_FILE_CONTENT");
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, fileName), bytes, { flag: "wx" });
    logoPath = `/api/uploads/${fileName}`;
  }
  const values = {
    organizationName: input.organizationName,
    currency: input.currency,
    locale: input.locale,
    taxRate: input.taxRate.toFixed(4),
    invoiceFooter: input.invoiceFooter || null,
    ...(logoPath ? { logoPath } : {}),
  };
  await db.insert(settings).values({ id: 1, ...values }).onConflictDoUpdate({ target: settings.id, set: { ...values, updatedAt: new Date() } });
  revalidatePath("/settings"); revalidatePath("/", "layout"); revalidatePath("/invoices");
}

export async function saveAppearance(formData: FormData) {
  const userId = await requirePermission("settings", "edit");
  const input = z.object({ theme: z.enum(["light", "dark", "system"]), accent: z.enum(["indigo", "ocean", "sage", "gold", "slate"]) }).parse(Object.fromEntries(formData));
  await db.update(users).set(input).where(eq(users.id, userId));
  revalidatePath("/", "layout");
}

export async function toggleLocale() {
  await requirePermission("settings", "edit");
  const [current] = await db.select({ locale: settings.locale }).from(settings).where(eq(settings.id, 1)).limit(1);
  const nextLocale = current?.locale === "en" ? "ar" : "en";
  await db.insert(settings).values({ id: 1, locale: nextLocale }).onConflictDoUpdate({ target: settings.id, set: { locale: nextLocale, updatedAt: new Date() } });
  revalidatePath("/", "layout");
}
