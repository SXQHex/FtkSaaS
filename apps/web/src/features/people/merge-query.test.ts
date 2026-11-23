import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { invalidateMergeViews } from "./merge-query";
import { invalidatePersonIdentityViews } from "./people-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const centerB = { ...scope, centerId: "center-b" };
const orgB = { ...scope, orgId: "org-b" };
const actorB = { ...scope, accountId: "actor-b" };
const key = (s: typeof scope, cursor?: string) =>
  ["merge-directory", s.accountId, s.orgId, s.centerId, "pending", "", cursor] as const;

it("M01 merge invalidation stays scoped without cursor refetch", async () => {
  const queries = new QueryClient();
  const first = key(scope);
  const old = key(scope, "cursor-2");
  const alias = ["finance", scope.accountId, scope.orgId, centerB.centerId, "person-a", "TRY"];
  const otherCenter = key(centerB, "cursor-2");
  const unrelated = [
    key(orgB, "cursor-2"),
    key(actorB, "cursor-2"),
    ["reports", scope.accountId, scope.orgId, scope.centerId],
  ];
  for (const k of [first, old, alias, otherCenter, ...unrelated])
    queries.setQueryData(k, { revision: "before" });

  const oldReader = vi.fn(async () => ({ revision: "after" }));
  const unsubscribe = new QueryObserver(queries, {
    queryKey: old,
    queryFn: oldReader,
    staleTime: Infinity,
  }).subscribe(() => {});
  await invalidateMergeViews(queries, scope);

  for (const k of [first, old, alias, otherCenter])
    expect(queries.getQueryState(k)?.isInvalidated).toBe(true);
  for (const k of unrelated) expect(queries.getQueryState(k)?.isInvalidated).toBe(false);
  expect(oldReader).not.toHaveBeenCalled();

  const firstRead = vi.fn(async () => ({ revision: "first-fresh" }));
  await queries.fetchQuery({ queryKey: first, queryFn: firstRead, staleTime: 0, retry: false });
  expect(firstRead).toHaveBeenCalledTimes(1);
  expect(oldReader).not.toHaveBeenCalled();

  await queries.fetchQuery({ queryKey: old, queryFn: oldReader, staleTime: Infinity });
  expect(oldReader).toHaveBeenCalledTimes(1);
  expect(queries.getQueryData(old)).toEqual({ revision: "after" });
  unsubscribe();
});

it("invalidates identity-dependent finance, product sales and earnings views across this organization", async () => {
  const queries = new QueryClient();
  const tenant = [scope.accountId, scope.orgId, centerB.centerId];
  const affected = [
    ["profile-person", ...tenant, "person-a"],
    ["finance-directory", ...tenant, "debts", { query: "before" }, "cursor-2"],
    ["product-history", ...tenant, "product", "sales", "cursor-2"],
    ["event-choices", ...tenant, "people"],
    ["lesson-requests", ...tenant, "pending", "cursor-2"],
    ["member-private-lessons", ...tenant, "person-b", "instructors"],
    ["overview-participants", ...tenant, "session", 3],
    ["settings-team-directory", centerB, "center", "instructor"],
    ["earnings-directory", centerB, "instructors", "person-a"],
    ["report-view", centerB, "collections", "collection_breakdown", "person"],
  ];
  const unrelated = [
    ["profile-person", ...tenant, "person-b"],
    ["product-history", ...tenant, "product", "versions", "cursor-2"],
    ["event-choices", ...tenant, "products"],
    ["member-private-lessons", ...tenant, "person-b", "list", "cursor-2"],
    ["earnings-directory", centerB, "instructors", "person-b"],
    ["report-view", centerB, "collections", "collection_breakdown", "product"],
    ["report-view", actorB, "collections", "collection_breakdown", "person"],
    ["finance-directory", scope.accountId, orgB.orgId, centerB.centerId, "debts"],
  ];
  for (const k of [...affected, ...unrelated]) queries.setQueryData(k, { revision: "before" });

  await invalidatePersonIdentityViews(queries, scope, "person-a");

  for (const k of affected) expect(queries.getQueryState(k)?.isInvalidated).toBe(true);
  for (const k of unrelated) expect(queries.getQueryState(k)?.isInvalidated).toBe(false);
});

it("refreshes alias-dependent readers only when the decision changes identity", async () => {
  const queries = new QueryClient();
  const tenant = [scope.accountId, scope.orgId, centerB.centerId];
  const aliases = [
    ["finance-directory", ...tenant, "debts"],
    ["member-entitlements", ...tenant, "person-a", "debt"],
    ["product-history", ...tenant, "product", "sales"],
    ["report-view", centerB, "collections", "collection_breakdown", "person"],
  ];
  const directory = key(centerB, "cursor-2");
  for (const k of [directory, ...aliases]) queries.setQueryData(k, { revision: "before" });

  await invalidateMergeViews(queries, scope, false);
  expect(queries.getQueryState(directory)?.isInvalidated).toBe(true);
  for (const k of aliases) expect(queries.getQueryState(k)?.isInvalidated).toBe(false);

  await invalidateMergeViews(queries, scope, true);
  for (const k of aliases) expect(queries.getQueryState(k)?.isInvalidated).toBe(true);
});

it("cancels pre-merge late replies while a foreign organization remains fetching", async () => {
  const queries = new QueryClient();
  const first = key(scope);
  const foreign = key(orgB);
  queries.setQueryData(first, { revision: "before" });

  let finishOld!: (value: { revision: string }) => void;
  const oldNetwork = new Promise<{ revision: string }>((resolve) => {
    finishOld = resolve;
  });
  let finishForeign!: (value: { revision: string }) => void;
  const foreignNetwork = new Promise<{ revision: string }>((resolve) => {
    finishForeign = resolve;
  });
  const pending = queries.fetchQuery({
    queryKey: first,
    queryFn: () => oldNetwork,
    staleTime: 0,
    retry: false,
  });
  const otherPending = queries.fetchQuery({
    queryKey: foreign,
    queryFn: () => foreignNetwork,
    retry: false,
  });

  await invalidateMergeViews(queries, scope);
  await expect(pending).resolves.toEqual({ revision: "before" });
  expect(queries.getQueryState(foreign)?.fetchStatus).toBe("fetching");

  await queries.fetchQuery({
    queryKey: first,
    queryFn: async () => ({ revision: "fresh" }),
    staleTime: 0,
    retry: false,
  });
  finishOld({ revision: "late-before" });
  finishForeign({ revision: "foreign" });
  await expect(otherPending).resolves.toEqual({ revision: "foreign" });
  expect(queries.getQueryData(first)).toEqual({ revision: "fresh" });
  expect(queries.getQueryData(foreign)).toEqual({ revision: "foreign" });
});
