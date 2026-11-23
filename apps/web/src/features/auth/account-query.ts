import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { readAccount } from "../../lib/account";
import { getSupabaseClient } from "../../lib/supabase";
import { nativeSessionId } from "./native-session-id";

type Account = Awaited<ReturnType<typeof readAccount>>;

// Never equate the native user UUID with the backend account UUID.
// Bearer tokens must never appear in query keys or devtools.
const accountStaleTime = 30_000;

export const accountQueryKeys = {
  all: () => ["authenticated-account"] as const,
  projection: (nativeUserId: string, includePlatformScope = false) =>
    ["authenticated-account", nativeUserId, includePlatformScope] as const,
};

async function verifiedSession(nativeUserId: string) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session || data.session.user.id !== nativeUserId) throw new Error("ACCOUNT_CHANGED");
  return data.session;
}

export function accountQuery(nativeUserId: string, includePlatformScope = false) {
  return queryOptions({
    queryKey: accountQueryKeys.projection(nativeUserId, includePlatformScope),
    queryFn: async () => {
      const session = await verifiedSession(nativeUserId);
      const account = await readAccount(includePlatformScope, session.access_token);
      // Actor equality alone cannot distinguish two sessions of one user.
      // Reject a late result from the old session without treating a normal
      // bearer refresh (same session_id) as a new login.
      const latest = await verifiedSession(nativeUserId);
      if (nativeSessionId(session) !== nativeSessionId(latest)) throw new Error("ACCOUNT_CHANGED");
      return account;
    },
    staleTime: accountStaleTime,
    retry: false,
  });
}

export async function verifiedWorkspaceAccount(queries: QueryClient, nativeUserId: string) {
  await verifiedSession(nativeUserId);
  // The platform projection is an authorized superset; never seed the privileged
  // key from an unprivileged response or share results across native actors.
  for (const includePlatformScope of [false, true]) {
    const cached = queries.getQueryState<Account>(
      accountQueryKeys.projection(nativeUserId, includePlatformScope),
    );
    if (!cached || cached.status !== "success") continue;
    if (cached.data === undefined || cached.isInvalidated) continue;
    if (Date.now() - cached.dataUpdatedAt < accountStaleTime) return cached.data;
  }
  // A privileged projection may be the only available actor read (e.g. /account).
  // Refresh that same key instead of starting an unnecessary ordinary projection.
  const ordinary = queries.getQueryState(accountQueryKeys.projection(nativeUserId));
  const platform = queries.getQueryState(accountQueryKeys.projection(nativeUserId, true));
  return queries.query(accountQuery(nativeUserId, !ordinary && !!platform));
}

export async function verifiedAccountForId(
  queries: QueryClient,
  accountId: string,
  includePlatformScope = false,
) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const account = includePlatformScope
    ? await queries.query(accountQuery(data.session.user.id, true))
    : await verifiedWorkspaceAccount(queries, data.session.user.id);
  if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
  return account;
}

export function invalidateAccountProjections(queries: QueryClient) {
  // Router reloads the projection; do not refetch before its guard runs.
  return queries.invalidateQueries({
    queryKey: accountQueryKeys.all(),
    refetchType: "none",
  });
}
