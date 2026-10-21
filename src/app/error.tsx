"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, RotateCcw, Home } from "lucide-react";

const ERROR_TRANSLATIONS: Record<string, string> = {
  INSUFFICIENT_CASHBOX_BALANCE: "رصيد الصندوق/الخزينة المحددة غير كافٍ لإتمام هذه المعاملة النقدية.",
  INSUFFICIENT_STOCK: "الكمية المطلوبة في الفاتورة غير متوفرة في رصيد المخزن حالياً.",
  CASHBOX_OPENING_BALANCE_LOCKED: "لا يمكن تعديل الرصيد الافتتاحي للخزينة بعد تسجيل حركات نقدية وفواتير عليها لحماية القيود المحاسبية.",
  CASHBOX_NOT_FOUND: "الصندوق أو الخزينة المحددة غير موجودة أو تم إلغاء تنشيطها.",
  ACCOUNT_NOT_FOUND: "حساب الطرف (العميل أو المورد) غير موجود في النظام.",
  PARTY_NOT_FOUND: "بيانات العميل أو المورد غير مسجلة.",
  ANONYMOUS_CREDIT_NOT_ALLOWED: "لا يمكن إصدار فاتورة آجلة بدون تحديد العميل المسجل لحفظ المديونية في دفتر الأستاذ.",
  TRANSFER_SAME_CASHBOX: "لا يمكن إجراء تحويل مالي بين نفس الصندوق.",
  USERNAME_EXISTS: "اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم مستخدم آخر.",
  PASSWORD_REQUIRED: "كلمة المرور مطلوبة عند إضافة مستخدم جديد (10 خانات على الأقل).",
  CANNOT_DISABLE_SELF: "لا يمكنك تعطيل أو حذف حسابك الشخصي الذي تستخدمه حالياً.",
  NEGATIVE_STOCK: "لا يمكن إجراء تسوية تجعل رصيد المخزون بالسالب.",
  INVALID_LINE: "بيانات أحد بنود الفاتورة غير مكتملة أو تحتوي على كميات غير صالحة.",
  PRICE_BELOW_COST: "تنبيه: سعر البيع المحدد للصنف أقل من سعر تكلفته المعتمد في المخزن.",
  FORBIDDEN: "عفواً، حسابك لا يملك الصلاحيات الكافية لتنفيذ هذا الإجراء.",
  UNAUTHENTICATED: "انتهت جلسة تسجيل الدخول، يرجى إعادة تسجيل الدخول مرة أخرى.",
  INVALID_PARTY: "بيانات العميل أو المورد غير مكتملة، يرجى مراجعة الاسم والبيانات المدخلة.",
  INVALID_PRODUCT: "بيانات الصنف غير صالحة، يرجى التأكد من اسم الصنف والأسعار.",
  INVALID_INVOICE: "بيانات الفاتورة غير صحيحة، يرجى مراجعة الأصناف والمبالغ المدخلة.",
};

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application runtime error:", error);
  }, [error]);

  const rawMessage = error?.message || "";
  let userFriendlyMessage = "";

  for (const [code, arabicText] of Object.entries(ERROR_TRANSLATIONS)) {
    if (rawMessage.includes(code)) {
      userFriendlyMessage = arabicText;
      break;
    }
  }

  if (!userFriendlyMessage) {
    if (rawMessage.includes("INSUFFICIENT_STOCK")) {
      userFriendlyMessage = "الكمية المطلوبة لبعض الأصناف أكبر من رصيد المخزن المتاح.";
    } else if (rawMessage.includes("PRICE_BELOW_COST")) {
      userFriendlyMessage = "سعر البيع المدخل أقل من سعر التكلفة المعتمد في النظام.";
    } else {
      userFriendlyMessage = "حدث تنبيه أثناء معالجة البيانات، يرجى مراجعة المدخلات والمحاولة مرة أخرى.";
    }
  }

  return (
    <main className="min-h-[75vh] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg bg-[var(--panel)] border border-[var(--line-strong)] rounded-3xl p-6 sm:p-8 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto shadow-xs">
          <AlertTriangle size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-[var(--ink)]">تنبيه أثناء معالجة العملية</h2>
          <p className="text-sm font-bold text-slate-700 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/60 leading-relaxed">
            {userFriendlyMessage}
          </p>
        </div>

        {error.digest && (
          <p className="text-[11px] text-[var(--muted)] font-mono">
            رمز التتبع الفني: {error.digest}
          </p>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="primary w-full sm:w-auto px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 rounded-xl cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>محاولة مرة أخرى</span>
          </button>

          <Link
            href="/"
            className="secondary w-full sm:w-auto px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 rounded-xl"
          >
            <Home size={15} />
            <span>العودة للوحة التحكم</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
