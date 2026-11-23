import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { readAccount } from "../../lib/account";
import { getSupabaseClient } from "../../lib/supabase";
import { nativeSessionId, sameNativeSession } from "./native-session-id";

type Account = Awaited<ReturnType<typeof readAccount>>;

// Never equate the native user UUID with the backend account UUID.
// Bearer tokens must never appear in query keys or devtools.
const accountStaleTime = 30_000;

type AccountSession = {
  userId: string;
  sessionId: string | undefined;
  includePlatformScope: boolean;
  verifiedAt: number;
  opaqueBearer?: string;
};
// Provenance belongs to the exact successful DTO, not mutable Query options.
// This retains no duplicate account data and is collected with the DTO. Native
// JWTs retain only their session UUID; an opaque bearer can only match itself.
const accountSessions = new WeakMap<Account, AccountSession>();

function belongsToSession(account: Account, session: Session, includePlatformScope: boolean) {
  const proof = accountSessions.get(account);
  return (
    proof?.userId === session.user.id &&
    proof.includePlatformScope === includePlatformScope &&
    Date.now() - proof.verifiedAt < accountStaleTime &&
    (proof.sessionId
      ? proof.sessionId === nativeSessionId(session)
      : proof.opaqueBearer === session.access_token)
  );
}

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
    queryFn: async ({ signal }) => {
      signal.throwIfAborted();
      const session = await verifiedSession(nativeUserId);
      const currentSession = async () => {
        // Both success and denial belong to the pinned session. An old
        // SESSION_REVOKED response must not sign out a newly selected actor.
        signal.throwIfAborted();
        const latest = await verifiedSession(nativeUserId);
        signal.throwIfAborted();
        if (!sameNativeSession(session, latest)) throw new Error("ACCOUNT_CHANGED");
      };
      const account = await readAccount(includePlatformScope, session.access_token).catch(
        async (error: unknown) => {
          await currentSession();
          throw error;
        },
      );
      await currentSession();
      const projection = { ...account };
      const sessionId = nativeSessionId(session);
      accountSessions.set(projection, {
        userId: nativeUserId,
        sessionId,
        includePlatformScope,
        verifiedAt: Date.now(),
        ...(!sessionId ? { opaqueBearer: session.access_token } : {}),
      });
      return projection;
    },
    // Structural sharing must not replace the newly verified DTO with an
    // identical DTO that was read in a previous native session.
    structuralSharing: false,
    staleTime: accountStaleTime,
    retry: false,
  });
}

async function verifiedProjection(
  queries: QueryClient,
  nativeUserId: string,
  projections: readonly [boolean] | readonly [false, true],
) {
  const session = await verifiedSession(nativeUserId);
  // The platform projection is an authorized superset; never seed the privileged
  // key from an unprivileged response or share results across native actors.
  for (const includePlatformScope of projections) {
    const cached = queries.getQueryState<Account>(
      accountQueryKeys.projection(nativeUserId, includePlatformScope),
    );
    if (!cached || cached.status !== "success") continue;
    if (cached.data === undefined || cached.isInvalidated) continue;
    if (
      Date.now() - cached.dataUpdatedAt < accountStaleTime &&
      belongsToSession(cached.data, session, includePlatformScope)
    )
      return cached.data;
  }
  // A privileged projection may be the only available actor read (e.g. /account).
  // Refresh that same key instead of starting an unnecessary ordinary projection.
  const ordinary = queries.getQueryState(accountQueryKeys.projection(nativeUserId));
  const platform = queries.getQueryState(accountQueryKeys.projection(nativeUserId, true));
  const includePlatformScope = projections.length === 1 ? projections[0] : !ordinary && !!platform;
  // A fresh timestamp alone cannot bless a manually seeded or previous-session
  // DTO. A miss must fetch, while parallel callers still share Query's promise.
  const account = await queries.query({
    ...accountQuery(nativeUserId, includePlatformScope),
    staleTime: 0,
  });
  const latest = await verifiedSession(nativeUserId);
  if (
    !sameNativeSession(session, latest) ||
    !belongsToSession(account, latest, includePlatformScope)
  )
    throw new Error("ACCOUNT_CHANGED");
  return account;
}

export function verifiedAccountProjection(
  queries: QueryClient,
  nativeUserId: string,
  includePlatformScope = false,
) {
  return verifiedProjection(queries, nativeUserId, [includePlatformScope]);
}

export function verifiedWorkspaceAccount(queries: QueryClient, nativeUserId: string) {
  return verifiedProjection(queries, nativeUserId, [false, true]);
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
    ? await verifiedAccountProjection(queries, data.session.user.id, true)
    : await verifiedWorkspaceAccount(queries, data.session.user.id);
  const latest = await verifiedSession(data.session.user.id);
  if (!sameNativeSession(data.session, latest)) throw new Error("ACCOUNT_CHANGED");
  if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
  return account;
}

export async function invalidateAccountProjections(queries: QueryClient) {
  const filters = { queryKey: accountQueryKeys.all() };
  const cache = queries.getQueryCache();
  const inFlight = cache.findAll(filters).filter((query) => query.state.fetchStatus !== "idle");
  const cancelling = queries.cancelQueries(filters, { silent: true });
  const invalidating = queries.invalidateQueries({ ...filters, refetchType: "none" });
  // Replace already-owned reads before awaiting cancellation. Query then hands
  // existing Router/Suspense waiters the replacement promise, instead of a
  // CancelledError (cold) or reverted old account data (warm).
  const replacements: Promise<unknown>[] = [];
  for (const query of inFlight) {
    // A synchronous cache subscriber may have evicted this projection.
    if (cache.get(query.queryHash) === query) replacements.push(query.fetch());
  }
  // Idle projections remain stale; their next guarded reader owns the fetch.
  await Promise.all([cancelling, invalidating, ...replacements]);
}
