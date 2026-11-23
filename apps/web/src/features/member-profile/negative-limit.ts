import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { RequestNegativeLimitSet, ReservationProtectionPreview } from "@ftksaas/api-contracts";
import { readProfileRights } from "./profile-read";
import { readProfileReservation } from "./reservations";

const count = z.number().int().nonnegative().safe();
export const negativeLimitDraft = z.object({
  disciplineId: z.uuid(),
  quantity: z
    .string()
    .regex(/^(0|[1-9][0-9]*)$/)
    .transform(Number)
    .pipe(count),
  reason: z.string().trim().min(1),
});
export async function readNegativeLimit(
  scope: ClientScope,
  personId: string,
  disciplineId: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  z.uuid().parse(disciplineId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const row = await backend.call("negative_limits_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    discipline_id: disciplineId,
    include_delegation: true,
  });
  if (
    row.person_id !== personId ||
    row.center_id !== scope.centerId ||
    row.discipline_id !== disciplineId
  )
    throw new Error("PROFILE_NEGATIVE_SOURCE_UNAVAILABLE");
  z.number().int().positive().safe().parse(row.version);
  for (const value of [row.override, row.default_limit, row.upper_limit, row.effective_limit])
    count.nullable().parse(value);
  for (const value of [row.reserved_deficit, row.consumed_deficit]) count.parse(value);
  return row;
}
export interface NegativeLimitReview {
  scope: ClientScope;
  personId: string;
  before: Awaited<ReturnType<typeof readNegativeLimit>>;
  value: z.output<typeof negativeLimitDraft>;
  preview: ReservationProtectionPreview;
  affected: { id: string; startsAt: string; endsAt: string }[];
}
export async function previewNegativeLimit(
  scope: ClientScope,
  personId: string,
  draft: unknown,
): Promise<NegativeLimitReview> {
  const value = negativeLimitDraft.parse(draft);
  const before = await readNegativeLimit(scope, personId, value.disciplineId);
  if (before.personal_override_enabled === false) throw new Error("PERSONAL_LIMIT_DISABLED");
  if (before.personal_override_enabled !== true)
    throw new Error("PROFILE_NEGATIVE_SOURCE_UNAVAILABLE");
  const backend = await scopedBackend(scope);
  const change = {
    kind: "negative_limit" as const,
    person_id: personId,
    discipline_id: value.disciplineId,
    allowed_negative_credits: value.quantity,
  };
  const preview = await backend.call("reservation_impact_preview_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    change,
    reason: value.reason,
  });
  const actual = preview.change;
  if (
    actual.kind !== "negative_limit" ||
    actual.person_id !== personId ||
    actual.discipline_id !== value.disciplineId ||
    actual.allowed_negative_credits !== value.quantity ||
    preview.preserves_reservations !== true ||
    preview.waives_independent_blocks !== false
  )
    throw new Error("PROFILE_NEGATIVE_PREVIEW_UNAVAILABLE");
  z.uuid().parse(preview.preview.id);
  z.string().min(1).parse(preview.preview.token);
  z.iso.datetime({ offset: true }).parse(preview.preview.expires_at);
  const ids = new Set<string>(),
    sessions = new Map<string, { starts_at: string; ends_at: string }>();
  const affected: NegativeLimitReview["affected"] = [];
  for (const item of preview.affected) {
    z.uuid().parse(item.reservation_id);
    z.uuid().parse(item.session_id);
    if (item.person_id !== personId || ids.has(item.reservation_id))
      throw new Error("PROFILE_NEGATIVE_PREVIEW_UNAVAILABLE");
    ids.add(item.reservation_id);
    let session = sessions.get(item.session_id);
    if (!session) {
      const row = await backend.call("session_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        session_id: item.session_id,
      });
      if (row.id !== item.session_id) throw new Error("PROFILE_NEGATIVE_PREVIEW_UNAVAILABLE");
      z.iso.datetime({ offset: true }).parse(row.starts_at);
      z.iso.datetime({ offset: true }).parse(row.ends_at);
      if (Date.parse(row.starts_at) >= Date.parse(row.ends_at))
        throw new Error("PROFILE_NEGATIVE_PREVIEW_UNAVAILABLE");
      session = { starts_at: row.starts_at, ends_at: row.ends_at };
      sessions.set(item.session_id, session);
    }
    affected.push({
      id: item.reservation_id,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
    });
  }
  return { scope: { ...scope }, personId, before, value, preview, affected };
}
export interface NegativeLimitIntent {
  scope: ClientScope;
  review: NegativeLimitReview;
  operation: "negative_limit_set_v1";
  request: Omit<RequestNegativeLimitSet, "request_id">;
}
export function negativeLimitIntent(review: NegativeLimitReview): NegativeLimitIntent {
  if (review.preview.preview.blockers.length) throw new Error("PROFILE_NEGATIVE_BLOCKED");
  return {
    scope: { ...review.scope },
    review: structuredClone(review),
    operation: "negative_limit_set_v1",
    request: {
      client_api_version: 1,
      org_id: review.scope.orgId,
      center_id: review.scope.centerId,
      operation_key: uuidv7(),
      expected_version: review.before.version,
      person_id: review.personId,
      discipline_id: review.value.disciplineId,
      allowed_negative_credits: review.value.quantity,
      reason: review.value.reason,
      impact_approval: { id: review.preview.preview.id, token: review.preview.preview.token },
      accepted_reservation_ids: review.affected.map((x) => x.id),
    },
  };
}
export async function writeNegativeLimit(intent: NegativeLimitIntent) {
  const backend = await scopedBackend(intent.scope);
  return backend.call("negative_limit_set_v1", { ...intent.request, request_id: uuidv7() });
}
export async function readNegativeLimitReceipt(intent: NegativeLimitIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference && result.result_reference.type !== "negative_limit_overrides")
  )
    throw new Error("PROFILE_NEGATIVE_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readNegativeLimitResult(intent: NegativeLimitIntent, id?: string) {
  if (!id) throw new Error("PROFILE_NEGATIVE_RESULT_UNAVAILABLE");
  z.uuid().parse(id);
  const { review } = intent;
  const limit = await readNegativeLimit(intent.scope, review.personId, review.value.disciplineId);
  if (
    limit.override !== review.value.quantity ||
    limit.override_version === null ||
    limit.override_version <= (review.before.override_version ?? 0)
  )
    throw new Error("PROFILE_NEGATIVE_RESULT_UNAVAILABLE");
  const rights = await readProfileRights(intent.scope, review.personId);
  for (const item of review.preview.affected) {
    const row = await readProfileReservation(
      intent.scope,
      review.personId,
      item.reservation_id,
      item.session_id,
    );
    if (row.state !== "active") throw new Error("PROFILE_NEGATIVE_RESULT_UNAVAILABLE");
  }
  return { limit, rights };
}
export type NegativeLimitResult = Awaited<ReturnType<typeof readNegativeLimitResult>>;
