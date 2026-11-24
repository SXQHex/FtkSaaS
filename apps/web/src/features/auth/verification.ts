import { requireAppOrigin } from "../../lib/public-config";
import { getSupabaseClient } from "../../lib/supabase";
export async function resendVerification(email: string) {
  const origin = requireAppOrigin();
  const { error } = await getSupabaseClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) throw error;
}
