# RECOMMENDED_FIX_PLAN.md — Prioritized Implementation & Remediation Plan

**Project:** لمسة جمال (Lamsat Gamal) — Cosmetics Supplies Warehouse ERP  
**Target:** Safe, zero-downtime remediation with strict verification on isolated test database before production rollout.  

---

## 1. Remediation Phases & Prioritization Matrix

```mermaid
graph TD
    subgraph Phase1 ["المرحلة الأولى: السلامة المحاسبية والأمنية (Sprint 1)"]
        F1["FIX-01: تسلسل ترقيم الفواتير (Sequence Lock)"]
        F2["FIX-02: إزالة الباب الخلفي لكلمة مرور الآدمن"]
        F3["FIX-03: تصحيح دالة رصيد الموردين (partyBalance)"]
        F4["FIX-04: قيد منع السحب بالسالب من الخزائن"]
    end

    subgraph Phase2 ["المرحلة الثانية: استكمال الدورات والواجهات (Sprint 2)"]
        F5["FIX-05: تفعيل دورة المردودات (Sales & Purchase Returns)"]
        F6["FIX-06: أتمتة النسخ الاحتياطي عبر Docker"]
        F7["FIX-07: تصحيح سلوك النوافذ المنبثقة Details وتنبيهات الخطأ"]
    end

    subgraph Phase3 ["المرحلة الثالثة: تجربة المستودع الميدانية (Sprint 3)"]
        F8["FEAT-01: مستمع الباركود السريع (Barcode Buffer)"]
        F9["FEAT-02: إدارة التصنيفات والخزائن المتقدمة"]
        F10["FEAT-03: تقارير مطابقة مسحوبة للواتساب"]
    end

    Phase1 --> Phase2
    Phase2 --> Phase3
```

---

## 2. Phase-by-Phase Technical Specifications

### Phase 1: Critical Fixes & Security (Immediate — Sprint 1)

#### Task 1.1: Replace `count(*)` with PostgreSQL Sequence for Invoices (DEF-001)
- **Target File:** [`src/server/services/invoices.ts#L30-L33`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L30-L33)
- **Implementation:**
  1. Add migration for two PostgreSQL sequences:
     ```sql
     CREATE SEQUENCE IF NOT EXISTS invoice_sale_seq;
     CREATE SEQUENCE IF NOT EXISTS invoice_purchase_seq;
     -- Synchronize sequences with existing invoice max numbers
     SELECT setval('invoice_sale_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(number FROM 5) AS integer)) FROM invoices WHERE type = 'sale'), 0) + 1, false);
     SELECT setval('invoice_purchase_seq', COALESCE((SELECT MAX(CAST(SUBSTRING(number FROM 5) AS integer)) FROM invoices WHERE type = 'purchase'), 0) + 1, false);
     ```
  2. In `createInvoice`:
     ```typescript
     const seq = input.type === "sale" ? "invoice_sale_seq" : "invoice_purchase_seq";
     const [{ nextval }] = await tx.execute(sql<{ nextval: number }>`SELECT nextval(${sql.identifier(seq)})`);
     const number = `${prefix}-${String(nextval).padStart(7, "0")}`;
     ```
- **Regression Test:** Delete an old invoice in `cosmetics_erp_test` and create 5 consecutive invoices concurrently; confirm zero unique constraint errors.

#### Task 1.2: Remove Hardcoded Admin Credentials (DEF-002)
- **Target File:** [`src/features/auth/actions.ts#L12`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/auth/actions.ts#L12)
- **Implementation:**
  ```typescript
  const isPasswordValid = await verify(user.passwordHash, password).catch(() => false);
  ```
- **Regression Test:** Verify that entering `admin` / `ChangeMe123!` fails if the hash does not match, while valid hashed password logs in successfully.

#### Task 1.3: Fix Supplier Balance Calculation in `partyBalance` (DEF-003)
- **Target File:** [`src/server/services/ledger-math.ts#L2-L13`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/ledger-math.ts#L2-L13)
- **Implementation:**
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
- **Regression Test:** Re-run `TC-RSK-01`; confirm supplier with 1,000 credit and 300 debit outputs `+700.00 EGP`.

#### Task 1.4: Enforce Cashbox Overdraft Prevention (DEF-004)
- **Target File:** [`src/features/finance/actions.ts#L24-L39`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/finance/actions.ts#L24-L39)
- **Implementation:**
  Query current cashbox balance inside transaction:
  ```typescript
  const [balanceRow] = await tx.select({
    balance: sql<string>`coalesce(sum(case when kind in ('income','transfer_in','invoice_payment','party_payment') then amount else -amount end), 0) + ${cashboxes.openingBalance}`
  }).from(cashTransactions).rightJoin(cashboxes, eq(cashboxes.id, cashTransactions.cashboxId))
  .where(eq(cashboxes.id, input.from)).groupBy(cashboxes.id);
  
  if (Number(balanceRow?.balance ?? 0) < input.amount) {
    throw new Error("INSUFFICIENT_CASHBOX_BALANCE");
  }
  ```
- **Regression Test:** Re-run `TC-CSH-03`; confirm transfer exceeding available funds throws `INSUFFICIENT_CASHBOX_BALANCE`.

---

### Phase 2: Business Workflows & UI Ergonomics (Sprint 2)

#### Task 2.1: Implement Sales & Purchase Returns Engine (DEF-005)
- **Target Files:** [`src/server/services/invoices.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts), [`src/features/invoices/invoice-form.tsx`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/invoices/invoice-form.tsx)
- **Implementation:**
  - Support `input.type === "sale_return"` (increases inventory, credits customer or pays cash).
  - Support `input.type === "purchase_return"` (decreases inventory, debits supplier or receives cash).
  - Add UI return mode to `invoice-form.tsx`.
- **Regression Test:** Execute `TC-RET-01` and `TC-RET-02`; confirm stock and balance reconcile cleanly.

#### Task 2.2: Docker-Native Backup Route (DEF-006)
- **Target File:** [`src/app/api/backup/route.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/api/backup/route.ts)
- **Implementation:**
  Check `exec("pg_dump")`. If it fails with `ENOENT`, execute via `exec("docker", ["exec", "cosmetics-db", "pg_dump", ...])`.

#### Task 2.3: Controlled Disclosure Modals & Sonner Toast Feedback (DEF-007, DEF-008)
- **Target Files:** [`src/components/close-disclosure-button.tsx`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/components/close-disclosure-button.tsx), [`src/features/invoices/invoice-form.tsx`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/invoices/invoice-form.tsx)
- **Implementation:**
  - Catch Server Action errors in `InvoiceForm`, call `toast.error(errorMap[err.message] || "حدث خطأ أثناء الحفظ")`, keep line items intact.
  - Automatically reset and collapse `<details>` disclosure upon successful server action return.

---

### Phase 3: Warehouse Operational Features (Sprint 3)

#### Task 3.1: Hardware Barcode Scanner Fast-Entry
- Add global keyboard buffer listener in `InvoiceForm`.
- If barcode matches an active product, instantly push to `lines` with `qty: 1` and sound an auditory success chime.

#### Task 3.2: Complete Category & Cashbox Management (DEF-009, DEF-010)
- Add `updateCategory`, `deleteCategory`, `updateCashbox`, and `toggleCashboxActive` Server Actions.

---

## 3. Verification & Test Execution Commands

```bash
# 1. Run full automated functional test suite on isolated test database
DATABASE_URL="postgres://cosmetics:cosmetics@127.0.0.1:55432/cosmetics_erp_test" npx vitest run tests/erp-functional-audit.test.ts

# 2. Run TypeScript compiler to ensure zero type regressions
npx tsc --noEmit

# 3. Test HTTP API authentication boundary
curl -s -X POST http://127.0.0.1:3000/api/backup
```
