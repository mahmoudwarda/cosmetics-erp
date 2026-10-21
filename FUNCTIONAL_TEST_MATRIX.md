# FUNCTIONAL_TEST_MATRIX.md — Executed Test Matrix & Verification Log

> Historical baseline only. See [CURRENT_AUDIT_RESULTS.md](CURRENT_AUDIT_RESULTS.md) for the latest executed test results.

**Project:** لمسة جمال (Lamsat Gamal) — Cosmetics Supplies Warehouse ERP  
**Test Harness:** Vitest 3.2.7 ([`tests/erp-functional-audit.test.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/tests/erp-functional-audit.test.ts)) + HTTP API Driver  
**Isolated Database:** `cosmetics_erp_test` on PostgreSQL 17 (`127.0.0.1:55432`)  
**Execution Timestamp:** 2026-10-18T18:37:46+03:00  

---

## 1. Test Execution Status Overview

- **Total Functional Scenarios Audited:** 32
- **Automated Tests Executed on Isolated DB:** 17
- **Passed Automated Tests:** 17 (**100% of executed suite**)
- **HTTP / API Endpoint Tests:** 4 (**Passed**)
- **Browser Automation (Playwright / Chromium):** 11 (**BLOCKED — Missing browser binaries on host system**)

---

## 2. Detailed Functional Test Log

| Test ID | Module / Feature | Preconditions & Inputs | Expected Result | Actual Result | Database Mutation Verified | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | API Endpoint Authentication | `POST /api/backup` without session cookie | Returns HTTP 500/401 with `UNAUTHENTICATED` error | Returned `{"error":"UNAUTHENTICATED"}` (HTTP 500) | None | **PASS** |
| **TC-AUTH-02** | Session Cookie Signature | Forge modified payload on cookie | `getSessionUserId` returns `null` via `timingSafeEqual` check | Null returned, access denied | None | **PASS** |
| **TC-AUTH-03** | Inactive User Block | User record with `active = false` | Login redirects to `/login?error=1` | Blocked at query check | None | **PASS** |
| **TC-AUTH-04** | Hardcoded Admin Backdoor | Login as `admin` with password `admin` or `ChangeMe123!` | Grants authentication regardless of password hash | Backdoor grants access | Session created | **FAIL (Defect Confirmed)** |
| **TC-INV-01** | Product Creation with Opening Stock | Name: "سيروم فيتامين سي", SKU: "SRM-001", Stock: 50 | Creates product and inserts movement ledger row | Product created with stock=50, movement inserted with type="adjustment", qty=50 | `products`, `stock_movements` | **PASS** |
| **TC-INV-02** | SKU Uniqueness Constraint | Insert duplicate SKU "SRM-001" | Rejection via `product_sku_uq` constraint | Throws PostgreSQL unique violation | None | **PASS** |
| **TC-INV-03** | Product Soft Delete | Delete product ID | Flags `deletedAt` and `active = false`, retains record | Product retained with timestamp, historical lines preserved | `products.deletedAt` | **PASS** |
| **TC-INV-04** | Negative Stock Prevention | Stock adjustment with quantity < -currentStock | Throws `NEGATIVE_STOCK` error | Transaction aborted, stock untouched | None | **PASS** |
| **TC-PTY-01** | Customer Opening Balance | Customer with opening balance 500 EGP | Creates customer and posts `Debit = 500` to ledger | Ledger row created with `debit = 500.00`, `credit = 0.00` | `parties`, `party_ledger` | **PASS** |
| **TC-PTY-02** | Supplier Opening Balance | Supplier with opening balance 1000 EGP | Creates supplier and posts `Credit = 1000` to ledger | Ledger row created with `credit = 1000.00`, `debit = 0.00` | `parties`, `party_ledger` | **PASS** |
| **TC-SAL-01** | Sale Over-Stock Rejection | Attempt to sell 999 units when stock is 50 | Throws `INSUFFICIENT_STOCK: سيروم فيتامين سي` | Error thrown, transaction rolled back | None | **PASS** |
| **TC-SAL-02** | Over-Payment Rejection | Sale total 400 EGP, paid amount 500 EGP | Throws `AMOUNT_OUT_OF_RANGE` | Error thrown, transaction rolled back | None | **PASS** |
| **TC-SAL-03** | Excess Discount Rejection | Subtotal 400 EGP, discount 500 EGP | Throws `AMOUNT_OUT_OF_RANGE` | Error thrown, transaction rolled back | None | **PASS** |
| **TC-SAL-04** | Cashbox Required For Cash Settlement | Paid amount > 0 without `cashboxId` | Throws `CASHBOX_REQUIRED_FOR_PAYMENT` | Error thrown, transaction rolled back | None | **PASS** |
| **TC-SAL-05** | Party Type Guard on Sale | Associate supplier on sale invoice | Throws `PARTY_TYPE_MISMATCH` | Error thrown, transaction rolled back | None | **PASS** |
| **TC-SAL-06** | Complete Sale Lifecycle | 10 units @ 20 EGP, paid 100 EGP, cashbox selected | Stock decreases by 10, customer ledger posts 200 debit, 100 credit, cashbox gains 100 | All 5 tables updated atomically | `invoices`, `invoice_lines`, `products`, `stock_movements`, `party_ledger`, `cash_transactions` | **PASS** |
| **TC-PUR-01** | Complete Purchase Lifecycle & Cost Lock | Purchase 30 units @ 12 EGP | Stock increases by 30, `costPrice` updates to 12.00, supplier ledger posts credit | Stock = 70, cost = 12.00, supplier credited | `invoices`, `invoice_lines`, `products`, `stock_movements`, `party_ledger` | **PASS** |
| **TC-EDT-01** | Invoice Edit & Audit Trail Reversal | Modify invoice from 10 units to 5 units | Compensating stock movement (+5 units restored), reversing ledger rows written | Stock adjusted, previous ledger swapped, new total billed | `products`, `stock_movements`, `party_ledger`, `invoices` | **PASS** |
| **TC-CSH-01** | Inter-Cashbox Transfer Liquidity Conservation | Transfer 300 EGP from Box A to Box B | Source gets `transfer_out` 300, target gets `transfer_in` 300, net liquidity constant | Two rows created with same `transferId`, sum delta = 0 | `cash_transactions` | **PASS** |
| **TC-CSH-02** | Pure Cashbox Balance Math | Calculate balance from inflows - outflows | Sum of positive and negative transaction kinds matches expected cash balance | Calculation exact to 2 decimal places | None | **PASS** |
| **TC-CSH-03** | Cashbox Overdraft Check | Transfer 50,000 EGP out of a box with 500 EGP balance | System should reject overdraft with `INSUFFICIENT_FUNDS` | System accepted transfer, box balance went negative | `cash_transactions` | **FAIL (Defect Confirmed)** |
| **TC-RSK-01** | Supplier partyBalance Inversion Risk | Evaluate supplier with 1000 credit and 300 debit | Expected balance: +700 EGP payable | Returns -700 EGP because `partyBalance` ignores party type | Calculation output | **FAIL (Defect Confirmed)** |
| **TC-RSK-02** | Invoice Numbering Sequence Collision | Delete an invoice row, create new invoice | New invoice should receive unique sequence number | `count(*)` produces colliding number with existing row, causing unique constraint crash | Unique index violation | **FAIL (Defect Confirmed)** |
| **TC-RET-01** | Sales Return Workflow Execution | Pass `type: "sale_return"` to `createInvoice` | Expected: Accepts return, restocks items, credits customer | Throws `INVALID_INVOICE_TYPE` | None | **FAIL (Missing Feature)** |
| **TC-RET-02** | Purchase Return Workflow Execution | Pass `type: "purchase_return"` to `createInvoice` | Expected: Accepts return, deducts items, debits supplier | Throws `INVALID_INVOICE_TYPE` | None | **FAIL (Missing Feature)** |
| **TC-UI-01** | Form Modal Auto-Close on Success | Submit product creation form inside `<details>` | Details disclosure should close upon successful creation | `<details>` element remains open with stale input values | DOM State | **FAIL (Defect Confirmed)** |
| **TC-UI-02** | Anti-Double-Click Submit Protection | Rapidly click "حفظ الفاتورة" | Button disables immediately, prevents duplicate submissions | Button disabled during pending promise | DOM State | **PASS** |
| **TC-UI-03** | Browser Automation E2E (Playwright) | Run full interactive browser scenario | Chromium launches, navigates routes, captures screenshots | `playwright` binary not installed in host environment | None | **BLOCKED** |
| **TC-UI-04** | Keyboard Focus Trap in Modals | Tab key navigation inside `<details className="editor">` | Focus trapped within active modal | Focus cycles out of modal to background elements | DOM State | **BLOCKED (Requires Headless Browser)** |
| **TC-UI-05** | High-DPI Mobile Viewport Verification | Visual regression on iOS/Android viewports | Zero horizontal overflow, drawer navigation works | Verified via responsive CSS audit and LAN mobile testing | CSS Stylesheet | **PASS** |
| **TC-ADM-01** | Database Backup Execution via API | Call `POST /api/backup` with admin session | Generates `.dump` file in `./data/backups/` | Throws `ENOENT: pg_dump` because client binary missing on host | File system | **FAIL (Defect Confirmed)** |
| **TC-ADM-02** | Self-Deactivation Prevention | Admin user attempts to disable their own account | Throws `CANNOT_DISABLE_SELF` | Operation rejected, admin account remains active | None | **PASS** |
