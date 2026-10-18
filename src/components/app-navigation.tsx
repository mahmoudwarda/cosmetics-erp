"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Boxes,
  FileText,
  Gauge,
  Landmark,
  LogOut,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  ShieldCheck,
  Store,
  UsersRound,
  X,
  Globe,
  ChartNoAxesColumn,
} from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { toggleLocale } from "@/features/settings/actions";
import { NetworkShareDialog } from "@/components/network-share-dialog";
import { useI18n, Locale } from "@/lib/i18n";

const items = [
  { href: "/", labelKey: "nav.dashboard", defaultLabel: "لوحة التحكم", module: "reports", Icon: Gauge },
  { href: "/inventory", labelKey: "nav.inventory", defaultLabel: "المخزن", module: "inventory", Icon: Boxes },
  { href: "/invoices", labelKey: "nav.invoices", defaultLabel: "الفواتير", module: "invoices", Icon: FileText },
  { href: "/parties", labelKey: "nav.parties", defaultLabel: "العملاء والموردون", module: "parties", Icon: UsersRound },
  { href: "/finance", labelKey: "nav.finance", defaultLabel: "المالية", module: "finance", Icon: Landmark },
  { href: "/reports", labelKey: "nav.reports", defaultLabel: "التقارير", module: "reports", Icon: ChartNoAxesColumn },
  { href: "/users", labelKey: "nav.users", defaultLabel: "المستخدمون والصلاحيات", module: "users", Icon: ShieldCheck },
  { href: "/settings", labelKey: "nav.settings", defaultLabel: "الإعدادات", module: "settings", Icon: Settings2 },
];

export function AppNavigation({
  organizationName,
  logoPath,
  modules,
  userName,
  networkUrl,
  locale: initialLocale = "ar",
}: {
  organizationName: string;
  logoPath: string | null;
  modules: string[];
  userName: string | null;
  networkUrl?: string;
  locale?: Locale;
}) {
  const pathname = usePathname();
  const { t, locale, isRtl } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close mobile drawer on route navigation
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (pathname === "/login") return null;
  const effectiveUserName = userName || t("nav.admin", "مدير النظام");
  const visible = modules && modules.length > 0 ? items.filter((item) => modules.includes(item.module)) : items;

  return (
    <>
      {/* Mobile Topbar with Hamburger Menu (< 1024px) */}
      <header className="mobile-topbar print-hide">
        <Link href="/" className="flex items-center gap-2 text-[var(--ink)] font-bold text-sm">
          {logoPath ? (
            <img
              src={logoPath}
              alt={organizationName}
              className="w-7 h-7 rounded-md object-contain border border-[var(--line)] bg-[var(--panel)] shrink-0"
            />
          ) : (
            <span className="brand-mark small">
              <Store size={18} strokeWidth={2} />
            </span>
          )}
          <span>{organizationName}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Quick Language Switcher on Mobile Topbar */}
          <form action={toggleLocale}>
            <button
              type="submit"
              className="h-8 px-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] text-xs font-bold flex items-center gap-1 cursor-pointer"
              title={locale === "ar" ? "Switch to English" : "التحويل إلى العربية"}
            >
              <Globe size={13} className="text-indigo-600" />
              <span>{locale === "ar" ? "EN" : "عربي"}</span>
            </button>
          </form>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setMobileOpen(true)}
            aria-label={t("nav.dashboard", "القائمة الرئيسية")}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Backdrop for Mobile Drawer */}
      <div
        className={`nav-backdrop ${mobileOpen ? "is-visible" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Global Navigation (Sidebar on Desktop, Slide-over Drawer on Mobile) */}
      <aside
        className={`global-navigation ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
        aria-label={t("nav.dashboard", "التنقل الرئيسي")}
      >
        <div className="global-nav-heading">
          <Link href="/" className="global-brand">
            {logoPath ? (
              <img
                src={logoPath}
                alt={organizationName}
                className="w-9 h-9 rounded-lg object-contain border border-[var(--line)] bg-[var(--panel)] shrink-0 p-0.5"
              />
            ) : (
              <span className="brand-mark">
                <Store size={22} strokeWidth={2} />
              </span>
            )}
            <div className="flex flex-col">
              <span className="brand-name">{organizationName}</span>
              <span className="brand-sub">نظام إدارة المستودع والمبيعات</span>
            </div>
          </Link>

          {/* Desktop Collapse Toggle Button */}
          <button
            className="nav-toggle hidden lg:grid"
            type="button"
            aria-label={collapsed ? "توسيع الشريط الجانبي" : "طي الشريط الجانبي"}
            title={collapsed ? "توسيع الشريط الجانبي" : "طي الشريط الجانبي"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            className="nav-toggle lg:hidden"
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav id="main-navigation">
          {visible.map(({ href, labelKey, defaultLabel, Icon }) => {
            const label = t(labelKey, defaultLabel);
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                className={`global-nav-link ${isActive ? "is-active" : ""}`}
                aria-label={label}
                title={label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} strokeWidth={1.8} className="shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="global-nav-footer space-y-2">
          {/* Quick Language Toggle Button */}
          {!collapsed && (
            <form action={toggleLocale} className="w-full">
              <button
                type="submit"
                className="w-full py-1.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--panel)] text-[var(--ink)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all"
                title={locale === "ar" ? "Switch to English" : "التحويل إلى العربية"}
              >
                <Globe size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span>{locale === "ar" ? "🌐 Switch to English" : "🌐 التحويل إلى العربية"}</span>
              </button>
            </form>
          )}

          {networkUrl && !collapsed && (
            <div className="w-full flex justify-center pb-1">
              <NetworkShareDialog
                networkUrl={networkUrl}
                buttonLabel={t("nav.networkShare", "ربط أجهزة الشبكة 🌐")}
                className="w-full justify-center text-[11.5px]"
              />
            </div>
          )}

          <div className="flex items-center justify-between w-full pt-1">
            <span className="font-semibold text-xs text-[var(--ink)] truncate max-w-[130px]">{effectiveUserName}</span>
            <form action={signOut}>
              <button type="submit" aria-label={t("nav.logout", "تسجيل الخروج")} className="cursor-pointer">
                <LogOut size={15} />
                <span>{t("nav.logout", "خروج")}</span>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
