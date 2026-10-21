import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";

const attemptLimit = 8;
const windowMinutes = 15;

/** Atomically records an attempt so limits apply across app restarts and instances. */
function getKeys(username: string, clientAddress?: string | null) {
  const identities = [`user:${username.trim().toLocaleLowerCase("en-US")}`];
  if (clientAddress) identities.push(`ip:${clientAddress.slice(0, 128)}`);
  return identities.map((identity) => createHash("sha256").update(identity).digest("hex"));
}

async function recordKey(key: string) {
  const result = await db.execute<{ attempts: number; blocked_until: Date | null }>(sql`
    INSERT INTO login_attempts (key, attempts, window_started_at, blocked_until)
    VALUES (${key}, 1, now(), NULL)
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN login_attempts.window_started_at < now() - (${windowMinutes} * interval '1 minute') THEN 1
        ELSE login_attempts.attempts + 1
      END,
      window_started_at = CASE
        WHEN login_attempts.window_started_at < now() - (${windowMinutes} * interval '1 minute') THEN now()
        ELSE login_attempts.window_started_at
      END,
      blocked_until = CASE
        WHEN login_attempts.window_started_at < now() - (${windowMinutes} * interval '1 minute') THEN NULL
        WHEN login_attempts.blocked_until > now() THEN login_attempts.blocked_until
        WHEN login_attempts.attempts + 1 >= ${attemptLimit} THEN now() + (${windowMinutes} * interval '1 minute')
        ELSE NULL
      END
    RETURNING attempts, blocked_until
  `);
  const row = result.rows[0];
  return Boolean(row?.blocked_until && new Date(row.blocked_until).getTime() > Date.now());
}

export async function recordLoginAttempt(username: string, clientAddress?: string | null) {
  const states = await Promise.all(getKeys(username, clientAddress).map(recordKey));

  if (Math.random() < 0.01) {
    await db.execute(sql`DELETE FROM login_attempts WHERE window_started_at < now() - interval '30 days'`);
  }

  return states.some(Boolean);
}

export async function clearLoginAttempts(username: string, clientAddress?: string | null) {
  await Promise.all(getKeys(username, clientAddress).map((key) => db.execute(sql`DELETE FROM login_attempts WHERE key = ${key}`)));
}
