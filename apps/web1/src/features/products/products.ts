import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  ProductView,
  ProductTerms,
  RequestProductPublish,
  RequestProductStateSet,
  ProductManagementEntry,
} from "../../lib/api-contracts/generated";
import type { ProductDraft } from "./product-editor";
import type { ProductFilter } from "./products-view";

export async function readProductsManagementPage(
  scope: ClientScope,
  filter: ProductFilter,
  query: string,
  cursor?: string,
) {
  const backend = await scopedBackend(scope);
  const result = await backend.call("products_management_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    view: "products",
    status: filter === "on" ? "on_sale" : filter === "off" ? "closed" : filter,
    include_timed_products: true,
    ...(query.trim() ? { query: query.trim() } : {}),
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  if (result.view !== "products") throw new Error("PRODUCT_SOURCE_UNAVAILABLE");
  const ids = new Set<string>();
  const items = result.items.map((row) => {
    if (!("active_right_holders" in row)) throw new Error("PRODUCT_SOURCE_UNAVAILABLE");
    z.uuid().parse(row.id);
    z.uuid().parse(row.version_id);
    z.number().int().positive().parse(row.version);
    z.enum(["active", "inactive", "archived"]).parse(row.state);
    if (ids.has(row.id)) throw new Error("PRODUCT_SOURCE_UNAVAILABLE");
    ids.add(row.id);
    return row;
  });
  return { ...result, items };
}

export async function readProductsPage(scope: ClientScope, cursor?: string) {
  const backend = await scopedBackend(scope);
  const result = await backend.call("products_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    include_timed_products: true,
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  const ids = new Set<string>();
  for (const row of result.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.version_id);
    if (ids.has(row.id)) throw new Error("PRODUCT_SOURCE_UNAVAILABLE");
    ids.add(row.id);
  }
  return result;
}
export function productDraft(base?: ProductView): ProductDraft {
  const terms = base?.terms,
    first = terms?.scopes[0];
  return {
    name: terms?.name ?? "",
    kind: terms?.kind === "timed" ? "timed" : "credit",
    bookingMode: terms?.booking_mode ?? "",
    refundMethod: terms?.refund.method ?? "",
    refundUnit: terms?.refund.used_unit_minor ?? "",
    extendsValidity: terms?.freeze.extends_validity ?? false,
    scopeKind:
      first?.scope_kind === "center_discipline" || first?.scope_kind === "center_all_disciplines"
        ? first.scope_kind
        : "",
    disciplineId: first?.discipline_id ?? "",
    credits: String(terms?.credits ?? ""),
    validityDays: "",
    price: terms?.price_minor ?? "",
    currency: terms?.currency ?? "",
    scopes: terms ? [...new Set(terms.scopes.flatMap((row) => row.usage_targets))] : [],
    quotaPeriod: terms?.quota?.period ?? "none",
    quotaLimit: String(terms?.quota?.limit ?? ""),
    freeze: terms?.freeze.enabled ?? false,
    freezeDays: String(terms?.freeze.max_days ?? ""),
    negativeValue: "",
    onSale: false,
    versionNote: "",
  };
}
const amount = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
const positive = (value: string, maximum = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().positive().max(maximum))
    .parse(value);
export interface ProductPublishIntent {
  scope: ClientScope;
  operation: "product_publish_v1";
  request: Omit<RequestProductPublish, "request_id">;
  base?: ProductView & { version?: number };
}
export interface ProductStateIntent {
  scope: ClientScope;
  operation: "product_state_set_v1";
  request: Omit<RequestProductStateSet, "request_id">;
}
export type ProductIntent = ProductPublishIntent | ProductStateIntent;
export function productStateIntent(
  scope: ClientScope,
  base: ProductManagementEntry,
  action: RequestProductStateSet["action"],
  reason: string,
): ProductStateIntent {
  const expected = action === "open" ? "active" : action === "close" ? "inactive" : "archived";
  if (base.state === expected) throw new Error("PRODUCT_INVALID");
  return {
    scope: { ...scope },
    operation: "product_state_set_v1",
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      product_id: z.uuid().parse(base.id),
      expected_version: z.number().int().positive().parse(base.version),
      action,
      reason: z.string().trim().min(1).max(2000).parse(reason),
    },
  };
}
export async function readProductHistory(
  scope: ClientScope,
  productId: string,
  view: "versions" | "sales",
  cursor?: string,
) {
  const backend = await scopedBackend(scope);
  const result = await backend.call("products_management_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    view,
    product_id: productId,
    include_timed_products: true,
    page: { limit: 20, ...(cursor ? { cursor } : {}) },
  });
  if (result.view !== view) throw new Error("PRODUCT_SOURCE_UNAVAILABLE");
  const ids = new Set<string>();
  for (const row of result.items) {
    if (
      (view === "versions" && (!("product_id" in row) || row.product_id !== productId)) ||
      (view === "sales" && !("product_version_id" in row)) ||
      ids.has(row.id)
    )
      throw new Error("PRODUCT_SOURCE_UNAVAILABLE");
    ids.add(z.uuid().parse(row.id));
  }
  return result;
}
export function productIntent(
  scope: ClientScope,
  draft: ProductDraft,
  base?: ProductView & { version?: number },
  disciplineIds: string[] = [],
  usageCenterIds: string[] = [],
): ProductPublishIntent {
  const name = z.string().trim().min(1).max(2000).parse(draft.name);
  const booking_mode = z.enum(["priority", "flexible"]).parse(draft.bookingMode);
  const method = z
    .enum(["none", "credit_ratio", "used_at_unit_price", "time_ratio"])
    .parse(draft.refundMethod);
  if (
    (draft.kind === "credit" && draft.quotaPeriod !== "none") ||
    (draft.kind === "timed" && method === "credit_ratio")
  )
    throw new Error("PRODUCT_INVALID");
  let scopes: ProductTerms["scopes"];
  if (base) scopes = structuredClone(base.terms.scopes);
  else {
    const usage_targets = z
      .array(z.enum(["lesson", "event"]))
      .min(1)
      .refine((values) => new Set(values).size === values.length)
      .parse(draft.scopes) as ["lesson" | "event", ...("lesson" | "event")[]];
    if (draft.scopeKind === "selected_centers") {
      const [first, ...remaining] = [...new Set(draft.usageCenterIds ?? [])];
      if (
        !first ||
        usageCenterIds.length < 2 ||
        [first, ...remaining].some((id) => !usageCenterIds.includes(id))
      )
        throw new Error("PRODUCT_SCOPE_REQUIRED");
      const centerScope = (id: string) => ({
        scope_kind: "center_all_disciplines" as const,
        center_id: z.uuid().parse(id),
        discipline_id: null,
        usage_targets,
      });
      scopes = [centerScope(first), ...remaining.map(centerScope)];
    } else if (draft.scopeKind === "center_all_disciplines")
      scopes = [
        {
          scope_kind: draft.scopeKind,
          center_id: scope.centerId,
          discipline_id: null,
          usage_targets,
        },
      ];
    else if (draft.scopeKind === "center_discipline" && disciplineIds.includes(draft.disciplineId))
      scopes = [
        {
          scope_kind: draft.scopeKind,
          center_id: scope.centerId,
          discipline_id: z.uuid().parse(draft.disciplineId),
          usage_targets,
        },
      ];
    else throw new Error("PRODUCT_SCOPE_REQUIRED");
  }
  const terms: ProductTerms = {
    name,
    kind: draft.kind === "timed" ? "timed" : "credits",
    booking_mode,
    credits: draft.kind === "credit" ? positive(draft.credits, 2147483647) : null,
    price_minor: amount.parse(draft.price),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .parse(draft.currency),
    freeze: {
      enabled: draft.freeze,
      extends_validity: draft.freeze && draft.extendsValidity,
      ...(draft.freeze ? { max_days: positive(draft.freezeDays) } : {}),
    },
    refund: {
      method,
      ...(method === "used_at_unit_price"
        ? { used_unit_minor: amount.parse(draft.refundUnit) }
        : {}),
    },
    quota:
      draft.kind === "timed" && draft.quotaPeriod !== "none"
        ? { period: draft.quotaPeriod, limit: positive(draft.quotaLimit) }
        : null,
    scopes,
  };
  return {
    scope: { ...scope },
    operation: "product_publish_v1",
    ...(base ? { base: structuredClone(base) } : {}),
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      ...(base
        ? { product_id: base.id, ...(base.version ? { expected_version: base.version } : {}) }
        : {}),
      terms,
    },
  };
}
export async function writeProduct(intent: ProductIntent) {
  const backend = await scopedBackend(intent.scope);
  const result =
    intent.operation === "product_publish_v1"
      ? await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() })
      : await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readProductReceipt(intent: ProductIntent) {
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
    (receipt.result_reference &&
      receipt.result_reference.type !==
        (intent.operation === "product_publish_v1" ? "product_versions" : "products"))
  )
    throw new Error("PRODUCT_RECEIPT_UNAVAILABLE");
  return receipt;
}
// Catalog projections may spell omitted optional members as null. Compare all
// contract terms without converting integer money or losing narrow scope keys.
export function productTermsEqual(left: ProductTerms, right: ProductTerms) {
  const normalize = (terms: ProductTerms) => ({
    name: terms.name,
    kind: terms.kind,
    booking_mode: terms.booking_mode,
    credits: terms.credits ?? null,
    price_minor: terms.price_minor,
    currency: terms.currency,
    freeze: {
      enabled: terms.freeze.enabled,
      extends_validity: terms.freeze.extends_validity,
      max_days: terms.freeze.max_days ?? null,
    },
    refund: { method: terms.refund.method, used_unit_minor: terms.refund.used_unit_minor ?? null },
    quota: terms.quota ? { period: terms.quota.period, limit: terms.quota.limit } : null,
    scopes: terms.scopes.map((row) => ({
      scope_kind: row.scope_kind,
      center_id: row.center_id,
      discipline_id: row.discipline_id,
      class_id: row.class_id ?? null,
      event_id: row.event_id ?? null,
      usage_targets: row.usage_targets,
    })),
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
export async function readProductResult(intent: ProductIntent, versionId?: string) {
  if (intent.operation === "product_state_set_v1") {
    const backend = await scopedBackend(intent.scope);
    const result = await backend.call("products_management_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: intent.scope.orgId,
      center_id: intent.scope.centerId,
      view: "products",
      product_id: intent.request.product_id,
      status: "all",
      include_timed_products: true,
      page: { limit: 1 },
    });
    const row = result.items[0];
    const expected =
      intent.request.action === "open"
        ? "active"
        : intent.request.action === "close"
          ? "inactive"
          : "archived";
    if (
      result.view !== "products" ||
      result.items.length !== 1 ||
      !row ||
      !("active_right_holders" in row) ||
      row.id !== intent.request.product_id ||
      row.state !== expected ||
      row.version <= intent.request.expected_version ||
      (versionId && versionId !== row.id)
    )
      throw new Error("PRODUCT_RESULT_UNAVAILABLE");
    return row;
  }
  z.uuid().parse(versionId);
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    if (intent.base?.version) {
      const page = await readProductHistory(intent.scope, intent.base.id, "versions", cursor);
      const row = page.items.find((entry) => entry.id === versionId);
      if (row) {
        if (!("product_id" in row) || !productTermsEqual(row.terms, intent.request.terms))
          throw new Error("PRODUCT_RESULT_UNAVAILABLE");
        return { id: row.product_id, version_id: row.id, terms: row.terms };
      }
      cursor = page.next_cursor ?? undefined;
      if (cursor && seen.has(cursor)) throw new Error("PRODUCT_RESULT_UNAVAILABLE");
      if (cursor) seen.add(cursor);
      continue;
    }
    const page = await readProductsPage(intent.scope, cursor);
    const value = page.items.find((row) => row.version_id === versionId);
    if (value) {
      if (
        !productTermsEqual(value.terms, intent.request.terms) ||
        (intent.base && value.id !== intent.base.id)
      )
        throw new Error("PRODUCT_RESULT_UNAVAILABLE");
      return value;
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("PRODUCT_RESULT_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new Error("PRODUCT_RESULT_UNAVAILABLE");
}
