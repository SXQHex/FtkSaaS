import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountPage, AccountErrorPage } from "../features/auth/account-page";
import { getSupabaseClient } from "../lib/supabase";
import { readAccount } from "../lib/account";
import { BackendError } from "../lib/backend";

export const Route = createFileRoute("/account")({
  beforeLoad: async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error || !data.session) throw redirect({ to: "/login" });
    const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
      throw redirect({ to: "/mfa" });
  },
  loader: async () => {
    try {
      return await readAccount();
    } catch (error) {
      if (
        error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)
      )
        throw redirect({ to: "/login" });
      throw error;
    }
  },
  component: AccountPage,
  errorComponent: AccountErrorPage,
});
