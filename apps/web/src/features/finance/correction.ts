import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  CashSummary,
  Preview,
  RequestCollectionCorrectApply,
  CashCorrection,
} from "@ftksaas/api-contracts";
import { getTemporal } from "../../lib/temporal";
import { readFinancePage, type FinanceSelection } from "./finance";
import type { FinanceDraft } from "./finance-action-sheet";
export interface CorrectionBase {
  scope: ClientScope;
  selection: FinanceSelection;
  movement: CashSummary;
  version: number;
}
export interface CorrectionReview {
  base: CorrectionBase;
  correction: CashCorrection;
  reason: string;
  preview: Preview;
}
export interface CorrectionIntent {
  scope: ClientScope;
  selection: FinanceSelection;
  operation: "collection_correct_apply_v1";
  base: CorrectionBase;
  correction: CashCorrection;
  request: Omit<RequestCollectionCorrectApply, "request_id">;
}
async function movement(scope: ClientScope, selection: FinanceSelection, id: string) {
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const data = await readFinancePage(scope, selection, cursor),
      row = data.movements.items.find((x) => x.id === id);
    if (row) return { data, row };
    cursor = data.movements.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("FINANCE_SOURCE_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new Error("FINANCE_SOURCE_UNAVAILABLE");
}
export async function readCorrectionBase(
  scope: ClientScope,
  selection: FinanceSelection,
  id: string,
): Promise<CorrectionBase> {
  z.uuid().parse(id);
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "collection_correct_preview_v1",
    selector: { operation: "collection_correct_preview_v1", key: { cash_movement_id: id } },
    page: { limit: 1 },
  });
  const item = page.items[0],
    versions =
      item?.versions.filter((x) => x.entity.type === "cash_movements" && x.entity.id === id) ?? [];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !item?.exists ||
    item.entity?.type !== "cash_movements" ||
    item.entity.id !== id ||
    item.current?.operation !== "collection_correct_preview_v1" ||
    item.current.values.cash_movement_id !== id ||
    versions.length !== 1 ||
    !Number.isSafeInteger(versions[0]!.version) ||
    versions[0]!.version < 1
  )
    throw new Error("FINANCE_AUTHORITY_UNAVAILABLE");
  const { row } = await movement(scope, selection, id);
  if (row.kind !== "collection" || row.previous_id || row.currency !== selection.currency)
    throw new Error("FINANCE_SOURCE_UNAVAILABLE");
  return {
    scope: { ...scope },
    selection: { ...selection },
    movement: structuredClone(row),
    version: versions[0]!.version,
  };
}
export async function previewCorrection(
  base: CorrectionBase,
  timezone: string,
  draft: FinanceDraft,
): Promise<CorrectionReview> {
  const value = z
    .object({
      personId: z.uuid(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      amount: z
        .string()
        .regex(/^[1-9][0-9]{0,18}$/)
        .refine((v) => BigInt(v) <= 9223372036854775807n),
      direction: z.enum(["increase", "decrease"]),
      reason: z.string().trim().min(1),
      occurredAt: z.string().min(1),
    })
    .parse(draft);
  if (
    value.personId !== base.selection.personId ||
    value.currency !== base.selection.currency ||
    value.currency !== base.movement.currency
  )
    throw new Error("FINANCE_SCOPE_CHANGED");
  const temporal = await getTemporal();
  let occurred_at: string;
  try {
    occurred_at = temporal.PlainDateTime.from(value.occurredAt)
      .toZonedDateTime(timezone, { disambiguation: "reject" })
      .toInstant()
      .toString();
  } catch {
    throw new Error("FINANCE_TIME_INVALID");
  }
  const correction: CashCorrection = {
      amount_minor: value.amount,
      currency: value.currency,
      direction: value.direction,
      occurred_at,
    },
    backend = await scopedBackend(base.scope);
  const preview = await backend.call("collection_correct_preview_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: base.scope.orgId,
    center_id: base.scope.centerId,
    cash_movement_id: base.movement.id,
    correction,
    reason: value.reason,
  });
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  // Show every native effect. Bind the root and person effects to the reviewed
  // scope; debt allocation deltas come from the server, never client arithmetic.
  const cashEffects = preview.effects.filter((effect) => effect.entity.type === "cash_movements");
  const creditEffects = preview.effects.filter((effect) => effect.entity.type === "people");
  const money = z
    .string()
    .regex(/^(0|[1-9][0-9]{0,18})$/)
    .refine((v) => BigInt(v) <= 9223372036854775807n);
  if (
    cashEffects.length !== 1 ||
    creditEffects.length !== 1 ||
    cashEffects[0]!.entity.id !== base.movement.id ||
    cashEffects[0]!.action !== "adjust" ||
    cashEffects[0]!.amount_minor !== correction.amount_minor ||
    cashEffects[0]!.reason !== value.reason ||
    creditEffects[0]!.entity.id !== base.selection.personId ||
    creditEffects[0]!.action !== (correction.direction === "decrease" ? "reverse" : "create") ||
    preview.effects.some(
      (effect) =>
        !z.uuid().safeParse(effect.entity.id).success ||
        !money.safeParse(effect.amount_minor).success ||
        effect.currency !== correction.currency ||
        !["cash_movements", "people", "debts"].includes(effect.entity.type) ||
        (effect.entity.type === "debts" &&
          effect.action !== (correction.direction === "decrease" ? "reverse" : "adjust")),
    )
  )
    throw new Error("FINANCE_PREVIEW_UNAVAILABLE");
  return { base: structuredClone(base), correction, reason: value.reason, preview };
}
export function correctionIntent(review: CorrectionReview): CorrectionIntent {
  if (review.preview.blockers.length || Date.parse(review.preview.expires_at) <= Date.now())
    throw new Error("FINANCE_PREVIEW_STALE");
  return {
    scope: { ...review.base.scope },
    selection: { ...review.base.selection },
    base: structuredClone(review.base),
    correction: { ...review.correction },
    operation: "collection_correct_apply_v1",
    request: {
      client_api_version: 1,
      org_id: review.base.scope.orgId,
      center_id: review.base.scope.centerId,
      operation_key: uuidv7(),
      preview: { id: review.preview.id, token: review.preview.token },
    },
  };
}
export async function writeCorrection(intent: CorrectionIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readCorrectionReceipt(intent: CorrectionIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference && receipt.result_reference.type !== "cash_movements")
  )
    throw new Error("FINANCE_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readCorrectionResult(intent: CorrectionIntent, id?: string) {
  z.uuid().parse(id);
  if (id === intent.base.movement.id) throw new Error("FINANCE_RESULT_UNAVAILABLE");
  const { data, row } = await movement(intent.scope, intent.selection, id!);
  if (
    row.previous_id !== intent.base.movement.id ||
    row.kind !==
      (intent.correction.direction === "increase" ? "correction_in" : "correction_out") ||
    row.amount_minor !== intent.correction.amount_minor ||
    row.currency !== intent.correction.currency ||
    Date.parse(row.occurred_at) !== Date.parse(intent.correction.occurred_at)
  )
    throw new Error("FINANCE_RESULT_UNAVAILABLE");
  const original = (await movement(intent.scope, intent.selection, intent.base.movement.id)).row;
  if (
    original.kind !== "collection" ||
    original.amount_minor !== intent.base.movement.amount_minor ||
    original.currency !== intent.base.movement.currency ||
    Date.parse(original.occurred_at) !== Date.parse(intent.base.movement.occurred_at) ||
    (original.payment?.method ?? null) !== (intent.base.movement.payment?.method ?? null) ||
    (original.payment?.reference ?? null) !== (intent.base.movement.payment?.reference ?? null)
  )
    throw new Error("FINANCE_RESULT_UNAVAILABLE");
  return data;
}
