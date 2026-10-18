import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "cosmetics_session";
function sign(payload: string) { return createHmac("sha256", process.env.AUTH_SECRET || "development-secret-change-me").update(payload).digest("hex"); }
export async function createSession(userId: string) {
  const payload = `${userId}.${Date.now() + 1000 * 60 * 60 * 12}`;
  (await cookies()).set(cookieName, `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: "lax", secure: process.env.SESSION_COOKIE_SECURE === "true", path: "/", maxAge: 60 * 60 * 12 });
}
export async function getSessionUserId(): Promise<string | null> {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return null;
  const [userId, expiry, signature] = raw.split(".");
  const payload = `${userId}.${expiry}`;
  const expected = sign(payload);
  if (!userId || !expiry || !signature || Number(expiry) < Date.now() || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return userId;
}
export async function clearSession() { (await cookies()).delete(cookieName); }
