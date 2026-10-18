# 04. سجل العيوب والملاحظات الفنية (Defect Register P0 - P3)
**مشروع:** لمسة جمال — Cosmetics Supplies Warehouse ERP  
**تصنيف الأولويات:**  
- **P0 (حرج جداً / Blocker):** يسبب انهيار النظام، ضياع البيانات، أو توقف عمليات البيع.
- **P1 (مرتفع / Major):** خطأ محاسبي جوهري أو عدم اتساق في الأرصدة والعمليات.
- **P2 (متوسط / Moderate):** غياب تدفق وظيفي كامل (مثل المردودات) أو نقص في القيود الرقابية.
- **P3 (منخفض / Minor / Polish):** تحسينات في الواجهات، رسائل الأخطاء، أو كفاءة الاستعلامات.

---

## 1. جدول ملخص العيوب المكتشفة

| المعرف | الأولوية | المكون المتأثر | وصف العيب الفني والخلل المحاسبي | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | **P0** | `src/server/services/invoices.ts` | تكرار أرقام الفواتير وانهيار النظام بسبب الاعتماد على `count(*)` لتوليد الرقم | **مؤكد بالاختبار الآلي** |
| **DEF-02** | **P1** | `src/server/services/ledger-math.ts` | حساب مقلوب لرصيد الموردين في دالة الأستاذ المشتركة لغياب تمييز نوع الطرف | **مؤكد بالاختبار الآلي** |
| **DEF-03** | **P1** | `src/features/finance/actions.ts` | غياب التحقق من الرصيد النقدي يسمح بتحويل نقدية بالسالب ومصروفات بدون رصيد | **مؤكد بالمعاينة** |
| **DEF-04** | **P1** | `src/features/finance/actions.ts` | إمكانية سداد عميل لمبلغ يفوق إجمالي مديونيته دون تدقيق | **مؤكد بالمعاينة** |
| **DEF-05** | **P2** | `src/server/services/invoices.ts` | عدم دعم مردودات المبيعات والمشتريات (`sale_return`, `purchase_return`) ورفضها كأنواع غير صالحة | **مؤكد بالكود** |
| **DEF-06** | **P2** | `src/app/api/backup/route.ts` | فشل مسار النسخ الاحتياطي بالواجهة نظراً لاستدعاء `pg_dump` المحلي غير المثبت على نظام Mac | **مؤكد بالاختبار** |
| **DEF-07** | **P3** | `src/features/inventory/actions.ts` | غياب واجهة وأفعال تعديل وحذف التصنيفات (`categories`) | **مؤكد بالمعاينة** |
| **DEF-08** | **P3** | `src/features/finance/actions.ts` | عدم إمكانية تعديل أو تعطيل/أرشفة الخزائن (`cashboxes`) بعد إنشائها | **مؤكد بالمعاينة** |

---

## 2. التحليل التفصيلي للعيوب وخطوات المعالجة

### DEF-01 (P0) — تصادم أرقام الفواتير وانهيار الإنشاء (Invoice Number Race & Collision)
- **الملف:** [`src/server/services/invoices.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L31-L32)
- **الكود المسبب:**
  ```typescript
  const [existingCount] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.type, input.type));
  const number = `${prefix}-${String((Number(existingCount?.count) || 0) + 1).padStart(5, "0")}`;
  ```
- **الأثر العملي:**
  1. إذا تم إنشاء فاتورة برقم `INV-00005` ثم تم حذف فاتورة مسودة أو تجريبية سابقة برقم `INV-00003`، يصبح الـ `count = 4`.
  2. الفاتورة التالية ستحاول توليد `INV-00005` الموجود بالفعل في قاعدة البيانات!
  3. يفشل الحفظ بـ `PostgreSQL Unique Constraint Violation` على القيد `invoice_type_number_uq`، ويتوقف الكاشير عن إنشاء أي فواتير بيع إضافية.
  4. في حالات الضغط العالي (Concurrency)، إذا أنشأ مستخدمان فاتورتين في نفس الثانية، سيحصلان على نفس الرقم وتفشل إحداهما فوراً.
- **الحل الجذري المقترح:**
  استخدام تسلسل تلقائي حقيقي في PostgreSQL عبر `SEQUENCE` مخصص لكل نوع فاتورة (`invoice_sale_seq`, `invoice_purchase_seq`)، أو استعلام `COALESCE(MAX(SUBSTRING(number ...)), 0) + 1 FOR UPDATE`.

---

### DEF-02 (P1) — الحساب المقلوب لأرصدة الموردين (Inverted Supplier Balance in Math Helper)
- **الملف:** [`src/server/services/ledger-math.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/ledger-math.ts#L2-L13)
- **الكود المسبب:**
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
- **الأثر العملي:**
  - بالنسبة للعميل: `Debit` = مبيعات (لنا عنده)، و `Credit` = سداد (دفع لنا) -> المعادلة `Debit - Credit` صحيحة.
  - بالنسبة للمورد: `Credit` = مشتريات (له عندنا مديونية)، و `Debit` = سداد (سددنا له) -> المعادلة الصحيحة للمورد هي `Credit - Debit`!
  - استخدام هذه الدالة للمورد يجعل حسابه بالسالب دائماً؛ ولهذا اضطر المطور في صفحات `src/app/(dashboard)/parties/page.tsx` و `src/app/(dashboard)/statements/page.tsx` إلى تجاوز الدالة وكتابة معادلة شرطية يدوية.
- **الحل الجذري المقترح:**
  تحديث الدالة لتستقبل نوع الطرف `partyType: 'customer' | 'supplier'`، بحيث تحسب الرصيد وفقاً لطبيعة الحساب المحاسبية:
  ```typescript
  export function partyBalance(
    ledgerLines: { debit: string | number; credit: string | number }[],
    openingBalance: string | number = 0,
    partyType: 'customer' | 'supplier' = 'customer'
  ) {
    let balance = Number(openingBalance) || 0;
    for (const line of ledgerLines) {
      const d = Number(line.debit) || 0;
      const c = Number(line.credit) || 0;
      balance += partyType === 'customer' ? (d - c) : (c - d);
    }
    return balance;
  }
  ```

---

### DEF-03 (P1) — إمكانية تحويل النقدية بالسالب وصرف مبالغ غير متوفرة
- **الملف:** [`src/features/finance/actions.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/finance/actions.ts#L76-L105)
- **الخلل:** في `transferCash` و `addCashTransaction` (نوع `outflow` / مصروف)، لا يوجد كود يتحقق مما إذا كان رصيد الخزينة المصدر الحالي يغطي المبلغ المطلوب تحويله أو صرفه.
- **الأثر:** السماح لأي مستخدم بإجراء تحويل بـ 50,000 ج من خزينة لا تملك سوى 2,000 ج، مما يجعل رصيد الخزينة بالسالب ويدمر الرقابة على السيولة النقدية.
- **الحل:** استعلام رصيد الخزينة داخل معاملة `tx` والتحقق من `currentBalance >= amount`، وإرجاع خطأ `INSUFFICIENT_CASHBOX_BALANCE` عند عدم كفاية الرصيد.

---

### DEF-04 (P1) — غياب التحقق من سداد مبالغ تفوق مديونية الطرف
- **الملف:** [`src/features/finance/actions.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/features/finance/actions.ts#L110-L150)
- **الخلل:** عند تسجيل دفعة من عميل `registerPartyPayment`، يتم قبول أي مبلغ حتى لو كان العميل مديناً بـ 1,000 ج ودفع 10,000 ج، دون تنبيه أو توجيه الفائض كرصيد دائن مقصود.
- **الحل:** حساب رصيد العميل الحالي وتنبيه المستخدم أو طلب تأكيد "تسجيل دفعة مقدمة فائضة عن المديونية".

---

### DEF-05 (P2) — رفض مردودات المبيعات والمشتريات في محرك الفواتير
- **الملف:** [`src/server/services/invoices.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/server/services/invoices.ts#L22)
- **الخلل:** دالة `createInvoice` تحتوي على الفحص:
  ```typescript
  if (input.type !== "sale" && input.type !== "purchase") {
    throw new Error("INVALID_INVOICE_TYPE");
  }
  ```
- **الأثر:** بالرغم من أن قاعدة البيانات تدعم `sale_return` و `purchase_return` في `invoice_type_enum`، إلا أن منطق السيرفر يرمي خطأً صريحاً، ولا توجد أي آلية لرد بضاعة مباعة أو تالفة وإعادتها للمخزن مع عكس قيود العميل والخزينة.
- **الحل:** تمكين معالجة مردودات البيع (إرجاع المخزون وتسجيل Credit للعميل أو Outflow من الخزينة) ومردودات الشراء (إنقاص المخزون وتسجيل Debit للمورد أو Inflow للخزينة).

---

### DEF-06 (P2) — فشل استدعاء النسخ الاحتياطي من الواجهة
- **الملف:** [`src/app/api/backup/route.ts`](file:///Users/mahmoudnagy/Downloads/project-clean/Cosmetics-ERP-SourceCode/src/app/api/backup/route.ts#L25)
- **الخلل:** يقوم المسار بتنفيذ أمر النظام `execFile("pg_dump", ...)` على جهاز المضيف. وحيث أن PostgreSQL يعمل داخل حاوية Docker (Container `cosmetics-db`)، فإن أداة `pg_dump` غير متوفرة في بيئة الـ Host بدون تثبيت أدوات عميل بوستجريس محلياً، مما يسبب الخطأ الفوري `ENOENT: command not found: pg_dump`.
- **الحل:** تعديل المنطق إما بتشغيل `docker exec cosmetics-db pg_dump ...`، أو كتابة تفريغ بيانات مخصص عبر Drizzle/SQL.
