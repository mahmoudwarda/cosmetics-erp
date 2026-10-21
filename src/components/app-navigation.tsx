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
  PlusCircle,
  User,
  Wifi,
} from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { toggleLocale } from "@/features/settings/actions";
import { NetworkShareDialog } from "@/components/network-share-dialog";
import { useI18n, Locale } from "@/lib/i18n-client";

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

const mobileBottomItems = [
  { href: "/", labelKey: "nav.dashboard", defaultLabel: "الرئيسية", Icon: Gauge },
  { href: "/inventory", labelKey: "nav.inventory", defaultLabel: "المخزن", Icon: Boxes },
  { href: "/invoices/new", labelKey: "invoices.newShort", defaultLabel: "+ فاتورة", Icon: PlusCircle, isPrimary: true },
  { href: "/invoices", labelKey: "nav.invoices", defaultLabel: "الفواتير", Icon: FileText },
  { href: "/parties", labelKey: "nav.parties", defaultLabel: "العملاء", Icon: UsersRound },
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

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (mobileOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [mobileOpen]);

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
        <Link href="/" className="flex items-center gap-2 text-[var(--ink)] font-bold text-sm min-w-0">
          {logoPath ? (
            <img
              src={logoPath}
              alt={organizationName}
              className="w-7 h-7 rounded-md object-contain border border-[var(--line)] bg-[var(--panel)] shrink-0"
            />
          ) : (
            <span className="brand-mark small shrink-0">
              <Store size={18} strokeWidth={2} />
            </span>
          )}
          <span className="truncate max-w-[150px] sm:max-w-[200px]">{organizationName}</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Network share pill on mobile */}
          {networkUrl && (
            <NetworkShareDialog
              networkUrl={networkUrl}
              buttonLabel=""
              className="p-1.5 h-8 w-8 !px-0 rounded-lg"
            />
          )}

          {/* Quick Language Switcher on Mobile Topbar */}
          <form action={toggleLocale}>
            <button
              type="submit"
              className="h-8 px-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] text-xs font-bold flex items-center gap-1 cursor-pointer"
              title={locale === "ar" ? "Switch to English" : "التحويل إلى العربية"}
            >
              <Globe size={13} className="text-indigo-600 shrink-0" />
              <span>{locale === "ar" ? "EN" : "عربي"}</span>
            </button>
          </form>

          {/* User initials / icon badge on mobile */}
          <div
            className="h-8 px-2 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--ink)] text-xs font-bold flex items-center gap-1"
            title={effectiveUserName}
          >
            <User size={13} className="text-slate-600 shrink-0" />
            <span className="max-w-[70px] truncate hidden sm:inline">{effectiveUserName}</span>
          </div>

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
            {!collapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="brand-name font-bold text-xs truncate max-w-[140px]">{organizationName}</span>
                <span className="brand-sub text-[10px] text-[var(--muted)] truncate">
                  {locale === "en" ? "Warehouse & Sales ERP" : "نظام إدارة المستودع والمبيعات"}
                </span>
              </div>
            )}
          </Link>

          {/* Responsive Sidebar Close/Collapse Toggle Button */}
          <button
            className="nav-toggle"
            type="button"
            aria-label={
              mobileOpen
                ? (locale === "en" ? "Close menu" : "إغلاق القائمة")
                : collapsed
                ? (locale === "en" ? "Expand sidebar" : "توسيع الشريط الجانبي")
                : (locale === "en" ? "Collapse sidebar" : "طي / إغلاق الشريط الجانبي")
            }
            title={
              mobileOpen
                ? (locale === "en" ? "Close menu" : "إغلاق القائمة")
                : collapsed
                ? (locale === "en" ? "Expand sidebar" : "توسيع الشريط الجانبي")
                : (locale === "en" ? "Collapse sidebar" : "طي / إغلاق الشريط الجانبي")
            }
            onClick={() => {
              if (mobileOpen) {
                setMobileOpen(false);
                return;
              }
              const next = !collapsed;
              setCollapsed(next);
              if (typeof document !== "undefined") {
                if (next) {
                  document.body.classList.add("sidebar-collapsed");
                } else {
                  document.body.classList.remove("sidebar-collapsed");
                }
              }
            }}
          >
            {collapsed ? <PanelRightOpen size={18} /> : <X size={18} />}
          </button>
        </div>

        <nav id="main-navigation" className="overflow-y-auto">
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

        <div className="global-nav-footer space-y-2 mt-auto">
          {/* Quick Language Toggle Button */}
          {!collapsed && (
            <form action={toggleLocale} className="w-full">
              <button
                type="submit"
                className="w-full py-1.5 px-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--panel)] text-[var(--ink)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all"
                title={locale === "ar" ? "Switch to English" : "التحويل إلى العربية"}
              >
                <Globe size={14} className="text-indigo-600" />
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

      {/* Mobile Bottom Navigation Bar (< 1024px) for Instant Touch Workflow */}
      <nav className="mobile-bottom-nav print-hide" aria-label="التنقل السفلي السريع">
        {mobileBottomItems.map(({ href, labelKey, defaultLabel, Icon, isPrimary }) => {
          const label = t(labelKey, defaultLabel);
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

          if (isPrimary) {
            return (
              <Link
                key={href}
                href={href}
                className="mobile-bottom-nav-primary flex flex-col items-center justify-center -mt-4 bg-indigo-600 text-white rounded-full w-12 h-12 shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform shrink-0"
                title={label}
                aria-label={label}
              >
                <Icon size={22} />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`mobile-bottom-nav-link ${isActive ? "is-active" : ""}`}
              aria-label={label}
              title={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={19} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
