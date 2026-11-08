"use client";
import { createContext, useContext, type ReactNode } from "react";
import { NextIntlClientProvider, useLocale } from "next-intl";
import type { UserSettingsValues } from "@ftksaas/api-contracts";
import tr from "../../messages/tr.json";
import en from "../../messages/en.json";
const PreferenceContext = createContext<UserSettingsValues | null>(null);
export const useUserPreferences = () => useContext(PreferenceContext);
export function UserPreferencesProvider({
  value,
  children,
}: {
  value: UserSettingsValues | null;
  children: ReactNode;
}) {
  const baseLocale = useLocale();
  const locale = value?.language === "tr" || value?.language === "en" ? value.language : baseLocale;
  let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (value?.timezone_mode === "manual" && value.timezone_name) {
    try {
      new Intl.DateTimeFormat(locale, { timeZone: value.timezone_name });
      timeZone = value.timezone_name;
    } catch {
      /* Keep device timezone for an invalid inherited preference. */
    }
  }
  return (
    <PreferenceContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "en" ? en : tr}
        timeZone={timeZone}
      >
        {children}
      </NextIntlClientProvider>
    </PreferenceContext.Provider>
  );
}
export function useNumberLocale() {
  const preferences = useUserPreferences(),
    locale = useLocale();
  return preferences?.number_format ?? locale;
}
