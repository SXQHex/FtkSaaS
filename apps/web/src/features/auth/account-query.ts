import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { readAccount } from "../../lib/account";
import { getSupabaseClient } from "../../lib/supabase";

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
  if (!data.session || data.session.user.id !== nativeUserId)
    throw new Error("ACCOUNT_CHANGED");
  return data.session;
}

export function accountQuery(nativeUserId: string, includePlatformScope = false) {
  return queryOptions({
    queryKey: accountQueryKeys.projection(nativeUserId, includePlatformScope),
    queryFn: async () => {
      const session = await verifiedSession(nativeUserId);
      const account = await readAccount(includePlatformScope, session.access_token);
      // Prevent a late response from being accepted for the next signed-in actor.
      await verifiedSession(nativeUserId);
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
    if (
      cached?.status === "success" &&
      cached.data !== undefined &&
      !cached.isInvalidated &&
      Date.now() - cached.dataUpdatedAt < accountStaleTime
    )
      return cached.data;
  }
  return queries.query(accountQuery(nativeUserId));
}

export function invalidateAccountProjections(queries: QueryClient) {
  // Router reloads the projection; do not refetch before its guard runs.
  return queries.invalidateQueries({
    queryKey: accountQueryKeys.all(),
    refetchType: "none",
  });
}
