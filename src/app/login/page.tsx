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
  const { url: networkUrl } = getLocalNetworkUrl(3000);

  return (
    <main className="login-shell">
      <section className="login-card-v2" aria-labelledby="login-heading">
        {/* Brand & Store Header */}
        <div className="login-brand-header">
          <div className="brand-mark">
            {logoUrl ? (
              <Image src={logoUrl} alt="" width={52} height={52} unoptimized className="brand-logo object-contain" />
            ) : (
              <Store size={26} aria-hidden="true" />
            )}
          </div>
          <h1 id="login-heading">{organization?.name ?? "لمسة جمال"}</h1>
          <p>نظام إدارة المخزون، المبيعات ونقاط البيع السحابية والمحلية</p>
        </div>

        {/* Interactive Login Form with Eye Toggle & Loading */}
        <LoginForm error={error} />

        {/* Footer & Network Connectivity */}
        <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-col items-center gap-2">
          <NetworkShareDialog networkUrl={networkUrl} />
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>نظام محلي مشفر ومحمي • تخزين آمن للبيانات</span>
          </div>
        </div>
      </section>
    </main>
  );
}
