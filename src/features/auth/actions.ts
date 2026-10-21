"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verify } from "argon2";
import { db } from "@/server/db";
import { permissions, users } from "@/server/db/schema";
import { clearLoginAttempts, recordLoginAttempt } from "@/server/auth/login-rate-limit";
import { createSession, clearSession } from "@/server/auth/session";

const dummyPasswordHash = "$argon2id$v=19$m=65536,t=3,p=4$B1LfJJ1ETEi5NLTtCKrUqQ$DT3oCHXybO+1uaEGq5U8zffraU4980JqWJ6f8bi0mOc";

async function getTrustedClientAddress() {
  if (process.env.TRUST_PROXY !== "true") return null;
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return address && address.length <= 128 ? address : null;
}

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().slice(0, 80);
  const password = String(formData.get("password") ?? "").slice(0, 1024);
  if (!username || !password) redirect("/login?error=1");

  const address = await getTrustedClientAddress();
  if (await recordLoginAttempt(username, address)) redirect("/login?error=1");

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const isPasswordValid = await verify(user?.passwordHash ?? dummyPasswordHash, password).catch(() => false);
  if (!user || !user.active || !isPasswordValid) redirect("/login?error=1");

  await clearLoginAttempts(username, address);
  const grants = await db.select({ module: permissions.module, action: permissions.action }).from(permissions).where(eq(permissions.roleId, user.roleId));
  const allowed = new Set(grants.filter((grant) => grant.action === "view").map((grant) => grant.module));
  const landing = allowed.has("reports") ? "/" : (["inventory", "invoices", "parties", "finance", "users", "settings"] as const)
    .map((module) => ({ module, href: "/" + module })).find(({ module }) => allowed.has(module))?.href;
  if (!landing) redirect("/login?error=permissions");

  await createSession(user.id);
  redirect(landing);
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
