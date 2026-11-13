import { createFileRoute, redirect } from "@tanstack/react-router";
import { MfaPage, MfaErrorPage } from "../features/auth/mfa-page";
import { getSupabaseClient } from "../lib/supabase";
import { readTotpFactors } from "../features/auth/mfa";
import { hasRecoverySession } from "../features/auth/password-recovery";
export const Route = createFileRoute("/mfa")({
  beforeLoad: async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error || !data.session) throw redirect({ to: "/login" });
    const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data.currentLevel === "aal2" || assurance.data.nextLevel !== "aal2")
      throw redirect({ to: (await hasRecoverySession()) ? "/reset-password" : "/account" });
  },
  loader: readTotpFactors,
  component: MfaPage,
  errorComponent: MfaErrorPage,
});
