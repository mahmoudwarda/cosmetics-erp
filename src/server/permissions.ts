import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { permissions, users } from "@/server/db/schema";
import { getSessionUserId } from "@/server/auth/session";
export type Module = "inventory"|"invoices"|"finance"|"parties"|"users"|"settings"|"reports";
export type Action = "view"|"create"|"edit"|"delete"|"export";
export async function requirePermission(module: Module, action: Action) {
 const uid=await getSessionUserId(); if(!uid) throw new Error("UNAUTHENTICATED");
 const [row]=await db.select({id:users.id}).from(users).innerJoin(permissions,eq(users.roleId,permissions.roleId)).where(and(eq(users.id,uid),eq(users.active,true),eq(permissions.module,module),eq(permissions.action,action))).limit(1);
 if(!row) throw new Error("FORBIDDEN"); return uid;
}
