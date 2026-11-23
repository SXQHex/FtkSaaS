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
