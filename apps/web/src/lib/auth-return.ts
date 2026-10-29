"use server";

import { cookies } from "next/headers";
import { appOrigin, safeReturnPath } from "./config";

// Preserve a local destination without expanding the provider callback allowlist.
export async function rememberAuthReturn(value: string) {
  (await cookies()).set("ftksaas_auth_return", safeReturnPath(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(appOrigin()).protocol === "https:",
    path: "/auth/callback",
    maxAge: 600,
  });
}
