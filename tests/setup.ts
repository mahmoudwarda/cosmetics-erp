import { Pool } from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://cosmetics:cosmetics@127.0.0.1:55432/cosmetics_erp_test";
const parsedTestDatabaseUrl = new URL(testDatabaseUrl);

if (!(["localhost", "127.0.0.1", "::1"].includes(parsedTestDatabaseUrl.hostname)) || parsedTestDatabaseUrl.pathname !== "/cosmetics_erp_test") {
  throw new Error("Tests require a local cosmetics_erp_test database. Set TEST_DATABASE_URL to that isolated database.");
}

// Services imported by tests must use the same isolated database as test fixtures.
process.env.DATABASE_URL = testDatabaseUrl;

// This database is explicitly disposable. Clear prior fixtures so repeated test runs
// do not accumulate duplicate products, parties, invoices, or cash transactions.
const testPool = new Pool({ connectionString: testDatabaseUrl });
try {
  const { rows } = await testPool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'",
  );
  const tables = rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`);
  if (tables.length > 0) {
    await testPool.query(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  }
} finally {
  await testPool.end();
}
