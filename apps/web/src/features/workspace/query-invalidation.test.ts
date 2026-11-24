import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { invalidatePeoplePages, peopleKeys } from "../people/people-query";
import {
  affectedProductQueryFamilies,
  invalidateProductPages,
  productsKeys,
} from "../products/products-query";
import { invalidateLeadPages, leadsKeys } from "../leads/leads-query";
import { financeKeys, invalidateFinanceViews } from "../finance/finance-query";
import {
  invalidateAttendanceEffects,
  invalidateSessionDetailViews,
  sessionDetailKeys,
} from "../session-detail/session-detail-query";
import {
  invalidateMemberPrivateLessonLists,
  memberPrivateLessonKeys,
} from "../member-private-lessons/member-private-lessons-query";
import { invalidateDocumentDirectoryViews } from "../documents/documents-query";
import { accessKeys, invalidateAccessDirectories } from "../access/access-query";
import { earningsKeys, invalidateEarningsViews } from "../earnings/earnings-query";
import {
  invalidateMemberReservationViews,
  memberReservationKeys,
} from "../member-reservations/member-reservations-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const other = { ...scope, centerId: "center-b" };

function cache(queries: QueryClient, key: readonly unknown[]) {
  queries.setQueryData(key, { fixture: true });
}

it("invalidates all people and product cursor/filter pages without crossing centers", async () => {
  const queries = new QueryClient();
  const people = peopleKeys.center(scope);
  const products = productsKeys.management(scope);
  cache(queries, [...people, "active", "cursor-1"]);
  cache(queries, [...people, "inactive", "cursor-2"]);
  cache(queries, [...products, "active", "cursor-1"]);
  const otherProductPage = [...productsKeys.management(other), "active", "cursor-1"];
  cache(queries, otherProductPage);
  await invalidatePeoplePages(queries, scope);
  await invalidateProductPages(queries, scope);
  expect(queries.getQueryState([...people, "active", "cursor-1"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState([...people, "inactive", "cursor-2"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState([...products, "active", "cursor-1"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherProductPage)?.isInvalidated).toBe(false);
});

it("marks every lead list variant stale without hiding a different center", async () => {
  const queries = new QueryClient();
  for (const key of [
    leadsKeys.directory(scope),
    leadsKeys.followups(scope),
    leadsKeys.sourceFollowups(scope),
    leadsKeys.applications(scope),
    leadsKeys.summary(scope),
  ]) {
    cache(queries, [...key, "cursor-2"]);
  }
  const otherLeadsPage = [...leadsKeys.directory(other), "cursor-2"];
  cache(queries, otherLeadsPage);
  await invalidateLeadPages(queries, scope);
  for (const key of [
    leadsKeys.directory(scope),
    leadsKeys.followups(scope),
    leadsKeys.sourceFollowups(scope),
    leadsKeys.applications(scope),
    leadsKeys.summary(scope),
  ]) {
    expect(queries.getQueryState([...key, "cursor-2"])?.isInvalidated).toBe(true);
  }
  expect(queries.getQueryState(otherLeadsPage)?.isInvalidated).toBe(false);
});

it("marks reservation and related tenant caches stale", async () => {
  const queries = new QueryClient();
  const member = "person-a";
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const affected = [
    [...memberReservationKeys.person(scope, member), "upcoming", "cursor-1"],
    [...memberReservationKeys.person(scope, member), "offers", "cursor-2"],
    ["member-classes", ...tenant, member, "lessons"],
    ["member-entitlements", ...tenant, member, "rights"],
    ["profile-reservations", ...tenant, member, "past"],
    ["session-detail", ...tenant, "session-a"],
    ["schedule-range", ...tenant, "range-a"],
    ["people", ...tenant, "with-member-summary"],
  ];
  for (const key of affected) cache(queries, key);
  const unrelated = [...memberReservationKeys.person(other, member), "upcoming"];
  cache(queries, unrelated);
  await invalidateMemberReservationViews(queries, scope, member);
  for (const key of affected) {
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  }
  expect(queries.getQueryState(unrelated)?.isInvalidated).toBe(false);
});

it("invalidates finance cursor pages for the confirmed person", async () => {
  const queries = new QueryClient();
  const key = financeKeys.person(scope, "person-a", "TRY");
  const otherKey = financeKeys.person(other, "person-a", "TRY");
  cache(queries, [...key, "cursor-1"]);
  cache(queries, [...key, "cursor-2"]);
  const peoplePage = ["people", scope.accountId, scope.orgId, scope.centerId, "active"];
  cache(queries, peoplePage);
  cache(queries, otherKey);
  const otherCurrency = financeKeys.person(scope, "person-a", "USD");
  cache(queries, [...otherCurrency, "cursor-2"]);
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const directoryOld = ["finance-directory", ...tenant, "credits", "cursor-2"];
  cache(queries, directoryOld);
  const debtsOld = ["finance-directory-credit-debts", ...tenant, "old-period"];
  cache(queries, debtsOld);
  await invalidateFinanceViews(queries, scope, "person-a", "TRY");
  expect(queries.getQueryState([...key, "cursor-1"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState([...key, "cursor-2"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState(peoplePage)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
  expect(queries.getQueryState([...otherCurrency, "cursor-2"])?.isInvalidated).toBe(false);
  expect(queries.getQueryState(directoryOld)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(debtsOld)?.isInvalidated).toBe(true);
});

it("M01 invalidates old private-lesson cursors without crossing tenants", async () => {
  const queries = new QueryClient();
  const prefix = memberPrivateLessonKeys.person(scope, "person-a");
  const current = [...prefix, "list", undefined, undefined];
  const old = [...prefix, "list", "cursor-2", undefined];
  const anotherPerson = [...memberPrivateLessonKeys.person(scope, "person-b"), "list", "cursor-2"];
  const otherCenter = [...memberPrivateLessonKeys.person(other, "person-a"), "list", "cursor-2"];
  const liveRead = vi.fn(async () => ({ version: 1 }));
  await queries.fetchQuery({ queryKey: current, queryFn: liveRead, staleTime: Infinity });
  const unsubscribe = new QueryObserver(queries, {
    queryKey: current,
    queryFn: liveRead,
    staleTime: Infinity,
  }).subscribe(() => {});
  for (const key of [old, anotherPerson, otherCenter]) cache(queries, key);
  await invalidateMemberPrivateLessonLists(queries, scope, "person-a");
  expect(queries.getQueryState(current)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(anotherPerson)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(otherCenter)?.isInvalidated).toBe(false);
  // No active-query network storm: only the required visible readback is fetched.
  expect(liveRead).toHaveBeenCalledTimes(1);
  const readOld = vi.fn(async () => ({ version: 2 }));
  await expect(
    queries.fetchQuery({ queryKey: old, queryFn: readOld, staleTime: Infinity }),
  ).resolves.toEqual({ version: 2 });
  expect(readOld).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it("M02 invalidates document directory, catalog and versions per center", async () => {
  const queries = new QueryClient();
  const keys = [
    ["document-directory", scope, "center", "acceptance", "all", "cursor-2"],
    ["document-directory", scope, "organization", "documents", "cursor-1"],
    ["document-catalog", scope, "center"],
    ["document-versions", scope, "organization", "document-1", "cursor-2"],
  ];
  for (const key of keys) cache(queries, key);
  const otherKey = ["document-directory", other, "center", "acceptance", "cursor-2"];
  cache(queries, otherKey);
  await invalidateDocumentDirectoryViews(queries, scope);
  for (const key of keys) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});

it("M03 limits invitation and account invalidation to the center", async () => {
  const queries = new QueryClient();
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const first = ["access-invitations", ...tenant, "open", "timezone", undefined];
  const old = ["access-invitations", ...tenant, "closed", "timezone", "cursor-2"];
  const accounts = ["access-accounts", ...tenant, "active", "search", "cursor-2"];
  const otherKey = ["access-accounts", other.accountId, other.orgId, other.centerId, "active"];
  for (const key of [first, old, accounts, otherKey]) cache(queries, key);
  await invalidateAccessDirectories(queries, scope);
  for (const key of [first, old, accounts])
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});

it("M04 invalidates earnings periods, catalog and counts per center", async () => {
  const queries = new QueryClient();
  const keys = [
    ["earnings-directory", scope, "earnings", "person-a", "2026-10", "cursor-2"],
    ["earnings-directory", scope, "instructors", "", "2026-11", "cursor-1"],
    ["earnings-instructor-catalog", scope],
    ["earnings-directory", scope, "instructors", "", "2026-10", undefined],
  ];
  for (const key of keys) cache(queries, key);
  const otherKey = ["earnings-directory", other, "earnings", "person-a", "cursor-2"];
  cache(queries, otherKey);
  await invalidateEarningsViews(queries, scope);
  for (const key of keys) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});

it("A-ortak: M01–M05 share one cache with tenant isolation and fresh cursors", async () => {
  const queries = new QueryClient();
  const otherOrg = { ...scope, orgId: "org-b" };
  const otherActor = { ...scope, accountId: "actor-b" };
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const documentPage = (source: typeof scope, cursor?: string) => [
    "document-directory",
    source,
    "center",
    "documents",
    "",
    "",
    "all",
    "",
    cursor,
  ];
  const scenarios: {
    name: string;
    first: readonly unknown[];
    old: readonly unknown[];
    foreign: readonly (readonly unknown[])[];
    invalidate: () => Promise<void>;
  }[] = [
    {
      name: "M01 session",
      first: sessionDetailKeys.participants(scope, "session-a"),
      old: sessionDetailKeys.participants(scope, "session-a", undefined, "cursor-2"),
      foreign: [
        sessionDetailKeys.participants(other, "session-a", undefined, "cursor-2"),
        sessionDetailKeys.participants(otherOrg, "session-a", undefined, "cursor-2"),
      ],
      invalidate: () => invalidateSessionDetailViews(queries, scope, "session-a"),
    },
    {
      name: "M02 documents",
      first: documentPage(scope),
      old: documentPage(scope, "cursor-2"),
      foreign: [documentPage(other, "cursor-2"), documentPage(otherActor, "cursor-2")],
      invalidate: () => invalidateDocumentDirectoryViews(queries, scope),
    },
    {
      name: "M03 accounts",
      first: [...accessKeys.accounts(scope), "linked", "search", undefined],
      old: [...accessKeys.accounts(scope), "linked", "search", "cursor-2"],
      foreign: [
        [...accessKeys.accounts(other), "linked", "search", "cursor-2"],
        [...accessKeys.accounts(otherOrg), "linked", "search", "cursor-2"],
      ],
      invalidate: () => invalidateAccessDirectories(queries, scope),
    },
    {
      name: "M04 earnings",
      first: [...earningsKeys.directory(scope), "earnings", "person-a", "October", undefined],
      old: [...earningsKeys.directory(scope), "earnings", "person-a", "September", "cursor-2"],
      foreign: [
        [...earningsKeys.directory(other), "earnings", "person-a", "September", "cursor-2"],
        [...earningsKeys.directory(otherActor), "earnings", "person-a", "September", "cursor-2"],
      ],
      invalidate: () => invalidateEarningsViews(queries, scope),
    },
    {
      name: "M05 finance",
      first: [...financeKeys.directory(scope), "movements", "November", {}, undefined],
      old: [...financeKeys.directory(scope), "debts", "October", {}, "cursor-2"],
      foreign: [
        [...financeKeys.directory(other), "movements", "November", {}, "cursor-2"],
        [...financeKeys.directory(otherOrg), "movements", "November", {}, "cursor-2"],
        [...financeKeys.directory(otherActor), "movements", "November", {}, "cursor-2"],
        [...financeKeys.person(scope, "person-a", "EUR"), "cursor-2"],
      ],
      invalidate: () => invalidateFinanceViews(queries, scope, "person-a", "TRY"),
    },
  ];

  // All five domains have cached page-two responses in the same live client.
  // An unrelated center, organization, actor or currency must remain untouched.
  for (const scenario of scenarios) {
    cache(queries, scenario.first);
    cache(queries, scenario.old);
    for (const key of scenario.foreign) cache(queries, key);
  }
  const readCounts: number[] = [];
  for (const scenario of scenarios) {
    const oldReader = vi.fn(async () => ({ revision: "stale" }));
    const unsubscribe = new QueryObserver(queries, {
      queryKey: scenario.old,
      queryFn: oldReader,
      staleTime: Infinity,
    }).subscribe(() => {});

    // The command's confirmed native write/receipt/result triggers only the
    // matching domain's invalidation. The E2E tests exercise that native chain.
    await scenario.invalidate();
    expect(queries.getQueryState(scenario.first)?.isInvalidated, scenario.name).toBe(true);
    expect(queries.getQueryState(scenario.old)?.isInvalidated, scenario.name).toBe(true);
    for (const key of scenario.foreign)
      expect(queries.getQueryState(key)?.isInvalidated, scenario.name).toBe(false);
    expect(oldReader, scenario.name).not.toHaveBeenCalled();

    const firstReader = vi.fn(async () => ({ revision: "fresh-first" }));
    await queries.fetchQuery({
      queryKey: scenario.first,
      queryFn: firstReader,
      staleTime: 0,
      retry: false,
    });
    expect(firstReader, scenario.name).toHaveBeenCalledTimes(1);
    expect(oldReader, scenario.name).not.toHaveBeenCalled();

    const freshOldReader = vi.fn(async () => ({ revision: "fresh-second" }));
    await queries.fetchQuery({
      queryKey: scenario.old,
      queryFn: freshOldReader,
      staleTime: Infinity,
      retry: false,
    });
    expect(freshOldReader, scenario.name).toHaveBeenCalledTimes(1);
    expect(queries.getQueryData(scenario.old), scenario.name).toEqual({
      revision: "fresh-second",
    });
    readCounts.push(firstReader.mock.calls.length + freshOldReader.mock.calls.length);
    unsubscribe();
  }
  expect(readCounts).toEqual([2, 2, 2, 2, 2]);
  expect(queries.getQueryData(["people", ...tenant, "person-unrelated"])).toBeUndefined();
  for (const scenario of scenarios)
    for (const key of scenario.foreign)
      expect(queries.getQueryData(key), scenario.name).toEqual({ fixture: true });
});

it("marks product history and event selectors stale after a scoped publication", () => {
  const families = affectedProductQueryFamilies(
    scope,
    {
      scopes: [
        {
          scope_kind: "center_all_disciplines",
          center_id: scope.centerId,
          discipline_id: null,
          usage_targets: ["event"],
        },
      ],
    },
    undefined,
    [other.centerId],
    "product-a",
  );
  expect(families).toContainEqual([
    "product-history",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    "product-a",
    "versions",
  ]);
  expect(families).toContainEqual([
    "event-choices",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    "products",
  ]);
  expect(families).not.toContainEqual([
    "event-choices",
    scope.accountId,
    scope.orgId,
    other.centerId,
    "products",
  ]);
});

it("marks instructor balance reports stale after an earnings write within their center", async () => {
  const queries = new QueryClient();
  const report = [
    "report-view",
    scope,
    "balances",
    "instructor_balances",
    undefined,
    { center_ids: [scope.centerId] },
    "cursor-2",
  ];
  const foreign = ["report-view", other, "balances", "instructor_balances"];
  const sales = ["report-view", scope, "weeks", "sales"];
  for (const key of [report, foreign, sales]) cache(queries, key);
  await invalidateEarningsViews(queries, scope);
  expect(queries.getQueryState(report)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(foreign)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(sales)?.isInvalidated).toBe(false);
});

it("invalidates closed attendance rights only for affected members and earnings only for the center", async () => {
  const queries = new QueryClient();
  const key = (s: typeof scope, personId: string) => [
    "profile-rights",
    s.accountId,
    s.orgId,
    s.centerId,
    personId,
  ];
  const affected = [
    key(scope, "student-a"),
    key(scope, "student-b"),
    earningsKeys.directory(scope),
  ];
  const intact = [key(scope, "student-c"), key(other, "student-a"), earningsKeys.directory(other)];
  for (const queryKey of [...affected, ...intact]) cache(queries, queryKey);
  await invalidateAttendanceEffects(queries, scope, ["student-a", "student-b"]);
  for (const queryKey of affected)
    expect(queries.getQueryState(queryKey)?.isInvalidated).toBe(true);
  for (const queryKey of intact) expect(queries.getQueryState(queryKey)?.isInvalidated).toBe(false);
});
