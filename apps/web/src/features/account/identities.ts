import type { UserIdentity } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";

export async function readIdentities() {
  const { data, error } = await getSupabaseClient().auth.getUserIdentities();
  if (error) throw error;
  return data.identities;
}
export async function linkGoogle() {
  const origin = import.meta.env.VITE_APP_ORIGIN?.trim();
  if (!origin) throw new Error("APP_ORIGIN_REQUIRED");
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
