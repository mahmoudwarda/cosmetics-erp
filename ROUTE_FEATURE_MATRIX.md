# ROUTE_FEATURE_MATRIX.md — Route, Feature & Permission Matrix

> Historical baseline only. See [CURRENT_AUDIT_RESULTS.md](CURRENT_AUDIT_RESULTS.md) for current route verification and security status.

**Project:** لمسة جمال (Lamsat Gamal) — Cosmetics Supplies Warehouse ERP  
**Scope:** 14 Application Routes, 16 Server Actions, 2 Route Handlers  

---

## 1. Application Routes & Permissions Matrix

| Path | Description | Access Level | Required Permission | Server Action / Handler | Mutated Tables |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | Authentication Portal | Public | None | `signIn(formData)` | None (Reads `users`, `permissions`) |
| `/` | Operational Executive Dashboard | Authenticated | `reports.view` | None (Server Component) | Reads `invoices`, `products`, `cashboxes`, `cash_transactions` |
| `/inventory` | Product Catalog & Stock | Authenticated | `inventory.view` | `saveProduct`, `deleteProduct`, `adjustStockFromForm`, `createCategory` | `products`, `stock_movements`, `categories` |
| `/invoices` | Commercial Invoices Ledger | Authenticated | `invoices.view` | None (List View) | Reads `invoices`, `parties`, `users` |
| `/invoices/new` | Multi-line Invoice Creation | Authenticated | `invoices.create` | `saveInvoice` -> `createInvoice` | `invoices`, `invoice_lines`, `products`, `stock_movements`, `party_ledger`, `cash_transactions` |
| `/invoices/[id]` | Invoice Detail, Printing & Edit | Authenticated | `invoices.view` (edit: `invoices.edit`) | `saveInvoice` -> `updateInvoice` | Same as creation + compensating reversals |
| `/parties` | Customers & Suppliers Catalog | Authenticated | `parties.view` | `saveParty`, `deleteParty`, `registerPartyPayment` | `parties`, `party_ledger`, `cash_transactions` |
| `/parties/[id]` | Party Statement & Payment History | Authenticated | `parties.view` | `registerPartyPayment` | `party_ledger`, `cash_transactions` |
| `/statements` | Filterable Account Statements | Authenticated | `parties.view` | None (Query + Print) | Reads `parties`, `party_ledger` |
| `/finance` | Cashboxes & Treasury Ledger | Authenticated | `finance.view` | `createCashbox`, `addCashTransaction`, `transferCash` | `cashboxes`, `cash_transactions` |
| `/reports` | Profit & Category Analytics | Authenticated | `reports.view` | None (Query + Print) | Reads `invoice_lines`, `invoices`, `categories`, `products` |
| `/users` | User Accounts & RBAC Matrix | Authenticated | `users.view` | `saveUser`, `resetUserPassword`, `toggleUserActive`, `createRole`, `updateRolePermissions` | `users`, `roles`, `permissions` |
| `/settings` | System Settings & Backup | Authenticated | `settings.view` (edit: `settings.edit`) | `saveSettings`, `saveAppearance` | `settings`, `users` |
| `/api/backup` | Database Dump Generator | Authenticated API | `settings.edit` | Route Handler (`POST`) | Triggers external `pg_dump` binary |
| `/api/uploads/[filename]` | Static File Asset Delivery | Authenticated / Public | None | Route Handler (`GET`) | Reads from `UPLOADS_DIR` disk storage |

---

## 2. Server Actions Detailed Technical Specification

### A. Authentication (`src/features/auth/actions.ts`)
1. **`signIn(formData: FormData)`**
   - **Inputs:** `username` (string), `password` (string).
   - **Validation:** Finds active user, verifies hash via Argon2. Hardcoded fallback exists for `admin` (`admin` / `ChangeMe123!`).
   - **Session:** Issues signed HMAC-SHA256 cookie (`cosmetics_session`).
   - **Redirect:** Determines first accessible module based on assigned role permissions.
2. **`signOut()`**
   - **Effect:** Deletes cookie and redirects to `/login`.

### B. Inventory & Products (`src/features/inventory/actions.ts`)
1. **`saveProduct(formData: FormData)`**
   - **Permission:** `inventory.create` (new) or `inventory.edit` (existing).
   - **Validation Schema:** `productSchema` (Zod): `name` (2-180), `sku` (1-80), `costPrice` (>=0), `salePrice` (>=0), `stock` (>=0), `reorderLevel` (>=0).
   - **Database Effects:**
     - Inserts or updates `products`.
     - On initial creation, if `stock > 0`, atomically writes initial `stock_movements` record (`type: "adjustment"`, reason: "رصيد افتتاحي عند إنشاء المنتج").
2. **`deleteProduct(formData: FormData)`**
   - **Permission:** `inventory.delete`.
   - **Effect:** Sets `active: false` and `deletedAt: new Date()`. Soft-delete preserves relational integrity in `invoice_lines`.
3. **`adjustStock(raw: unknown)` / `adjustStockFromForm(formData: FormData)`**
   - **Permission:** `inventory.edit`.
   - **Validation:** `productId` (UUID), `quantity` (non-zero finite float), `reason` (min 4 chars).
   - **Guards:** Rejects if `stock + quantity < 0` (`NEGATIVE_STOCK`).
   - **Database Effects:** Updates `products.stock`, records `stock_movements` with `type: "adjustment"`.
4. **`createCategory(formData: FormData)`**
   - **Permission:** `inventory.create`.
   - **Validation:** `name` (2-120 chars).
   - **Limitation:** No update or delete action exists for categories.

### C. Invoices & Billing (`src/features/invoices/actions.ts` & `src/server/services/invoices.ts`)
1. **`createInvoice(input: InvoiceInput, userId: string)`**
   - **Permission:** `invoices.create`.
   - **Validation:** Line items length >= 1, `type` in `["sale", "purchase"]`, `quantity > 0`, `unitPrice >= 0`, `paid <= total`, `discount <= subtotal`.
   - **Party Type Guard:** Rejects sale invoices with supplier party (`PARTY_TYPE_MISMATCH`).
   - **Concurrency Control:** `pg_advisory_xact_lock(hashtext(input.type))`.
   - **Number Generation:** `prefix + (count + 1)`.
   - **Database Effects:** Atomic write across 5 tables (`invoices`, `invoice_lines`, `products`, `stock_movements`, `party_ledger`, `cash_transactions`).
2. **`updateInvoice(invoiceId: string, input: InvoiceInput, userId: string)`**
   - **Permission:** `invoices.edit`.
   - **Row Locking:** Acquires `for("update")` lock on invoice and products.
   - **Database Effects:** Computes compensating inventory and ledger entries. Does not destroy audit trail.

### D. Treasury & Finance (`src/features/finance/actions.ts`)
1. **`createCashbox(formData: FormData)`**
   - **Permission:** `finance.create`.
   - **Validation:** `name` (2-100), `kind` (`cash` | `bank` | `wallet`), `openingBalance` (>= 0).
   - **Limitation:** Cannot be edited or archived.
2. **`transferCash(formData: FormData)`**
   - **Permission:** `finance.create`.
   - **Validation:** `from` != `to`, `amount > 0`.
   - **Database Effects:** Two symmetric rows in `cash_transactions` (`transfer_out` and `transfer_in`) sharing a single `transferId`.
   - **Defect:** Does not check source balance.
3. **`addCashTransaction(formData: FormData)`**
   - **Permission:** `finance.create`.
   - **Validation:** `kind` (`income` | `expense`), `amount > 0`, `category` (2-100).
   - **Defect:** Does not check cashbox liquidity for expenses.
4. **`registerPartyPayment(formData: FormData)`**
   - **Permission:** `parties.create`.
   - **Effect:** Dual write to `party_ledger` and `cash_transactions`.

### E. Commercial Parties (`src/features/parties/actions.ts`)
1. **`saveParty(formData: FormData)`**
   - **Permission:** `parties.create` or `parties.edit`.
   - **Validation:** `name` (2-180), `type` (`customer` | `supplier`), `openingBalance` (>= 0).
   - **Database Effects:** Inserts/updates `parties`; creates/updates `party_ledger` opening balance entry.
2. **`deleteParty(formData: FormData)`**
   - **Permission:** `parties.delete`.
   - **Effect:** Soft-delete (`deletedAt = new Date()`).

### F. Users & Roles (`src/features/users/actions.ts`)
1. **`saveUser(formData: FormData)`**
   - **Permission:** `users.create` or `users.edit`.
   - **Validation:** Password length >= 10, username uniqueness enforced.
2. **`toggleUserActive(formData: FormData)`**
   - **Permission:** `users.edit`.
   - **Guard:** Prevents disabling current user (`CANNOT_DISABLE_SELF`).
3. **`createRole` & `updateRolePermissions`**
   - **Permission:** `users.create` / `users.edit`.
   - **Effect:** Atomic role and permission assignment.
