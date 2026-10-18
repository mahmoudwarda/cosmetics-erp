# FRONTEND_REDESIGN_AUDIT.md — Complete Route, Component & Responsive Audit

**Project:** لمسة جمال (Lamsat Gamal) — Cosmetics Supplies Warehouse ERP  
**Audit Date:** October 18, 2026  
**Auditor Roles:** Senior Frontend Engineer, ERP UX Architect, Accessibility Engineer  
**Baseline Tech Stack:** Next.js 16.0.0 App Router, React 19.2.0, TypeScript 5.9.3, Tailwind CSS v4.1.14, Lucide-react 0.544.0  

---

## 1. Route Map & Component Inventory

| Route Path | Page Purpose | Layout / Shell Component | Key Page Components & Controls | Data & Form Interactivity | Responsive Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | Authentication Portal | Standalone (No AppNav) | `LoginForm`, Logo, Card, Error Banner | Client form, Argon2 server action, password toggle | Usable (< 400px), centered card |
| `/` | Operational Warehouse Dashboard | `AppNavigation` (Fixed Rail / Drawer) | KPI Cards (Sales, Purchases, Cash, Alerts), Low Stock Table, Recent Invoices Table, Quick Actions | Server Component, real-time DB counts, status badges | Tablet/Desktop clean, KPI grid wraps on mobile |
| `/inventory` | Product Catalog & Stock Control | `AppNavigation` | Inventory KPI Summary, Search/Filter Bar, `<details className="editor">` (Product form, Stock adjust form, Category quick-add), Products Table | Zod Server Actions (`saveProduct`, `adjustStockFromForm`, `deleteProduct`, `createCategory`) | Table scrolls horizontally; disclosures expand vertically |
| `/invoices` | Invoices Historical Ledger | `AppNavigation` | Date filter bar, Type tabs (Sale/Purchase), Invoices Table, Status Badges (`paid`, `unpaid`, `partial`), Pagination link | Query filter params, Links to `/invoices/[id]` | Table horizontal scroll container; filter wraps |
| `/invoices/new` | Multi-Line Invoice Creation | `AppNavigation` | `InvoiceForm` (Type switcher, Party select, Cashbox select, Product picker, Lines table, Discount/Tax/Paid inputs, Submit button) | Client state + Zod Server Action (`saveInvoice` -> `createInvoice`), anti-double-click | Form grid wraps; product lines table scrolls on small screens |
| `/invoices/[id]` | Invoice View, Print & Edit | `AppNavigation` | Invoice Metadata Header, Items Table, Financial Summary (Subtotal, Discount, Tax, Total, Paid, Balance), `PrintButton`, Edit `<details>` | Server Component, Printable view, Edit disclosure containing `InvoiceForm` | Optimized for A4 / 80mm print; screen layout responsive |
| `/parties` | Customers & Suppliers Registry | `AppNavigation` | Party Type Tabs (Customers / Suppliers), Search/Filter, `<details className="editor">` (Create party form), Parties Table, Action Buttons | Server Component + Server Actions (`saveParty`, `deleteParty`) | Table responsive with horizontal scroll; forms wrap |
| `/parties/[id]` | Party Statement & Payment Desk | `AppNavigation` | Party Profile Card, Outstanding Balance Card, Payment `<details>` modal, Transaction History Table, `PrintButton` | Server Actions (`registerPartyPayment`), printable ledger | Header wraps on mobile; ledger table scrolls |
| `/statements` | Filterable Account Statements | `AppNavigation` | Account Select Dropdown, Date Range Pickers (`from`, `to`), `PrintButton`, Running Balance Statement Table | Search params query, running balance calculation, print stylesheet | Filter inputs wrap to 1-col on mobile; print cleans navigation |
| `/finance` | Treasury & Cashboxes | `AppNavigation` | Cashbox Balance Cards (Cash, Bank, Wallet), Action Disclosures (Add Cashbox, Add Transaction, Transfer Cash), Transaction History Table | Server Actions (`createCashbox`, `addCashTransaction`, `transferCash`) | KPI cards wrap; transfers select 2 columns on tablet/desktop |
| `/reports` | Sales & Category Analytics | `AppNavigation` | Date Range Picker, Period Summary KPI Strip, Category Revenue Breakdown Bar, Top 10 Selling Products Table, `PrintButton` | Search params query, SQL aggregations, printable report | Bar charts container responsive; tables scroll |
| `/users` | Staff Accounts & RBAC Matrix | `AppNavigation` | Users Table, Status Toggles, Password Reset Modal, `<details>` Create User, `<details>` Create Role, Roles & Permissions Checkbox Matrix | Server Actions (`saveUser`, `toggleUserActive`, `resetUserPassword`, `createRole`, `updateRolePermissions`) | Matrix grid wraps; table scrolls |
| `/settings` | System Brand & Configuration | `AppNavigation` | Brand & Store Form (Name, Currency, Tax Rate, Logo Upload, Footer), Appearance Picker (Theme, Accent Color), Database Backup Trigger Button | Server Actions (`saveSettings`, `saveAppearance`, `/api/backup`) | Form grid adapts 1-to-2 columns |
| `/[section]` | Dynamic Redirect Catch-All | `AppNavigation` | Redirects to valid module or 404 | Next.js Server Redirect | Responsive redirect |

---

## 2. Shared Layout & Component Architecture

### A. Navigation & Shell (`src/components/app-navigation.tsx`)
- **Desktop (>= 1024px):** Fixed right-rail sidebar (`w-64`, fixed position `top-0 bottom-0 right-0`). Right padding `pe-64` applied to body/main.
- **Mobile (< 1024px):** Off-canvas drawer with hamburger button in sticky top bar, backdrop overlay, and animated slide-out from the right.
- **RTL Integrity:** Logical spacing used (`ms-`, `me-`, `pe-`, `ps-`, `start-`, `end-`).

### B. Disclosure Modals (`src/components/close-disclosure-button.tsx`)
- Native HTML `<details className="editor">` with `<summary>` triggers.
- **Problem:** When Server Actions revalidate, `<details>` does not close automatically.
- **Problem:** Lacks backdrop click dismiss and `Escape` key capture.

### C. Printing Controls (`src/components/print-button.tsx`)
- Client button triggering `window.print()`.
- Screen classes utilize `@media print` rules in `globals.css` with `.print-hide` hiding navigation rails and action headers.

### D. Network Share Modal (`src/components/network-share-dialog.tsx`)
- LAN QR code and URL sharing dialog for warehouse mobile devices.

---

## 3. Current Responsive Behavior by Viewport

| Viewport Width | Target Profile | Shell / Navigation | Forms & Grids | Tables | Known Deficiencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **320px–375px** | Small Mobile (iPhone SE) | Drawer nav works | Form grids wrap to 1-col | Must scroll horizontally | Number badges wrap tightly; search inputs need full width |
| **376px–430px** | Standard Mobile (iPhone 14/15/16) | Drawer nav works | Form grids wrap cleanly | Clean horizontal scroll | Minor button spacing crowding on action bars |
| **431px–767px** | Large Mobile / Phablets | Drawer nav works | 2-col inputs start to fit | Table container scroll | Disclosures need improved max-height bounds |
| **768px–1023px** | Tablets (Portrait/Landscape) | Drawer / compact rail | 2-3 column grids | Wide tables fit most columns | Some tables have empty space on right; KPI cards 2-col |
| **1024px–1279px** | Small Laptops | Fixed rail (w-64) | 3-4 column grids | Tables fully legible | Content feels slightly shifted if container lacks max-width |
| **1280px–1535px** | Standard Laptops / Desktops | Fixed rail (w-64) | Full multi-column | Spacious tables | Ideal layout; typography remains crisp |
| **1536px+** | Large Desktop (2K / 4K) | Fixed rail | Multi-column | Spacious | Needs max-width centering to avoid excessive line lengths |

---

## 4. Accessibility & Visual Consistency Deficiencies

1. **Focus States:** Missing prominent `:focus-visible` rings on custom `<summary>` button elements.
2. **Accessible Names:** Several icon-only action buttons (edit, delete, trash) lack explicit `aria-label` or `title` attributes.
3. **Form Error Association:** Form validation errors are rendered in global banners or error boundaries rather than directly associated with input fields via `aria-describedby`.
4. **Color Contrast:** Muted text (`var(--muted)`) in dark mode or secondary table cells needs verification against WCAG AA (minimum 4.5:1 ratio).
5. **Touch Targets:** A few table action buttons (e.g., delete trash can icon) measure under 36px touch area on small screens, needing at least 44×44px touch targets.
