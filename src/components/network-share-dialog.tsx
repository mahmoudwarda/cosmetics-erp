"use client";

import { useState, useEffect } from "react";
import { Check, Copy, Laptop, Smartphone, Wifi, X, QrCode } from "lucide-react";
import QRCodeLib from "qrcode";

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
  const [displayUrl, setDisplayUrl] = useState(networkUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const { hostname, host, protocol } = window.location;
      if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.startsWith("172.18.")) {
        setDisplayUrl(`${protocol}//${host}`);
      } else if (networkUrl && networkUrl.includes("172.18.")) {
        setDisplayUrl("http://172.20.10.2:3000");
      } else if (networkUrl) {
        setDisplayUrl(networkUrl);
      }
    }
  }, [networkUrl]);

  useEffect(() => {
    if (displayUrl) {
      QRCodeLib.toDataURL(displayUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: "#1e1b4b",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code generation error:", err));
    }
  }, [displayUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
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
            className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--modal-bg)] border border-[var(--modal-border)] p-5 sm:p-6 shadow-2xl text-right text-[var(--ink)]"
            dir="rtl"
            role="dialog"
            aria-modal="true"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 left-4 p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <Wifi size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--ink)]">
                  فتح السيستم من أجهزة الشبكة
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  كاشير إضافي • لابتوب المدير • تابلت وموبايل
                </p>
              </div>
            </div>

            {/* Crisp Scannable QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-indigo-100 shadow-xs mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code لفتح السيستم"
                  className="w-48 h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-slate-50 rounded-xl text-xs text-slate-400 font-bold">
                  جاري تجهيز الباركود...
                </div>
              )}
              <span className="text-[11px] font-bold text-slate-700 mt-2 flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                <QrCode size={13} className="text-indigo-600" />
                <span>امسح بكاميرا الموبايل للدخول الفوري</span>
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-2.5">
              أو افتح المتصفح وادخل الرابط المباشر للشبكة:
            </p>

            {/* Copy Box */}
            <div className="flex items-center gap-2 p-1.5 bg-[var(--bg)] rounded-xl border border-[var(--line-strong)] mb-2">
              <input
                id="network-url-input"
                type="text"
                value={displayUrl}
                onChange={(e) => setDisplayUrl(e.target.value)}
                dir="ltr"
                className="w-full bg-transparent px-3 py-1.5 text-xs font-mono font-bold text-emerald-700 outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="primary text-xs py-1.5 px-3 shrink-0 rounded-lg font-bold"
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

            <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mb-4 font-medium">
              💡 <strong>تنبيه للمتصفح:</strong> تأكد أن الرابط يبدأ بـ <span className="font-mono font-bold" dir="ltr">http://</span> وليس <span className="font-mono font-bold" dir="ltr">https://</span> لعدم وجود شهادة SSL محلية.
            </p>

            {/* Instructions */}
            <div className="space-y-2 bg-[var(--bg)] rounded-xl p-3 border border-[var(--line)] text-xs mb-4">
              <div className="flex items-start gap-2 text-[var(--ink-secondary)]">
                <Smartphone size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>الموبايل والتابلت:</strong> امسح الـ QR Code بكاميرا الهاتف أو الصق الرابط للتحكم الكامل.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[var(--ink-secondary)]">
                <Laptop size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>جهاز كاشير إضافي:</strong> افتح الرابط دون الحاجة لأي برامج إضافية.
                </span>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="secondary w-full py-2.5 text-xs font-bold rounded-xl"
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
