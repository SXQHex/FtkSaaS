import { v7 as uuidv7 } from "uuid";
import { readMergeDirectory } from "./merge-directory";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type {
  PersonView,
  Preview,
  MergeApprovalDiscovery,
  EntityVersion,
} from "@ftksaas/api-contracts";

export interface MergePair {
  source: PersonView;
  target: PersonView;
}
export interface MergeSnapshot extends MergePair {
  scope: ClientScope;
  preview: Preview;
  reason: string;
  decision: "merge" | "not_duplicate";
}
export type MergeIntent = {
  scope: ClientScope;
  key: string;
  sourceId: string;
  targetId: string;
  preview: { id: string; token: string };
} & (
  | { kind: "apply"; decision: "merge" | "not_duplicate"; reason: string }
  | { kind: "approve"; approvalCenterId: string }
);
const request = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: scope.orgId,
  center_id: scope.centerId,
});
async function pairRead(
  backend: Awaited<ReturnType<typeof scopedBackend>>,
  scope: ClientScope,
  sourceId: string,
  targetId: string,
): Promise<MergePair> {
  if (!sourceId || !targetId || sourceId === targetId) throw new Error("MERGE_PAIR_UNAVAILABLE");
  const [source, target] = await Promise.all([
    backend.call("person_get_v1", {
      ...request(scope),
      person_id: sourceId,
      include_member_summary: true,
    }),
    backend.call("person_get_v1", {
      ...request(scope),
      person_id: targetId,
      include_member_summary: true,
    }),
  ]);
  if (source.id !== sourceId || target.id !== targetId) throw new Error("MERGE_PAIR_UNAVAILABLE");
  return { source, target };
}
export async function readMergePair(scope: ClientScope, sourceId: string, targetId: string) {
  return pairRead(await scopedBackend(scope), scope, sourceId, targetId);
}
export async function previewMerge(
  scope: ClientScope,
  sourceId: string,
  targetId: string,
  reason: string,
  decision: "merge" | "not_duplicate" = "merge",
): Promise<MergeSnapshot> {
  if (!sourceId || !targetId || sourceId === targetId) throw new Error("MERGE_PAIR_UNAVAILABLE");
  const backend = await scopedBackend(scope);
  if (!reason.trim() || reason.trim().length > 2000) throw new Error("MERGE_REASON_REQUIRED");
  const preview = await backend.call("person_merge_preview_v1", {
    ...request(scope),
    source_id: sourceId,
    target_id: targetId,
    reason: reason.trim(),
    decision,
  });
  const summary = preview.merge_summary;
  if (
    !summary ||
    summary.source_id !== sourceId ||
    summary.target_id !== targetId ||
    summary.linked_history !== (decision === "merge") ||
    summary.reason !== reason.trim() ||
    summary.decision !== decision ||
    !preview.id ||
    !preview.token ||
    !Number.isFinite(Date.parse(preview.expires_at))
  )
    throw new Error("MERGE_PREVIEW_UNAVAILABLE");
  // The post-preview reads must match its dependencies before displaying the
  // pair as the basis for consent. A changed person requires a new preview.
  const pair = await pairRead(backend, scope, sourceId, targetId);
  for (const person of [pair.source, pair.target]) {
    const versions = preview.dependencies.versions.filter(
      (entry) => entry.entity.type === "people" && entry.entity.id === person.id,
    );
    if (versions.length !== 1 || versions[0]?.version !== person.version)
      throw new Error("MERGE_PREVIEW_STALE");
  }
  if (summary.required_approval_center_ids.some((id) => !summary.affected_center_ids.includes(id)))
    throw new Error("MERGE_PREVIEW_UNAVAILABLE");
  return { scope: { ...scope }, ...pair, preview, reason: reason.trim(), decision };
}
function approvalRead(
  item: {
    operation: string;
    exists: boolean;
    versions: EntityVersion[];
    merge_approval?: MergeApprovalDiscovery;
  },
  scope: ClientScope,
  previewId?: string,
) {
  const approval = item.merge_approval;
  if (
    item.operation !== "person_merge_approve_v1" ||
    !item.exists ||
    !approval ||
    approval.approval_center_id !== scope.centerId ||
    (previewId && approval.preview.id !== previewId) ||
    !approval.preview.id ||
    !approval.preview.token ||
    approval.source_id === approval.target_id ||
    approval.linked_history !== true ||
    !approval.affected_center_ids.includes(scope.centerId) ||
    !Number.isFinite(Date.parse(approval.expires_at))
  )
    throw new Error("MERGE_APPROVAL_UNAVAILABLE");
  for (const id of [approval.source_id, approval.target_id]) {
    const versions = item.versions.filter(
      (entry) => entry.entity.type === "people" && entry.entity.id === id,
    );
    if (versions.length !== 1 || !versions[0]?.version)
      throw new Error("MERGE_APPROVAL_UNAVAILABLE");
  }
  return { ...approval, versions: item.versions };
}
export async function readMergeApprovals(
  scope: ClientScope,
  cursor?: string,
  context?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, context);
  const page = await backend.call("management_state_get_v1", {
    ...request(scope),
    operation: "person_merge_approve_v1",
    selector: { operation: "person_merge_approve_v1", key: { approval_center_id: scope.centerId } },
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  const items = page.items.map((item) => approvalRead(item, scope));
  if (new Set(items.map((item) => item.preview.id)).size !== items.length)
    throw new Error("MERGE_APPROVAL_UNAVAILABLE");
  return { items, next_cursor: page.next_cursor };
}
export async function readMergeApproval(scope: ClientScope, previewId: string) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    ...request(scope),
    operation: "person_merge_approve_v1",
    selector: {
      operation: "person_merge_approve_v1",
      key: { approval_center_id: scope.centerId, preview_id: previewId },
    },
    page: { limit: 2 },
  });
  if (page.items.length !== 1 || page.next_cursor) throw new Error("MERGE_APPROVAL_UNAVAILABLE");
  return approvalRead(page.items[0]!, scope, previewId);
}
export async function readMergeApprovalPair(scope: ClientScope, previewId: string) {
  const approval = await readMergeApproval(scope, previewId);
  const pair = await readMergePair(scope, approval.source_id, approval.target_id);
  for (const person of [pair.source, pair.target]) {
    const version = approval.versions.find(
      (entry) => entry.entity.type === "people" && entry.entity.id === person.id,
    );
    if (version?.version !== person.version) throw new Error("MERGE_PREVIEW_STALE");
  }
  return { scope: { ...scope }, approval, ...pair };
}
export function mergeApplyIntent(snapshot: MergeSnapshot): MergeIntent {
  if (snapshot.preview.blockers.length || Date.parse(snapshot.preview.expires_at) <= Date.now())
    throw new Error("MERGE_PREVIEW_UNAVAILABLE");
  return {
    kind: "apply",
    scope: { ...snapshot.scope },
    key: uuidv7(),
    sourceId: snapshot.source.id,
    targetId: snapshot.target.id,
    decision: snapshot.decision,
    reason: snapshot.reason,
    preview: { id: snapshot.preview.id, token: snapshot.preview.token },
  };
}
export function mergeApprovalIntent(
  scope: ClientScope,
  approval: MergeApprovalDiscovery,
): MergeIntent {
  if (
    approval.approval_center_id !== scope.centerId ||
    Date.parse(approval.expires_at) <= Date.now() ||
    !approval.required_approvals.some(
      (entry) => entry.center_id === scope.centerId && !entry.approved,
    )
  )
    throw new Error("MERGE_APPROVAL_UNAVAILABLE");
  return {
    kind: "approve",
    scope: { ...scope },
    key: uuidv7(),
    sourceId: approval.source_id,
    targetId: approval.target_id,
    preview: { ...approval.preview },
    approvalCenterId: scope.centerId,
  };
}
export async function writeMerge(intent: MergeIntent) {
  const backend = await scopedBackend(intent.scope);
  const common = {
    ...request(intent.scope),
    operation_key: intent.key,
    preview: { ...intent.preview },
  };
  const result =
    intent.kind === "apply"
      ? await backend.call("person_merge_apply_v1", common)
      : await backend.call("person_merge_approve_v1", {
          ...common,
          approval_center_id: intent.approvalCenterId,
        });
  if (!result.primary_id || (intent.kind === "apply" && result.primary_id !== intent.targetId))
    throw new Error("MERGE_ACK_UNAVAILABLE");
  return result;
}
export async function readMergeOperation(intent: MergeIntent) {
  const backend = await scopedBackend(intent.scope);
  const operation = intent.kind === "apply" ? "person_merge_apply_v1" : "person_merge_approve_v1";
  const result = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation,
    key: intent.key,
  });
  if (
    result.operation !== operation ||
    result.key !== intent.key ||
    (result.status === "succeeded" && result.result_available && !result.result_reference) ||
    (result.result_reference &&
      (result.result_reference.type !== (intent.kind === "apply" ? "people" : "merge_approvals") ||
        (intent.kind === "apply" && result.result_reference.id !== intent.targetId)))
  )
    throw new Error("MERGE_RECEIPT_UNAVAILABLE");
  return result;
}
// Read only after a confirmed command acknowledgement or a succeeded receipt.
export async function readMergeResult(intent: MergeIntent) {
  if (intent.kind === "approve") {
    const approval = await readMergeApproval(intent.scope, intent.preview.id);
    if (
      approval.source_id !== intent.sourceId ||
      approval.target_id !== intent.targetId ||
      !approval.required_approvals.some(
        (entry) => entry.center_id === intent.approvalCenterId && entry.approved,
      )
    )
      throw new Error("MERGE_REREAD_UNAVAILABLE");
    return approval;
  }
  const backend = await scopedBackend(intent.scope);
  const person = await backend.call("person_get_v1", {
    ...request(intent.scope),
    person_id: intent.targetId,
    include_member_summary: true,
  });
  if (
    person.id !== intent.targetId ||
    (intent.decision !== "not_duplicate" && !person.linked_person_ids?.includes(intent.sourceId))
  )
    throw new Error("MERGE_REREAD_UNAVAILABLE");
  if (intent.decision === "not_duplicate") {
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await readMergeDirectory(
        intent.scope,
        "not_duplicate",
        person.display_name,
        cursor,
      );
      const decision = page.items.find(
        (row) =>
          [row.source.id, row.target.id].includes(intent.sourceId) &&
          [row.source.id, row.target.id].includes(intent.targetId),
      );
      if (decision) {
        if (decision.reason !== intent.reason) throw new Error("MERGE_REREAD_UNAVAILABLE");
        return person;
      }
      cursor = page.next_cursor ?? undefined;
      if (cursor && seen.has(cursor)) throw new Error("MERGE_REREAD_UNAVAILABLE");
      if (cursor) seen.add(cursor);
    } while (cursor);
    throw new Error("MERGE_REREAD_UNAVAILABLE");
  }
  return person;
}
