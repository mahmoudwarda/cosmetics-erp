import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runDirectSqlMigrations() {
  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(drizzleDir)) return;
  
  const sqlFiles = fs.readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);
    
    for (const file of sqlFiles) {
      const check = await client.query("SELECT 1 FROM __drizzle_migrations WHERE hash = $1", [file]);
      if (check.rowCount === 0) {
        console.log(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(drizzleDir, file), "utf8");
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)", [file, Date.now()]);
        await client.query("COMMIT");
      }
    }
    console.log("Database schema migrations verified successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    // Attempt standard Drizzle migration if drizzle-orm is resolved
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully via Drizzle migrator.");
  } catch {
    console.log("Drizzle migrator unavailable or failed. Applying migrations directly via SQL files...");
    await runDirectSqlMigrations();
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
