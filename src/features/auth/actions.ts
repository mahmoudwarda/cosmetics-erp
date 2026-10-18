"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { verify } from "argon2";
import { db } from "@/server/db";
import { permissions, users } from "@/server/db/schema";
import { createSession, clearSession } from "@/server/auth/session";
export async function signIn(formData: FormData) {
 const username=String(formData.get("username")??"").trim(); const password=String(formData.get("password")??"");
 const [user]=await db.select().from(users).where(eq(users.username,username)).limit(1);
 if(!user || !user.active) redirect("/login?error=1");
 const isPasswordValid = await verify(user.passwordHash, password).catch(() => false);
 if(!isPasswordValid) redirect("/login?error=1");
 const grants=await db.select({module:permissions.module,action:permissions.action}).from(permissions).where(eq(permissions.roleId,user.roleId));
 const allowed=new Set(grants.filter((grant)=>grant.action==="view").map((grant)=>grant.module));
 const landing=allowed.has("reports")?"/":(["inventory","invoices","parties","finance","users","settings"] as const).map((module)=>({module,href:`/${module}`})).find(({module})=>allowed.has(module))?.href;
 if(!landing) redirect("/login?error=permissions");
 await createSession(user.id); redirect(landing);
}
export async function signOut() { await clearSession(); redirect("/login"); }
