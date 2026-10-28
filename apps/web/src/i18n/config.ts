export const locales = ["tr", "en"] as const;
export type Locale = (typeof locales)[number];
export const localeCookie = "ftksaas_locale";
export function isLocale(value: unknown): value is Locale {
  return value === "tr" || value === "en";
}
