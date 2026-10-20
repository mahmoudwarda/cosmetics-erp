"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Laptop, RefreshCw, Smartphone, Wifi, X, QrCode as QrIcon, Settings2 } from "lucide-react";
import { QrCodeView } from "@/components/qr-code";

interface NetworkShareDialogProps {
  networkUrl: string;
  className?: string;
  buttonLabel?: string;
}

interface NetworkInfoResponse {
  ip: string;
  url: string;
  port: number;
  isHotspot: boolean;
  networkType: "hotspot" | "wifi" | "lan" | "localhost";
  allInterfaces?: Array<{ name: string; ip: string; type: string }>;
}

export function NetworkShareDialog({
  networkUrl: initialUrl,
  className = "",
  buttonLabel = "فتح من جهاز آخر في الشبكة",
}: NetworkShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [currentIp, setCurrentIp] = useState("");
  const [networkType, setNetworkType] = useState<"hotspot" | "wifi" | "lan" | "localhost">("wifi");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [customIpInput, setCustomIpInput] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch latest dynamic network status from API
  const fetchNetworkInfo = async () => {
    setIsRefreshing(true);
    try {
      // If user is already browsing on a non-localhost IP in their browser, prioritize that
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const port = window.location.port ? `:${window.location.port}` : "";
        if (hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.startsWith("172.18.")) {
          const directUrl = `${window.location.protocol}//${hostname}${port}`;
          setCurrentUrl(directUrl);
          setCurrentIp(hostname);
          if (hostname.startsWith("172.20.10.") || hostname.startsWith("192.168.43.")) {
            setNetworkType("hotspot");
          } else {
            setNetworkType("wifi");
          }
          setIsRefreshing(false);
          return;
        }
      }

      const res = await fetch("/api/network");
      if (res.ok) {
        const data: NetworkInfoResponse = await res.json();
        if (data.url) {
          setCurrentUrl(data.url);
          setCurrentIp(data.ip);
          setNetworkType(data.networkType);
          setCustomIpInput(data.ip);
        }
      }
    } catch {
      // Fallback to initial
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetworkInfo();
    }
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
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

  const handleSaveCustomIp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIp = customIpInput.trim();
    if (!cleanIp) return;

    try {
      const res = await fetch("/api/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: cleanIp }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUrl(data.url || `http://${cleanIp}:3000`);
        setCurrentIp(cleanIp);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch {
      // Update locally anyway
      setCurrentUrl(`http://${cleanIp}:3000`);
      setCurrentIp(cleanIp);
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
            className="relative w-full max-w-lg rounded-xl bg-[var(--modal-bg)] border border-[var(--modal-border)] p-6 shadow-2xl text-right text-[var(--ink)] max-h-[90vh] overflow-y-auto"
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
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <Wifi size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[var(--ink)]">
                    فتح السيستم من أجهزة الشبكة
                  </h3>
                  {networkType === "hotspot" ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      هوت سبوت موبايل 📱
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      واي فاي / راوتر 📶
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  كاشير إضافي • لابتوب المدير • تابلت الصالة والمخزن
                </p>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center p-4 my-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <QrCodeView value={currentUrl} size={160} className="mb-2" />
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                <QrIcon size={14} className="text-emerald-600" />
                <span>امسح الباركود بكاميرا الموبايل لفتح السيستم فوراً</span>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                تأكد أن الموبايل أو التابلت متصل بنفس شبكة الواي فاي أو الهوت سبوت
              </p>
            </div>

            {/* Copy Box */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[var(--muted)] mb-1">
                رابط الدخول المباشر:
              </label>
              <div className="flex items-center gap-2 p-1.5 bg-[var(--bg)] rounded-lg border border-[var(--line-strong)]">
                <input
                  id="network-url-input"
                  type="text"
                  readOnly
                  value={currentUrl}
                  dir="ltr"
                  className="w-full bg-transparent px-3 py-1.5 text-xs font-mono font-bold text-emerald-600 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1"
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
                <button
                  type="button"
                  onClick={fetchNetworkInfo}
                  disabled={isRefreshing}
                  className="secondary text-xs py-1.5 px-2.5 shrink-0 flex items-center gap-1"
                  title="تحديث تلقائي لرصد أي شبكة جديدة"
                >
                  <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>
              </div>
            </div>

            {/* Quick manual IP toggle */}
            <div className="mb-4 border-t border-[var(--line)] pt-3">
              <button
                type="button"
                onClick={() => setShowManualEdit(!showManualEdit)}
                className="flex items-center justify-between w-full text-xs text-[var(--muted)] hover:text-[var(--ink)] font-semibold transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Settings2 size={13} />
                  <span>تعديل عنوان الـ IP يدوياً (إذا غيرت الشبكة)</span>
                </span>
                <span className="text-[11px] text-indigo-600 font-bold">
                  {showManualEdit ? "إخفاء" : "إظهار"}
                </span>
              </button>

              {showManualEdit && (
                <form onSubmit={handleSaveCustomIp} className="mt-2.5 p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-xs space-y-2">
                  <p className="text-[11px] text-[var(--muted)]">
                    إذا كان جهازك متصلاً بهوت سبوت هاتف أو راوتر آخر، اكتب عنوان الـ IP الخاص به هنا وسيقوم السيستم بتحديث الرابط والباركود:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="مثال: 172.20.10.2 أو 192.168.1.5"
                      value={customIpInput}
                      onChange={(e) => setCustomIpInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded border border-[var(--line-strong)] text-xs font-mono font-semibold"
                    />
                    <button
                      type="submit"
                      className="primary text-xs py-1.5 px-3 shrink-0"
                    >
                      {saveSuccess ? "تم الحفظ!" : "تطبيق"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-2 bg-[var(--bg)] rounded-lg p-3 border border-[var(--line)] text-xs mb-4">
              <div className="flex items-start gap-2 text-[var(--ink-secondary)]">
                <Smartphone size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>هوت سبوت الموبايل (Personal Hotspot):</strong> شغّل نقطة الاتصال من هاتفك ووصل اللابتوب بها، وسيعمل السيستم على الهاتف واللابتوب معاً بدون الحاجة لراوتر خارجي.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[var(--ink-secondary)]">
                <Laptop size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>كاشير إضافي:</strong> افتح الرابط من أي جهاز كمبيوتر أو تابلت بالمتصفح وستظهر شاشة الكاشير والمخازن فوراً وتُحفظ البيانات في نفس اللحظة.
                </span>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="text-center">
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
