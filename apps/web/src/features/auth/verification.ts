import { getSupabaseClient } from "../../lib/supabase";
export async function resendVerification(email: string) {
  const origin = import.meta.env.VITE_APP_ORIGIN?.trim();
  if (!origin) throw new Error("APP_ORIGIN_REQUIRED");
  const { error } = await getSupabaseClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) throw error;
}
