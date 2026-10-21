import { hash } from "argon2";
import pg from "pg";

const { Client } = pg;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password || password.length < 14) {
  throw new Error("An initial admin password of at least 14 characters is required.");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const roleResult = await client.query(
    "INSERT INTO roles (name, is_system) VALUES ('super-admin', true) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
  );
  const roleId = roleResult.rows[0].id;
  const modules = ["inventory", "invoices", "finance", "parties", "users", "settings", "reports"];
  const actions = ["view", "create", "edit", "delete", "export"];
  for (const module of modules) {
    for (const action of actions) {
      await client.query(
        "INSERT INTO permissions (role_id, module, action) VALUES ($1, $2, $3) ON CONFLICT (role_id, module, action) DO NOTHING",
        [roleId, module, action],
      );
    }
  }
  const user = await client.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
  if (user.rowCount === 0) {
    await client.query(
      "INSERT INTO users (name, username, password_hash, role_id) VALUES ($1, 'admin', $2, $3)",
      ["مدير النظام", await hash(password), roleId],
    );
  }
  await client.query("INSERT INTO units (name, factor) VALUES ('قطعة', '1') ON CONFLICT (name) DO NOTHING");
  await client.query("INSERT INTO settings (id, organization_name, locale, currency) VALUES (1, 'لمسة جمال', 'ar', 'EGP') ON CONFLICT (id) DO NOTHING");
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
