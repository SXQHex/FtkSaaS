import { createFileRoute, redirect } from "@tanstack/react-router";
import { ResetPasswordPage } from "../features/auth/reset-password-page";
import { requireRecoverySession } from "../features/auth/password-recovery";
import { getSupabaseClient } from "../lib/supabase";

export const Route = createFileRoute("/reset-password")({
  beforeLoad: async () => {
    try {
      await requireRecoverySession();
    } catch {
      throw redirect({ to: "/forgot-password" });
    }
    const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
      throw redirect({ to: "/mfa" });
  },
  component: ResetPasswordPage,
});
