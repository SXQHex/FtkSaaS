import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { accessKeys, invalidateAccessDirectories } from "./access-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const otherCenter = { ...scope, centerId: "center-b" };
const otherOrg = { ...scope, orgId: "org-b" };
const otherActor = { ...scope, accountId: "actor-b" };
const invitationKey = (source: typeof scope, status: string, cursor?: string) => [
  ...accessKeys.invitations(source),
  status,
  "Europe/Istanbul",
  cursor,
];
const accountKey = (source: typeof scope, status: string, cursor?: string) => [
  ...accessKeys.accounts(source),
  status,
  "search",
  cursor,
];

it("M03 stales access filter/cursor variants only within the actor and center", async () => {
  const queries = new QueryClient();
  const first = invitationKey(scope, "open");
  const old = invitationKey(scope, "closed", "cursor-2");
  const accountOld = accountKey(scope, "linked", "cursor-3");
  const foreign = [
    invitationKey(otherCenter, "open", "cursor-2"),
    accountKey(otherOrg, "linked", "cursor-2"),
    accountKey(otherActor, "unlinked", "cursor-2"),
  ];
  for (const key of [first, old, accountOld, ...foreign])
    queries.setQueryData(key, { revision: "before" });
  const oldReader = vi.fn(async () => ({ revision: "after" }));
  const stop = new QueryObserver(queries, {
    queryKey: old,
    queryFn: oldReader,
    staleTime: Infinity,
  }).subscribe(() => {});

  await invalidateAccessDirectories(queries, scope);
  for (const key of [first, old, accountOld])
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

it("M03 cancels late reads without overwriting fresh data or other tenants", async () => {
  const queries = new QueryClient();
  const first = accountKey(scope, "all");
  const foreign = accountKey(otherCenter, "all");
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

  await invalidateAccessDirectories(queries, scope);
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

it("M03 a denied required first-page read never makes an old cursor fresh", async () => {
  const queries = new QueryClient();
  const first = invitationKey(scope, "open");
  const old = invitationKey(scope, "open", "cursor-2");
  queries.setQueryData(first, { revision: "before" });
  queries.setQueryData(old, { revision: "before" });
  await invalidateAccessDirectories(queries, scope);

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
