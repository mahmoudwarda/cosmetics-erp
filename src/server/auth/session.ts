import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const cookieName = "cosmetics_session";
const developmentSecret = randomBytes(32).toString("hex");
function getSigningSecret() {
  const configuredSecret = process.env.AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!configuredSecret || configuredSecret.length < 32 || configuredSecret === "replace-with-a-long-random-local-secret" || configuredSecret === "cosmetics-erp-super-secret-key-32chars") {
      throw new Error("AUTH_SECRET must be a unique random value of at least 32 characters in production");
    }
    return configuredSecret;
  }
  return configuredSecret || developmentSecret;
}
function sign(payload: string) { return createHmac("sha256", getSigningSecret()).update(payload).digest("hex"); }
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
  if (!userId || !/^\d+$/.test(expiry || "") || !signature || Number(expiry) < Date.now() || !/^[a-f0-9]{64}$/i.test(signature) || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return userId;
}
export async function clearSession() { (await cookies()).delete(cookieName); }
