import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

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
  await Promise.all(families.map((queryKey) => queries.cancelQueries({ queryKey })));
  for (const family of infiniteFamilies) {
    for (const { queryKey } of queries.getQueryCache().findAll({ queryKey: family }))
      retainFirstInfinitePage(queries, queryKey);
  }
  await Promise.all(
    families.map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}

export async function cacheVerifiedReadback<T>(queries: QueryClient, queryKey: QueryKey, data: T) {
  const cancelling = queries.cancelQueries({ queryKey, exact: true });
  queries.setQueryData(queryKey, data);
  await cancelling;
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
  readFirstPage: () => Promise<T>;
  infiniteFamilies?: readonly QueryKey[];
}): Promise<T> {
  await invalidateCachedFamilies(queries, families, infiniteFamilies);
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
