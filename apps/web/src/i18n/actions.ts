"use server";
import { cookies } from "next/headers";
import { isLocale, localeCookie } from "./config";
export async function setLocale(value: string) {
  if (!isLocale(value)) throw new Error("Unsupported locale");
  (await cookies()).set(localeCookie, value, {
    path: "/", sameSite: "lax", httpOnly: true,
    secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365,
  });
}
