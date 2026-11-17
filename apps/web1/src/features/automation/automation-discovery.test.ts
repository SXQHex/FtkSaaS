import { beforeEach, expect, it, vi } from "vitest";
import {
  readAutomationQueue,
  readSegmentDiscovery,
  readKnownAutomationJob,
} from "./automation-discovery";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const summary = {
  total: 90,
  pending: 20,
  running: 10,
  retry_wait: 10,
  succeeded: 30,
  failed: 10,
  cancelled: 10,
  notifications_created: 7,
  followups_created: 8,
  email_delivery: "not_supported",
};
const job = {
  id: id(4),
  version: 12,
  center_id: id(3),
  person_id: id(5),
  state: "failed" as const,
  attempts: 3,
  next_attempt_at: null,
  safe_error_code: "SERVICE_UNAVAILABLE",
  result_reference: null,
  retry_available: true,
  created_at: "2026-11-16T12:00:00.123456Z",
  automation_id: id(6),
  automation_version: 7,
  automation_name: "Örnek otomasyon",
  configuration_creator_person_id: id(7),
  initiator_kind: "automation" as const,
};
const queue = () => ({
  items: [
    {
      operation: "automation_save_v1",
      exists: true,
      entity: { type: "outbox_jobs", id: job.id },
      state: job.state,
      versions: [{ entity: { type: "outbox_jobs", id: job.id }, version: 12 }],
      current: null,
      automation_job: job,
    },
  ],
  next_cursor: null,
  as_of: "2026-11-17T12:00:00Z",
  automation_queue_summary: summary,
});
beforeEach(() => call.mockReset());
it("reads saved segment matches with explicit execution center and global counts rather than page length", async () => {
  call.mockResolvedValue({
    items: [
      {
        operation: "segment_save_v1",
        exists: true,
        entity: { type: "people", id: id(5) },
        current: null,
        versions: [],
        segment_match: { person_id: id(5), display_name: "Sentetik kişi" },
      },
    ],
    segment_summary: { audience_count: 24, matched_count: 3, using_automations: 7 },
    next_cursor: "next",
    as_of: "2026-11-17T12:00:00Z",
  });
  expect(await readSegmentDiscovery(scope, id(8), "matches", "before")).toMatchObject({
    items: [{ id: id(5), name: "Sentetik kişi" }],
    summary: { matched_count: 3, using_automations: 7 },
    nextCursor: "next",
  });
  expect(call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      selector: {
        operation: "segment_save_v1",
        key: {
          scope: { kind: "center", center_id: scope.centerId },
          segment_id: id(8),
          discovery: "matches",
          execution_center_id: scope.centerId,
        },
      },
      page: { limit: 20, sort: "created_at_asc", cursor: "before" },
    }),
  );
});
it("reads usage from versioned native references even though the outer operation is segment discovery", async () => {
  const row = {
    operation: "automation_save_v1",
    exists: true,
    entity: { type: "automations", id: id(6) },
    versions: [{ entity: { type: "automations", id: id(6) }, version: 7 }],
    automation_reference: { id: id(6), version: 7, name: "Yetkili otomasyon", enabled: false },
  };
  call.mockResolvedValue({ items: [row], as_of: "2026-11-17T12:00:00Z" });
  expect((await readSegmentDiscovery(scope, id(8), "automations")).items[0]).toMatchObject({
    name: "Yetkili otomasyon",
    enabled: false,
  });
  call.mockResolvedValue({ items: [{ ...row, versions: [] }], as_of: "2026-11-17T12:00:00Z" });
  await expect(readSegmentDiscovery(scope, id(8), "automations")).rejects.toThrow(
    "AUTOMATION_DISCOVERY_UNAVAILABLE",
  );
});
it("rejects inconsistent segment count evidence and repeated cursors", async () => {
  call.mockResolvedValue({
    items: [],
    as_of: "2026-11-17T12:00:00Z",
    segment_summary: { audience_count: 2, matched_count: 3, using_automations: 1 },
  });
  await expect(readSegmentDiscovery(scope, id(8), "matches")).rejects.toThrow(
    "AUTOMATION_DISCOVERY_UNAVAILABLE",
  );
  call.mockResolvedValue({ items: [], as_of: "2026-11-17T12:00:00Z", next_cursor: "repeat" });
  await expect(readSegmentDiscovery(scope, id(8), "automations", "repeat")).rejects.toThrow(
    "AUTOMATION_DISCOVERY_UNAVAILABLE",
  );
});
it("reads the whole authorized configuration scope queue with native summary, not a selected list of current configs", async () => {
  call.mockResolvedValue(queue());
  expect(await readAutomationQueue(scope, { state: "all" }, "cursor")).toMatchObject({
    items: [job],
    summary,
  });
  expect(call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      operation: "automation_save_v1",
      selector: {
        operation: "automation_save_v1",
        key: {
          scope: { kind: "center", center_id: scope.centerId },
          discovery: "jobs",
          state: "all",
        },
      },
      page: { limit: 20, sort: "created_at_desc", cursor: "cursor" },
    }),
  );
});
it("rejects wrong native job versions, filter mismatches and missing summary", async () => {
  const broken = queue();
  broken.items[0]!.versions[0]!.version = 13;
  call.mockResolvedValue(broken);
  await expect(readAutomationQueue(scope, { state: "all" })).rejects.toThrow(
    "AUTOMATION_QUEUE_UNAVAILABLE",
  );
  call.mockResolvedValue(queue());
  await expect(readAutomationQueue(scope, { state: "succeeded" })).rejects.toThrow(
    "AUTOMATION_QUEUE_UNAVAILABLE",
  );
  await expect(readAutomationQueue(scope, { state: "all", automationId: id(99) })).rejects.toThrow(
    "AUTOMATION_QUEUE_UNAVAILABLE",
  );
  call.mockResolvedValue({ ...queue(), automation_queue_summary: undefined });
  await expect(readAutomationQueue(scope, { state: "all" })).rejects.toThrow();
});
it("does not reinterpret native job success or notification counts as email delivery", async () => {
  call.mockResolvedValue({
    ...queue(),
    automation_queue_summary: { ...summary, email_delivery: "delivered" },
  });
  await expect(readAutomationQueue(scope, { state: "all" })).rejects.toThrow();
  call.mockResolvedValue({ ...queue(), automation_queue_summary: { ...summary, total: 1 } });
  await expect(readAutomationQueue(scope, { state: "all" })).rejects.toThrow(
    "AUTOMATION_QUEUE_UNAVAILABLE",
  );
});
it("rereads one known microsecond and preserves timestamp precision, job/config identity and versions", async () => {
  call.mockResolvedValue(queue());
  expect(await readKnownAutomationJob(scope, job)).toMatchObject({
    id: job.id,
    version: 12,
    automation_version: 7,
  });
  expect(call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      selector: {
        operation: "automation_save_v1",
        key: {
          scope: { kind: "center", center_id: scope.centerId },
          discovery: "jobs",
          state: "all",
          automation_id: job.automation_id,
          interval: { starts_at: job.created_at, ends_at: "2026-11-16T12:00:00.123457Z" },
        },
      },
    }),
  );
});
it("never walks general history for a missing known job or repeats a source cursor", async () => {
  call.mockResolvedValue({ ...queue(), items: [] });
  await expect(readKnownAutomationJob(scope, job)).rejects.toThrow("AUTOMATION_JOB_UNAVAILABLE");
  expect(call).toHaveBeenCalledTimes(1);
  call.mockReset();
  call.mockResolvedValue({ ...queue(), items: [], next_cursor: "repeat" });
  await expect(readKnownAutomationJob(scope, job)).rejects.toThrow("AUTOMATION_QUEUE_UNAVAILABLE");
  expect(call).toHaveBeenCalledTimes(2);
});
