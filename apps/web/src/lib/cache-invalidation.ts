import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

const privateQueryRevisions = new WeakMap<QueryClient, number>();
const privateReadbackRevisions = new WeakMap<QueryClient, number>();

export function privateQueryRevision(queries: QueryClient) {
  return privateQueryRevisions.get(queries) ?? 0;
}

export function advancePrivateQueryRevision(queries: QueryClient) {
  privateQueryRevisions.set(queries, privateQueryRevision(queries) + 1);
  advancePrivateReadbackRevision(queries);
}

function advancePrivateReadbackRevision(queries: QueryClient) {
  privateReadbackRevisions.set(queries, (privateReadbackRevisions.get(queries) ?? 0) + 1);
}

export function clearPrivateQueries(queries: QueryClient) {
  advancePrivateReadbackRevision(queries);
  queries.clear();
}

export function capturePrivateReadback(queries: QueryClient) {
  const revision = privateReadbackRevisions.get(queries);
  return () => {
    if (privateReadbackRevisions.get(queries) !== revision)
      throw new Error("PRIVATE_QUERY_CHANGED");
  };
}

// The caller owns which native domain operation affected which tenant/key family.
// Never invalidate the whole QueryClient or refetch cached continuation pages.
export async function invalidateCachedFamilies(
  queries: QueryClient,
  families: readonly QueryKey[],
  infiniteFamilies: readonly QueryKey[] = [],
) {
  if (!families.length || families.some((key) => key.length < 2))
    throw new Error("QUERY_INVALIDATION_SCOPE_REQUIRED");
  // Read requests begun before a confirmed native write must not complete into
  // a fresh cache after the mandatory first-page readback. Cancel only the
  // affected Query readers; native writers, receipts and status are separate.
  const revision = privateReadbackRevisions.get(queries);
  await Promise.all(families.map((queryKey) => queries.cancelQueries({ queryKey })));
  if (privateReadbackRevisions.get(queries) !== revision) return;
  for (const family of infiniteFamilies) {
    for (const { queryKey } of queries.getQueryCache().findAll({ queryKey: family }))
      retainFirstInfinitePage(queries, queryKey);
  }
  await Promise.all(
    families.map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}

export async function cacheVerifiedReadback<T>(queries: QueryClient, queryKey: QueryKey, data: T) {
  const assertCurrent = capturePrivateReadback(queries);
  const cache = queries.getQueryCache();
  const filter = { queryKey, exact: true };
  const source = cache.find(filter);
  const cancelling = queries.cancelQueries(filter);
  assertCurrent();
  if (cache.find(filter) !== source) throw new Error("PRIVATE_QUERY_CHANGED");
  queries.setQueryData(queryKey, data);
  await cancelling;
}

export async function readIntoCurrentQuery<T>(
  queries: QueryClient,
  queryKey: QueryKey,
  read: () => Promise<T>,
  select: (result: T) => unknown = (result) => result,
): Promise<T> {
  const filters = { queryKey, exact: true };
  const assertCurrent = capturePrivateReadback(queries);
  const source = queries.getQueryCache().find(filters);
  const result = await read();
  assertCurrent();
  // Session handoff removes private queries and can recreate the same key.
  // A read begun against the previous query must never populate the new one.
  if (!source || queries.getQueryCache().find(filters) !== source)
    throw new Error("PRIVATE_QUERY_CHANGED");
  await cacheVerifiedReadback(queries, queryKey, select(result));
  return result;
}

export async function invalidateAndReadFirstPage<T>({
  queries,
  families,
  firstPageKey,
  readFirstPage,
  infiniteFamilies,
}: {
  queries: QueryClient;
  families: readonly QueryKey[];
  firstPageKey: QueryKey;
  readFirstPage: (context: { signal: AbortSignal }) => Promise<T>;
  infiniteFamilies?: readonly QueryKey[];
}): Promise<T> {
  const assertCurrent = capturePrivateReadback(queries);
  await invalidateCachedFamilies(queries, families, infiniteFamilies);
  assertCurrent();
  // The mandatory page readback must not use a stale continuation cursor.
  // Failure propagates to the native command's saved-unread recovery state.
  return queries.fetchQuery({
    queryKey: firstPageKey,
    queryFn: readFirstPage,
    staleTime: 0,
    retry: false,
  });
}

export function retainFirstInfinitePage(queries: QueryClient, queryKey: QueryKey) {
  // InfiniteQuery normally refetches *all* cached pages. The server may have
  // invalidated its old continuation cursors after a committed mutation.
  queries.setQueryData<InfiniteData<unknown, unknown>>(queryKey, (current) =>
    current && current.pages.length > 1
      ? { ...current, pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1) }
      : current,
  );
}
