import { requireAppOrigin } from "../../lib/public-config";
import { getSupabaseClient } from "../../lib/supabase";

function callbackUrl() {
  const origin = requireAppOrigin();
  return `${origin}/auth/callback`;
}
export async function requestEmailChange(email: string) {
  const { data, error } = await getSupabaseClient().auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: callbackUrl() },
  );
  if (error) throw error;
  if (!data.user) throw new Error("AUTH_REQUIRED");
}
export async function resendEmailChange(email: string) {
  const { error } = await getSupabaseClient().auth.resend({
    type: "email_change",
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw error;
}
