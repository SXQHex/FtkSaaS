import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import {
  invalidateAndReadFirstPage,
  invalidateCachedFamilies,
  retainFirstInfinitePage,
} from "./cache-invalidation";

it("invalidates scoped filter/cursor caches without active query refetches", async () => {
  const queries = new QueryClient();
  const family = ["directory", "actor-a", "org-a", "center-a"];
  const first = [...family, "pending", undefined];
  const old = [...family, "pending", "cursor-2"];
  const alternate = [...family, "all", "cursor-3"];
  const anotherTenant = ["directory", "actor-a", "org-a", "center-b"];
  const activeReader = vi.fn(async () => ({ version: 1 }));
  await queries.fetchQuery({ queryKey: old, queryFn: activeReader });
  const unobserve = new QueryObserver(queries, {
    queryKey: old,
    queryFn: activeReader,
    staleTime: Infinity,
  }).subscribe(() => {});
  queries.setQueryData(alternate, { version: 1 });
  queries.setQueryData(anotherTenant, { version: 1 });
  const firstReader = vi.fn(async () => ({ version: 2 }));
  await expect(
    invalidateAndReadFirstPage({
      queries,
      families: [family],
      firstPageKey: first,
      readFirstPage: firstReader,
    }),
  ).resolves.toEqual({ version: 2 });
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(alternate)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(anotherTenant)?.isInvalidated).toBe(false);
  expect(queries.getQueryData(first)).toEqual({ version: 2 });
  expect(activeReader).toHaveBeenCalledTimes(1);
  expect(firstReader).toHaveBeenCalledTimes(1);
  unobserve();
});

it("does not accept a page readback failure as a successful mutation refresh", async () => {
  const queries = new QueryClient();
  const family = ["directory", "actor", "org", "center"];
  const stale = [...family, "cursor-2"];
  queries.setQueryData(stale, { version: 1 });
  const denied = new Error("FORBIDDEN");
  await expect(
    invalidateAndReadFirstPage({
      queries,
      families: [family],
      firstPageKey: [...family, undefined],
      readFirstPage: async () => {
        throw denied;
      },
    }),
  ).rejects.toBe(denied);
  expect(queries.getQueryState(stale)?.isInvalidated).toBe(true);
});

it("rejects unscoped blanket invalidations", async () => {
  const queries = new QueryClient();
  const error = "QUERY_INVALIDATION_SCOPE_REQUIRED";
  await expect(invalidateCachedFamilies(queries, [["directory"]])).rejects.toThrow(error);
  await expect(invalidateCachedFamilies(queries, [])).rejects.toThrow(error);
});

it("retains only the first cached infinite page before native readback", async () => {
  const queries = new QueryClient();
  const key = ["document-catalog", "actor", "org", "center"];
  queries.setQueryData(key, {
    pages: [{ items: [1] }, { items: [2] }],
    pageParams: [undefined, "cursor-2"],
  });
  retainFirstInfinitePage(queries, key);
  expect(queries.getQueryData(key)).toEqual({
    pages: [{ items: [1] }],
    pageParams: [undefined],
  });
});
