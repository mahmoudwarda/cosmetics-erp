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
        <div className="text-right space-y-1.5">
          <label htmlFor="login-username" className="block text-xs font-bold text-slate-700">
            اسم المستخدم
          </label>
          <div className="relative flex items-center">
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              disabled={isPending}
              placeholder="اسم المستخدم"
              className="w-full h-11 ps-11 pe-4 border border-slate-300 rounded-xl bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/60 transition-all disabled:opacity-50"
            />
            <User size={18} className="absolute start-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Password Field with Visibility Toggle */}
        <div className="text-right space-y-1.5">
          <label htmlFor="login-password" className="block text-xs font-bold text-slate-700">
            كلمة المرور
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
              className="w-full h-11 ps-11 pe-11 border border-slate-300 rounded-xl bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/60 transition-all disabled:opacity-50"
            />
            <Lock size={18} className="absolute start-3.5 text-slate-400 pointer-events-none" />
            <button
              type="button"
              className="absolute end-2 p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-12 mt-2 text-sm font-bold flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-97 transition-all border-0 disabled:opacity-50"
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
