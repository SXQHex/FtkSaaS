import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { earningsKeys, invalidateEarningsViews } from "./earnings-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const otherCenter = { ...scope, centerId: "center-b" };
const otherActor = { ...scope, accountId: "actor-b" };
const otherOrg = { ...scope, orgId: "org-b" };

it("M04 invalidates historical earnings cursors without a tenant spill", async () => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const directory = earningsKeys.directory(scope);
  const first = [...directory, "earnings", "person-a", "2026-10", undefined];
  const old = [...directory, "earnings", "person-a", "2026-10", "old-cursor"];
  const anotherPeriod = [...directory, "payments", "person-b", "2026-11", "other-cursor"];
  const watchedRead = vi.fn(async () => ({ revision: 1 }));
  const unsubscribe = new QueryObserver(queries, {
    queryKey: first,
    queryFn: watchedRead,
    staleTime: Infinity,
  }).subscribe(() => {});
  await queries.fetchQuery({ queryKey: first, queryFn: watchedRead, staleTime: Infinity });

  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const affected = [
    old,
    anotherPeriod,
    [...earningsKeys.visibleCounts(scope), "2026-10", { items: [] }],
    [...earningsKeys.paymentChain(scope), "payment-a"],
    ["earnings-agreement-status", scope, "person-a", ["agreement-a"]],
    ["instructor-earning-page", ...tenant, "person-a", "2026-10", "cursor-2"],
    ["instructor-account-payments", ...tenant, "person-a", "2026-10", "cursor-2"],
    ["instructor-account-agreements", ...tenant, "person-a", "cursor-2"],
    ["instructor-month-earnings", ...tenant, "person-a", "2026-10"],
  ];
  for (const key of affected) queries.setQueryData(key, { revision: 1 });

  const catalog = earningsKeys.instructorCatalog(scope);
  const source = [...earningsKeys.paymentSource(scope), "person-a"];
  const pages = {
    pages: [{ revision: 1 }, { revision: 2 }],
    pageParams: [undefined, "old-cursor"],
  };
  for (const key of [catalog, source]) queries.setQueryData(key, pages);

  const untouched = [
    [...earningsKeys.directory(otherCenter), "payments", "person-a", "cursor"],
    [...earningsKeys.directory(otherActor), "payments", "person-a", "cursor"],
    [...earningsKeys.directory(otherOrg), "payments", "person-a", "cursor"],
    [...earningsKeys.paymentSource(otherCenter), "person-a"],
    ["instructor-account-payments", otherActor.accountId, otherActor.orgId, otherActor.centerId],
  ];
  for (const key of untouched) queries.setQueryData(key, { revision: 7 });

  await invalidateEarningsViews(queries, scope);

  for (const key of [first, ...affected, catalog, source])
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of untouched) {
    expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
    expect(queries.getQueryData(key)).toEqual({ revision: 7 });
  }
  for (const key of [catalog, source])
    expect(queries.getQueryData(key)).toEqual({
      pages: [{ revision: 1 }],
      pageParams: [undefined],
    });
  expect(watchedRead).toHaveBeenCalledTimes(1);

  const freshRead = vi.fn(async () => ({ revision: 2 }));
  expect(
    await queries.fetchQuery({ queryKey: old, queryFn: freshRead, staleTime: Infinity }),
  ).toEqual({ revision: 2 });
  expect(freshRead).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("M04 cancels pre-write reads before first-page readback", async () => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = [...earningsKeys.directory(scope), "payments", "", undefined, undefined];
  let releaseOld!: (value: { revision: number }) => void;
  const oldRead = vi.fn(
    () =>
      new Promise<{ revision: number }>((resolve) => {
        releaseOld = resolve;
      }),
  );
  const pending = queries.fetchQuery({ queryKey: key, queryFn: oldRead }).catch(() => undefined);
  expect(oldRead).toHaveBeenCalledTimes(1);

  const otherKey = [...earningsKeys.directory(otherCenter), "payments", "", undefined, undefined];
  queries.setQueryData(otherKey, { revision: 7 });
  await invalidateEarningsViews(queries, scope);

  const freshRead = vi.fn(async () => ({ revision: 2 }));
  expect(
    await queries.fetchQuery({ queryKey: key, queryFn: freshRead, staleTime: 0 }),
  ).toEqual({ revision: 2 });
  releaseOld({ revision: 1 });
  await pending;

  expect(queries.getQueryData(key)).toEqual({ revision: 2 });
  expect(queries.getQueryData(otherKey)).toEqual({ revision: 7 });
  expect(freshRead).toHaveBeenCalledTimes(1);
});
