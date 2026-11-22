import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { invalidatePeoplePages, peopleKeys } from "../people/people-query";
import { invalidateProductPages, productsKeys } from "../products/products-query";
import { invalidateLeadPages, leadsKeys } from "../leads/leads-query";
import { financeKeys, invalidateFinanceViews } from "../finance/finance-query";
import {
  invalidateMemberPrivateLessonLists,
  memberPrivateLessonKeys,
} from "../member-private-lessons/member-private-lessons-query";
import { invalidateDocumentDirectoryViews } from "../documents/documents-query";
import { invalidateAccessDirectories } from "../access/access-query";
import { invalidateEarningsViews } from "../earnings/earnings-query";
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
  const directoryOld = ["finance-directory", ...[scope.accountId, scope.orgId, scope.centerId], "credits", "cursor-2"];
  cache(queries, directoryOld);
  const debtsOld = ["finance-directory-credit-debts", ...[scope.accountId, scope.orgId, scope.centerId], "old-period"];
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


it("M01 invalidates old private-lesson cursors while preserving other people and tenants", async () => {
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

it("M02 marks document filters, catalog levels and version pages stale only in this center", async () => {
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

it("M03 invalidates invitation/account cursor families without reviving an unauthorized center", async () => {
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

it("M04 invalidates old earnings periods, instructors, catalog and counts without crossing centers", async () => {
  const queries = new QueryClient();
  const keys = [
    ["earnings-directory", scope, "earnings", "person-a", "2026-10", "cursor-2"],
    ["earnings-directory", scope, "instructors", "", "2026-11", "cursor-1"],
    ["earnings-instructor-catalog", scope],
    ["earnings-visible-counts", scope, "2026-10", { items: [] }],
  ];
  for (const key of keys) cache(queries, key);
  const otherKey = ["earnings-directory", other, "earnings", "person-a", "cursor-2"];
  cache(queries, otherKey);
  await invalidateEarningsViews(queries, scope);
  for (const key of keys) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});
