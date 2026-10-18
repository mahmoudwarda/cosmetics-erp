# 03. مصفوفة الاختبارات الوظيفية ومطابقة القواعد (Functional Test Matrix)
**مشروع:** لمسة جمال — Cosmetics Supplies Warehouse ERP  
**بيئة الاختبار المنفذة:** قاعدة بيانات معزولة بالكامل `cosmetics_erp_test` (PostgreSQL 17 على المنفذ `55432`)  
**إطار الاختبار:** Vitest 3.2.7 + TypeScript  
**ملف الاختبار المرجعي:** [`tests/erp-functional-audit.test.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/tests/erp-functional-audit.test.ts)  
**النتيجة الإجمالية:** **17 اختباراً ناجحاً بنسبة 100% (17/17 Passed)**  

---

## 1. ملخص نتائج الاختبارات الآلية (Execution Summary)

```text
 ✓ tests/erp-functional-audit.test.ts (17 tests) 92ms
   ✓ 1. Product & Inventory Logic > creates a product with initial stock and verifies movement ledger (6ms)
   ✓ 1. Product & Inventory Logic > enforces SKU uniqueness constraint in database (2ms)
   ✓ 1. Product & Inventory Logic > verifies soft delete flags deletedAt without destroying history (11ms)
   ✓ 2. Customers & Suppliers (Parties) Ledger > creates a customer with opening balance and writes Debit to party_ledger (3ms)
   ✓ 2. Customers & Suppliers (Parties) Ledger > creates a supplier with opening balance and writes Credit to party_ledger (2ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > refuses sale invoice when quantity exceeds available stock (9ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > refuses invoice when paid amount exceeds total (1ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > refuses invoice when discount exceeds subtotal (1ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > refuses payment without specifying cashboxId (0ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > refuses party type mismatch (supplier on a sale invoice) (2ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > successfully creates a valid sale invoice, deducts stock, and records payment (8ms)
   ✓ 3. Invoice & Stock Mutation Lifecycle > successfully creates a purchase invoice and increases stock and updates costPrice (4ms)
   ✓ 4. Invoice Editing & Audit Trail Reversals > modifies an existing invoice, restores previous stock, and records compensatory ledger lines (11ms)
   ✓ 5. Cashbox Transfers & Math > transfers cash between two boxes and preserves total liquidity (1ms)
   ✓ 5. Cashbox Transfers & Math > verifies pure cashboxBalance arithmetic (0ms)
   ✓ 6. Discovered Defect Risks > RISK DEMO: Supplier partyBalance calculates inverted without party.type (0ms)
   ✓ 6. Discovered Defect Risks > RISK DEMO: Invoice numbering vulnerability when count(*) is used (5ms)
```

---

## 2. جدول تفاصيل سيناريوهات الاختبار والنتائج

| المعرف | السيناريو الوظيفي | المدخلات والقيمة المتوقعة | السلوك الفعلي للنظام | النتيجة |
| :--- | :--- | :--- | :--- | :--- |
| **TC-INV-01** | إنشاء صنف برصيد افتتاحي | إضافة صنف برصيد 50 قطعة | تم إنشاء الصنف بنجاح، وسجلت حركة `initial` في `stock_movements` بـ 50 قطعة | **Pass (ناجح)** |
| **TC-INV-02** | منع تكرار كود SKU | إضافة صنف بنفس كود SKU لصنف قائم | رفضت قاعدة البيانات العملية استناداً للقيد الفريد `sku_uq` | **Pass (ناجح)** |
| **TC-INV-03** | الحذف المرن للأصناف | طلب حذف صنف له حركات سابقة | تم وضع تاريخ `deletedAt` دون مسح السجل أو كسر فواتيره السابقة | **Pass (ناجح)** |
| **TC-PTY-01** | رصيد افتتاحي لعميل | إضافة عميل برصيد مدين 500 جنيه | تم تسجيل قيد `Debit = 500` في `party_ledger` | **Pass (ناجح)** |
| **TC-PTY-02** | رصيد افتتاحي لمورد | إضافة مورد برصيد دائن 1000 جنيه | تم تسجيل قيد `Credit = 1000` في `party_ledger` | **Pass (ناجح)** |
| **TC-SAL-01** | بيع كمية تفوق الرصيد المخزني | بيع 999 قطعة من صنف رصيده 50 | إيقاف العملية وإرجاع الخطأ الحصري `INSUFFICIENT_STOCK` | **Pass (ناجح)** |
| **TC-SAL-02** | محاولة دفع مبلغ أكبر من الفاتورة | فاتورة قيمتها 400 والمدفوع 500 | إيقاف العملية وإرجاع الخطأ الحسابي `PAID_EXCEEDS_TOTAL` | **Pass (ناجح)** |
| **TC-SAL-03** | خصم يتجاوز إجمالي البنود | إجمالي الفاتورة 400 والخصم 500 | إيقاف العملية وإرجاع الخطأ `DISCOUNT_EXCEEDS_TOTAL` | **Pass (ناجح)** |
| **TC-SAL-04** | سداد نقدي بدون تحديد خزينة | مدفوع 100 جنيه دون تحديد `cashboxId` | إيقاف العملية وإرجاع الخطأ `CASHBOX_REQUIRED` | **Pass (ناجح)** |
| **TC-SAL-05** | عدم تطابق نوع الطرف مع الفاتورة | اختيار مورد في فاتورة بيع | إيقاف العملية وإرجاع الخطأ `PARTY_TYPE_MISMATCH` | **Pass (ناجح)** |
| **TC-SAL-06** | دورة فاتورة مبيعات سليمة (كاملة) | بيع 10 قطع بسعر 20 ج، ودفع 100 ج نقداً | خصم 10 قطع من المخزون، تسجيل 200 ج في حساب العميل، تسجيل 100 ج في الخزينة وتسجيل 100 ج سداد | **Pass (ناجح)** |
| **TC-PUR-01** | دورة فاتورة مشتريات وتحديث التكلفة | شراء 30 قطعة بسعر 12 ج للقطعة | زيادة المخزون بـ 30 قطعة، وتحديث `costPrice` للصنف إلى 12 ج تلقائياً | **Pass (ناجح)** |
| **TC-EDT-01** | تعديل فاتورة مرحلة وإلغاء الأثر | تقليل كمية الفاتورة من 10 إلى 5 قطع | تم إلغاء حركات المخزون السابقة واسترجاع 5 قطع وتعديل حساب الطرف والخزينة | **Pass (ناجح)** |
| **TC-CSH-01** | تحويل نقدية بين خزينتين | تحويل 300 ج من الخزينة أ إلى ب | خصم 300 من أ وإيداع 300 في ب، مع ثبات إجمالي سيولة المنشأة | **Pass (ناجح)** |
| **TC-CSH-02** | حساب رصيد الخزينة الرياضي | جمع `inflows` وطرح `outflows` | الناتج مطابق تماماً لحركات القيود النقدية | **Pass (ناجح)** |
| **TC-DF-01** | برهان عيب دالة `partyBalance` | حساب رصيد مورد دائن بـ 1000 وسدد 300 | الدالة المشتركة أرجعت `-700` بدلاً من `+700` لغياب فحص `party.type` | **Bug Proven (مؤكد)** |
| **TC-DF-02** | برهان عيب ترقيم الفواتير `count(*)` | حذف أو نقص في تعداد الفواتير | توليد رقم مطابق لفاتورة سابقة مما يؤدي لحدوث كسر في الـ Unique Constraint | **Bug Proven (مؤكد)** |
