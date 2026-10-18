import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Palette } from "lucide-react";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { settings, users } from "@/server/db/schema";
import { saveAppearance, saveSettings } from "@/features/settings/actions";
import { requirePermission } from "@/server/permissions";
import { localLogoUrl } from "@/server/services/branding";

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  await requirePermission("settings", "view");

  const [[row], [user]] = await Promise.all([
    db.select().from(settings).where(eq(settings.id, 1)).limit(1),
    db.select({ theme: users.theme, accent: users.accent }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const logoUrl = localLogoUrl(row?.logoPath);

  return (
    <main className="main standalone">
      <header className="topbar">
        <div>
          <p className="eyebrow">إدارة النظام والهوية</p>
          <h1>إعدادات المتجر والمظهر</h1>
        </div>
        <Link className="secondary" href="/">
          <ArrowRight size={15} />
          <span>الرئيسية</span>
        </Link>
      </header>

      {/* Organization Identity Settings */}
      <section className="panel settings-panel">
        <div className="panel-title">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            <div>
              <h3>بيانات المؤسسة والفواتير</h3>
              <p>اسم المتجر، العملة، الضريبة، والشعار المطبوع على الفواتير والسندات</p>
            </div>
          </div>
        </div>

        <form action={saveSettings} encType="multipart/form-data" className="form-grid">
          <label>
            اسم المؤسسة / المتجر
            <input name="organizationName" defaultValue={row?.organizationName ?? "لمسة جمال"} required />
          </label>
          <label>
            لغة الواجهة والاتجاه
            <select name="locale" defaultValue={row?.locale ?? "ar"}>
              <option value="ar">العربية (RTL) • Arabic</option>
              <option value="en">English (LTR) • الإنجليزية</option>
            </select>
          </label>
          <label>
            العملة الافتراضية
            <input name="currency" defaultValue={row?.currency ?? "EGP"} required maxLength={8} />
          </label>
          <input type="hidden" name="taxRate" value="0" />
          <label className="wide-field">
            شعار المتجر (PNG / JPG / WebP • حتى 3MB)
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          {row?.logoPath && (
            <div className="wide-field flex items-center gap-3 p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
              <span className="global-logo" style={{ backgroundImage: `url("${logoUrl}")` }} />
              <div>
                <b className="text-xs text-[var(--ink)] block">الشعار الحالي للمؤسسة</b>
                <span className="text-xs text-[var(--muted)]">يظهر في ترويسة الفواتير وشريط التنقل</span>
              </div>
            </div>
          )}
          <label className="wide-field">
            نص تذييل الفاتورة (ملاحظات ختامية للعميل)
            <textarea
              name="invoiceFooter"
              rows={3}
              defaultValue={row?.invoiceFooter ?? ""}
              placeholder="مثال: البضاعة المباعة لا ترد ولا تستبدل بعد 14 يومًا • شكرًا لتعاملكم معنا"
            />
          </label>
          <button className="primary" type="submit">
            حفظ إعدادات المؤسسة
          </button>
        </form>
      </section>

      {/* Appearance & Color Palette Settings */}
      <section className="panel">
        <div className="panel-title">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-indigo-600" />
            <div>
              <h3>المظهر ومجموعة الألوان</h3>
              <p>تخصيص السمة المرئية ونظام الألوان لحسابك الحالي</p>
            </div>
          </div>
        </div>

        <form action={saveAppearance} className="form-grid">
          <label>
            نمط السمة (Theme)
            <select name="theme" defaultValue={user?.theme ?? "system"}>
              <option value="system">حسب إعدادات نظام الجهاز</option>
              <option value="light">النمط الفاتح (Light Mode)</option>
              <option value="dark">النمط الداكن (Dark Mode)</option>
            </select>
          </label>
          <label>
            مجموعة ألوان التطبيق (Accent Color)
            <select
              name="accent"
              defaultValue={
                user?.accent === "rose" || user?.accent === "berry"
                  ? "indigo"
                  : user?.accent ?? "indigo"
              }
            >
              <option value="indigo">نيلي كلاسيكي (Indigo Navy) • موصى به</option>
              <option value="ocean">أزرق محيطي (Ocean Blue)</option>
              <option value="sage">أخضر زمردي هادئ (Emerald Sage)</option>
              <option value="gold">ذهبي كهرماني (Amber Gold)</option>
              <option value="slate">رمادي صناعي داكن (Industrial Slate)</option>
            </select>
          </label>
          <button className="primary" type="submit">
            تطبيق وحفظ المظهر
          </button>
        </form>
      </section>
    </main>
  );
}
