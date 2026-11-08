"use client";
import { createFormatter, useFormatter, useTimeZone } from "next-intl";
import { effectMoney } from "../lib/effect-money";
import { useNumberLocale, useUserPreferences } from "./user-preferences";
type DateOptions = NonNullable<Parameters<ReturnType<typeof useFormatter>["dateTime"]>[2]>;
export function useDisplayMoney() {
  const locale = useNumberLocale();
  return (amount: string, currency: string, _locale?: string) =>
    effectMoney(amount, currency, locale);
}
export function useDisplayFormatter() {
  const base = useFormatter(),
    preferences = useUserPreferences(),
    locale = useNumberLocale(),
    timeZone = useTimeZone();
  const numeric = createFormatter({ locale, timeZone });
  return {
    ...base,
    number: numeric.number,
    dateTime: (value: Date | number, options?: DateOptions | string, overrides?: DateOptions) => {
      if (typeof options === "string") return base.dateTime(value, options, overrides);
      if (!preferences) return base.dateTime(value, options);
      const next: DateOptions = { ...options };
      if (next.timeStyle || next.hour)
        next.hourCycle = preferences.time_format === "12" ? "h12" : "h23";
      if (next.dateStyle && preferences.date_format === "dd.MM.yyyy") {
        const parts = new Intl.DateTimeFormat(locale, {
          timeZone: next.timeZone ?? timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(value);
        const part = (kind: string) => parts.find((p) => p.type === kind)?.value ?? "";
        const date = `${part("day")}.${part("month")}.${part("year")}`;
        return next.timeStyle
          ? `${date} · ${base.dateTime(value, { timeZone: next.timeZone, timeStyle: next.timeStyle, hourCycle: next.hourCycle })}`
          : date;
      }
      return base.dateTime(value, next);
    },
  };
}
