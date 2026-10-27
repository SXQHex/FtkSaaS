import { NextResponse } from "next/server";
import { appOrigin, safeReturnPath } from "../../../lib/config";
import { serverClient } from "../../../lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin();
  const code = url.searchParams.get("code");
  const client = await serverClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(safeReturnPath(url.searchParams.get("next")), origin));
  }
  return NextResponse.redirect(new URL("/giris?error=callback", origin));
}
