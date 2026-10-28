import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, localeCookie } from "./config";
import tr from "../../messages/tr.json";
import en from "../../messages/en.json";
export default getRequestConfig(async () => {
  const value = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(value) ? value : "tr";
  return { locale, messages: locale === "en" ? en : tr, timeZone: "UTC" };
});
