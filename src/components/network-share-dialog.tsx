"use client";

import { useState } from "react";
import { Check, Copy, Laptop, Smartphone, Wifi, X } from "lucide-react";

interface NetworkShareDialogProps {
  networkUrl: string;
  className?: string;
  buttonLabel?: string;
}

export function NetworkShareDialog({
  networkUrl,
  className = "",
  buttonLabel = "فتح من جهاز آخر في الشبكة",
}: NetworkShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(networkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.getElementById("network-url-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-[var(--line-strong)] hover:bg-[var(--bg)] hover:text-[var(--primary)] text-[var(--ink-secondary)] ${className}`}
        title="مشاركة رابط السيستم مع أجهزة الكاشير أو التابلت على نفس الشبكة"
      >
        <Wifi size={14} className="text-emerald-600" />
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--backdrop)]">
          <div
            className="relative w-full max-w-md rounded-xl bg-[var(--modal-bg)] border border-[var(--modal-border)] p-6 shadow-2xl text-right text-[var(--ink)]"
            dir="rtl"
            role="dialog"
            aria-modal="true"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 left-4 p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] rounded-lg transition-colors"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                <Wifi size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--ink)]">
                  فتح السيستم من أجهزة الشبكة
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  كاشير إضافي • لابتوب المدير • تابلت الصالة
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-4">
              افتح المتصفح من أي جهاز متصل بنفس شبكة الواي فاي أو الراوتر، وافتح الرابط التالي:
            </p>

            {/* Copy Box */}
            <div className="flex items-center gap-2 p-1.5 bg-[var(--bg)] rounded-lg border border-[var(--line-strong)] mb-5">
              <input
                id="network-url-input"
                type="text"
                readOnly
                value={networkUrl}
                dir="ltr"
                className="w-full bg-transparent px-3 py-1.5 text-xs font-mono font-bold text-emerald-600 outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="primary text-xs py-1.5 px-3 shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-2.5 bg-[var(--bg)] rounded-lg p-3.5 border border-[var(--line)] text-xs">
              <div className="flex items-start gap-2 text-[var(--ink-secondary)]">
                <Smartphone size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>الموبايل والتابلت:</strong> افتح المتصفح والصق الرابط لإصدار الفواتير أو فحص المخزن مباشرة من الصالة.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[var(--ink-secondary)]">
                <Laptop size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>جهاز كاشير إضافي:</strong> لا يتطلب تثبيت أي برامج، كافة العمليات تُحفظ لحظياً في قاعدة البيانات الرئيسية.
                </span>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="secondary w-full py-2 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
