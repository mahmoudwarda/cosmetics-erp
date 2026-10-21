"use server";

import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { permissions, roles, users } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import { getSessionUserId } from "@/server/auth/session";
import { zUuid, zOptionalUuid } from "@/lib/validation";

const roleIds = zUuid;
const userSchema = z.object({ id: zOptionalUuid, name: z.string().trim().min(2).max(140), username: z.string().trim().min(3).max(80).regex(/^[\p{L}\p{N}_.-]+$/u), roleId: roleIds, password: z.string().min(10).optional().or(z.literal("")) });
const modules = ["inventory", "invoices", "finance", "parties", "users", "settings", "reports"] as const;
const actions = ["view", "create", "edit", "delete", "export"] as const;
type ModuleValue = typeof modules[number];
type ActionValue = typeof actions[number];
function normalizeGrants(input: string[]) {
  const grants = new Set<string>();
  for (const raw of input) {
    const [module, action, extra] = raw.split(":");
    if (extra !== undefined || !modules.includes(module as ModuleValue) || !actions.includes(action as ActionValue)) throw new Error("INVALID_PERMISSION");
    grants.add(`${module}:${action}`);
    if (action !== "view") grants.add(`${module}:view`);
  }
  return [...grants].map((grant) => grant.split(":")) as [ModuleValue, ActionValue][];
}

export async function saveUser(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await requirePermission("users", id ? "edit" : "create");
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("INVALID_USER");
  const input = parsed.data;
  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, input.roleId)).limit(1);
  if (!role) throw new Error("ROLE_NOT_FOUND");
  const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
  if (duplicate && duplicate.id !== id) throw new Error("USERNAME_EXISTS");
  if (id) {
    await db.update(users).set({ name: input.name, username: input.username, roleId: input.roleId }).where(eq(users.id, id));
  } else {
    if (!input.password) throw new Error("PASSWORD_REQUIRED");
    await db.insert(users).values({ name: input.name, username: input.username, roleId: input.roleId, passwordHash: await hash(input.password) });
  }
  revalidatePath("/users");
}

export async function resetUserPassword(formData: FormData) {
  await requirePermission("users", "edit");
  const input = z.object({ id: zUuid, password: z.string().min(10) }).parse(Object.fromEntries(formData));
  await db.update(users).set({ passwordHash: await hash(input.password) }).where(eq(users.id, input.id));
  revalidatePath("/users");
}

export async function toggleUserActive(formData: FormData) {
  await requirePermission("users", "edit");
  const id = zUuid.parse(formData.get("id"));
  const currentUserId = await getSessionUserId();
  if (id === currentUserId) throw new Error("CANNOT_DISABLE_SELF");
  const [user] = await db.select({ active: users.active }).from(users).where(eq(users.id, id)).limit(1);
  if (user) await db.update(users).set({ active: !user.active }).where(eq(users.id, id));
  revalidatePath("/users");
}

export async function createRole(formData: FormData) {
  await requirePermission("users", "create");
  const name = z.string().trim().min(2).max(80).parse(formData.get("name"));
  const rows = normalizeGrants(z.array(z.string()).parse(formData.getAll("grant")));
  await db.transaction(async (tx) => {
    const [role] = await tx.insert(roles).values({ name }).returning({ id: roles.id });
    if (rows.length) await tx.insert(permissions).values(rows.map(([module, action]) => ({ roleId: role.id, module, action })));
  });
  revalidatePath("/users");
}

export async function updateRolePermissions(formData: FormData) {
  await requirePermission("users", "edit");
  const roleId = roleIds.parse(formData.get("roleId"));
  const rows = normalizeGrants(z.array(z.string()).parse(formData.getAll("grant")));
  await db.transaction(async (tx) => {
    await tx.delete(permissions).where(eq(permissions.roleId, roleId));
    if (rows.length) await tx.insert(permissions).values(rows.map(([module, action]) => ({ roleId, module, action })));
  });
  revalidatePath("/users");
}
