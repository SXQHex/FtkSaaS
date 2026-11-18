import { beforeEach, expect, it, vi } from "vitest";
import type { LessonRequestView } from "../../lib/api-contracts/generated";
const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
import {
  createOwnRequestIntent,
  existingOwnRequestIntent,
  readOwnRequestResult,
  readOwnRequestReceipt,
  writeOwnRequest,
} from "./member-private-lessons-command";
import { readOwnRequests } from "./member-private-lessons-read";
import type { OwnRequestDraft } from "./member-private-lessons-view";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  personId = id(4);
const draft = (): OwnRequestDraft => ({
  day: "2027-11-07",
  time: "01:30",
  duration: "45",
  disciplineId: id(5),
  instructorId: "",
  offset: "",
  alternativeId: id(9),
  reviewed: true,
});
const before: LessonRequestView = {
  id: id(6),
  center_id: scope.centerId,
  person_id: personId,
  discipline_id: id(5),
  created_at: "2026-11-16T12:00:00Z",
  requested_start: "2027-11-07T12:00:00Z",
  duration_minutes: 45,
  format: "private",
  version: 2,
  state: "alternative_offered",
  alternatives: [
    {
      id: id(9),
      request_id: id(6),
      created_at: "2026-11-16T12:00:00Z",
      starts_at: "2027-11-07T15:00:00Z",
      ends_at: "2027-11-07T15:45:00Z",
      version: 1,
      state: "offered",
    },
  ],
};
const asOf = "2026-11-16T12:00:00Z";
function page(row: LessonRequestView, operation = "lesson_request_withdraw_v1") {
  return {
    items: [
      {
        operation,
        entity: { type: "lesson_requests", id: row.id },
        state: row.state,
        exists: true,
        versions: [{ entity: { type: "lesson_requests", id: row.id }, version: row.version }],
        request_detail: row,
      },
    ],
    next_cursor: null,
    as_of: asOf,
  };
}
beforeEach(() => vi.clearAllMocks());
it("requires a DST fold choice and preserves the selected occurrence without manager overrides", async () => {
  await expect(
    createOwnRequestIntent(scope, personId, draft(), "America/New_York", [{ id: id(5) }], [], asOf),
  ).rejects.toMatchObject({ message: "SCHEDULE_TIME_AMBIGUOUS" });
  const intent = await createOwnRequestIntent(
    scope,
    personId,
    { ...draft(), offset: "-05:00" },
    "America/New_York",
    [{ id: id(5) }],
    [],
    asOf,
  );
  expect(intent.request).toMatchObject({
    person_id: personId,
    requested_start: "2027-11-07T06:30:00Z",
    duration_minutes: 45,
  });
  expect(intent.request).not.toHaveProperty("window_exception");
  expect(intent.request).not.toHaveProperty("reason");
  mock.call.mockResolvedValue({ primary_id: id(6) });
  await writeOwnRequest(intent);
  await writeOwnRequest(intent);
  expect(mock.call.mock.calls[0]![1].operation_key).toBe(mock.call.mock.calls[1]![1].operation_key);
  expect(mock.call.mock.calls[0]![1].request_id).not.toBe(mock.call.mock.calls[1]![1].request_id);
});
it("rejects a missing local time and instructors outside the native catalog", async () => {
  await expect(
    createOwnRequestIntent(
      scope,
      personId,
      { ...draft(), day: "2027-03-14", time: "02:30" },
      "America/New_York",
      [{ id: id(5) }],
      [],
      asOf,
    ),
  ).rejects.toMatchObject({ message: "SCHEDULE_TIME_GAP" });
  await expect(
    createOwnRequestIntent(
      scope,
      personId,
      { ...draft(), instructorId: id(99) },
      "Europe/Istanbul",
      [{ id: id(5) }],
      [],
      asOf,
    ),
  ).rejects.toThrow("OWN_REQUEST_CHOICES_UNAVAILABLE");
});
it("freezes self request versions and rejects other people or unreviewed actions", () => {
  const source = structuredClone(before),
    intent = existingOwnRequestIntent(scope, personId, source, "withdraw", draft(), asOf);
  source.version = 99;
  expect(intent.request).toMatchObject({ lesson_request_id: before.id, expected_version: 2 });
  expect(() =>
    existingOwnRequestIntent(scope, id(90), before, "withdraw", draft(), asOf),
  ).toThrow();
  expect(() =>
    existingOwnRequestIntent(
      scope,
      personId,
      before,
      "accept",
      { ...draft(), reviewed: false },
      asOf,
    ),
  ).toThrow();
});
it("reads an accepted alternative without treating it as center approval or creating a reservation", async () => {
  const intent = existingOwnRequestIntent(scope, personId, before, "accept", draft(), asOf);
  const after = {
    ...before,
    version: 3,
    alternatives: [
      {
        ...before.alternatives[0]!,
        state: "accepted" as const,
        version: 2,
        selected_at: "2026-11-16T12:01:00Z",
      },
    ],
  };
  mock.call.mockResolvedValue(page(after));
  expect((await readOwnRequestResult(intent, before.id)).state).toBe("alternative_offered");
  expect(mock.call).toHaveBeenCalledTimes(1);
  expect(mock.call.mock.calls[0]![0]).toBe("management_state_get_v1");
});
it("rejects a cross-person list and mismatched result receipt", async () => {
  mock.call.mockResolvedValueOnce(
    page({ ...before, person_id: id(99) }, "lesson_request_create_v1"),
  );
  await expect(readOwnRequests(scope, personId)).rejects.toThrow("OWN_REQUEST_SOURCE_UNAVAILABLE");
  const intent = existingOwnRequestIntent(scope, personId, before, "withdraw", draft(), asOf);
  mock.call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_reference: { type: "lesson_requests", id: id(99) },
  });
  await expect(readOwnRequestReceipt(intent)).rejects.toThrow("OWN_REQUEST_RECEIPT_UNAVAILABLE");
});
it("deep-linked own request uses exact native read ID and preserves self ownership checks", async () => {
  mock.call.mockResolvedValue(page(before, "lesson_request_create_v1"));
  await expect(readOwnRequests(scope, personId, undefined, before.id)).resolves.toMatchObject({
    items: [before],
  });
  expect(mock.call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      selector: {
        operation: "lesson_request_create_v1",
        key: { person_id: personId, lesson_request_id: before.id },
      },
    }),
  );
  await expect(readOwnRequests(scope, personId, undefined, id(99))).rejects.toThrow(
    "OWN_REQUEST_SOURCE_UNAVAILABLE",
  );
  await expect(readOwnRequests(scope, id(99), undefined, before.id)).rejects.toThrow(
    "OWN_REQUEST_SOURCE_UNAVAILABLE",
  );
});
