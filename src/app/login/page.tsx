import Image from "next/image";
import { Store, ShieldCheck } from "lucide-react";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { localLogoUrl } from "@/server/services/branding";
import { getLocalNetworkUrl } from "@/server/network";
import { NetworkShareDialog } from "@/components/network-share-dialog";
import { LoginForm } from "@/features/auth/login-form";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let organization: { name: string; logoPath: string | null } | undefined;

  try {
    const [row] = await db
      .select({ name: settings.organizationName, logoPath: settings.logoPath })
      .from(settings)
      .limit(1);
    organization = row;
  } catch {
    /* Keep login available while database is starting */
  }

  const logoUrl = localLogoUrl(organization?.logoPath);
  const { url: networkUrl } = getLocalNetworkUrl(3001);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-slate-100 via-indigo-50/30 to-slate-200/60">
      <section
        className="w-full max-w-[440px] bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 text-right transition-all"
        aria-labelledby="login-heading"
      >
        {/* Brand & Store Header */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl border border-indigo-100 bg-indigo-50/50 flex items-center justify-center mx-auto mb-4 p-1.5 overflow-hidden">
            {logoUrl ? (
              <Image src={logoUrl} alt="" width={56} height={56} unoptimized className="w-full h-full object-contain rounded-xl" />
            ) : (
              <Store size={28} className="text-indigo-600" aria-hidden="true" />
            )}
          </div>
          <h1 id="login-heading" className="text-2xl font-black text-slate-900 mb-1 tracking-tight">
            {organization?.name ?? "لمسة جمال"}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            نظام إدارة المخزون، المبيعات ونقاط البيع السحابية والمحلية
          </p>
        </div>

        {/* Interactive Login Form with Eye Toggle & Loading */}
        <LoginForm error={error} />

        {/* Footer & Network Connectivity */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-2.5">
          <NetworkShareDialog networkUrl={networkUrl} />
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span>نظام محلي مشفر ومحمي • تخزين آمن للبيانات</span>
          </div>
        </div>
      </section>
    </main>
  );
}
