import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidatePeoplePages, peopleKeys } from "../people/people-query";
import { invalidateProductPages, productsKeys } from "../products/products-query";
import { invalidateLeadPages, leadsKeys } from "../leads/leads-query";
import { financeKeys, invalidateFinanceViews } from "../finance/finance-query";
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
  cache(queries, [...productsKeys.management(other), "active", "cursor-1"]);
  await invalidatePeoplePages(queries, scope);
  await invalidateProductPages(queries, scope);
  expect(queries.getQueryState([...people, "active", "cursor-1"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState([...people, "inactive", "cursor-2"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState([...products, "active", "cursor-1"])?.isInvalidated).toBe(
    true,
  );
  expect(
    queries.getQueryState([...productsKeys.management(other), "active", "cursor-1"])
      ?.isInvalidated,
  ).toBe(false);
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
  cache(queries, [...leadsKeys.directory(other), "cursor-2"]);
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
  expect(
    queries.getQueryState([...leadsKeys.directory(other), "cursor-2"])?.isInvalidated,
  ).toBe(false);
});

it("marks reservation, waitlist, rights, calendar and person summaries stale for the same tenant", async () => {
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

it("invalidates all finance currencies and cursor projections for the confirmed person", async () => {
  const queries = new QueryClient();
  const key = financeKeys.person(scope, "person-a", "TRY");
  const otherKey = financeKeys.person(other, "person-a", "TRY");
  cache(queries, [...key, "cursor-1"]);
  cache(queries, [...key, "cursor-2"]);
  cache(queries, ["people", scope.accountId, scope.orgId, scope.centerId, "active"]);
  cache(queries, otherKey);
  await invalidateFinanceViews(queries, scope, "person-a", "TRY");
  expect(queries.getQueryState([...key, "cursor-1"])?.isInvalidated).toBe(true);
  expect(queries.getQueryState([...key, "cursor-2"])?.isInvalidated).toBe(true);
  expect(
    queries.getQueryState([
      "people",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      "active",
    ])?.isInvalidated,
  ).toBe(true);
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});
