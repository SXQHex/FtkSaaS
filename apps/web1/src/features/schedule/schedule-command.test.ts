import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Preview, SessionView } from "../../lib/api-contracts/generated";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  scheduleApplyIntent,
  readScheduleReceipt,
  readScheduleResult,
  writeSchedule,
  replacementSessionIntent,
  type ScheduleIntent,
} from "./schedule-command";
const scope = { accountId: "fixture-account", orgId: "fixture-org", centerId: "fixture-center" };
const interval = { starts_at: "2026-11-15T09:00:00Z", ends_at: "2026-11-15T10:00:00Z" };
const preview = (): Preview => ({
  id: "fixture-preview",
  token: "synthetic-capability",
  scope_hash: "synthetic-scope",
  expires_at: "2099-01-01T00:00:00Z",
  blockers: [],
  effects: [],
  dependencies: {
    policy_hashes: [],
    permission_hash: "synthetic-permission",
    versions: [{ entity: { type: "sessions", id: "fixture-session" }, version: 3 }],
  },
  sessions: [
    {
      session_id: "fixture-session",
      interval,
      resources: [],
      assignments: [],
      capacity: { total: 12 },
    },
  ],
});
const intent = () =>
  scheduleApplyIntent({
    scope,
    operation: "session_change_apply_v1",
    preview: preview(),
    sessionId: "fixture-session",
    sourceVersion: 3,
  });
beforeEach(() => {
  call.mockReset();
});
describe("reviewed native schedule writes and rereads", () => {
  it("reads a replacement receipt through only public operation/key fields and checks its durable source link", async () => {
    const source: SessionView = {
      id: "source",
      class_id: null,
      discipline_id: "discipline",
      format: "group",
      attendance_state: "open",
      assignments: [],
      ...interval,
      state: "cancelled",
      version: 3,
      capacity: {
        total: 12,
        held: 0,
        remaining: 12,
        category_held: null,
        category_remaining: null,
        room_capacity: null,
      },
    };
    call.mockResolvedValueOnce(source);
    const value = await replacementSessionIntent(scope, source, interval, "room");
    call.mockResolvedValueOnce({
      operation: "replacement_session_create_v1",
      key: value.request.operation_key,
      status: "succeeded",
      result_reference: { type: "sessions", id: "replacement" },
    });
    await readScheduleReceipt(value);
    expect(call).toHaveBeenLastCalledWith("operation_status_get_v1", {
      client_api_version: 1,
      request_id: expect.any(String),
      org_id: scope.orgId,
      operation: "replacement_session_create_v1",
      key: value.request.operation_key,
    });
    call.mockImplementation(async (operation) =>
      operation === "management_state_get_v1"
        ? {
            items: [
              {
                exists: true,
                entity: { type: "sessions", id: "replacement" },
                state: "planned",
                versions: [{ entity: { type: "sessions", id: "replacement" }, version: 1 }],
                current: {
                  operation: "replacement_session_create_v1",
                  values: { replaces_id: source.id, interval },
                },
              },
            ],
            next_cursor: null,
          }
        : {
            ...source,
            id: "replacement",
            state: "planned",
            ...interval,
            version: 1,
            capacity: { total: 12, held: 0, remaining: 12 },
          },
    );
    await readScheduleResult(value, "replacement");
    expect(
      call.mock.calls.filter(([operation]) => operation === "replacement_session_create_v1"),
    ).toHaveLength(0);
  });
  it.each(["expired", "blocked"])(
    "rejects an %s preview before creating a write intent",
    (condition) => {
      const value = preview();
      if (condition === "expired") value.expires_at = "2000-01-01T00:00:00Z";
      else
        value.blockers.push({
          code: "RESOURCE_CONFLICT",
          retryable: false,
          trace_id: "synthetic-trace",
        });
      expect(() =>
        scheduleApplyIntent({ scope, operation: "program_apply_v1", preview: value }),
      ).toThrow("SCHEDULE_PREVIEW_UNAVAILABLE");
      expect(call).not.toHaveBeenCalled();
    },
  );
  it("pins every changed session to a known source version", () => {
    const value = preview();
    value.dependencies.versions = [];
    expect(() =>
      scheduleApplyIntent({
        scope,
        operation: "session_change_apply_v1",
        preview: value,
        sessionId: "fixture-session",
        sourceVersion: 3,
      }),
    ).toThrow("SCHEDULE_PREVIEW_UNAVAILABLE");
  });
  it("retries an unknown writer with exactly the same key and payload, using a new request id", async () => {
    const value = intent();
    call.mockResolvedValue({ primary_id: "fixture-session" });
    await writeSchedule(value);
    await writeSchedule(value);
    const first = call.mock.calls[0]![1],
      second = call.mock.calls[1]![1];
    expect(first.operation_key).toBe(second.operation_key);
    expect(first.request_id).not.toBe(second.request_id);
    expect({ ...first, request_id: "ignored" }).toEqual({ ...second, request_id: "ignored" });
  });
  it("rejects a receipt for a different operation or primary object", async () => {
    const value = intent();
    call.mockResolvedValue({
      operation: value.operation,
      key: value.request.operation_key,
      result_reference: { type: "sessions", id: "different-session" },
    });
    await expect(readScheduleReceipt(value)).rejects.toThrow("SCHEDULE_RECEIPT_UNAVAILABLE");
    expect(call.mock.calls.every(([operation]) => operation === "operation_status_get_v1")).toBe(
      true,
    );
  });
  it("does not report an unchanged version as successful read-after-write", async () => {
    const value = intent();
    const session: SessionView = {
      id: "fixture-session",
      class_id: null,
      discipline_id: "fixture-discipline",
      format: "group",
      state: "planned",
      attendance_state: "open",
      ...interval,
      assignments: [],
      version: 3,
      capacity: {
        total: 12,
        held: 0,
        remaining: 12,
        category_held: null,
        category_remaining: null,
        room_capacity: null,
      },
    };
    call.mockResolvedValue(session);
    await expect(readScheduleResult(value)).rejects.toThrow("SCHEDULE_REREAD_UNAVAILABLE");
    call.mockResolvedValue({ ...session, version: 4 });
    await expect(readScheduleResult(value)).resolves.toBeUndefined();
  });
  it("keeps an expired new-session receipt without a result id unread instead of sending a new writer", async () => {
    const value: ScheduleIntent = {
      scope,
      operation: "session_create_v1",
      expectedSessions: [],
      request: {
        client_api_version: 1,
        request_id: "synthetic-request",
        operation_key: "synthetic-key",
        org_id: scope.orgId,
        center_id: scope.centerId,
        discipline_id: "fixture-discipline",
        format: "group",
        interval,
        resources: [],
        assignments: [],
        inherit_class_assignments: false,
        capacity: { total: 12 },
      },
    };
    await expect(readScheduleResult(value)).rejects.toThrow("SCHEDULE_REREAD_UNAVAILABLE");
    expect(call).not.toHaveBeenCalled();
  });
});

it("rejects a newer matching-time session with stale duties, but accepts reordered native duties without demanding optional agreement metadata", async () => {
  const p = preview();
  p.sessions![0]!.assignments = [
    { person_id: "new-instructor", duty: "instructor", agreement_id: "native-agreement" },
    { person_id: "assistant", duty: "assistant" },
  ];
  const value = scheduleApplyIntent({
    scope,
    operation: "session_change_apply_v1",
    preview: p,
    sessionId: "fixture-session",
    sourceVersion: 3,
  });
  const source: SessionView = {
    id: "fixture-session",
    class_id: null,
    discipline_id: "fixture-discipline",
    format: "group",
    attendance_state: "open",
    state: "planned",
    version: 4,
    ...interval,
    assignments: [
      { person_id: "old-instructor", duty: "instructor" },
      { person_id: "assistant", duty: "assistant" },
    ],
    capacity: {
      total: 12,
      held: 0,
      remaining: 12,
      category_held: null,
      category_remaining: null,
      room_capacity: null,
    },
  };
  call.mockResolvedValue(source);
  await expect(readScheduleResult(value)).rejects.toThrow("SCHEDULE_REREAD_UNAVAILABLE");
  source.assignments = [
    { person_id: "assistant", duty: "assistant" },
    { person_id: "new-instructor", duty: "instructor" },
  ];
  await expect(readScheduleResult(value)).resolves.toBeUndefined();
  source.assignments = [{ person_id: "new-instructor", duty: "instructor" }];
  await expect(readScheduleResult(value)).rejects.toThrow("SCHEDULE_REREAD_UNAVAILABLE");
  expect(call.mock.calls.every(([operation]) => operation === "session_get_v1")).toBe(true);
});
