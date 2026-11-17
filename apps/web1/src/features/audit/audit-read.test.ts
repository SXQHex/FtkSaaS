import { beforeEach, expect, it, vi } from "vitest";
import { readAudit, readTracking } from "./audit-read";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const input = {
  period: "all" as const,
  anchor: "2026-11-17T12:00:00Z",
  timezone: "Europe/Istanbul",
};
const audit = {
  id: id(4),
  created_at: "2026-11-15T12:00:00Z",
  action: "person_update_v1",
  subject: { type: "people", id: id(5) },
  actor_display: "Sentetik yönetici",
  subject_title: "Sentetik kişi",
  module: "M03",
  result: "recorded",
  reason: null,
  diff: null,
};
const tracking = {
  kind: "job",
  id: id(4),
  created_at: audit.created_at,
  operation: "report_build_v1",
  state: "retry_wait",
  expires_at: null,
  progress_count: 3,
  total_count: null,
  safe_error_code: "TEMPORARY_FAILURE",
  next_attempt_at: "2026-11-17T12:10:00Z",
  result_reference: null,
};
const totals = {
  total: 19,
  previews: 6,
  operations: 8,
  jobs: 5,
  attention: 7,
  running: 2,
  retry: 3,
  completed: 8,
};
beforeEach(() => call.mockReset());
it("omits interval for all retained records, binds native filters and never requests an audit export", async () => {
  call.mockResolvedValue({ items: [audit], as_of: input.anchor, next_cursor: "next" });
  await readAudit(scope, {
    ...input,
    module: "M03",
    result: "recorded",
    query: "  kişi ",
    cursor: "before",
  });
  expect(call.mock.calls[0]![0]).toBe("audit_list_v1");
  expect(call.mock.calls[0]![1]).toMatchObject({
    center_id: scope.centerId,
    module: "M03",
    result: "recorded",
    query: "kişi",
    page: { limit: 20, cursor: "before" },
  });
  expect(call.mock.calls[0]![1]).not.toHaveProperty("interval");
});
it("uses center-local midnight for today and binds a stable end instant across cursor pages", async () => {
  call.mockResolvedValue({ items: [], as_of: input.anchor, next_cursor: null });
  await readAudit(scope, { ...input, period: "1" });
  await readAudit(scope, { ...input, period: "1", cursor: "next" });
  expect(call.mock.calls[0]![1].interval).toEqual({
    starts_at: "2026-11-16T21:00:00Z",
    ends_at: input.anchor,
  });
  expect(call.mock.calls[1]![1].interval).toEqual(call.mock.calls[0]![1].interval);
});
it("rejects invented result filters, cross-module rows and non-recorded events", async () => {
  await expect(readAudit(scope, { ...input, result: "failed" })).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
  call.mockResolvedValue({ items: [{ ...audit, module: "M09" }], as_of: input.anchor });
  await expect(readAudit(scope, { ...input, module: "M03" })).rejects.toThrow();
  call.mockResolvedValue({ items: [{ ...audit, result: "failed" }], as_of: input.anchor });
  await expect(readAudit(scope, input)).rejects.toThrow();
});
it("keeps native counters independent of visible row count, kind and state", async () => {
  call.mockResolvedValue({
    items: [tracking],
    summary: totals,
    as_of: input.anchor,
    next_cursor: null,
  });
  const data = await readTracking(scope, {
    ...input,
    kind: "job",
    state: "retry_wait",
    query: "report_build_v1",
  });
  expect(data.summary).toEqual(totals);
  expect(data.items[0]?.total_count).toBeNull();
  expect(data.items[0]?.next_attempt_at).toBe(tracking.next_attempt_at);
  expect(call.mock.calls[0]![0]).toBe("tracking_directory_get_v1");
});
it("rejects repeated cursors, duplicate native keys and impossible progress", async () => {
  call.mockResolvedValue({
    items: [tracking],
    summary: totals,
    as_of: input.anchor,
    next_cursor: "same",
  });
  await expect(readTracking(scope, { ...input, cursor: "same" })).rejects.toThrow();
  call.mockResolvedValue({
    items: [tracking, tracking],
    summary: totals,
    as_of: input.anchor,
    next_cursor: null,
  });
  await expect(readTracking(scope, input)).rejects.toThrow();
  call.mockResolvedValue({
    items: [{ ...tracking, total_count: 2 }],
    summary: totals,
    as_of: input.anchor,
    next_cursor: null,
  });
  await expect(readTracking(scope, input)).rejects.toThrow();
});
it("does not collapse separate operation and job entries that share a domain id", async () => {
  call.mockResolvedValue({
    items: [
      {
        ...tracking,
        kind: "operation",
        state: "succeeded",
        progress_count: null,
        total_count: null,
        next_attempt_at: null,
      },
      tracking,
    ],
    summary: totals,
    as_of: input.anchor,
    next_cursor: null,
  });
  expect((await readTracking(scope, input)).items).toHaveLength(2);
});
