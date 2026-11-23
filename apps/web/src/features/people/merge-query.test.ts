import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { invalidateMergeViews } from "./merge-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const centerB = { ...scope, centerId: "center-b" };
const orgB = { ...scope, orgId: "org-b" };
const actorB = { ...scope, accountId: "actor-b" };
const key = (s: typeof scope, cursor?: string) =>
  ["merge-directory", s.accountId, s.orgId, s.centerId, "pending", "", cursor] as const;

it("marks old merge cursors and same-org aliases stale without refetching or crossing tenants", async () => {
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
