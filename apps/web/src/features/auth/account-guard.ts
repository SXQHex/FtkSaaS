import { redirect } from "@tanstack/react-router";
import { getSupabaseClient } from "../../lib/supabase";
import type { QueryClient } from "@tanstack/react-query";
import { accountQuery } from "./account-query";
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
  return { authUserId: data.session.user.id };
}

type AccountLoaderContext = {
  context: { queryClient: QueryClient; authUserId: string };
};

export async function loadAccount({ context }: AccountLoaderContext) {
  return loadAccountProjection(context, false);
}

export async function loadPlatformAccount({ context }: AccountLoaderContext) {
  return loadAccountProjection(context, true);
}

async function loadAccountProjection(
  context: AccountLoaderContext["context"],
  includePlatformScope: boolean,
) {
  try {
    return await context.queryClient.query(accountQuery(context.authUserId, includePlatformScope));
  } catch (error) {
    if (error instanceof BackendError && ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code))
      throw redirect({ to: "/login" });
    throw error;
  }
}
