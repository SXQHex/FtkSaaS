import { requireAppOrigin } from "../../lib/public-config";
import type { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { checkSignup } from "../../lib/public-gateway";
import { getSupabaseClient } from "../../lib/supabase";
import { queryClient } from "../../lib/query-client";
import { accountQuery } from "./account-query";
import { sameNativeSession } from "./native-session-id";

async function verifySignupSession(expected: Session) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session || !sameNativeSession(expected, data.session))
    throw new Error("ACCOUNT_CHANGED");
}

export async function registerAccount(
  values: { name: string; email: string; password: string },
  queries: QueryClient = queryClient,
) {
  const origin = requireAppOrigin();
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
  queries.clear();
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel(data.session.access_token);
  if (assurance.error) throw assurance.error;
  await verifySignupSession(data.session);
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return "/mfa" as const;
  await queries.query(accountQuery(data.session.user.id, true));
  await verifySignupSession(data.session);
  return "/account" as const;
}
