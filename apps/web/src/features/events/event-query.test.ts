import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
import { invalidatePersonIdentityViews } from "../people/people-query";
import { eventDetailKey, eventDutyNameQuery, invalidateEventViews } from "./event-query";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ read })) }));

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

it("reuses a duty name in one scope and invalidates only the renamed person in that organization", async () => {
  read.mockReset().mockResolvedValue({ id: "person", display_name: "Sentetik eğitmen" });
  const queries = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  const person = eventDutyNameQuery(scope, "person");
  const other = eventDutyNameQuery(scope, "other");
  const anotherCenter = eventDutyNameQuery({ ...scope, centerId: "second" }, "person");
  const otherActor = eventDutyNameQuery({ ...scope, accountId: "other-actor" }, "person");
  const otherOrg = eventDutyNameQuery({ ...scope, orgId: "other-org" }, "person");
  await expect(queries.fetchQuery(person)).resolves.toBe("Sentetik eğitmen");
  await expect(queries.fetchQuery(eventDutyNameQuery(scope, "person"))).resolves.toBe(
    "Sentetik eğitmen",
  );
  expect(read).toHaveBeenCalledExactlyOnceWith(
    "person_get_v1",
    expect.objectContaining({ org_id: scope.orgId, person_id: "person" }),
    expect.any(AbortSignal),
  );
  for (const key of [other, anotherCenter, otherActor, otherOrg])
    queries.setQueryData(key.queryKey, "Sentetik kişi");
  await invalidatePersonIdentityViews(queries, scope, "person");
  expect(queries.getQueryState(person.queryKey)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(anotherCenter.queryKey)?.isInvalidated).toBe(true);
  for (const key of [other, otherActor, otherOrg])
    expect(queries.getQueryState(key.queryKey)?.isInvalidated).toBe(false);

  read.mockResolvedValue({ id: "person", display_name: "Güncel ad" });
  await expect(queries.fetchQuery(person)).resolves.toBe("Güncel ad");
  expect(read).toHaveBeenCalledTimes(2);
});

it("keeps a denied or mismatched duty name out of another scope", async () => {
  const queries = new QueryClient();
  const anotherCenter = eventDutyNameQuery({ ...scope, centerId: "second" }, "person");
  const otherActor = eventDutyNameQuery({ ...scope, accountId: "other-actor" }, "person");
  read
    .mockReset()
    .mockResolvedValueOnce({ id: "person", display_name: "Yetkili ad" })
    .mockRejectedValueOnce(
      new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: "synthetic" }),
    )
    .mockResolvedValueOnce({ id: "other", display_name: "Yabancı kişi" });
  await expect(queries.fetchQuery(eventDutyNameQuery(scope, "person"))).resolves.toBe("Yetkili ad");
  await expect(queries.fetchQuery(anotherCenter)).resolves.toBeNull();
  await expect(queries.fetchQuery(otherActor)).rejects.toThrow("EVENT_PERSON_UNAVAILABLE");
  expect(queries.getQueryData(otherActor.queryKey)).toBeUndefined();
});

it("bounds concurrent duty reads and skips a query cancelled while waiting", async () => {
  const queries = new QueryClient();
  const release = Promise.withResolvers<void>();
  read.mockReset().mockImplementation(async (_operation, { person_id }) => {
    await release.promise;
    return { id: person_id, display_name: person_id };
  });
  const options = Array.from({ length: 6 }, (_, index) =>
    eventDutyNameQuery(scope, `person-${index}`),
  );
  const finished = Promise.allSettled(options.map((query) => queries.fetchQuery(query)));

  try {
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4));
    await queries.cancelQueries({ queryKey: options[4]!.queryKey, exact: true });
  } finally {
    release.resolve();
    await finished;
  }

  expect(read).toHaveBeenCalledTimes(5);
  expect(read).not.toHaveBeenCalledWith(
    "person_get_v1",
    expect.objectContaining({ person_id: "person-4" }),
    expect.any(AbortSignal),
  );
  await expect(finished).resolves.toContainEqual({ status: "fulfilled", value: "person-5" });
});
