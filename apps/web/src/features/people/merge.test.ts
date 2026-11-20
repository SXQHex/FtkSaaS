import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ManagementStatePage,
  ManagementStateView,
  PersonView,
  Preview,
} from "@ftksaas/api-contracts";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { readMergeDirectory, mergeReviewRows } from "./merge-directory";
import {
  previewMerge,
  mergeApplyIntent,
  mergeApprovalIntent,
  writeMerge,
  readMergeResult,
  readMergeOperation,
} from "./merge";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const sourceId = "019a7b00-0000-7000-8000-000000000005",
  targetId = "019a7b00-0000-7000-8000-000000000006",
  previewId = "019a7b00-0000-7000-8000-000000000007";
const person = (id: string): PersonView => ({
  id,
  display_name: id === sourceId ? "Fixture Source" : "Fixture Target",
  version: 3,
  relationships: [],
  discipline_relationships: [],
  contacts: [],
});
const preview = (decision: "merge" | "not_duplicate" = "merge"): Preview => ({
  id: previewId,
  token: "synthetic-preview",
  scope_hash: "synthetic-scope",
  expires_at: "2099-01-01T00:00:00Z",
  effects: [],
  blockers: [],
  dependencies: {
    policy_hashes: [],
    permission_hash: "synthetic-permission",
    versions: [sourceId, targetId].map((id) => ({ entity: { type: "people", id }, version: 3 })),
  },
  merge_summary: {
    source_id: sourceId,
    target_id: targetId,
    affected_center_ids: [scope.centerId],
    required_approval_center_ids: [],
    linked_history: decision === "merge",
    reason: "Review reason",
    decision,
  },
});
function row(
  state: "suggested" | "completed" | "not_duplicate" = "suggested",
): ManagementStateView {
  return {
    operation: "person_merge_preview_v1",
    exists: true,
    entity: { type: "people", id: targetId },
    state: state === "suggested" ? "pending" : state === "completed" ? "accepted" : "rejected",
    versions: preview().dependencies.versions,
    as_of: "2026-11-15T00:00:00Z",
    current: {
      operation: "person_merge_preview_v1",
      values: { source_id: sourceId, target_id: targetId },
    },
    merge_review: {
      state,
      source: { id: sourceId, display_name: "Fixture Source", version: 3 },
      target: { id: targetId, display_name: "Fixture Target", version: 3 },
      matching_kinds: state === "suggested" ? ["email"] : [],
      reason: state === "suggested" ? null : "Review reason",
      recorded_at: state === "suggested" ? null : "2026-11-15T00:00:00Z",
    },
  };
}
const page = (item: ManagementStateView = row()): ManagementStatePage => ({
  items: [item],
  next_cursor: null,
  as_of: item.as_of,
  merge_review_summary: { total: 10, filtered: 1, by_state: [{ state: "suggested", count: 1 }] },
});
beforeEach(() => {
  call.mockReset();
});
describe("Merge scoped review and commands", () => {
  it("requests one server-filtered cursor page and retains backend-wide counts", async () => {
    call.mockResolvedValue(page());
    const result = await readMergeDirectory(scope, "suggested", " Fixture ", "cursor");
    expect(call).toHaveBeenCalledExactlyOnceWith(
      "management_state_get_v1",
      expect.objectContaining({
        org_id: scope.orgId,
        center_id: scope.centerId,
        selector: {
          operation: "person_merge_preview_v1",
          key: { directory: "center", status: "suggested", query: "Fixture" },
        },
        page: { limit: 20, cursor: "cursor" },
      }),
    );
    expect(result.summary.total).toBe(10);
    expect(result.items[0]?.matching_kinds).toEqual(["email"]);
  });
  it("rejects a row with a mismatched state or person version rather than trusting its label", () => {
    const item = row();
    expect(() => mergeReviewRows(page(item), "completed")).toThrow("MERGE_DIRECTORY_UNAVAILABLE");
    item.versions = [];
    expect(() => mergeReviewRows(page(item), "suggested")).toThrow("MERGE_DIRECTORY_UNAVAILABLE");
  });
  it.each(["merge", "not_duplicate"] as const)(
    "pins reason and %s decision and checks fresh pair dependencies",
    async (decision) => {
      call.mockImplementation(async (op, r) =>
        op === "person_merge_preview_v1" ? preview(decision) : person(r.person_id),
      );
      const result = await previewMerge(scope, sourceId, targetId, " Review reason ", decision);
      expect(call).toHaveBeenNthCalledWith(
        1,
        "person_merge_preview_v1",
        expect.objectContaining({ reason: "Review reason", decision }),
      );
      expect(call).toHaveBeenCalledWith(
        "person_get_v1",
        expect.objectContaining({ include_member_summary: true }),
      );
      expect(result.reason).toBe("Review reason");
      expect(result.decision).toBe(decision);
    },
  );
  it("refuses changed pinned reason, empty reason, and stale dependencies", async () => {
    call.mockResolvedValue(preview());
    await expect(previewMerge(scope, sourceId, targetId, "Different")).rejects.toThrow(
      "MERGE_PREVIEW_UNAVAILABLE",
    );
    call.mockClear();
    await expect(previewMerge(scope, sourceId, targetId, " ")).rejects.toThrow(
      "MERGE_REASON_REQUIRED",
    );
    expect(call).not.toHaveBeenCalled();
    call.mockImplementation(async (op, r) =>
      op === "person_merge_preview_v1" ? preview() : { ...person(r.person_id), version: 4 },
    );
    await expect(previewMerge(scope, sourceId, targetId, "Review reason")).rejects.toThrow(
      "MERGE_PREVIEW_STALE",
    );
  });
  it("refuses an expired preview before creating any write intent", () => {
    expect(() =>
      mergeApplyIntent({
        scope,
        source: person(sourceId),
        target: person(targetId),
        preview: { ...preview(), expires_at: "2020-01-01T00:00:00Z" },
        reason: "Review reason",
        decision: "merge",
      }),
    ).toThrow("MERGE_PREVIEW_UNAVAILABLE");
    expect(call).not.toHaveBeenCalled();
  });
  it("replays only the frozen key/capability and validates the target acknowledgement", async () => {
    const intent = mergeApplyIntent({
      scope,
      source: person(sourceId),
      target: person(targetId),
      preview: preview(),
      reason: "Review reason",
      decision: "merge",
    });
    call.mockResolvedValue({ primary_id: targetId });
    await writeMerge(intent);
    await writeMerge(intent);
    expect(call.mock.calls.map((x) => x[1].operation_key)).toEqual([intent.key, intent.key]);
    expect(call.mock.calls[0]?.[1]).not.toHaveProperty("reason");
    call.mockResolvedValue({ primary_id: sourceId });
    await expect(writeMerge(intent)).rejects.toThrow("MERGE_ACK_UNAVAILABLE");
  });
  it("requires the canonical alias after a merge, and a matching durable decision after dismissal", async () => {
    const snapshot = {
      scope,
      source: person(sourceId),
      target: person(targetId),
      preview: preview(),
      reason: "Review reason",
      decision: "merge" as const,
    };
    call.mockResolvedValue(person(targetId));
    await expect(readMergeResult(mergeApplyIntent(snapshot))).rejects.toThrow(
      "MERGE_REREAD_UNAVAILABLE",
    );
    call.mockResolvedValue({ ...person(targetId), linked_person_ids: [sourceId] });
    await expect(readMergeResult(mergeApplyIntent(snapshot))).resolves.toMatchObject({
      id: targetId,
    });
    const decision = mergeApplyIntent({
      ...snapshot,
      decision: "not_duplicate",
      preview: preview("not_duplicate"),
    });
    call.mockImplementation(async (op) =>
      op === "person_get_v1" ? person(targetId) : page(row("not_duplicate")),
    );
    await expect(readMergeResult(decision)).resolves.toMatchObject({ id: targetId });
    expect(call).toHaveBeenCalledWith(
      "management_state_get_v1",
      expect.objectContaining({
        selector: {
          operation: "person_merge_preview_v1",
          key: { directory: "center", status: "not_duplicate", query: "Fixture Target" },
        },
      }),
    );
  });
  it("keeps another center's approval capability distinct from an apply", async () => {
    const approval = {
      approval_center_id: scope.centerId,
      preview: { id: previewId, token: "synthetic-approval" },
      source_id: sourceId,
      target_id: targetId,
      expires_at: "2099-01-01T00:00:00Z",
      affected_center_ids: [scope.centerId],
      required_approvals: [{ center_id: scope.centerId, approved: false }],
      linked_history: true as const,
      effects: [],
    };
    const intent = mergeApprovalIntent(scope, approval);
    call.mockResolvedValue({ primary_id: previewId });
    await writeMerge(intent);
    expect(call).toHaveBeenCalledExactlyOnceWith(
      "person_merge_approve_v1",
      expect.objectContaining({ approval_center_id: scope.centerId, preview: approval.preview }),
    );
    expect(() => mergeApprovalIntent({ ...scope, centerId: targetId }, approval)).toThrow(
      "MERGE_APPROVAL_UNAVAILABLE",
    );
  });
  it("does not accept another operation key or result target as its recovery receipt", async () => {
    const intent = mergeApplyIntent({
      scope,
      source: person(sourceId),
      target: person(targetId),
      preview: preview(),
      reason: "Review reason",
      decision: "merge",
    });
    call.mockResolvedValue({
      operation: "person_merge_apply_v1",
      key: "other",
      status: "succeeded",
      result_available: true,
      result_reference: { type: "people", id: targetId },
    });
    await expect(readMergeOperation(intent)).rejects.toThrow("MERGE_RECEIPT_UNAVAILABLE");
  });
});
