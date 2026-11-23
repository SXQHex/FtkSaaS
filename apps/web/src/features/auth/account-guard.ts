import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../../lib/supabase";
import { BackendError } from "../../lib/backend";
import { accountQuery } from "./account-query";
import { workspaceKeys, workspaceQuery } from "../workspace/workspace-query";
import { hasDeletionReceipt } from "../account/deletion";
import { takeInvitationReturn } from "../invitations/invitation";

// Route guards own native authentication, MFA and lifecycle. Query owns fetched data.
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

async function loadAccountProjection(
  { queryClient, authUserId }: AccountLoaderContext["context"],
  includePlatformScope: boolean,
) {
  try {
    return await queryClient.query(accountQuery(authUserId, includePlatformScope));
  } catch (error) {
    if (error instanceof BackendError && ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code))
      throw redirect({ to: "/login" });
    throw error;
  }
}

async function prepareAccountAndWorkspace(
  context: AccountLoaderContext["context"],
  includePlatformScope: boolean,
  organizationId?: string,
) {
  const account = await loadAccountProjection(context, includePlatformScope);
  const query = workspaceQuery(context.queryClient, account.id, organizationId);
  const selected = organizationId
    ? context.queryClient.getQueryState(workspaceKeys.projection(account.id, organizationId))
    : undefined;
  if (
    organizationId &&
    (selected?.isInvalidated || selected?.status === "error" || (!selected?.data && !query.initialData))
  ) {
    // A direct link or a browser history transition has no fresh authority
    // guarantee. Await the native scoped read before the route can render.
    await context.queryClient.query(query);
  } else {
    // A forward SPA navigation reuses this document's already verified
    // workspace; extra forced reads would restart live command readbacks.
    void context.queryClient.query(query).catch(() => {});
  }
  // Return no account DTO: Router coordinates; Query is the sole account cache.
}

export async function loadScopedAccount(
  context: AccountLoaderContext["context"],
  organizationId?: string,
  includePlatformScope = false,
) {
  await prepareAccountAndWorkspace(context, includePlatformScope, organizationId);
}

export async function loadAccount({ context }: AccountLoaderContext) {
  await loadScopedAccount(context);
}

export async function loadPlatformAccount({ context }: AccountLoaderContext) {
  await loadAccountProjection(context, true);
}
