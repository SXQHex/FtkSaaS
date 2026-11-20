import { createFileRoute, redirect } from "@tanstack/react-router";
import { MfaPage, MfaErrorPage } from "../features/auth/mfa-page";
import { getSupabaseClient } from "../lib/supabase";
import { readTotpFactors } from "../features/auth/mfa";
import { hasRecoverySession } from "../features/auth/password-recovery";
import {
  hasPendingPasswordReplacement,
  retirePreviousPasswordSession,
} from "../features/account/fresh-session";
export const Route = createFileRoute("/mfa")({
  beforeLoad: async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error || !data.session) throw redirect({ to: "/login" });
    const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel(
      hasPendingPasswordReplacement(data.session) ? data.session.access_token : undefined,
    );
    if (assurance.error) throw assurance.error;
    if (assurance.data.currentLevel === "aal2" || assurance.data.nextLevel !== "aal2") {
      // The native verifier may have saved AAL2 before a reload interrupted continuation.
      if (assurance.data.currentLevel === "aal2") await retirePreviousPasswordSession(data.session);
      throw redirect({ to: (await hasRecoverySession()) ? "/reset-password" : "/account" });
    }
  },
  loader: readTotpFactors,
  component: MfaPage,
  errorComponent: MfaErrorPage,
});
