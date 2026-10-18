import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const [{ migrate }, { db }] = await Promise.all([
  import("drizzle-orm/node-postgres/migrator"),
  import("../src/server/db"),
]);
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Database migrations applied.");
