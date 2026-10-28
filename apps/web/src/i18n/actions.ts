"use server";
import { cookies, headers } from "next/headers";
import { isLocale, localeCookie } from "./config";
export async function setLocale(value: string) {
  if (!isLocale(value)) throw new Error("Unsupported locale");
  // WebKit rejects Secure cookies on HTTP loopback, including production-mode local tests.
  // Keep Secure on all hosted origins; this cookie contains only a language preference.
  const origin = (await headers()).get("origin");
  const localHttp = origin !== null && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  (await cookies()).set(localeCookie, value, {
    path: "/", sameSite: "lax", httpOnly: true,
    secure: !localHttp, maxAge: 60 * 60 * 24 * 365,
  });
}
