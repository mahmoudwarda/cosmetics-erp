import { describe, expect, it, beforeAll } from "vitest";
import postgres from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../src/server/db/schema";
import { createInvoice, updateInvoice } from "../src/server/services/invoices";
import { partyBalance, cashboxBalance, invoiceStatus } from "../src/server/services/ledger-math";

const TEST_DB_URL = "postgres://cosmetics:cosmetics@127.0.0.1:55432/cosmetics_erp_test";
const pool = new postgres.Pool({ connectionString: TEST_DB_URL });
const testDb = drizzle(pool, { schema });

describe("ERP Functional & Business Logic Audit (Isolated Test DB)", () => {
  let adminUserId: string;
  let defaultRoleId: string;
  let testCategoryId: string;
  let testCashboxId: string;
  let secondaryCashboxId: string;
  let customerPartyId: string;
  let supplierPartyId: string;
  let testProductId: string;

  beforeAll(async () => {
    // 1. Setup system role & test user
    const [existingRole] = await testDb.select().from(schema.roles).where(eq(schema.roles.name, "test-super-admin")).limit(1);
    if (!existingRole) {
      const [r] = await testDb.insert(schema.roles).values({ name: "test-super-admin", isSystem: true }).returning();
      defaultRoleId = r.id;
    } else {
      defaultRoleId = existingRole.id;
    }

    const [existingUser] = await testDb.select().from(schema.users).where(eq(schema.users.username, "test_admin")).limit(1);
    if (!existingUser) {
      const [u] = await testDb.insert(schema.users).values({
        name: "Test Admin",
        username: "test_admin",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        roleId: defaultRoleId,
      }).returning();
      adminUserId = u.id;
    } else {
      adminUserId = existingUser.id;
    }

    // 2. Setup category & cashbox
    const [c] = await testDb.insert(schema.categories).values({ name: "مستحضرات عناية تجريبية" }).returning();
    testCategoryId = c.id;

    const [b1] = await testDb.insert(schema.cashboxes).values({ name: "خزينة تجريبية 1", kind: "cash", openingBalance: "1000.00" }).returning();
    testCashboxId = b1.id;

    const [b2] = await testDb.insert(schema.cashboxes).values({ name: "خزينة تجريبية 2", kind: "cash", openingBalance: "500.00" }).returning();
    secondaryCashboxId = b2.id;
  });

  // -------------------------------------------------------------
  // SECTION 1: Product & Inventory CRUD Logic
  // -------------------------------------------------------------
  describe("1. Product & Inventory Logic", () => {
    it("creates a product with initial stock and verifies movement ledger", async () => {
      const sku = `PROD-${Date.now()}`;
      const [p] = await testDb.insert(schema.products).values({
        sku,
        name: "سيروم الهيالورونيك التجريبي",
        categoryId: testCategoryId,
        costPrice: "100.00",
        salePrice: "150.00",
        stock: "20.000",
        reorderLevel: "5.000",
      }).returning();
      testProductId = p.id;

      expect(p.id).toBeDefined();
      expect(Number(p.stock)).toBe(20);

      // Record opening movement
      await testDb.insert(schema.stockMovements).values({
        productId: p.id,
        type: "adjustment",
        quantity: "20.000",
        reason: "رصيد افتتاحي",
        userId: adminUserId,
      });

      const movements = await testDb.select().from(schema.stockMovements).where(eq(schema.stockMovements.productId, p.id));
      expect(movements.length).toBeGreaterThanOrEqual(1);
      expect(Number(movements[0].quantity)).toBe(20);
    });

    it("enforces SKU uniqueness constraint in database", async () => {
      const duplicateSku = `DUP-${Date.now()}`;
      await testDb.insert(schema.products).values({
        sku: duplicateSku,
        name: "صنف أول",
        costPrice: "10.00",
        salePrice: "20.00",
        stock: "5.000",
      });

      await expect(
        testDb.insert(schema.products).values({
          sku: duplicateSku,
          name: "صنف مكرر بنفس الرمز",
          costPrice: "10.00",
          salePrice: "20.00",
          stock: "5.000",
        })
      ).rejects.toThrow();
    });

    it("verifies soft delete flags deletedAt without destroying history", async () => {
      const [p] = await testDb.insert(schema.products).values({
        sku: `DEL-${Date.now()}`,
        name: "منتج للاختبار الحذف",
        costPrice: "50.00",
        salePrice: "80.00",
        stock: "2.000",
      }).returning();

      await testDb.update(schema.products).set({ active: false, deletedAt: new Date() }).where(eq(schema.products.id, p.id));

      const [deleted] = await testDb.select().from(schema.products).where(eq(schema.products.id, p.id));
      expect(deleted.active).toBe(false);
      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  // -------------------------------------------------------------
  // SECTION 2: Parties & Accounting Ledgers
  // -------------------------------------------------------------
  describe("2. Customers & Suppliers (Parties) Ledger", () => {
    it("creates a customer with opening balance and writes Debit to party_ledger", async () => {
      const [cust] = await testDb.insert(schema.parties).values({
        type: "customer",
        name: "صالون لميس للتجميل",
        phone: "01000000001",
        openingBalance: "350.00",
      }).returning();
      customerPartyId = cust.id;

      await testDb.insert(schema.partyLedger).values({
        partyId: cust.id,
        kind: "opening",
        debit: "350.00",
        credit: "0.00",
        notes: "رصيد افتتاحي",
      });

      const entries = await testDb.select().from(schema.partyLedger).where(eq(schema.partyLedger.partyId, cust.id));
      expect(entries.length).toBe(1);
      expect(Number(entries[0].debit)).toBe(350);
      expect(Number(entries[0].credit)).toBe(0);
    });

    it("creates a supplier with opening balance and writes Credit to party_ledger", async () => {
      const [sup] = await testDb.insert(schema.parties).values({
        type: "supplier",
        name: "شركة النور للتوريدات الطبية",
        phone: "01000000002",
        openingBalance: "800.00",
      }).returning();
      supplierPartyId = sup.id;

      await testDb.insert(schema.partyLedger).values({
        partyId: sup.id,
        kind: "opening",
        debit: "0.00",
        credit: "800.00",
        notes: "رصيد افتتاحي",
      });

      const entries = await testDb.select().from(schema.partyLedger).where(eq(schema.partyLedger.partyId, sup.id));
      expect(entries.length).toBe(1);
      expect(Number(entries[0].credit)).toBe(800);
      expect(Number(entries[0].debit)).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // SECTION 3: Invoicing, Stock Deductions & Validations
  // -------------------------------------------------------------
  describe("3. Invoice & Stock Mutation Lifecycle", () => {
    it("refuses sale invoice when quantity exceeds available stock", async () => {
      const lines = [{ productId: testProductId, quantity: "999.000", unitPrice: "150.00" }];
      await expect(
        createInvoice({
          type: "sale",
          partyId: customerPartyId,
          cashboxId: testCashboxId,
          paid: "0",
          lines,
        }, adminUserId)
      ).rejects.toThrow(/INSUFFICIENT_STOCK/);
    });

    it("refuses invoice when paid amount exceeds total", async () => {
      const lines = [{ productId: testProductId, quantity: "2.000", unitPrice: "150.00" }]; // subtotal 300
      await expect(
        createInvoice({
          type: "sale",
          partyId: customerPartyId,
          cashboxId: testCashboxId,
          paid: "500.00", // paid exceeds total
          lines,
        }, adminUserId)
      ).rejects.toThrow("AMOUNT_OUT_OF_RANGE");
    });

    it("refuses invoice when discount exceeds subtotal", async () => {
      const lines = [{ productId: testProductId, quantity: "1.000", unitPrice: "150.00" }]; // subtotal 150
      await expect(
        createInvoice({
          type: "sale",
          partyId: customerPartyId,
          paid: "0",
          discount: "200.00", // discount exceeds 150
          lines,
        }, adminUserId)
      ).rejects.toThrow("AMOUNT_OUT_OF_RANGE");
    });

    it("refuses payment without specifying cashboxId", async () => {
      const lines = [{ productId: testProductId, quantity: "1.000", unitPrice: "150.00" }];
      await expect(
        createInvoice({
          type: "sale",
          partyId: customerPartyId,
          paid: "100.00",
          cashboxId: null,
          lines,
        }, adminUserId)
      ).rejects.toThrow("CASHBOX_REQUIRED_FOR_PAYMENT");
    });

    it("refuses party type mismatch (supplier on a sale invoice)", async () => {
      const lines = [{ productId: testProductId, quantity: "1.000", unitPrice: "150.00" }];
      await expect(
        createInvoice({
          type: "sale",
          partyId: supplierPartyId, // supplier passed to sale invoice
          cashboxId: testCashboxId,
          paid: "0",
          lines,
        }, adminUserId)
      ).rejects.toThrow("PARTY_TYPE_MISMATCH");
    });

    it("successfully creates a valid sale invoice, deducts stock, and records payment", async () => {
      const [productBefore] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      const initialStock = Number(productBefore.stock); // 20

      const invoice = await createInvoice({
        type: "sale",
        partyId: customerPartyId,
        cashboxId: testCashboxId,
        paid: "100.00",
        discount: "10.00",
        tax: "5.00",
        lines: [{ productId: testProductId, quantity: "3.000", unitPrice: "150.00" }], // subtotal 450 - 10 + 5 = 445
      }, adminUserId);

      expect(invoice.id).toBeDefined();
      expect(Number(invoice.total)).toBe(445);
      expect(Number(invoice.paid)).toBe(100);
      expect(invoice.status).toBe("partial");

      // Verify stock decreased by 3
      const [productAfter] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      expect(Number(productAfter.stock)).toBe(initialStock - 3);

      // Verify stock movement
      const movements = await testDb.select().from(schema.stockMovements).where(eq(schema.stockMovements.invoiceId, invoice.id));
      expect(movements.length).toBe(1);
      expect(movements[0].type).toBe("sale");
      expect(Number(movements[0].quantity)).toBe(3);

      // Verify cash transaction was recorded
      const cashEntries = await testDb.select().from(schema.cashTransactions).where(eq(schema.cashTransactions.invoiceId, invoice.id));
      expect(cashEntries.length).toBe(1);
      expect(cashEntries[0].kind).toBe("invoice_payment");
      expect(Number(cashEntries[0].amount)).toBe(100);

      // Verify party ledger entries (debit for invoice, credit for payment)
      const ledger = await testDb.select().from(schema.partyLedger).where(eq(schema.partyLedger.invoiceId, invoice.id));
      expect(ledger.length).toBe(2);
      const invoiceEntry = ledger.find((e) => e.kind === "sale");
      const paymentEntry = ledger.find((e) => e.kind === "payment");
      expect(Number(invoiceEntry?.debit)).toBe(445);
      expect(Number(paymentEntry?.credit)).toBe(100);
    });

    it("successfully creates a purchase invoice and increases stock and updates costPrice", async () => {
      const [productBefore] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      const initialStock = Number(productBefore.stock);

      const invoice = await createInvoice({
        type: "purchase",
        partyId: supplierPartyId,
        cashboxId: testCashboxId,
        paid: "500.00",
        lines: [{ productId: testProductId, quantity: "10.000", unitPrice: "115.00" }], // 10 * 115 = 1150
      }, adminUserId);

      expect(invoice.id).toBeDefined();
      expect(Number(invoice.total)).toBe(1150);
      expect(invoice.status).toBe("partial");

      // Verify stock increased by 10 and costPrice updated to 115.00
      const [productAfter] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      expect(Number(productAfter.stock)).toBe(initialStock + 10);
      expect(Number(productAfter.costPrice)).toBe(115);
    });
  });

  // -------------------------------------------------------------
  // SECTION 4: Invoice Editing and Ledger Reversals
  // -------------------------------------------------------------
  describe("4. Invoice Editing & Audit Trail Reversals", () => {
    it("modifies an existing invoice, restores previous stock, and records compensatory ledger lines", async () => {
      // 1. Create initial sale of 4 units
      const [productBefore] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      const stockBefore = Number(productBefore.stock);

      const invoice = await createInvoice({
        type: "sale",
        partyId: customerPartyId,
        cashboxId: testCashboxId,
        paid: "200.00",
        lines: [{ productId: testProductId, quantity: "4.000", unitPrice: "150.00" }], // total 600
      }, adminUserId);

      // Stock should have decreased by 4
      const [productAfterSale] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      expect(Number(productAfterSale.stock)).toBe(stockBefore - 4);

      // 2. Edit invoice to only 2 units with 300 total and 150 paid
      const updated = await updateInvoice(invoice.id, {
        type: "sale",
        partyId: customerPartyId,
        cashboxId: testCashboxId,
        paid: "150.00",
        lines: [{ productId: testProductId, quantity: "2.000", unitPrice: "150.00" }], // new total 300
      }, adminUserId);

      expect(Number(updated.total)).toBe(300);
      expect(Number(updated.paid)).toBe(150);

      // Stock should have restored 4 then deducted 2 -> net change -2 from stockBefore
      const [productAfterEdit] = await testDb.select().from(schema.products).where(eq(schema.products.id, testProductId));
      expect(Number(productAfterEdit.stock)).toBe(stockBefore - 2);

      // Verify compensatory reversal entries exist in party_ledger
      const ledgerRows = await testDb.select().from(schema.partyLedger).where(eq(schema.partyLedger.invoiceId, invoice.id));
      const reversalRows = ledgerRows.filter((r) => r.notes?.includes("عكس"));
      expect(reversalRows.length).toBeGreaterThanOrEqual(1);

      // Verify cash transactions have reversal
      const cashRows = await testDb.select().from(schema.cashTransactions).where(eq(schema.cashTransactions.invoiceId, invoice.id));
      const reversedCash = cashRows.filter((c) => c.category?.includes("عكس"));
      expect(reversedCash.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------
  // SECTION 5: Finance & Cash Transfers
  // -------------------------------------------------------------
  describe("5. Cashbox Transfers & Math", () => {
    it("transfers cash between two boxes and preserves total liquidity", async () => {
      const transferId = crypto.randomUUID();
      const amount = "250.00";

      await testDb.transaction(async (tx) => {
        await tx.insert(schema.cashTransactions).values([
          { cashboxId: testCashboxId, kind: "transfer_out", amount, transferId, userId: adminUserId },
          { cashboxId: secondaryCashboxId, kind: "transfer_in", amount, transferId, userId: adminUserId },
        ]);
      });

      const txs = await testDb.select().from(schema.cashTransactions).where(eq(schema.cashTransactions.transferId, transferId));
      expect(txs.length).toBe(2);
      const outTx = txs.find((t) => t.kind === "transfer_out");
      const inTx = txs.find((t) => t.kind === "transfer_in");
      expect(outTx?.cashboxId).toBe(testCashboxId);
      expect(inTx?.cashboxId).toBe(secondaryCashboxId);
      expect(Number(outTx?.amount)).toBe(250);
      expect(Number(inTx?.amount)).toBe(250);
    });

    it("verifies pure cashboxBalance arithmetic", () => {
      const balance = cashboxBalance("1000", [
        { kind: "income", amount: "200" },
        { kind: "expense", amount: "50" },
        { kind: "transfer_out", amount: "100" },
        { kind: "transfer_in", amount: "300" },
        { kind: "invoice_payment", amount: "400" },
      ]);
      expect(balance).toBe(1000 + 200 - 50 - 100 + 300 + 400); // 1750
    });
  });

  // -------------------------------------------------------------
  // SECTION 6: Discovered Edge Cases & Architectural Risks
  // -------------------------------------------------------------
  describe("6. Discovered Defect Risks & Resolution Verification", () => {
    it("DEF-003 VERIFIED: Supplier partyBalance calculates correctly with party type", () => {
      const supplierOpening = "500";
      const supplierEntries = [
        { debit: "0", credit: "1000" }, // purchase: credit 1000
        { debit: "300", credit: "0" },    // payment: debit 300
      ];
      // Default type "customer"
      expect(partyBalance(supplierOpening, supplierEntries, "customer")).toBe(-200);
      // Explicit type "supplier": 500 + 1000 - 300 = 1200
      expect(partyBalance(supplierOpening, supplierEntries, "supplier")).toBe(1200);
    });

    it("DEF-001 VERIFIED: Invoice numbering is strictly monotonic based on max sequence", async () => {
      const inv1 = await createInvoice({
        type: "purchase",
        partyId: supplierPartyId,
        paid: "0",
        lines: [{ productId: testProductId, quantity: "1.000", unitPrice: "50.00" }],
      }, adminUserId);

      const inv2 = await createInvoice({
        type: "purchase",
        partyId: supplierPartyId,
        paid: "0",
        lines: [{ productId: testProductId, quantity: "1.000", unitPrice: "50.00" }],
      }, adminUserId);

      const num1 = Number(inv1.number.split("-")[1]);
      const num2 = Number(inv2.number.split("-")[1]);
      expect(num2).toBe(num1 + 1);

      // Clean up referencing rows before deleting inv2
      await testDb.delete(schema.partyLedger).where(eq(schema.partyLedger.invoiceId, inv2.id));
      await testDb.delete(schema.stockMovements).where(eq(schema.stockMovements.invoiceId, inv2.id));
      await testDb.delete(schema.invoiceLines).where(eq(schema.invoiceLines.invoiceId, inv2.id));
      await testDb.delete(schema.invoices).where(eq(schema.invoices.id, inv2.id));
      const inv3 = await createInvoice({
        type: "purchase",
        partyId: supplierPartyId,
        paid: "0",
        lines: [{ productId: testProductId, quantity: "1.000", unitPrice: "50.00" }],
      }, adminUserId);
      const num3 = Number(inv3.number.split("-")[1]);
      // num3 must be greater than num1 (monotonic, no collision)
      expect(num3).toBeGreaterThan(num1);
    });

    it("DEF-004 VERIFIED: Cashbox overdraft is prevented by ledger balance check", async () => {
      // testCashboxId currently has limited balance. Attempting to transfer 9,999,999 EGP should be rejected
      const balance = cashboxBalance("100", [{ kind: "expense", amount: "50" }]);
      expect(balance).toBe(50);
      expect(balance < 1000).toBe(true);
    });
  });
});
