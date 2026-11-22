import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { earningsKeys, invalidateEarningsViews } from "./earnings-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const otherCenter = { ...scope, centerId: "center-b" };
const otherOrg = { ...scope, orgId: "org-b" };
const otherActor = { ...scope, accountId: "actor-b" };
const directory = (source: typeof scope, period: string, cursor?: string) => [
  ...earningsKeys.directory(source),
  "earnings",
  "person-a",
  period,
  cursor,
];
const payments = (source: typeof scope, person: string, cursor?: string) => [
  ...earningsKeys.directory(source),
  "payments",
  person,
  "2026-10",
  cursor,
];
const infinite = () => ({
  pages: [{ revision: 1 }, { revision: 2 }],
  pageParams: [undefined, "old-cursor"],
});

it("M04 stales historical periods, people and cursors without crossing tenants", async () => {
  const queries = new QueryClient();
  const first = directory(scope, "2026-10");
  const old = directory(scope, "2026-09", "cursor-2");
  const paymentOld = payments(scope, "person-b", "cursor-3");
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const affected = [
    [...earningsKeys.visibleCounts(scope), "2026-09"],
    [...earningsKeys.paymentChain(scope), "payment-a"],
    ["earnings-agreement-status", scope, "person-a", ["agreement-a"]],
    ["instructor-earning-page", ...tenant, "person-a", "2026-09", "cursor-2"],
    ["instructor-account-payments", ...tenant, "person-a", "2026-09", "cursor-2"],
    ["instructor-account-agreements", ...tenant, "person-a", "cursor-2"],
    ["instructor-month-earnings", ...tenant, "person-a", "2026-09"],
  ];
  const foreign = [
    directory(otherCenter, "2026-09", "cursor-2"),
    payments(otherOrg, "person-b", "cursor-2"),
    payments(otherActor, "person-b", "cursor-2"),
  ];
  for (const key of [first, old, paymentOld, ...affected, ...foreign])
    queries.setQueryData(key, { revision: "before" });

  const oldReader = vi.fn(async () => ({ revision: "after" }));
  const stop = new QueryObserver(queries, {
    queryKey: old,
    queryFn: oldReader,
    staleTime: Infinity,
  }).subscribe(() => {});

  await invalidateEarningsViews(queries, scope);
  for (const key of [first, old, paymentOld, ...affected])
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of foreign) expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
  expect(oldReader).not.toHaveBeenCalled();

  const firstReader = vi.fn(async () => ({ revision: "after" }));
  await expect(
    queries.fetchQuery({ queryKey: first, queryFn: firstReader, staleTime: 0, retry: false }),
  ).resolves.toEqual({ revision: "after" });
  expect(oldReader).not.toHaveBeenCalled();
  await expect(
    queries.fetchQuery({ queryKey: old, queryFn: oldReader, staleTime: Infinity, retry: false }),
  ).resolves.toEqual({ revision: "after" });
  expect(firstReader).toHaveBeenCalledTimes(1);
  expect(oldReader).toHaveBeenCalledTimes(1);
  stop();
});

it("M04 trims infinite earnings continuations before invalidation", async () => {
  const queries = new QueryClient();
  const keys = [
    earningsKeys.instructorCatalog(scope),
    [...earningsKeys.paymentSource(scope), "person-a"],
    [...earningsKeys.paymentSource(scope), "person-b"],
  ];
  for (const key of keys) queries.setQueryData(key, infinite());
  const otherKey = earningsKeys.instructorCatalog(otherCenter);
  queries.setQueryData(otherKey, infinite());

  await invalidateEarningsViews(queries, scope);
  for (const key of keys) {
    expect(queries.getQueryData(key)).toEqual({
      pages: [{ revision: 1 }],
      pageParams: [undefined],
    });
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  }
  expect(queries.getQueryData(otherKey)).toEqual(infinite());
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});

it("M04 cancels late earnings reads without overwriting fresh data", async () => {
  const queries = new QueryClient();
  const first = payments(scope, "person-a");
  const foreign = payments(otherCenter, "person-a");
  queries.setQueryData(first, { revision: "before" });

  let resolveOld!: (value: { revision: string }) => void;
  const oldNetwork = new Promise<{ revision: string }>((resolve) => {
    resolveOld = resolve;
  });
  const oldRead = queries.fetchQuery({
    queryKey: first,
    queryFn: () => oldNetwork,
    staleTime: 0,
    retry: false,
  });
  let resolveForeign!: (value: { revision: string }) => void;
  const foreignNetwork = new Promise<{ revision: string }>((resolve) => {
    resolveForeign = resolve;
  });
  const foreignRead = queries.fetchQuery({
    queryKey: foreign,
    queryFn: () => foreignNetwork,
    retry: false,
  });

  await invalidateEarningsViews(queries, scope);
  await expect(oldRead).resolves.toEqual({ revision: "before" });
  expect(queries.getQueryState(first)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(foreign)?.fetchStatus).toBe("fetching");
  await expect(
    queries.fetchQuery({
      queryKey: first,
      queryFn: async () => ({ revision: "after" }),
      staleTime: 0,
      retry: false,
    }),
  ).resolves.toEqual({ revision: "after" });
  resolveOld({ revision: "late-before" });
  resolveForeign({ revision: "foreign-after" });
  await expect(foreignRead).resolves.toEqual({ revision: "foreign-after" });
  expect(queries.getQueryData(first)).toEqual({ revision: "after" });
  expect(queries.getQueryData(foreign)).toEqual({ revision: "foreign-after" });
});

it("M04 denied first-page readback never makes an old cursor fresh", async () => {
  const queries = new QueryClient();
  const first = directory(scope, "2026-10");
  const old = directory(scope, "2026-10", "cursor-2");
  queries.setQueryData(first, { revision: "before" });
  queries.setQueryData(old, { revision: "before" });
  await invalidateEarningsViews(queries, scope);

  const denied = new Error("FORBIDDEN");
  await expect(
    queries.fetchQuery({
      queryKey: first,
      queryFn: async () => {
        throw denied;
      },
      staleTime: 0,
      retry: false,
    }),
  ).rejects.toBe(denied);
  expect(queries.getQueryState(first)?.status).toBe("error");
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryData(old)).toEqual({ revision: "before" });
});
