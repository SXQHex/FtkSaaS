import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { ManagementStatePage, MergeReviewDetail } from "../../lib/api-contracts/generated";

export type MergeReviewState = MergeReviewDetail["state"];
export function mergeReviewRows(page: ManagementStatePage, state: MergeReviewState) {
  const rows = page.items.map((item) => {
    const review = item.merge_review;
    if (
      item.operation !== "person_merge_preview_v1" ||
      !item.exists ||
      item.current?.operation !== "person_merge_preview_v1" ||
      !review ||
      review.state !== state ||
      !review.source.id ||
      !review.target.id ||
      review.source.id === review.target.id ||
      item.current.values.source_id !== review.source.id ||
      item.current.values.target_id !== review.target.id ||
      item.entity?.type !== "people" ||
      item.entity.id !== review.target.id ||
      item.state !==
        (state === "suggested" ? "pending" : state === "completed" ? "accepted" : "rejected") ||
      (review.recorded_at !== null && !Number.isFinite(Date.parse(review.recorded_at)))
    )
      throw new Error("MERGE_DIRECTORY_UNAVAILABLE");
    for (const person of [review.source, review.target]) {
      const versions = item.versions.filter(
        (v) => v.entity.type === "people" && v.entity.id === person.id,
      );
      if (versions.length !== 1 || versions[0]?.version !== person.version || person.version < 1)
        throw new Error("MERGE_DIRECTORY_UNAVAILABLE");
    }
    if (state === "suggested" && !review.matching_kinds.length)
      throw new Error("MERGE_DIRECTORY_UNAVAILABLE");
    return { ...review, id: JSON.stringify([review.source.id, review.target.id, review.state]) };
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new Error("MERGE_DIRECTORY_UNAVAILABLE");
  return rows;
}
export async function readMergeDirectory(
  scope: ClientScope,
  state: MergeReviewState,
  query = "",
  cursor?: string,
  limit = 20,
) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "person_merge_preview_v1",
    selector: {
      operation: "person_merge_preview_v1",
      key: { directory: "center", status: state, ...(query.trim() ? { query: query.trim() } : {}) },
    },
    page: { limit, ...(cursor ? { cursor } : {}) },
  });
  const summary = page.merge_review_summary;
  if (
    !summary ||
    [summary.total, summary.filtered, ...summary.by_state.map((x) => x.count)].some(
      (x) => !Number.isSafeInteger(x) || x < 0,
    ) ||
    summary.filtered > summary.total ||
    new Set(summary.by_state.map((x) => x.state)).size !== summary.by_state.length
  )
    throw new Error("MERGE_DIRECTORY_UNAVAILABLE");
  return { items: mergeReviewRows(page, state), summary, next_cursor: page.next_cursor };
}
