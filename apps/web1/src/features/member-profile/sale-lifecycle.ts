import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  EntitlementView,
  ProductView,
  Preview,
  ManagementStateView,
} from "../../lib/api-contracts/generated";
import type { MemberDraft } from "./member-draft";
import { readProfileRights } from "./profile-read";
import { readFinancePage } from "../finance/finance";
export type SaleLifecycleAction = "renew" | "change" | "terminate";
const positive = z.number().int().positive().safe();
const instant = z.iso.datetime({ offset: true });
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export interface SaleInventory {
  version: number;
  items: ManagementStateView[];
}
/** Complete native source inventory, not a scan over the person's reservation history. */
export async function readSaleInventory(
  scope: ClientScope,
  saleId: string,
): Promise<SaleInventory> {
  z.uuid().parse(saleId);
  const backend = await scopedBackend(scope),
    seen = new Set<string>(),
    ids = new Set<string>();
  const items: ManagementStateView[] = [];
  let cursor: string | undefined, version: number | undefined;
  do {
    const page = await backend.call("management_state_get_v1", {
      ...common(scope),
      request_id: uuidv7(),
      operation: "sale_change_preview_v1",
      selector: { operation: "sale_change_preview_v1", key: { sale_id: saleId } },
      page: { limit: 100, ...(cursor ? { cursor } : {}) },
    });
    const context = page.sale_change_context;
    if (
      !context ||
      context.entity.type !== "sales" ||
      context.entity.id !== saleId ||
      (version !== undefined && version !== context.version) ||
      page.items.length > 100
    )
      throw new Error("SALE_LIFECYCLE_INVENTORY_UNAVAILABLE");
    version = positive.parse(context.version);
    instant.parse(page.as_of);
    for (const row of page.items) {
      const record = row.sale_change_record,
        entity = row.entity;
      if (
        !row.exists ||
        row.operation !== "sale_change_preview_v1" ||
        row.state !== "active" ||
        !record ||
        !entity ||
        !["reservations", "event_registrations"].includes(entity.type) ||
        ids.has(entity.id) ||
        row.current?.operation !== "sale_change_preview_v1" ||
        row.current.values.sale_id !== saleId ||
        record.parent.type !== (entity.type === "reservations" ? "sessions" : "events") ||
        row.versions.filter(
          (v) => v.entity.type === "sales" && v.entity.id === saleId && v.version === version,
        ).length !== 1 ||
        row.versions.filter((v) => v.entity.type === entity.type && v.entity.id === entity.id)
          .length !== 1 ||
        row.versions.filter(
          (v) => v.entity.type === record.parent.type && v.entity.id === record.parent.id,
        ).length !== 1
      )
        throw new Error("SALE_LIFECYCLE_INVENTORY_UNAVAILABLE");
      for (const value of [entity.id, record.person_id, record.center_id, record.parent.id])
        z.uuid().parse(value);
      for (const binding of row.versions) positive.parse(binding.version);
      instant.parse(record.starts_at);
      ids.add(entity.id);
      items.push(row);
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("SALE_LIFECYCLE_INVENTORY_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return { version: version!, items };
}
export function sameSaleInventory(a: SaleInventory, b: SaleInventory) {
  const signature = (value: SaleInventory) =>
    JSON.stringify([
      value.version,
      value.items.map((row) => [row.entity, row.state, row.versions, row.sale_change_record]),
    ]);
  // as_of advances on an unchanged read; native identity/version bindings define the reviewed inventory.
  return signature(a) === signature(b);
}
export interface LifecycleReview {
  scope: ClientScope;
  action: SaleLifecycleAction;
  personId: string;
  source: EntitlementView;
  product?: ProductView;
  preview: Preview;
  inventory?: SaleInventory;
  decisions: Record<string, "keep" | "cancel">;
}
export async function previewSaleLifecycle(
  scope: ClientScope,
  personId: string,
  source: EntitlementView,
  action: SaleLifecycleAction,
  draft: MemberDraft,
  product?: ProductView,
  inventory?: SaleInventory,
): Promise<LifecycleReview> {
  if (source.person_id !== personId) throw new Error("SALE_LIFECYCLE_SOURCE_UNAVAILABLE");
  z.uuid().parse(source.sale_id);
  positive.parse(source.sale_version);
  const request = { ...common(scope), request_id: uuidv7() },
    backend = await scopedBackend(scope);
  let preview: Preview;
  if (action === "terminate")
    preview = await backend.call("sale_terminate_preview_v1", {
      ...request,
      sale_id: source.sale_id,
      reason: z.string().trim().min(1).parse(draft.reason),
    });
  else {
    if (!product || product.version_id !== draft.productVersionId)
      throw new Error("SALE_LIFECYCLE_PRODUCT_UNAVAILABLE");
    const dates = {
      start_date: z.iso.date().parse(draft.startDate),
      end_date: z.iso.date().parse(draft.endDate),
    };
    if (action === "renew")
      preview = await backend.call("sale_renew_preview_v1", {
        ...request,
        previous_sale_id: source.sale_id,
        product_version_id: product.version_id,
        ...dates,
      });
    else {
      if (
        !inventory ||
        inventory.version !== source.sale_version ||
        inventory.items.some((row) => row.entity!.type !== "reservations")
      )
        throw new Error("SALE_LIFECYCLE_INVENTORY_UNAVAILABLE");
      const ids = inventory.items.map((row) => row.entity!.id);
      if (
        ids.length !== Object.keys(draft.reservations).length ||
        ids.some((id) => !["keep", "cancel"].includes(draft.reservations[id] ?? ""))
      )
        throw new Error("SALE_LIFECYCLE_CHOICES_REQUIRED");
      preview = await backend.call("sale_change_preview_v1", {
        ...request,
        sale_id: source.sale_id,
        new_product_version_id: product.version_id,
        ...dates,
        reason: z.string().trim().min(1).parse(draft.reason),
        keep_reservation_ids: ids.filter((id) => draft.reservations[id] === "keep"),
        cancel_reservation_ids: ids.filter((id) => draft.reservations[id] === "cancel"),
      });
    }
    const detail = preview.sale_lifecycle;
    if (
      !detail ||
      detail.previous_sale_id !== source.sale_id ||
      detail.product_version_id !== product.version_id ||
      detail.start_date !== dates.start_date ||
      detail.end_date !== dates.end_date ||
      detail.previous_end_date !== source.end_date
    )
      throw new Error("SALE_LIFECYCLE_PREVIEW_UNAVAILABLE");
  }
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  instant.parse(preview.expires_at);
  if (
    preview.dependencies.versions.filter(
      (v) =>
        v.entity.type === "sales" &&
        v.entity.id === source.sale_id &&
        v.version === source.sale_version,
    ).length !== 1
  )
    throw new Error("SALE_LIFECYCLE_PREVIEW_UNAVAILABLE");
  if (action === "change" && inventory) {
    for (const row of inventory.items) {
      const effects = preview.effects.filter(
        (effect) => effect.entity.type === "reservations" && effect.entity.id === row.entity!.id,
      );
      if (
        effects.length !== 1 ||
        effects[0]!.action !== (draft.reservations[row.entity!.id] === "keep" ? "adjust" : "cancel")
      )
        throw new Error("SALE_LIFECYCLE_PREVIEW_UNAVAILABLE");
    }
  }
  return {
    scope: { ...scope },
    action,
    personId,
    source: structuredClone(source),
    product: product && structuredClone(product),
    preview,
    inventory: inventory && structuredClone(inventory),
    decisions: { ...draft.reservations },
  };
}
export function saleLifecycleIntent(review: LifecycleReview) {
  if (review.preview.blockers.length || Date.parse(review.preview.expires_at) <= Date.now())
    throw new Error("SALE_LIFECYCLE_PREVIEW_STALE");
  return {
    review: structuredClone(review),
    operation: (
      {
        renew: "sale_renew_apply_v1",
        change: "sale_change_apply_v1",
        terminate: "sale_terminate_apply_v1",
      } as const
    )[review.action],
    key: uuidv7(),
  };
}
export type LifecycleIntent = ReturnType<typeof saleLifecycleIntent>;
export async function writeSaleLifecycle(intent: LifecycleIntent) {
  const backend = await scopedBackend(intent.review.scope);
  return backend.call(intent.operation, {
    ...common(intent.review.scope),
    request_id: uuidv7(),
    operation_key: intent.key,
    preview: { id: intent.review.preview.id, token: intent.review.preview.token },
  });
}
export async function readSaleLifecycleReceipt(intent: LifecycleIntent) {
  const backend = await scopedBackend(intent.review.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.review.scope.orgId,
    operation: intent.operation,
    key: intent.key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "sales")
  )
    throw new Error("SALE_LIFECYCLE_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSaleLifecycleResult(intent: LifecycleIntent, id?: string) {
  const { review } = intent,
    rows = await readProfileRights(review.scope, review.personId);
  const old = rows.find((row) => row.sale_id === review.source.sale_id);
  if (!old || old.person_id !== review.personId)
    throw new Error("SALE_LIFECYCLE_RESULT_UNAVAILABLE");
  if (
    review.action !== "renew" &&
    (old.sale_state !== "terminated" ||
      old.state !== "closed" ||
      !old.sale_version ||
      old.sale_version <= review.source.sale_version!)
  )
    throw new Error("SALE_LIFECYCLE_RESULT_UNAVAILABLE");
  if (review.action === "terminate" && id && id !== old.sale_id)
    throw new Error("SALE_LIFECYCLE_RESULT_UNAVAILABLE");
  if (review.action !== "terminate") {
    z.uuid().parse(id);
    const detail = review.preview.sale_lifecycle!,
      next = rows.find((row) => row.sale_id === id);
    if (
      !next ||
      next.sale_id === old.sale_id ||
      next.person_id !== review.personId ||
      next.product_version_id !== detail.product_version_id ||
      next.start_date !== detail.start_date ||
      next.end_date !== detail.end_date ||
      next.sale_state !== "active"
    )
      throw new Error("SALE_LIFECYCLE_RESULT_UNAVAILABLE");
  }
  const backend = await scopedBackend(review.scope);
  for (const effect of review.preview.effects.filter((row) => row.entity.type === "reservations")) {
    const page = await backend.call("management_state_get_v1", {
      ...common(review.scope),
      request_id: uuidv7(),
      operation: "reservation_cancel_v1",
      selector: { operation: "reservation_cancel_v1", key: { reservation_id: effect.entity.id } },
      page: { limit: 1 },
    });
    const row = page.items[0];
    if (
      page.items.length !== 1 ||
      page.next_cursor ||
      !row?.exists ||
      row.entity?.type !== "reservations" ||
      row.entity.id !== effect.entity.id ||
      row.state !== (effect.action === "cancel" ? "cancelled" : "active")
    )
      throw new Error("SALE_LIFECYCLE_RESULT_UNAVAILABLE");
  }
  const finance = review.product
    ? await readFinancePage(review.scope, {
        personId: review.personId,
        currency: review.product.terms.currency,
      })
    : undefined;
  return { rows, finance };
}
