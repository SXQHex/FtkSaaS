import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSupabaseClient } from "../lib/supabase";
import { readAccount } from "../lib/account";
import { inspectInvitation, requestInvitationAuth } from "../features/invitations/invitation";
import { InvitationPage, InvitationErrorPage } from "../features/invitations/invitation-page";

export const Route = createFileRoute("/invite")({
  loader: async () => {
    const invitation = inspectInvitation();
    if (!invitation) return { invitation: undefined, account: null };
    const auth = getSupabaseClient().auth;
    const { data, error } = await auth.getSession();
    if (error) throw error;
    if (!data.session) return { invitation, account: null };
    const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
      requestInvitationAuth();
      throw redirect({ to: "/mfa" });
    }
    return { invitation, account: await readAccount() };
  },
  component: InvitationPage,
  errorComponent: InvitationErrorPage,
});
