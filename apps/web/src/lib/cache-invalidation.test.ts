import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import {
  cacheVerifiedReadback,
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

it("cancels pre-write reads while foreign requests stay active", async () => {
  const queries = new QueryClient();
  const family = ["directory", "actor-a", "org-a", "center-a"];
  const old = [...family, "cursor-2"];
  const foreign = ["directory", "actor-a", "org-a", "center-b", "cursor-2"];
  queries.setQueryData(old, { revision: "before" });

  let finishOld!: (value: { revision: string }) => void;
  const oldNetwork = new Promise<{ revision: string }>((resolve) => {
    finishOld = resolve;
  });
  let finishForeign!: (value: { revision: string }) => void;
  const foreignNetwork = new Promise<{ revision: string }>((resolve) => {
    finishForeign = resolve;
  });
  const oldRequest = queries.fetchQuery({
    queryKey: old,
    queryFn: () => oldNetwork,
    staleTime: 0,
    retry: false,
  });
  const foreignRequest = queries.fetchQuery({
    queryKey: foreign,
    queryFn: () => foreignNetwork,
    retry: false,
  });

  await invalidateCachedFamilies(queries, [family]);
  await expect(oldRequest).resolves.toEqual({ revision: "before" });
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(foreign)?.fetchStatus).toBe("fetching");

  const freshPage = { revision: "after" };
  await expect(
    queries.fetchQuery({
      queryKey: old,
      queryFn: async () => freshPage,
      staleTime: 0,
      retry: false,
    }),
  ).resolves.toEqual(freshPage);
  finishOld({ revision: "late-before" });
  finishForeign({ revision: "foreign-after" });
  await expect(foreignRequest).resolves.toEqual({ revision: "foreign-after" });
  expect(queries.getQueryData(old)).toEqual(freshPage);
  expect(queries.getQueryData(foreign)).toEqual({ revision: "foreign-after" });
  expect(queries.getQueryState(foreign)?.isInvalidated).toBe(false);
});

it("keeps a verified readback when the previous exact reader finishes late", async () => {
  const queries = new QueryClient();
  const key = ["profile-rights", "actor-a", "org-a", "center-a", "student-a"];
  const other = [...key.slice(0, -1), "student-b"];
  let complete!: (value: string) => void;
  const pending = queries.fetchQuery({
    queryKey: key,
    queryFn: () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  });
  const cancelled = pending.catch(() => undefined);
  queries.setQueryData(other, "other rights");
  await cacheVerifiedReadback(queries, key, "verified rights");
  complete("old rights");
  await cancelled;
  expect(queries.getQueryData(key)).toBe("verified rights");
  expect(queries.getQueryData(other)).toBe("other rights");
});

it("cancels and trims affected infinite catalogs before marking them stale", async () => {
  const queries = new QueryClient();
  const key = ["event-choices", "actor-a", "org-a", "center-a", "products"];
  const foreign = ["event-choices", "actor-a", "org-a", "center-b", "products"];
  const catalog = { pages: [1, 2], pageParams: [undefined, "old-cursor"] };
  queries.setQueryData(key, catalog);
  queries.setQueryData(foreign, catalog);
  await invalidateCachedFamilies(queries, [key], [key]);
  expect(queries.getQueryData(key)).toEqual({ pages: [1], pageParams: [undefined] });
  expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryData(foreign)).toEqual(catalog);
  expect(queries.getQueryState(foreign)?.isInvalidated).toBe(false);
});
