import { getSupabaseClient } from "../../lib/supabase";
import type { QueryClient } from "@tanstack/react-query";
import { queryClient } from "../../lib/query-client";
import { accountQuery } from "./account-query";
import { hasDeletionReceipt } from "../account/deletion";

export async function loginWithPassword(
  values: { email: string; password: string },
  queries: QueryClient = queryClient,
) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword(values);
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  // An explicit new sign-in always ends the previous actor's Query lifetime,
  // including a different session for the same Supabase user UUID.
  queries.clear();
  const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return "/mfa" as const;
  if (hasDeletionReceipt(data.session.user.id)) return "/account/deletion" as const;
  await queries.query(accountQuery(data.session.user.id, true));
  return "/account" as const;
}

export async function loginWithGoogle() {
  const origin = import.meta.env.VITE_APP_ORIGIN?.trim();
  if (!origin) throw new Error("APP_ORIGIN_REQUIRED");
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) throw error;
}
