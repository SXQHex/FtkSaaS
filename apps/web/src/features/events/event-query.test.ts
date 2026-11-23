import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { eventDetailKey, invalidateEventViews } from "./event-query";

const scope = { accountId: "actor", orgId: "org", centerId: "center" };

it("keeps the exact validated event readback and invalidates only the matching payment variants", async () => {
  const queries = new QueryClient();
  const detail = eventDetailKey(scope, "event");
  const other = eventDetailKey(scope, "other-event");
  const payment = ["event-registration-payment", "actor", "org", "center", "event", "person"];
  const otherPayment = [
    "event-registration-payment",
    "actor",
    "org",
    "center",
    "other-event",
    "person",
  ];
  const anotherCenter = [
    "event-registration-payment",
    "actor",
    "org",
    "different",
    "event",
    "person",
  ];
  const list = ["events", "actor", "org", "center", "month"];
  for (const key of [detail, other, payment, otherPayment, anotherCenter, list])
    queries.setQueryData(key, { version: 2 });

  await invalidateEventViews(queries, scope, "event", { detailVerified: true });

  expect(queries.getQueryState(detail)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(other)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(payment)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(otherPayment)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(anotherCenter)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(list)?.isInvalidated).toBe(true);

  await invalidateEventViews(queries, scope, "event");
  expect(queries.getQueryState(detail)?.isInvalidated).toBe(true);
});

it("invalidates collection reports and the affected person's warm debt projections", async () => {
  const queries = new QueryClient();
  const foreign = { ...scope, centerId: "different" };
  const subject = [scope.accountId, scope.orgId, scope.centerId, "person"];
  const affected = [
    ["report-finance-summary", scope, { interval: "current" }],
    ["report-view", scope, "collections", "collection_breakdown", "person", {}, "cursor-2"],
    ["profile-person", ...subject],
    ["people", ...subject.slice(0, 3), "search"],
    ["member-entitlements", ...subject, "debt"],
  ];
  const untouched = [
    ["report-finance-summary", foreign],
    ["report-view", scope, "sessions", "session_metrics"],
    ["report-view", scope, "weeks", "sales"],
    ["profile-person", ...subject.slice(0, 3), "another-person"],
  ];
  for (const key of [...affected, ...untouched]) queries.setQueryData(key, { version: 1 });

  await invalidateEventViews(queries, scope, "event", { finance: true, personId: "person" });

  for (const key of affected) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of untouched) expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
});
