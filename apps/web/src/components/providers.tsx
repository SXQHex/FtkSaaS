"use client";
import { useSyncExternalStore } from "react";
import { NextIntlClientProvider, useLocale, useTimeZone } from "next-intl";
import { ThemeProvider } from "next-themes";
function subscribeToTimezone(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}
function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const inheritedTimeZone = useTimeZone();
  // Hydrate with the server value, then use the browser's timezone for every formatter.
  const timeZone = useSyncExternalStore(
    subscribeToTimezone,
    browserTimezone,
    () => inheritedTimeZone,
  );
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
