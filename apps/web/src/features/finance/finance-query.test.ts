import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { financeKeys, invalidateFinanceViews } from "./finance-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const otherCenter = { ...scope, centerId: "center-b" };
const otherOrg = { ...scope, orgId: "org-b" };
const otherActor = { ...scope, accountId: "actor-b" };
const tenant = [scope.accountId, scope.orgId, scope.centerId];

function cache(queries: QueryClient, key: readonly unknown[]) {
  queries.setQueryData(key, { revision: 1 });
}

it("M05 invalidates affected financial pages, monetary reports and currency-only credit reads", async () => {
  const queries = new QueryClient();
  const first = [
    ...financeKeys.directory(scope),
    "movements",
    "November",
    { kind: "sale" },
    undefined,
  ];
  const old = [...financeKeys.directory(scope), "debts", "October", { query: "A" }, "cursor-2"];
  const person = [...financeKeys.person(scope, "person-a", "TRY"), "cursor-2"];
  const tryCredit = financeKeys.creditDebt(scope, "person-a", "TRY");
  const mixedCredit = [
    "finance-directory-credit-debts",
    ...tenant,
    "old-as-of",
    ["people:person-a:credit:TRY", "people:person-a:credit:EUR"],
  ];
  const profile = ["profile-person", ...tenant, "person-a"];
  const people = ["people", ...tenant, "active", "cursor-2"];
  const rights = ["member-entitlements", ...tenant, "person-a", "all"];
  const moneySummary = ["report-finance-summary", scope, "November"];
  const sales = ["report-view", scope, "weeks", "sales", "week"];
  const collections = ["report-view", scope, "collections", "collection_breakdown", "person"];
  const affected = [
    first,
    old,
    person,
    tryCredit,
    mixedCredit,
    profile,
    people,
    rights,
    moneySummary,
    sales,
    collections,
  ];
  const unrelated = [
    [...financeKeys.person(scope, "person-a", "USD"), "cursor-2"],
    financeKeys.creditDebt(scope, "person-a", "EUR"),
    financeKeys.creditDebt(scope, "person-b", "TRY"),
    [...financeKeys.person(otherCenter, "person-a", "TRY"), "cursor-2"],
    [...financeKeys.directory(otherOrg), "debts", "November"],
    [...financeKeys.directory(otherActor), "movements", "November"],
    ["report-finance-summary", otherCenter, "November"],
    ["report-view", otherOrg, "weeks", "sales"],
    ["report-view", scope, "sessions", "session_metrics"],
    ["report-view", scope, "balances", "instructor_balances"],
    ["report-view", scope, "crm", "crm_conversion"],
    ["profile-person", ...tenant, "person-b"],
  ];
  for (const key of [...affected, ...unrelated]) cache(queries, key);

  await invalidateFinanceViews(queries, scope, "person-a", "TRY");
  for (const key of affected) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of unrelated) expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
});

it("M05 leaves active readers idle and only re-reads the required first page", async () => {
  const queries = new QueryClient();
  const first = [...financeKeys.directory(scope), "movements", "November", {}, undefined];
  const old = [...financeKeys.directory(scope), "movements", "November", {}, "cursor-2"];
  const person = [...financeKeys.person(scope, "person-a", "TRY"), undefined];
  const euro = financeKeys.creditDebt(scope, "person-a", "EUR");
  const firstRead = vi.fn(async () => ({ revision: 1 }));
  const oldRead = vi.fn(async () => ({ revision: 1 }));
  const personRead = vi.fn(async () => ({ revision: 1 }));
  const euroRead = vi.fn(async () => ({ revision: 1 }));
  const records = [
    { queryKey: first, queryFn: firstRead },
    { queryKey: old, queryFn: oldRead },
    { queryKey: person, queryFn: personRead },
    { queryKey: euro, queryFn: euroRead },
  ];
  for (const record of records) await queries.fetchQuery({ ...record, staleTime: Infinity });
  const unsubscribers = records.map((record) =>
    new QueryObserver(queries, { ...record, staleTime: Infinity }).subscribe(() => {}),
  );

  await invalidateFinanceViews(queries, scope, "person-a", "TRY");
  for (const read of [firstRead, oldRead, personRead, euroRead])
    expect(read).toHaveBeenCalledTimes(1);
  expect(queries.getQueryState(first)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(person)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(euro)?.isInvalidated).toBe(false);

  const firstReadback = vi.fn(async () => ({ revision: 2 }));
  await queries.fetchQuery({ queryKey: first, queryFn: firstReadback, staleTime: Infinity });
  expect(queries.getQueryData(first)).toEqual({ revision: 2 });
  expect(queries.getQueryState(first)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(oldRead).toHaveBeenCalledTimes(1);
  const oldReadback = vi.fn(async () => ({ revision: 2 }));
  await queries.fetchQuery({ queryKey: old, queryFn: oldReadback, staleTime: Infinity });
  expect(queries.getQueryData(old)).toEqual({ revision: 2 });
  expect(oldReadback).toHaveBeenCalledTimes(1);
  for (const unsubscribe of unsubscribers) unsubscribe();
});

it("M05 aborts a pre-write financial directory read before invalidating its cache", async () => {
  const queries = new QueryClient();
  const key = [...financeKeys.directory(scope), "movements", "November", {}, "cursor-2"];
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  const aborted = vi.fn();
  const pending = queries.fetchQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      new Promise<{ revision: number }>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted();
            reject(new Error("READ_ABORTED"));
          },
          { once: true },
        );
        started();
      }),
    retry: false,
  });
  await waiting;
  await invalidateFinanceViews(queries, scope, "person-a", "TRY");
  expect(aborted).toHaveBeenCalledTimes(1);
  expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  await expect(pending).rejects.toBeDefined();
});
