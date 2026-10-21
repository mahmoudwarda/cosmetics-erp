import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const [{ hash }, { db }, schema, { eq }] = await Promise.all([
  import("argon2"),
  import("../src/server/db"),
  import("../src/server/db/schema"),
  import("drizzle-orm"),
]);
const { roles, permissions, users, units, settings } = schema;

const [existingAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.username, "admin")).limit(1);
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!existingAdmin && (!seedAdminPassword || seedAdminPassword.length < 14 || /^(replace|change-me|password)/i.test(seedAdminPassword))) {
  throw new Error("Set a unique SEED_ADMIN_PASSWORD of at least 14 characters in .env before the first seed.");
}

const [role] = await db.insert(roles).values({ name: "super-admin", isSystem: true }).onConflictDoNothing().returning();
let adminRole = role;
if (!adminRole) [adminRole] = await db.select().from(roles).where(eq(roles.name, "super-admin")).limit(1);

for (const mod of ["inventory", "invoices", "finance", "parties", "users", "settings", "reports"] as const) {
  for (const action of ["view", "create", "edit", "delete", "export"] as const) {
    await db.insert(permissions).values({ roleId: adminRole.id, module: mod, action }).onConflictDoNothing();
  }
}
if (!existingAdmin) {
  await db.insert(users).values({ name: "مدير النظام", username: "admin", passwordHash: await hash(seedAdminPassword!), roleId: adminRole.id }).onConflictDoNothing();
}
await db.insert(units).values({ name: "قطعة", factor: "1" }).onConflictDoNothing();
await db.insert(settings).values({ id: 1, organizationName: "لمسة جمال", locale: "ar", currency: "EGP" }).onConflictDoNothing();
console.log("Seed complete. Initial admin username: admin. No sample products or opening cash balance were created.");
