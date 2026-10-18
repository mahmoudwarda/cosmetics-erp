# MISSING_FEATURES_AND_IDEAS.md — Missing Workflows & Enhancement Backlog

**Project:** لمسة جمال (Lamsat Gamal) — Cosmetics Supplies Warehouse ERP  
**Focus:** Warehouse operational realities, commercial cosmetics supply workflows, and functional completeness  

---

## 1. Missing Core Business Workflows

### A. Sales & Purchase Returns (مردودات المبيعات والمشتريات)
- **Current State:** The database enums (`invoice_type_enum`, `movement_type_enum`) declare `sale_return` and `purchase_return`, but `createInvoice` explicitly throws `INVALID_INVOICE_TYPE`, and no UI exists.
- **Business Need:** In the cosmetics industry, salons frequently return damaged goods, wrong shades of foundation, or defective pumps. Similarly, warehouses return expired batches or leaking containers to suppliers.
- **Required Implementation:**
  1. Add a "مرتجع مبيعات" button on the invoice view page to generate a credit return referencing `originalInvoiceId`.
  2. Increment product stock atomically.
  3. Credit customer account or trigger cash payout from the selected drawer.
  4. Record `stock_movements` with `type: "sale_return"`.

---

### B. Category Management & Merchandising (إدارة التصنيفات)
- **Current State:** Only a quick-create text box exists in [`src/features/inventory/actions.ts:createCategory`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/inventory/actions.ts#L79). Categories cannot be edited, renamed, reorganized, or deleted.
- **Business Need:** Warehouses frequently restructure product lines (e.g., merging "عناية بالبشرة" and "مستحضرات علاجية" or fixing spelling errors).
- **Required Implementation:**
  - `updateCategory(id, name, parentId)`
  - `deleteCategory(id)`: Guarded by checking `products.categoryId IS NULL` to prevent breaking active catalogs.

---

### C. Cashbox Closure & Drawer Reconciliation (إقفال ورديات الخزينة)
- **Current State:** Cashboxes run indefinitely. No concept of daily shifts, cashier handovers, or drawer counts.
- **Business Need:** At the end of each shift or business day, the cashier must count cash, match it against recorded `cash_transactions`, identify shortages/overages (عجز وزيادة), and lock the drawer.
- **Required Implementation:**
  - Shift closing workflow: Expected cash vs Actual counted cash.
  - Automatic posting of variance as "عجز خزينة" (expense) or "زيادة نقدية" (income).

---

### D. Specific Invoice Debt Settlement (مطابقة الفواتير وسداد فواتير محددة)
- **Current State:** Customer payments are posted broadly to `party_ledger` as general credit without linking to specific unpaid invoice IDs.
- **Business Need:** Salons often pay by check or transfer for "Invoice #104" specifically. Without invoice matching, an invoice remains marked `unpaid` or `partial` even when the customer's total balance is zero.
- **Required Implementation:**
  - Option during `registerPartyPayment` to select which pending invoices to allocate the payment toward, updating `invoices.paid` and `invoices.status` accordingly.

---

## 2. High-Impact Operational Improvements

### 1. Barcode Scanner Fast-Entry Buffer (التقاط الباركود المباشر)
- **Problem:** Currently, adding an item in `/invoices/new` requires opening a dropdown, searching by text, typing the quantity, and clicking "إضافة للبند".
- **Enhancement:** Add a global `keydown` event listener in `InvoiceForm`. Standard USB/Bluetooth barcode scanners emit rapid alphanumeric sequences followed by `Enter`.
- **User Experience:** Cashier scans a shampoo bottle $\rightarrow$ item automatically adds to the invoice table with quantity 1 $\rightarrow$ cursor remains ready for the next scan.

### 2. Native Thermal Receipt (80mm) & WhatsApp Sharing
- **Problem:** Browser print relies on standard desktop dialogs.
- **Enhancement:**
  - Dedicated 80mm ESC/POS thermal receipt CSS template for POS ticket printers.
  - "إرسال الفاتورة عبر واتساب" button that formats invoice details and total into a pre-filled WhatsApp link (`https://wa.me/20XXXXXXXXXX?text=...`) for salon clients.

### 3. Bulk Excel / CSV Importer for Cosmetics Supplies
- **Problem:** Manually typing 1,000 new cosmetic SKUs (brand, size, shade, barcode, wholesale price) is laborious.
- **Enhancement:** Upload CSV/Excel template directly creating categories and products within a background batch transaction.

### 4. Minimum Stock Auto-Purchase Draft (مسودة أمر شراء عند النواقص)
- **Problem:** The dashboard displays "أصناف تحتاج إعادة طلب", but the warehouse manager must manually write down the items.
- **Enhancement:** One-click action: "إنشاء مسودة أمر شراء لجميع الأصناف المنخفضة" automatically pre-filling `/invoices/new` with supplier products at reorder levels.

### 5. Automated Periodic Docker Database Backups
- **Problem:** Manual backup via browser route fails if host tools are missing.
- **Enhancement:** Docker Compose cron container or nightly Node.js daemon dumping `cosmetics_erp` to `./data/backups/` and uploading encrypted snapshots to offsite storage (S3/GCS).
