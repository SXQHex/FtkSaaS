import { redirect } from "@tanstack/react-router";
import { getSupabaseClient } from "../../lib/supabase";
import { readAccount } from "../../lib/account";
import { BackendError } from "../../lib/backend";
import { hasDeletionReceipt } from "../account/deletion";
import { takeInvitationReturn } from "../invitations/invitation";

// Shared by protected product pages; native Auth/AAL and account lifecycle stay
// identical to the accepted account route.
export async function requireAccountSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session) throw redirect({ to: "/login" });
  const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    throw redirect({ to: "/mfa" });
  if (hasDeletionReceipt(data.session.user.id)) throw redirect({ to: "/account/deletion" });
  if (takeInvitationReturn()) throw redirect({ to: "/invite" });
}

export async function loadAccount() {
  try {
    return await readAccount();
  } catch (error) {
    if (error instanceof BackendError && ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code))
      throw redirect({ to: "/login" });
    throw error;
  }
}
