# 06. تدقيق الأمان والموثوقية والصلاحيات (Security & Reliability Assessment)

> This report describes an earlier source state. See [CURRENT_AUDIT_RESULTS.md](CURRENT_AUDIT_RESULTS.md) for current verification before deployment.
**مشروع:** لمسة جمال — Cosmetics Supplies Warehouse ERP  

---

## 1. نموذج المصادقة والجلسات (Authentication & Session Security)
- **المكتبة المستخدمة:** `iron-session` (مشفرة بـ AES-256-GCM).
- **مكان التخزين:** كوكي للمتصفح مشفرة ومحمية بخصائص:
  - `httpOnly: true` (تمنع سرقة الجلسة عبر XSS).
  - `sameSite: "lax"` (حماية ضد CSRF).
  - `secure: process.env.NODE_ENV === "production"`.
- **تشفير كلمات المرور:**
  - يتم استخدام خوارزمية **Scrypt** المدمجة في مكتبة `node:crypto` عبر دالة تشفير وتوليد Salt فريد لكل مستخدم (`hashPassword` و `verifyPassword` في `src/server/auth/password.ts`).
  - آمنة تماماً ضد هجمات القواميس (Brute-force) وجداول Rainbow Tables.

---

## 2. مصفوفة الصلاحيات والحماية على مستوى السيرفر (RBAC Enforcement)
- **الأدوار المدمجة في النظام:**
  1. `super_admin`: كامل الصلاحيات دون استثناء.
  2. `admin`: إدارة عامة مع تقييد بعض إعدادات النظام الحساسة.
  3. `accountant`: الفواتير، الخزائن، الحسابات، والتقارير المالية.
  4. `sales`: إنشاء فواتير البيع، عرض الأصناف والعملاء، دون تعديل التكاليف أو رؤية الأرباح الحساسة.
  5. `warehouse`: فواتير الشراء، إدارة الأصناف، والمخزون، دون الوصول لتقارير الأرباح المالية.
- **آلية الفحص:**
  في كل Server Action، يتم استدعاء دوال الحراسة:
  ```typescript
  const session = await requireAuth();
  await requireRole(session.user.roleId, "invoices.create");
  ```
- **تقييم القوة:** حماية قوية جداً من جهة السيرفر؛ لا يمكن للمستخدم الالتفاف عليها بتعديل كود الـ Frontend أو استدعاء الـ Actions مباشرة.

---

## 3. التحقق من صحة المدخلات والحماية من الحقن (Input Validation & SQLi)
- **مخططات Zod:**
  كافة المدخلات الحيوية (الفواتير، الأصناف، الأطراف، المعاملات النقدية) مفحوصة ومفلترة عبر `zod` schemas تمنع الحقول غير المتوقعة أو النصوص الضخمة.
- **الاستعلامات وقاعدة البيانات:**
  يستخدم النظام **Drizzle ORM** مع محرك `node-postgres` المعتمد على الاستعلامات المجهزة (Parameterized Prepared Statements).
  - **خطر الـ SQL Injection:** منعدم في العمليات الاعتيادية.
  - جميع حقول الـ `sql` تستخدم الـ Template Tag الآمن `sql`...`` لتمرير المعاملات كـ Parameters ($1, $2) بدلاً من الدمج النصي المباشر.

---

## 4. تقييم موثوقية النظام والنسخ الاحتياطي (Reliability & Disaster Recovery)
1. **النسخ الاحتياطي الآلي:**
   - حالياً، نقطة النهاية `/api/backup` تعتمد على استدعاء مباشر لأمر `pg_dump`.
   - نظراً لتشغيل قاعدة البيانات في Docker، يفشل الاستدعاء المباشر ما لم يتم تشغيله عبر `docker exec` أو إتاحة أداة `pg_dump` داخل بيئة التشغيل.
   - **التقييم:** خطر على استمرارية الأعمال يتطلب تصحيحاً فورياً لأتمتة النسخ اليومي.
2. **اتصالات الشبكة المحلية (Local Network LAN Binding):**
   - تم حل مشكلة الوصول من الموبايل عبر الشبكة المحلية بنجاح بواسطة التوافق مع `allowedDevOrigins` في `next.config.ts` والربط على `0.0.0.0:3000` وتشغيل ممر التحويل على `3001`.
   - هذا الإعداد ممتاز لبيئة التطوير والتجربة المخزنية الميدانية.
