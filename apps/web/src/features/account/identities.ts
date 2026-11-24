import { requireAppOrigin } from "../../lib/public-config";
import type { UserIdentity } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import { storeGoogleCalendarReturn } from "../auth/calendar-session-return";

export async function readIdentities() {
  const { data, error } = await getSupabaseClient().auth.getUserIdentities();
  if (error) throw error;
  return data.identities;
}
export async function linkGoogle() {
  const origin = requireAppOrigin();
  storeGoogleCalendarReturn();
  const { error } = await getSupabaseClient().auth.linkIdentity({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) throw error;
}
export async function unlinkGoogle(identity: UserIdentity) {
  if (identity.provider !== "google") throw new Error("IDENTITY_UNAVAILABLE");
  const { error } = await getSupabaseClient().auth.unlinkIdentity(identity);
  if (error) throw error;
}
