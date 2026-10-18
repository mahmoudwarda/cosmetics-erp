import { desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Coins,
  Edit,
  KeyRound,
  Receipt,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  ShieldPlus,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  BarChart3,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { permissions, roles, settings, users } from "@/server/db/schema";
import { requirePermission } from "@/server/permissions";
import {
  createRole,
  resetUserPassword,
  saveUser,
  toggleUserActive,
  updateRolePermissions,
} from "@/features/users/actions";
import { CloseDisclosureButton } from "@/components/close-disclosure-button";
import { translate, Locale } from "@/lib/i18n";

const modules = [
  { id: "inventory", key: "nav.inventory", icon: Boxes, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  { id: "invoices", key: "nav.invoices", icon: Receipt, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
  { id: "finance", key: "nav.finance", icon: Coins, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  { id: "parties", key: "nav.parties", icon: Users, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  { id: "users", key: "nav.users", icon: ShieldCheck, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
  { id: "settings", key: "nav.settings", icon: Settings, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  { id: "reports", key: "nav.reports", icon: BarChart3, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
] as const;

const actions = [
  { id: "view", key: "common.view" },
  { id: "create", key: "common.add" },
  { id: "edit", key: "common.edit" },
  { id: "delete", key: "common.delete" },
  { id: "export", key: "common.export" },
] as const;

export default async function UsersPage() {
  const currentUserId = await getSessionUserId();
  if (!currentUserId) redirect("/login");
  await requirePermission("users", "view");

  const [settingsRow] = await db
    .select({ locale: settings.locale })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  const locale = (settingsRow?.locale ?? "ar") as Locale;
  const isRtl = locale === "ar";
  const localeCode = locale === "en" ? "en-US" : "ar-EG";

  const [userRows, roleRows, permissionRows] = await Promise.all([
    db
      .select({ user: users, roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.createdAt))
      .limit(300),
    db.select().from(roles).orderBy(roles.name),
    db.select().from(permissions),
  ]);

  const grantsByRole = new Map<string, Set<string>>();
  for (const grant of permissionRows) {
    const current = grantsByRole.get(grant.roleId) ?? new Set<string>();
    current.add(`${grant.module}:${grant.action}`);
    grantsByRole.set(grant.roleId, current);
  }

  const activeUsersCount = userRows.filter((u) => u.user.active).length;

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">{translate("users.subtitle", locale)}</p>
          <h1>{translate("users.title", locale)}</h1>
        </div>
        <div className="top-actions">
          <Link className="secondary" href="/">
            <ArrowRight size={15} className={isRtl ? "" : "rotate-180"} />
            <span>{translate("common.home", locale)}</span>
          </Link>
        </div>
      </header>

      {/* Users & Roles KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block mb-1">{translate("users.totalUsers", locale)}</span>
            <b className="text-2xl text-[var(--ink)]">{userRows.length.toLocaleString(localeCode)} {locale === "en" ? "Users" : "مستخدم"}</b>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
            <Users size={18} />
          </div>
        </div>

        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block mb-1">{translate("users.activeUsers", locale)}</span>
            <b className="text-2xl text-emerald-600 font-bold">{activeUsersCount.toLocaleString(localeCode)} {locale === "en" ? "Active" : "نشط"}</b>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="p-4 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block mb-1">{translate("users.roles", locale)}</span>
            <b className="text-2xl text-[var(--ink)]">{roleRows.length.toLocaleString(localeCode)} {locale === "en" ? "Roles" : "دور وظيفي"}</b>
          </div>
          <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center font-bold">
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      {/* Users Panel */}
      <section className="panel users-panel">
        <div className="panel-title mb-4">
          <div>
            <h3>{locale === "en" ? "User Accounts & Staff" : "حسابات المستخدمين والموظفين"}</h3>
            <p>{locale === "en" ? "Manage credentials, assign job roles, and reset passwords" : "إدارة بيانات الدخول، تعيين الأدوار الوظيفية، وإعادة تعيين كلمات المرور"}</p>
          </div>
          <div className="flex items-center gap-2">
            <details className="editor">
              <summary className="primary">
                <UserPlus size={15} />
                <span>{translate("users.addUser", locale)}</span>
              </summary>
              <form action={saveUser} className="form-grid">
                <CloseDisclosureButton title={translate("users.addUser", locale)} />
                <label>
                  {locale === "en" ? "Full Name" : "الاسم الكامل"}
                  <input name="name" required minLength={2} placeholder={locale === "en" ? "e.g., Ahmed Mohamed (Cashier)" : "مثال: أحمد محمد (كاشير)"} />
                </label>
                <label>
                  {translate("users.username", locale)}
                  <input name="username" required minLength={3} autoComplete="off" placeholder="ahmed10" />
                </label>
                <label>
                  {locale === "en" ? "Temporary Password (min 10 chars)" : "كلمة المرور المؤقتة (10 أحرف كحد أدنى)"}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    placeholder="••••••••••"
                  />
                </label>
                <label>
                  {translate("users.role", locale)}
                  <select name="roleId" required>
                    {roleRows.map((role) => (
                      <option value={role.id} key={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary" type="submit">
                  {locale === "en" ? "Create & Activate User" : "إنشاء وتفعيل الحساب"}
                </button>
              </form>
            </details>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="min-w-[180px]">{translate("users.user", locale)}</th>
                <th className="min-w-[120px]">{translate("users.username", locale)}</th>
                <th className="min-w-[130px]">{translate("users.role", locale)}</th>
                <th className="min-w-[90px] text-center">{translate("users.status", locale)}</th>
                <th className="min-w-[220px] text-center">{translate("users.actions", locale)}</th>
              </tr>
            </thead>
            <tbody>
              {userRows.length ? (
                userRows.map(({ user, roleName }) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200/60">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <b className="text-[var(--ink)] block font-bold text-sm">{user.name}</b>
                          {user.id === currentUserId && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block">
                              {translate("users.currentAccount", locale)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]" dir="ltr">
                        {user.username}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                        <Shield size={12} />
                        <span>{roleName}</span>
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          user.active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                        }`}
                      >
                        {user.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{user.active ? translate("common.active", locale) : translate("common.suspended", locale)}</span>
                      </span>
                    </td>
                    <td className="row-actions text-center">
                      <div className="flex items-center gap-1.5 justify-center flex-nowrap">
                        {/* Edit User Details */}
                        <details className="row-editor">
                          <summary className="h-8 px-2.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 hover:bg-sky-600 hover:text-white inline-flex items-center gap-1 text-xs font-extrabold transition-all shadow-2xs cursor-pointer flex-nowrap whitespace-nowrap">
                            <Edit size={13} />
                            <span>{translate("users.editUser", locale)}</span>
                          </summary>
                          <form action={saveUser} className="form-grid">
                            <CloseDisclosureButton title={`${translate("users.editUser", locale)}: ${user.name}`} />
                            <input type="hidden" name="id" value={user.id} />
                            <label>
                              {locale === "en" ? "Full Name" : "الاسم الكامل"}
                              <input name="name" defaultValue={user.name} required />
                            </label>
                            <label>
                              {translate("users.username", locale)}
                              <input name="username" defaultValue={user.username} required />
                            </label>
                            <label className="wide-field">
                              {translate("users.role", locale)}
                              <select name="roleId" defaultValue={user.roleId}>
                                {roleRows.map((role) => (
                                  <option value={role.id} key={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button className="primary">{translate("common.save", locale)}</button>
                          </form>
                        </details>

                        {/* Reset Password */}
                        <details className="row-editor">
                          <summary className="h-8 px-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white inline-flex items-center gap-1 text-xs font-extrabold transition-all shadow-2xs cursor-pointer flex-nowrap whitespace-nowrap">
                            <KeyRound size={13} />
                            <span>{translate("users.password", locale)}</span>
                          </summary>
                          <form action={resetUserPassword} className="form-grid">
                            <CloseDisclosureButton title={`${translate("users.resetPassword", locale)}: ${user.name}`} />
                            <input type="hidden" name="id" value={user.id} />
                            <label className="wide-field">
                              {locale === "en" ? "New Password (min 10 chars)" : "كلمة المرور الجديدة (10 أحرف على الأقل)"}
                              <input
                                name="password"
                                type="password"
                                minLength={10}
                                required
                                autoComplete="new-password"
                                placeholder="••••••••••"
                              />
                            </label>
                            <button className="primary">{translate("users.resetPassword", locale)}</button>
                          </form>
                        </details>

                        {/* Activate / Deactivate Toggle */}
                        {user.id !== currentUserId && (
                          <form action={toggleUserActive} className="inline-flex">
                            <input type="hidden" name="id" value={user.id} />
                            <button
                              className={`h-8 px-2.5 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer flex-nowrap whitespace-nowrap ${
                                user.active
                                  ? "border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:text-white"
                                  : "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white"
                              }`}
                              title={user.active ? (locale === "en" ? "Suspend user account" : "إيقاف الحساب مؤقتاً") : (locale === "en" ? "Activate user account" : "تفعيل الحساب مجدداً")}
                            >
                              {user.active ? <UserX size={13} /> : <UserCheck size={13} />}
                              <span>{user.active ? translate("users.suspend", locale) : translate("users.activate", locale)}</span>
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="table-empty">
                    {locale === "en" ? "No users registered yet." : "لا يوجد مستخدمون مسجلون."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Roles & Permissions Matrix Section */}
      <section className="panel">
        <div className="panel-title mb-4">
          <div>
            <h3>{translate("users.rbac", locale)}</h3>
            <p>{locale === "en" ? "Define granular permissions for each role; verified server-side on every transaction" : "تحديد الصلاحيات الدقيقة لكل رتبة؛ يتم التحقق منها برمجياً على الخادم بكل عملية"}</p>
          </div>
          <details className="editor">
            <summary className="primary">
              <ShieldPlus size={15} />
              <span>{translate("users.addRole", locale)}</span>
            </summary>
            <form action={createRole} className="form-grid">
              <CloseDisclosureButton title={translate("users.addRole", locale)} />
              <label className="wide-field">
                {locale === "en" ? "Role Name" : "اسم الدور"}
                <input name="name" required minLength={2} placeholder={locale === "en" ? "e.g., Warehouse Manager, Cashier" : "مثال: أمين مستودع، كاشير فرعي"} />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full my-2">
                {modules.map(({ id, key, icon: Icon, color }) => (
                  <div key={id} className="p-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] space-y-2">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--line)]">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${color}`}>
                        <Icon size={14} />
                      </div>
                      <b className="text-xs text-[var(--ink)]">{translate(key, locale)}</b>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {actions.map((act) => (
                        <label
                          key={act.id}
                          className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            name="grant"
                            value={`${id}:${act.id}`}
                            className="rounded border-[var(--line-strong)] text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          <span className="font-medium text-[var(--ink)] text-[11px]">{translate(act.key, locale)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button className="primary" type="submit">
                  {locale === "en" ? "Create Role & Save Permissions" : "إنشاء الدور وحفظ الصلاحيات"}
                </button>
              </div>
            </form>
          </details>
        </div>

        {/* Roles List */}
        <div className="grid grid-cols-1 gap-3">
          {roleRows.map((role) => {
            const roleGrants = grantsByRole.get(role.id) ?? new Set<string>();

            return (
              <details
                className="group border border-[var(--line)] rounded-xl bg-[var(--panel)] overflow-hidden shadow-xs hover:border-[var(--line-strong)] transition-all"
                key={role.id}
              >
                <summary className="p-4 flex items-center justify-between cursor-pointer list-none select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0 border border-indigo-200/60">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <b className="text-sm font-bold text-[var(--ink)] block">{role.name}</b>
                      <span className="text-xs text-[var(--muted)]">
                        {locale === "en" ? "Click to view or edit permissions assigned to this role" : "انقر لاستعراض أو تعديل الصلاحيات الممنوحة لهذا الدور"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {role.isSystem && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {locale === "en" ? "System Role" : "دور نظام قياسي"}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                      {roleGrants.size} {translate("users.permissionsActive", locale)}
                    </span>
                  </div>
                </summary>

                <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)]">
                  <form action={updateRolePermissions} className="space-y-4">
                    <input type="hidden" name="roleId" value={role.id} />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {modules.map(({ id, key, icon: Icon, color }) => (
                        <div
                          key={id}
                          className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${color}`}>
                              <Icon size={14} />
                            </div>
                            <b className="text-xs font-bold text-[var(--ink)]">{translate(key, locale)}</b>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {actions.map((act) => {
                              const isChecked = roleGrants.has(`${id}:${act.id}`);
                              return (
                                <label
                                  key={act.id}
                                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-all cursor-pointer select-none ${
                                    isChecked
                                      ? "bg-indigo-50/60 border-indigo-200 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200 font-bold"
                                      : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--ink-secondary)]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    name="grant"
                                    value={`${id}:${act.id}`}
                                    defaultChecked={isChecked}
                                    className="rounded border-[var(--line-strong)] text-[var(--primary)] focus:ring-[var(--primary)]"
                                  />
                                  <span className="text-[11px]">{translate(act.key, locale)}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end pt-2">
                      <button className="primary px-5 py-2 text-xs flex items-center gap-1.5 font-bold cursor-pointer" type="submit">
                        <Save size={14} />
                        <span>{locale === "en" ? `Save Permissions: ${role.name}` : `حفظ صلاحيات دور: ${role.name}`}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </main>
  );
}
