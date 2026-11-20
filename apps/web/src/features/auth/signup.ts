import { checkSignup } from "../../lib/public-gateway";
import { getSupabaseClient } from "../../lib/supabase";
import { readAccount } from "../../lib/account";

export async function registerAccount(values: { name: string; email: string; password: string }) {
  const origin = import.meta.env.VITE_APP_ORIGIN?.trim();
  if (!origin) throw new Error("APP_ORIGIN_REQUIRED");
  const check = await checkSignup(values.email);
  if (check.status === "account_exists") throw new Error("ACCOUNT_EXISTS");
  if (check.status !== "available") throw new Error("SIGNUP_CHECK_INVALID");
  const auth = getSupabaseClient().auth;
  const { data, error } = await auth.signUp({
    email: values.email,
    password: values.password,
    options: { emailRedirectTo: `${origin}/auth/callback`, data: { display_name: values.name } },
  });
  if (error) throw error;
  if (!data.user) throw new Error("SIGNUP_UNCONFIRMED");
  if (data.user.identities?.length === 0) throw new Error("ACCOUNT_EXISTS");
  if (!data.session) return "/verify-email" as const;
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return "/mfa" as const;
  await readAccount();
  return "/account" as const;
}
