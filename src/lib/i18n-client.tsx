"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { translations, Locale, TranslationKey, translate } from "./i18n";

export { type Locale, type TranslationKey, translations, translate };

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey | string, fallback?: string) => string;
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ar",
  t: (key, fallback) => (translations.ar[key as TranslationKey] as string) || fallback || String(key),
  isRtl: true,
});

export function I18nProvider({
  locale = "ar",
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const t = (key: TranslationKey | string, fallback?: string): string => {
    return translate(key, locale, fallback);
  };

  const isRtl = locale === "ar";

  return (
    <I18nContext.Provider value={{ locale, t, isRtl }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
