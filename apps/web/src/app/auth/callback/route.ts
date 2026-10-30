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
  const target = new URL("/login?error=callback", origin);
  if (next !== "/") target.searchParams.set("next", next);
  return NextResponse.redirect(target);
}
