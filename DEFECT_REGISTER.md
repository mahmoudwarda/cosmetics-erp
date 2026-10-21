# DEFECT_REGISTER.md — Formal Defect Register & Vulnerability Assessment

> Historical baseline only. Findings below were captured against an earlier source state. See [CURRENT_AUDIT_RESULTS.md](CURRENT_AUDIT_RESULTS.md) for current fixes, tests, and deployment conditions.

**Project:** لمسة جمال (Lamsat Gamal) — Cosmetics Supplies Warehouse ERP  
**Audit Scope:** Full Application Source Code, Server Actions, Database Services, Security, and UI/UX Workflows  

---

## 1. Defect Summary Table

| Defect ID | Severity | Category | Status | Affected File & Lines | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-001** | **P0 (Blocker)** | Database / Concurrency | Confirmed Defect | [`src/server/services/invoices.ts#L31-L32`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L31-L32) | Invoice number sequence collision and transaction crash when `count(*)` is used |
| **DEF-002** | **P0 (Security)** | Authentication | Confirmed Defect | [`src/features/auth/actions.ts#L12`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/auth/actions.ts#L12) | Hardcoded admin password bypass (`admin` / `ChangeMe123!`) overrides argon2 hash |
| **DEF-003** | **P1 (Critical)** | Accounting / Ledger | Confirmed Defect | [`src/server/services/ledger-math.ts#L2-L13`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/ledger-math.ts#L2-L13) | Inverted supplier balance calculation in core `partyBalance` utility |
| **DEF-004** | **P1 (Critical)** | Financial Integrity | Confirmed Defect | [`src/features/finance/actions.ts#L24-L39`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/finance/actions.ts#L24-L39) | Negative cashbox balances permitted; no overdraft check on transfers/expenses |
| **DEF-005** | **P1 (Critical)** | Business Logic | Missing Feature / Defect | [`src/server/services/invoices.ts#L11`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L11) | Returns (`sale_return`, `purchase_return`) rejected with `INVALID_INVOICE_TYPE` |
| **DEF-006** | **P2 (Major)** | DevOps / Reliability | Confirmed Defect | [`src/app/api/backup/route.ts#L9`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/api/backup/route.ts#L9) | Backup route crashes with `ENOENT: pg_dump` when client binary not installed on host |
| **DEF-007** | **P2 (Major)** | UI/UX State Machine | Confirmed Defect | [`src/app/inventory/page.tsx#L95`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/inventory/page.tsx#L95) | Form `<details>` disclosures remain open with stale data after successful submission |
| **DEF-008** | **P2 (Major)** | UI / Error Feedback | Confirmed Defect | [`src/features/invoices/invoice-form.tsx#L91-L94`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/invoices/invoice-form.tsx#L91-L94) | Unhandled Server Action errors bubble up to error boundary instead of inline toasts |
| **DEF-009** | **P3 (Moderate)**| Inventory Operations | Missing Feature | [`src/features/inventory/actions.ts#L79-L84`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/inventory/actions.ts#L79-L84) | No edit or delete capabilities for product categories |
| **DEF-010** | **P3 (Moderate)**| Treasury Operations | Missing Feature | [`src/features/finance/actions.ts#L10-L15`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/finance/actions.ts#L10-L15) | No update, archival, or closing operations for cashboxes |
| **DEF-011** | **P3 (Moderate)**| Inventory Audit | Confirmed Defect | [`src/features/inventory/actions.ts#L68`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/inventory/actions.ts#L68) | `adjustStock` saves `Math.abs(quantity)`, obscuring movement direction in ledger |

---

## 2. In-Depth Defect Reports

---

### DEF-001 — Invoice Number Sequence Collision & Unique Violation
- **Severity:** P0 (Blocker)
- **Component:** Invoicing Engine
- **File & Lines:** [`src/server/services/invoices.ts#L31-L32`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L31-L32)
- **Source Code:**
  ```typescript
  const [last] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.type, input.type));
  const number = `${prefix}-${String(Number(last?.count ?? 0) + 1).padStart(7, "0")}`;
  ```
- **Reproduction Steps:**
  1. Create 3 sales invoices (`SAL-0000001`, `SAL-0000002`, `SAL-0000003`).
  2. If an administrative script or test purges or soft-archives an invoice (or if an invoice row is deleted), `count(*)` becomes 2.
  3. Attempting to create a 4th invoice will evaluate `count + 1 = 3`, generating `SAL-0000003`.
  4. Database rejects insertion due to `uniqueIndex("invoice_type_number_uq").on(t.type, t.number)`.
  5. The entire sales desk is permanently blocked from creating new invoices until manual DB surgery is performed.
- **Root Cause:** Calculating serial sequences using `count(*)` instead of an immutable monotonic sequence or atomic `MAX()` counter.
- **Recommended Remediation:**
  Create a dedicated PostgreSQL sequence or query `MAX(SUBSTRING(number FROM ...))` with an exclusive advisory lock:
  ```sql
  CREATE SEQUENCE IF NOT EXISTS invoice_sale_seq START WITH 1;
  CREATE SEQUENCE IF NOT EXISTS invoice_purchase_seq START WITH 1;
  ```
  Or in Drizzle:
  ```typescript
  const seqName = input.type === "sale" ? "invoice_sale_seq" : "invoice_purchase_seq";
  const [{ nextVal }] = await tx.execute(sql`SELECT nextval(${seqName}) as "nextVal"`);
  const number = `${prefix}-${String(nextVal).padStart(7, "0")}`;
  ```

---

### DEF-002 — Hardcoded Admin Password Backdoor
- **Severity:** P0 (Critical Security Vulnerability)
- **Component:** Authentication Action
- **File & Lines:** [`src/features/auth/actions.ts#L12`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/auth/actions.ts#L12)
- **Source Code:**
  ```typescript
  const isPasswordValid =
    (await verify(user.passwordHash, password).catch(() => false)) ||
    (username === "admin" && (password === "admin" || password === "ChangeMe123!"));
  ```
- **Reproduction Steps:**
  1. Access `/login`.
  2. Enter username `admin` and password `ChangeMe123!` or `admin`.
  3. Login succeeds even if the database administrator previously updated `user.passwordHash` to a high-entropy secret.
- **Root Cause:** Lingering local development/testing convenience code left in production action.
- **Recommended Remediation:**
  Remove the logical `||` expression entirely:
  ```typescript
  const isPasswordValid = await verify(user.passwordHash, password).catch(() => false);
  ```

---

### DEF-003 — Inverted Supplier Balance in `partyBalance` Helper
- **Severity:** P1 (Critical Accounting Risk)
- **Component:** Accounting Services
- **File & Lines:** [`src/server/services/ledger-math.ts#L2-L13`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/ledger-math.ts#L2-L13)
- **Source Code:**
  ```typescript
  export function partyBalance(
    ledgerLines: { debit: string | number; credit: string | number }[],
    openingBalance: string | number = 0
  ) {
    let balance = Number(openingBalance) || 0;
    for (const line of ledgerLines) {
      balance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
    }
    return balance;
  }
  ```
- **Observed vs Expected:**
  - A supplier delivers goods worth 1,000 EGP (Credit = 1,000) and receives 300 EGP payment (Debit = 300).
  - Outstanding payable owed to supplier is **+700 EGP**.
  - `partyBalance` computes $0 + (300 - 1000) = \mathbf{-700\text{ EGP}}$, falsely indicating that the supplier owes the warehouse money.
- **Root Cause:** Helper assumes all parties are customers (where Debit is receivable).
- **Remediation:** Pass party type (`"customer" | "supplier"`):
  ```typescript
  export function partyBalance(
    ledgerLines: { debit: string | number; credit: string | number }[],
    openingBalance: string | number = 0,
    partyType: "customer" | "supplier" = "customer"
  ) {
    let balance = Number(openingBalance) || 0;
    for (const line of ledgerLines) {
      const d = Number(line.debit) || 0;
      const c = Number(line.credit) || 0;
      balance += partyType === "customer" ? (d - c) : (c - d);
    }
    return balance;
  }
  ```

---

### DEF-004 — Absence of Overdraft Checks in Treasury Transfers & Expenses
- **Severity:** P1 (Financial Integrity)
- **Component:** Finance Feature
- **File & Lines:** [`src/features/finance/actions.ts#L24-L39`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/finance/actions.ts#L24-L39)
- **Observed Behavior:**
  - An operator executes a transfer of 50,000 EGP from "صندوق الكاشير" (current balance: 1,200 EGP) to "البنك الأهلي".
  - System executes the transfer without error. The cashier drawer now shows a negative balance of -48,800 EGP.
- **Root Cause:** Neither `transferCash` nor `addCashTransaction` (for expenses) computes source box available balance.
- **Remediation:** Calculate real-time balance inside transaction and throw `INSUFFICIENT_CASHBOX_BALANCE` if `balance < input.amount`.

---

### DEF-005 — Incomplete Returns Workflow (Sales & Purchase Returns)
- **Severity:** P1 (Core Workflow Gap)
- **Component:** Invoicing Engine
- **File & Lines:** [`src/server/services/invoices.ts#L11`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L11)
- **Source Code:**
  ```typescript
  if (!["sale", "purchase"].includes(input.type)) throw new Error("INVALID_INVOICE_TYPE");
  ```
- **Observed Behavior:**
  - When customer brings back defective cosmetics, the cashier cannot record a sales return.
  - Passing `sale_return` throws `INVALID_INVOICE_TYPE`, even though `invoice_type_enum` supports it.
- **Remediation:** Implement explicit return accounting:
  - `sale_return`: Increment stock, Credit customer / Outflow cashbox.
  - `purchase_return`: Decrement stock, Debit supplier / Inflow cashbox.

---

### DEF-006 — Docker Host Binary Dependency in Backup API
- **Severity:** P2 (Reliability)
- **Component:** Settings & Backup API
- **File & Lines:** [`src/app/api/backup/route.ts#L9`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/api/backup/route.ts#L9)
- **Observed Behavior:**
  - Invoking `POST /api/backup` executes `execFile("pg_dump", ...)`.
  - On macOS/Windows host environments where PostgreSQL runs in Docker, `pg_dump` is not installed on the host OS `$PATH`.
  - Process crashes with `ENOENT: command not found: pg_dump`.
- **Remediation:** Check if `pg_dump` exists; if not, invoke via `docker exec cosmetics-db pg_dump ...` or implement streaming SQL dump.

---

### DEF-007 — Stale Inputs & Open Modals on Successful Submission
- **Severity:** P2 (UX / Usability)
- **Component:** Page Disclosure Panels
- **Files:** [`src/app/inventory/page.tsx`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/inventory/page.tsx#L95), [`src/app/finance/page.tsx`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/finance/page.tsx#L100)
- **Observed Behavior:**
  - User opens `<details className="editor">` to add a new cosmetic product.
  - User submits the form. Server action creates the product and calls `revalidatePath("/inventory")`.
  - The `<details>` remains open on screen with the previously entered values, confusing users into thinking the submission failed or prompting them to submit again.
- **Remediation:** Wrap drawer panels in a controlled client component with `open` state and auto-close on form action resolution.
