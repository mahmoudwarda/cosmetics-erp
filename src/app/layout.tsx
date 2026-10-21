import type { Metadata } from "next";
import "./globals.css";
import { PageTransition } from "@/components/page-transition";
import { AppNavigation } from "@/components/app-navigation";
import { getSessionUserId } from "@/server/auth/session";
import { db } from "@/server/db";
import { permissions, settings, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { localLogoUrl } from "@/server/services/branding";
import { getLocalNetworkUrl } from "@/server/network";

export const metadata: Metadata = {
  title: "Cosmetics ERP | إدارة متجر التجميل",
  description: "نظام متكامل لإدارة مخزون ومبيعات متجر مستحضرات التجميل",
  manifest: "/manifest.webmanifest",
};

import { I18nProvider, Locale } from "@/lib/i18n-client";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let organizationName = "لمسة جمال",
    logoPath: string | null = null,
    locale: Locale = "ar",
    theme = "system",
    accent = "indigo",
    modules: string[] = [],
    userName: string | null = null;
  const { url: networkUrl } = getLocalNetworkUrl(3001);

  try {
    const [brand] = await db
      .select({ name: settings.organizationName, logo: settings.logoPath, locale: settings.locale })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);
    if (brand) {
      organizationName = brand.name;
      logoPath = localLogoUrl(brand.logo);
      if (brand.locale === "en" || brand.locale === "ar") locale = brand.locale;
    }
    const userId = await getSessionUserId();
    if (userId) {
      const [user] = await db
        .select({ roleId: users.roleId, theme: users.theme, accent: users.accent, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user) {
        theme = user.theme;
        accent = user.accent;
        userName = user.name;
        modules = (
          await db
            .select({ module: permissions.module })
            .from(permissions)
            .where(and(eq(permissions.roleId, user.roleId), eq(permissions.action, "view")))
        ).map((grant) => grant.module);
      }
    }
  } catch {
    /* Keep the login shell available while local services are starting. */
  }

  return (
    <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"} data-theme={theme} data-accent={accent}>
      <body>
        <I18nProvider locale={locale}>
          <AppNavigation
            organizationName={organizationName}
            logoPath={logoPath}
            modules={modules}
            userName={userName}
            networkUrl={networkUrl}
            locale={locale}
          />
          <PageTransition>{children}</PageTransition>
        </I18nProvider>
      </body>
    </html>
  );
}
