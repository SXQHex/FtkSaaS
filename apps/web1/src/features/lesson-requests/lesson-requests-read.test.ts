import { beforeEach, expect, it, vi } from "vitest";
import { readLessonRequests } from "./lesson-requests-read";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const scope = { accountId: "account", orgId: "org", centerId: "center" };
const summary = { pending: 25, alternative_offered: 12, approved: 9, rejected: 4 };
beforeEach(() => call.mockReset());
it("uses the typed filter and summary opt-in with the native cursor without deriving counters", async () => {
  call.mockResolvedValue({
    items: [],
    next_cursor: null,
    as_of: "2026-11-16T00:00:00Z",
    lesson_request_summary: summary,
  });
  expect(await readLessonRequests(scope, "native-cursor", "resolved")).toMatchObject({
    items: [],
    summary,
  });
  expect(call).toHaveBeenCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      org_id: "org",
      center_id: "center",
      operation: "lesson_request_create_v1",
      selector: {
        operation: "lesson_request_create_v1",
        key: { status: "resolved", include_summary: true },
      },
      page: { limit: 20, sort: "created_at_asc", cursor: "native-cursor" },
    }),
  );
});
it("does not replace missing or invalid native totals with zero", async () => {
  call.mockResolvedValue({ items: [], next_cursor: null });
  await expect(readLessonRequests(scope)).rejects.toThrow();
  call.mockResolvedValue({
    items: [],
    next_cursor: null,
    lesson_request_summary: { ...summary, pending: -1 },
  });
  await expect(readLessonRequests(scope)).rejects.toThrow();
});
it("rejects cursor repetition before treating the page as an empty success", async () => {
  call.mockResolvedValue({ items: [], next_cursor: "repeat", lesson_request_summary: summary });
  await expect(readLessonRequests(scope, "repeat", "all")).rejects.toThrow(
    "LESSON_REQUEST_PAGE_UNAVAILABLE",
  );
});
