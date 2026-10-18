"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Lock, User, AlertCircle } from "lucide-react";
import { signIn } from "@/features/auth/actions";

export function LoginForm({ error }: { error?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await signIn(formData);
    });
  };

  return (
    <div className="w-full">
      {error && (
        <div className="error-banner mb-4" role="alert">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>
            {error === "permissions"
              ? "هذا الحساب ليس لديه صلاحية لفتح أي صفحة. اطلب من مدير النظام تعيين صلاحيات لحسابك."
              : "اسم المستخدم أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى."}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Field */}
        <div className="field-wrap text-right">
          <label htmlFor="login-username" className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
            <span>اسم المستخدم</span>
            <span className="text-[11px] font-normal text-[var(--muted)]">مطلوب</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              disabled={isPending}
              placeholder="أدخل اسم المستخدم (مثال: admin)"
              className="w-full h-10 pe-10 ps-3 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all disabled:opacity-50"
            />
            <User size={17} className="absolute start-3 text-[var(--muted)] pointer-events-none" />
          </div>
        </div>

        {/* Password Field with Visibility Toggle */}
        <div className="field-wrap text-right">
          <label htmlFor="login-password" className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
            <span>كلمة المرور</span>
            <span className="text-[11px] font-normal text-[var(--muted)]">مطلوب</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={isPending}
              placeholder="••••••••"
              className="w-full h-10 pe-10 ps-10 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all disabled:opacity-50"
            />
            <Lock size={17} className="absolute start-3 text-[var(--muted)] pointer-events-none" />
            <button
              type="button"
              className="absolute end-2 p-2 text-[var(--muted)] hover:text-[var(--ink)] rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="primary w-full h-11 mt-2 text-sm font-bold flex items-center justify-center gap-2 rounded-lg shadow-sm transition-all"
        >
          {isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>جاري التحقق والولوج...</span>
            </>
          ) : (
            <span>تسجيل الدخول للنظام</span>
          )}
        </button>
      </form>
    </div>
  );
}
