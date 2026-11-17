import { beforeEach, expect, it, vi } from "vitest";
import type {
  ManagementWorkKind,
  ManagementWorkView,
  ManagementStateView,
  EventView,
  SessionView,
  LessonRequestView,
} from "../../lib/api-contracts/generated";
import {
  readOverviewWork,
  readOverviewWorkSource,
  overviewFollowupIntent,
  writeOverviewFollowup,
  readOverviewFollowupReceipt,
  readOverviewFollowupResult,
} from "./overview-work";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  at = "2026-11-16T12:00:00Z";
function task(kind: ManagementWorkKind): ManagementWorkView {
  const common = {
    id: id(4),
    kind,
    version: 2,
    title: "Sentetik bekleyen iş",
    created_at: at,
    person_id: id(5),
    person_name: "Örnek kişi",
    due_at: kind === "crm_followup" ? at : null,
  };
  if (kind === "lesson_attendance")
    return { ...common, target: { operation: "session_get_v1", session_id: common.id } };
  if (kind === "event_attendance")
    return { ...common, target: { operation: "event_get_v1", event_id: common.id } };
  return {
    ...common,
    target: {
      operation: "management_state_get_v1",
      selector:
        kind === "lesson_request"
          ? { operation: "lesson_request_create_v1", key: { lesson_request_id: common.id } }
          : kind === "application_review"
            ? { operation: "public_application_review_v1", key: { application_id: common.id } }
            : {
                operation: "crm_activity_save_v1",
                key: { activity_id: common.id, person_id: id(5) },
              },
    },
  };
}
function management(work: ManagementWorkView, version = 2, completed = false): ManagementStateView {
  const type =
    work.kind === "crm_followup"
      ? "crm_activities"
      : work.kind === "application_review"
        ? "public_applications"
        : "lesson_requests";
  if (work.target.operation !== "management_state_get_v1") throw Error("TEST_TARGET");
  const entity = { type, id: work.id } as const;
  const request: LessonRequestView = {
    id: work.id,
    center_id: scope.centerId,
    person_id: id(5),
    discipline_id: id(6),
    format: "private",
    duration_minutes: 60,
    requested_start: at,
    created_at: at,
    state: "pending",
    version,
    alternatives: [],
  };
  return {
    operation: work.target.selector.operation,
    entity,
    exists: true,
    state: completed ? "completed" : work.kind === "crm_followup" ? "active" : "pending",
    versions: [{ entity, version }],
    as_of: at,
    ...(work.kind === "lesson_request" ? { request_detail: request } : {}),
    current:
      work.kind === "crm_followup"
        ? {
            operation: "crm_activity_save_v1",
            values: {
              activity_id: work.id,
              person_id: id(5),
              lead_id: null,
              kind: completed ? "outcome" : "followup",
              note: "Özgün takip notu",
              due_at: at,
              outcome: completed ? "Görüşüldü" : null,
            },
          }
        : work.kind === "application_review"
          ? { operation: "public_application_review_v1", values: { application_id: work.id } }
          : null,
  };
}
const session: SessionView = {
  id: id(4),
  class_id: null,
  discipline_id: id(6),
  format: "group",
  starts_at: at,
  ends_at: "2026-11-16T13:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  version: 2,
  capacity: {
    total: 10,
    held: 2,
    remaining: 8,
    category_held: null,
    category_remaining: null,
    room_capacity: 10,
  },
};
const event: EventView = {
  id: id(4),
  name: "Etkinlik",
  center_id: scope.centerId,
  interval: { starts_at: at, ends_at: "2026-11-16T13:00:00Z" },
  timezone: "Europe/Istanbul",
  venue: { kind: "external", name: "Salon", timezone: "Europe/Istanbul" },
  state: "published",
  attendance_state: "open",
  capacity: { kind: "unlimited" },
  assignments: [],
  discipline_ids: [],
  version: 2,
  terms: {
    fee_minor: "0",
    currency: "TRY",
    full_payment_required: false,
    allowed_product_version_ids: [],
    cancellation: { before_cutoff: "release", after_cutoff: "consume", no_show: "consume" },
    refund: { method: "none" },
  },
};
const summary = {
  total: 10,
  lesson_request: 2,
  lesson_attendance: 2,
  event_attendance: 2,
  crm_followup: 2,
  application_review: 2,
};
beforeEach(() => {
  call.mockReset();
});
it("uses the native all-authorized center queue and retains authoritative counts rather than page totals", async () => {
  call.mockResolvedValue({
    items: [task("crm_followup")],
    next_cursor: "next",
    as_of: at,
    summary,
  });
  const page = await readOverviewWork(scope);
  expect(page.summary.total).toBe(10);
  expect(call).toHaveBeenCalledExactlyOnceWith(
    "management_work_list_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      kind: "all",
      page: { limit: 20, sort: "created_at_asc" },
    }),
  );
});
it.each(["duplicate", "count", "cursor", "target"])(
  "rejects malformed %s queue data before exposing a source action",
  async (mode) => {
    const row = task("crm_followup");
    call.mockResolvedValue({
      items:
        mode === "duplicate"
          ? [row, row]
          : [
              mode === "target"
                ? { ...row, target: { operation: "event_get_v1", event_id: row.id } }
                : row,
            ],
      next_cursor: mode === "cursor" ? "same" : null,
      as_of: at,
      summary: mode === "count" ? { ...summary, total: 9 } : summary,
    });
    await expect(readOverviewWork(scope, mode === "cursor" ? "same" : undefined)).rejects.toThrow();
  },
);
it.each([
  "lesson_request",
  "lesson_attendance",
  "event_attendance",
  "crm_followup",
  "application_review",
] as const)("rereads the exact %s source without any writer", async (kind) => {
  const row = task(kind);
  call.mockImplementation(async (operation) =>
    operation === "session_get_v1"
      ? session
      : operation === "event_get_v1"
        ? event
        : { items: [management(row)], next_cursor: null, as_of: at },
  );
  const source = await readOverviewWorkSource(scope, row);
  expect(source.task.id).toBe(row.id);
  expect(call).toHaveBeenCalledTimes(1);
  expect(call.mock.calls[0][1]).toMatchObject({ org_id: scope.orgId, center_id: scope.centerId });
  if (source.kind === "flow")
    expect(source.href).toContain(`/o/${scope.orgId}/c/${scope.centerId}/`);
});
it("does not open stale or closed lesson work and never infers occurrence from a past clock", async () => {
  call.mockResolvedValue({ ...session, version: 3 });
  await expect(readOverviewWorkSource(scope, task("lesson_attendance"))).rejects.toThrow(
    "WORK_SOURCE_CHANGED",
  );
  call.mockResolvedValue({ ...session, attendance_state: "closed" });
  await expect(readOverviewWorkSource(scope, task("lesson_attendance"))).rejects.toThrow(
    "WORK_SOURCE_CHANGED",
  );
});
it("reuses native CRM outcome editing for a known leadless followup, preserving its actual note and due time", async () => {
  const row = task("crm_followup"),
    page = { items: [management(row)], next_cursor: null, as_of: at };
  call.mockResolvedValue(page);
  const source = await readOverviewWorkSource(scope, row);
  if (source.kind !== "followup") throw Error("TEST_SOURCE");
  const intent = await overviewFollowupIntent(source, " Görüşüldü ");
  call.mockResolvedValue({
    primary_id: row.id,
    version: 3,
    operation_id: id(8),
    related: [],
    replayed: false,
  });
  await writeOverviewFollowup(intent);
  expect(call).toHaveBeenLastCalledWith(
    "crm_activity_save_v1",
    expect.objectContaining({
      activity_id: row.id,
      person_id: id(5),
      lead_id: null,
      expected_version: 2,
      operation_key: intent.key,
      kind: "outcome",
      note: "Özgün takip notu",
      due_at: at,
      outcome: "Görüşüldü",
    }),
  );
  call.mockResolvedValue({ items: [management(row, 3, true)], next_cursor: null, as_of: at });
  await expect(readOverviewFollowupResult(intent, row.id)).resolves.toMatchObject({ version: 3 });
  call.mockResolvedValue({
    operation: "crm_activity_save_v1",
    key: intent.key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "crm_activities", id: id(99) },
  });
  await expect(readOverviewFollowupReceipt(intent)).rejects.toThrow("WORK_RECEIPT_UNAVAILABLE");
});
it("preflight stops after followup source version changes without creating a replacement activity", async () => {
  const row = task("crm_followup");
  call.mockResolvedValue({ items: [management(row)], next_cursor: null, as_of: at });
  const source = await readOverviewWorkSource(scope, row);
  if (source.kind !== "followup") throw Error("TEST_SOURCE");
  call.mockResolvedValue({ items: [management(row, 3)], next_cursor: null, as_of: at });
  await expect(overviewFollowupIntent(source, "Görüşüldü")).rejects.toThrow();
  expect(call.mock.calls.every(([operation]) => operation === "management_state_get_v1")).toBe(
    true,
  );
});
