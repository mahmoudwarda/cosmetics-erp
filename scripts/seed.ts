import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const [{ hash }, { db }, schema, { eq }] = await Promise.all([
  import("argon2"),
  import("../src/server/db"),
  import("../src/server/db/schema"),
  import("drizzle-orm"),
]);
const { roles, permissions, users, categories, units, products, cashboxes, settings } = schema;

const [role] = await db.insert(roles).values({ name: "super-admin", isSystem: true }).onConflictDoNothing().returning();
let adminRole = role;
if (!adminRole) [adminRole] = await db.select().from(roles).where(eq(roles.name, "super-admin")).limit(1);

for (const mod of ["inventory", "invoices", "finance", "parties", "users", "settings", "reports"] as const) {
  for (const action of ["view", "create", "edit", "delete", "export"] as const) {
    await db.insert(permissions).values({ roleId: adminRole.id, module: mod, action }).onConflictDoNothing();
  }
}
await db.insert(users).values({ name: "مدير النظام", username: "admin", passwordHash: await hash(process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!"), roleId: adminRole.id }).onConflictDoNothing();

const [cat] = await db.insert(categories).values({ name: "العناية بالبشرة" }).returning();
const [unit] = await db.insert(units).values({ name: "قطعة", factor: "1" }).onConflictDoNothing().returning();
let baseUnit = unit;
if (!baseUnit) [baseUnit] = await db.select().from(units).where(eq(units.name, "قطعة")).limit(1);
for (const [sku, name, cost, sale, stock] of [
  ["SKN-001", "سيروم فيتامين C", "120", "190", "24"],
  ["SKN-002", "مرطب يومي", "85", "145", "18"],
  ["SKN-003", "واقي شمس SPF50", "160", "235", "7"],
  ["SKN-004", "غسول لطيف", "70", "125", "31"],
  ["SKN-005", "كريم ليلي", "130", "210", "3"],
]) {
  await db.insert(products).values({ sku, name, categoryId: cat.id, unitId: baseUnit.id, costPrice: cost, salePrice: sale, stock, reorderLevel: "5" }).onConflictDoNothing();
}
await db.insert(cashboxes).values({ name: "الخزينة الرئيسية", kind: "cash", openingBalance: "5000" });
await db.insert(settings).values({ id: 1, organizationName: "لمسة جمال", locale: "ar", currency: "EGP" }).onConflictDoNothing();
console.log("Seed complete. Login: admin / ChangeMe123! (change immediately).");
