import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appOrigin, safeReturnPath } from "../../../lib/config";
import { serverClient } from "../../../lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin();
  const code = url.searchParams.get("code");
  const jar = await cookies();
  const next = safeReturnPath(
    url.searchParams.get("next") ?? jar.get("ftksaas_auth_return")?.value,
  );
  const providerError = ["error", "error_code", "error_description"].some((key) =>
    url.searchParams.has(key),
  );
  if (!code && !providerError && next !== "/reset-password") {
    // Secure email change returns its first confirmation in a fragment, which the
    // server cannot read. The browser carries it to this informational page.
    // Keep the destination cookie for the second link's actual PKCE exchange.
    const target = new URL("/auth/confirmation", origin);
    if (next !== "/") target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }
  // Use the original path when clearing the callback-scoped cookie.
  jar.set("ftksaas_auth_return", "", {
    path: "/auth/callback",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(origin).protocol === "https:",
  });
  const client = await serverClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  if (next === "/reset-password")
    return NextResponse.redirect(new URL("/forgot-password?error=callback", origin));
  const target = new URL("/login?error=callback", origin);
  if (next !== "/") target.searchParams.set("next", next);
  return NextResponse.redirect(target);
}
