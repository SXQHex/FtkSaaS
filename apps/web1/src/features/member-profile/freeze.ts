import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  Preview,
  RequestFreezePreview,
  RequestFreezeEndPreview,
  RequestFreezeApply,
  RequestFreezeEndApply,
  EntitlementView,
  TableFreezes,
  RequestFreezeCancelPreview,
  RequestFreezeCancelApply,
  FreezeCancellationImpact,
} from "../../lib/api-contracts/generated";
import { readProfileRights } from "./profile-read";
import { getTemporal } from "../../lib/temporal";

export type FreezeAction = "freeze" | "unfreeze" | "cancelFreeze";
const dates = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reason: z.string().trim().min(1),
});
const end = z.object({ endDate: z.iso.date(), reason: z.string().trim().min(1) });
type Binding = { id: string; version: number };
export interface FreezeReview {
  scope: ClientScope;
  personId: string;
  action: FreezeAction;
  before: EntitlementView & { version: number; freezes: TableFreezes[] };
  freeze?: TableFreezes;
  request:
    | Omit<RequestFreezePreview, "request_id">
    | Omit<RequestFreezeEndPreview, "request_id">
    | Omit<RequestFreezeCancelPreview, "request_id">;
  preview: Preview;
  cancellation?: FreezeCancellationImpact;
  bindings: Binding[];
}
async function readBindings(scope: ClientScope, ids: string[]): Promise<Binding[]> {
  if (new Set(ids).size !== ids.length) throw new Error("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
  if (!ids.length) return [];
  const backend = await scopedBackend(scope),
    bindings: Binding[] = [];
  for (const id of ids) {
    const page = await backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "reservation_cancel_v1",
      selector: { operation: "reservation_cancel_v1", key: { reservation_id: id } },
      page: { limit: 1 },
    });
    const item = page.items[0],
      versions =
        item?.versions.filter((x) => x.entity.type === "reservations" && x.entity.id === id) ?? [];
    if (
      page.items.length !== 1 ||
      page.next_cursor ||
      !item?.exists ||
      item.entity?.type !== "reservations" ||
      item.entity.id !== id ||
      item.state !== "active" ||
      item.current?.operation !== "reservation_cancel_v1" ||
      item.current.values.reservation_id !== id ||
      versions.length !== 1
    )
      throw new Error("PROFILE_FREEZE_BINDING_UNAVAILABLE");
    bindings.push({ id, version: z.number().int().positive().safe().parse(versions[0]!.version) });
  }
  return bindings;
}
export async function previewFreeze(
  scope: ClientScope,
  personId: string,
  saleId: string,
  action: FreezeAction,
  draft: unknown,
  freezeId?: string,
): Promise<FreezeReview> {
  z.uuid().parse(saleId);
  const period = action === "freeze" ? dates.parse(draft) : undefined,
    ending = action === "unfreeze" ? end.parse(draft) : undefined,
    value = period ?? ending ?? z.object({ reason: z.string().trim().min(1) }).parse(draft),
    rights = await readProfileRights(scope, personId),
    row = rights.find((x) => x.sale_id === saleId);
  if (!row || row.state !== "active" || row.sale_state !== "active" || !row.freezes)
    throw new Error("PROFILE_FREEZE_SOURCE_UNAVAILABLE");
  const before = {
    ...row,
    version: z.number().int().positive().safe().parse(row.version),
    freezes: row.freezes,
  };
  const T = await getTemporal();
  let freeze: TableFreezes | undefined;
  if (action === "freeze") {
    const startDate = period!.startDate;
    if (T.PlainDate.compare(startDate, period!.endDate) >= 0)
      throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "END_AFTER_START" }]);
  } else {
    z.uuid().parse(freezeId);
    freeze = row.freezes.find((x) => x.id === freezeId);
    if (!freeze || !["scheduled", "active"].includes(freeze.state))
      throw new Error("PROFILE_FREEZE_SOURCE_UNAVAILABLE");
    z.number().int().positive().safe().parse(freeze.version);
    if (action === "cancelFreeze") {
      if (
        freeze.state !== "scheduled" ||
        freeze.actual_end != null ||
        T.Instant.compare(T.Now.instant(), T.Instant.from(freeze.starts_at)) >= 0
      )
        throw new Error("PROFILE_FREEZE_CANCEL_UNAVAILABLE");
    } else if (T.Instant.compare(T.Now.instant(), T.Instant.from(freeze.starts_at)) < 0)
      throw new Error("FREEZE_CANCEL_UNAVAILABLE");
  }
  const backend = await scopedBackend(scope),
    common = {
      client_api_version: 1 as const,
      org_id: scope.orgId,
      center_id: scope.centerId,
      reason: value.reason,
    };
  let request: FreezeReview["request"],
    preview: Preview,
    cancellation: FreezeCancellationImpact | undefined;
  if (action === "freeze") {
    request = {
      ...common,
      sale_id: saleId,
      dates: { start_date: period!.startDate, end_date: period!.endDate },
    };
    preview = await backend.call("freeze_preview_v1", { ...request, request_id: uuidv7() });
  } else if (action === "cancelFreeze") {
    request = { ...common, freeze_id: freeze!.id };
    const quote = await backend.call("freeze_cancel_preview_v1", {
      ...request,
      request_id: uuidv7(),
    });
    preview = quote;
    cancellation = quote.freeze_cancellation;
    if (
      !cancellation ||
      cancellation.freeze_id !== freeze!.id ||
      cancellation.sale_id !== saleId ||
      cancellation.state !== "cancelled" ||
      cancellation.previous_end_date !== before.end_date ||
      cancellation.preserves_reservations !== true
    )
      throw new Error("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
    z.number().int().nonnegative().safe().parse(cancellation.removed_extension_days);
    z.iso.date().parse(cancellation.end_date);
    z.iso.date().parse(cancellation.previous_end_date);
    z.iso.datetime({ offset: true }).parse(cancellation.valid_until);
  } else {
    request = { ...common, freeze_id: freeze!.id, end_date: ending!.endDate };
    preview = await backend.call("freeze_end_preview_v1", { ...request, request_id: uuidv7() });
  }
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  const root =
    action === "freeze" ? { type: "sales", id: saleId } : { type: "freezes", id: freeze!.id };
  if (
    !preview.effects.some(
      (x) =>
        x.entity.type === root.type &&
        x.entity.id === root.id &&
        x.action === (action === "cancelFreeze" ? "cancel" : "adjust"),
    )
  )
    throw new Error("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
  if (action === "cancelFreeze") {
    const saleEffects = preview.effects.filter((effect) => effect.entity.type === "sales");
    if (
      preview.effects.filter((effect) => effect.entity.type === "freezes").length !== 1 ||
      saleEffects.length !== 1 ||
      saleEffects[0].entity.id !== saleId ||
      saleEffects[0].action !== "adjust" ||
      saleEffects[0].quantity !== cancellation!.removed_extension_days ||
      preview.effects.some(
        (effect) =>
          !(
            effect.entity.type === "sales" &&
            effect.entity.id === saleId &&
            effect.action === "adjust"
          ) &&
          !(
            effect.entity.type === "freezes" &&
            effect.entity.id === freeze!.id &&
            effect.action === "cancel"
          ) &&
          !(effect.entity.type === "reservations" && effect.action === "adjust"),
      )
    )
      throw new Error("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
  } else if (
    preview.effects.some(
      (x) =>
        x.action !== "adjust" ||
        (x.entity.type !== "reservations" &&
          (x.entity.type !== root.type || x.entity.id !== root.id)),
    )
  )
    throw new Error("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
  const ids = preview.effects
    .filter((x) => x.entity.type === "reservations")
    .map((x) => z.uuid().parse(x.entity.id));
  const bindings = await readBindings(scope, ids);
  return {
    scope: { ...scope },
    personId,
    action,
    before,
    freeze,
    request,
    preview,
    bindings,
    cancellation,
  };
}
export interface FreezeIntent {
  scope: ClientScope;
  review: FreezeReview;
  operation: "freeze_apply_v1" | "freeze_end_apply_v1" | "freeze_cancel_apply_v1";
  request: Omit<
    RequestFreezeApply | RequestFreezeEndApply | RequestFreezeCancelApply,
    "request_id"
  >;
}
export function freezeIntent(review: FreezeReview): FreezeIntent {
  if (review.preview.blockers.length) throw new Error("PROFILE_FREEZE_BLOCKED");
  if (Date.parse(review.preview.expires_at) <= Date.now())
    throw new Error("PROFILE_FREEZE_PREVIEW_UNAVAILABLE");
  return {
    scope: { ...review.scope },
    review: structuredClone(review),
    operation:
      review.action === "freeze"
        ? "freeze_apply_v1"
        : review.action === "cancelFreeze"
          ? "freeze_cancel_apply_v1"
          : "freeze_end_apply_v1",
    request: {
      client_api_version: 1,
      org_id: review.scope.orgId,
      center_id: review.scope.centerId,
      operation_key: uuidv7(),
      preview: { id: review.preview.id, token: review.preview.token },
    },
  };
}
export async function writeFreeze(intent: FreezeIntent) {
  const backend = await scopedBackend(intent.scope),
    result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  if (intent.review.freeze && result.primary_id !== intent.review.freeze.id)
    throw new Error("PROFILE_FREEZE_RESULT_UNAVAILABLE");
  return result;
}
export async function readFreezeReceipt(intent: FreezeIntent) {
  const backend = await scopedBackend(intent.scope),
    result = await backend.call("operation_status_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      operation: intent.operation,
      key: intent.request.operation_key,
    });
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference &&
      (result.result_reference.type !== "freezes" ||
        (intent.review.freeze && result.result_reference.id !== intent.review.freeze.id)))
  )
    throw new Error("PROFILE_FREEZE_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readFreezeResult(intent: FreezeIntent, id?: string) {
  const resultId = z.uuid().parse(id ?? intent.review.freeze?.id);
  const { review, scope } = intent,
    rights = await readProfileRights(scope, review.personId),
    row = rights.find((x) => x.sale_id === review.before.sale_id),
    freeze = row?.freezes?.find((x) => x.id === resultId);
  if (!row || !row.version || row.version <= review.before.version || !freeze)
    throw new Error("PROFILE_FREEZE_RESULT_UNAVAILABLE");
  const T = await getTemporal(),
    localDate = (value: string) =>
      T.Instant.from(value).toZonedDateTimeISO(row.timezone).toPlainDate().toString();
  if ("dates" in review.request) {
    if (
      review.before.freezes.some((x) => x.id === resultId) ||
      freeze.preview_id !== review.preview.id ||
      !["scheduled", "active"].includes(freeze.state) ||
      localDate(freeze.starts_at) !== review.request.dates.start_date ||
      localDate(freeze.planned_end) !== review.request.dates.end_date
    )
      throw new Error("PROFILE_FREEZE_RESULT_UNAVAILABLE");
  } else if (review.action === "cancelFreeze") {
    if (
      !review.freeze ||
      !review.cancellation ||
      freeze.id !== review.freeze.id ||
      freeze.state !== "cancelled" ||
      freeze.actual_end != null ||
      freeze.extension_until != null ||
      Date.parse(freeze.starts_at) !== Date.parse(review.freeze.starts_at) ||
      Date.parse(freeze.planned_end) !== Date.parse(review.freeze.planned_end) ||
      !freeze.version ||
      !review.freeze.version ||
      freeze.version <= review.freeze.version ||
      row.end_date !== review.cancellation.end_date ||
      row.state !== review.before.state ||
      row.sale_state !== review.before.sale_state
    )
      throw new Error("PROFILE_FREEZE_RESULT_UNAVAILABLE");
  } else if (
    freeze.id !== review.freeze?.id ||
    freeze.state !== "ended" ||
    !freeze.actual_end ||
    localDate(freeze.actual_end) !==
      ("end_date" in review.request ? review.request.end_date : undefined) ||
    !freeze.version ||
    !review.freeze.version ||
    freeze.version <= review.freeze.version
  )
    throw new Error("PROFILE_FREEZE_RESULT_UNAVAILABLE");
  const bindings = await readBindings(
    scope,
    review.bindings.map((x) => x.id),
  );
  if (bindings.some((item, index) => item.version <= review.bindings[index]!.version))
    throw new Error("PROFILE_FREEZE_RESULT_UNAVAILABLE");

  return { rights };
}
export type FreezeResult = Awaited<ReturnType<typeof readFreezeResult>>;
