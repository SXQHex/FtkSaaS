import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type { ClientScope } from "../../lib/scoped-backend";
import { scopedBackend } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import type {
  ManagementStateView,
  RequestTrialOfferCreate,
  RequestTrialRegistrationConfirm,
  SessionView,
} from "../../lib/api-contracts/generated";
import { readLeadDetail, type LeadDetail } from "./leads-read";
import { readScheduleRange, readScheduleSession } from "../schedule/schedule-read";
import { getTemporal } from "../../lib/temporal";
const base = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
  request_id: uuidv7(),
});
function version(row: ManagementStateView, type: string, id: string) {
  const matches = row.versions.filter((v) => v.entity.type === type && v.entity.id === id);
  if (!row.exists || row.entity?.type !== type || row.entity.id !== id || matches.length !== 1)
    throw Error("TRIAL_SOURCE_UNAVAILABLE");
  return z.number().int().positive().safe().parse(matches[0]!.version);
}
async function directory(
  scope: ClientScope,
  leadId: string,
  kind: "products" | "history",
  cursor?: string,
) {
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...base(scope),
    operation: "trial_offer_create_v1",
    selector: {
      operation: "trial_offer_create_v1",
      key: { lead_id: z.uuid().parse(leadId), directory: kind },
    },
    page: { limit: 20, sort: "created_at_desc", ...(cursor ? { cursor } : {}) },
  });
  const seen = new Set<string>();
  for (const row of page.items) {
    if (row.operation !== "trial_offer_create_v1" || !row.entity || seen.has(row.entity.id))
      throw Error("TRIAL_SOURCE_UNAVAILABLE");
    seen.add(row.entity.id);
  }
  if (cursor && cursor === page.next_cursor) throw Error("TRIAL_CURSOR_REPEATED");
  return page;
}
export async function readTrialProducts(scope: ClientScope, leadId: string, cursor?: string) {
  const page = await directory(scope, leadId, "products", cursor);
  return {
    ...page,
    items: page.items.map((row) => {
      const value = row.crm_discovery;
      if (value?.kind !== "trial_product") throw Error("TRIAL_SOURCE_UNAVAILABLE");
      return { ...value, version: version(row, "product_versions", value.product_version_id) };
    }),
  };
}
export async function readTrialHistory(scope: ClientScope, leadId: string, cursor?: string) {
  const page = await directory(scope, leadId, "history", cursor);
  return {
    ...page,
    items: page.items.map((row) => {
      const value = row.crm_discovery;
      if (value?.kind !== "trial_offer") throw Error("TRIAL_SOURCE_UNAVAILABLE");
      return { ...value, version: version(row, "trial_offers", value.offer_id) };
    }),
  };
}
export type TrialProduct = Awaited<ReturnType<typeof readTrialProducts>>["items"][number];
export type TrialOffer = Awaited<ReturnType<typeof readTrialHistory>>["items"][number];
async function findProduct(scope: ClientScope, leadId: string, id: string) {
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await readTrialProducts(scope, leadId, cursor),
      found = page.items.find((row) => row.product_version_id === id);
    if (found) return found;
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw Error("TRIAL_CURSOR_REPEATED");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw Error("TRIAL_SOURCE_UNAVAILABLE");
}
async function findOffer(scope: ClientScope, leadId: string, id: string) {
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await readTrialHistory(scope, leadId, cursor),
      found = page.items.find((row) => row.offer_id === id);
    if (found) return found;
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw Error("TRIAL_CURSOR_REPEATED");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw Error("TRIAL_SOURCE_UNAVAILABLE");
}
async function freshLead(scope: ClientScope, lead: LeadDetail) {
  const current = await readLeadDetail(scope, lead.personId, lead.id);
  if (current.version !== lead.version || current.state !== "open")
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
}
export async function readTrialSessions(scope: ClientScope, timezone: string, day: string) {
  const T = await getTemporal(),
    date = day ? T.PlainDate.from(day) : T.Now.plainDateISO(timezone);
  const result = await readScheduleRange(scope, {
    starts_at: date.toZonedDateTime(timezone).toInstant().toString(),
    ends_at: date.add({ days: 1 }).toZonedDateTime(timezone).toInstant().toString(),
  });
  return {
    day: date.toString(),
    entries: result.entries.filter(
      (entry) =>
        entry.type === "session" &&
        entry.session.state === "planned" &&
        Date.parse(entry.session.starts_at) > Date.now(),
    ),
  };
}
type TrialIntent = { scope: ClientScope; lead: LeadDetail } & (
  | {
      operation: "trial_offer_create_v1";
      request: Omit<RequestTrialOfferCreate, "request_id">;
      product: TrialProduct;
    }
  | {
      operation: "trial_registration_confirm_v1";
      request: Omit<RequestTrialRegistrationConfirm, "request_id">;
      offer: TrialOffer;
    }
);
export async function trialOfferIntent(
  scope: ClientScope,
  lead: LeadDetail,
  product: TrialProduct,
  session: SessionView | undefined,
  category: string,
  reviewed: boolean,
): Promise<TrialIntent> {
  if (!reviewed) throw Error("LEAD_REVIEW_REQUIRED");
  await freshLead(scope, lead);
  const current = await findProduct(scope, lead.id, product.product_version_id);
  if (
    current.version !== product.version ||
    current.offer_minutes !== product.offer_minutes ||
    current.price_minor !== product.price_minor ||
    current.currency !== product.currency ||
    current.offer_policy_state !== "available"
  )
    throw Error("TRIAL_SOURCE_CHANGED");
  if (session) {
    const live = await readScheduleSession(scope, session.id);
    if (
      live.version !== session.version ||
      live.state !== "planned" ||
      Date.parse(live.starts_at) <= Date.now()
    )
      throw Error("TRIAL_SOURCE_CHANGED");
    if (live.capacity.category_remaining !== null) z.enum(["male", "female"]).parse(category);
    else if (category) throw Error("TRIAL_SOURCE_CHANGED");
  } else if (category) throw Error("TRIAL_SOURCE_CHANGED");
  const request = {
    client_api_version: 1 as const,
    org_id: scope.orgId,
    center_id: scope.centerId,
  };
  return {
    scope: { ...scope },
    lead,
    product,
    operation: "trial_offer_create_v1",
    request: {
      ...request,
      operation_key: uuidv7(),
      lead_id: lead.id,
      product_version_id: product.product_version_id,
      session_id: session?.id ?? null,
      ...(category ? { booking_category: z.enum(["male", "female"]).parse(category) } : {}),
    },
  };
}
async function readOfferState(scope: ClientScope, id: string) {
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...base(scope),
    operation: "trial_registration_confirm_v1",
    selector: { operation: "trial_registration_confirm_v1", key: { offer_id: z.uuid().parse(id) } },
    page: { limit: 1 },
  });
  const row = page.items[0];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    row?.operation !== "trial_registration_confirm_v1" ||
    row.current?.operation !== "trial_registration_confirm_v1" ||
    row.current.values.offer_id !== id
  )
    throw Error("TRIAL_SOURCE_UNAVAILABLE");
  return { state: row.state, version: version(row, "trial_offers", id) };
}
export async function trialConfirmIntent(
  scope: ClientScope,
  lead: LeadDetail,
  offer: TrialOffer,
  reviewed: boolean,
): Promise<TrialIntent> {
  if (!reviewed) throw Error("LEAD_REVIEW_REQUIRED");
  await freshLead(scope, lead);
  const current = await findOffer(scope, lead.id, offer.offer_id),
    state = await readOfferState(scope, offer.offer_id);
  if (
    current.version !== offer.version ||
    state.version !== offer.version ||
    state.state !== "active" ||
    current.state !== "active" ||
    !current.session_id ||
    current.session_id !== offer.session_id ||
    current.product_version_id !== offer.product_version_id ||
    current.price_minor !== offer.price_minor ||
    current.currency !== offer.currency
  )
    throw Error("TRIAL_SOURCE_CHANGED");
  const request = {
    client_api_version: 1 as const,
    org_id: scope.orgId,
    center_id: scope.centerId,
  };
  return {
    scope: { ...scope },
    lead,
    offer,
    operation: "trial_registration_confirm_v1",
    request: { ...request, operation_key: uuidv7(), offer_id: offer.offer_id },
  };
}
export async function writeTrial(intent: TrialIntent) {
  const backend = await scopedBackend(intent.scope);
  return intent.operation === "trial_offer_create_v1"
    ? backend.call(intent.operation, { ...intent.request, request_id: uuidv7() })
    : backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
}
export async function readTrialReceipt(intent: TrialIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
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
      (receipt.result_reference.type !== "trial_offers" ||
        (intent.operation === "trial_registration_confirm_v1" &&
          receipt.result_reference.id !== intent.offer.offer_id)))
  )
    throw Error("TRIAL_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readTrialResult(intent: TrialIntent, id?: string) {
  const primary = z.uuid().parse(id);
  if (intent.operation === "trial_registration_confirm_v1" && primary !== intent.offer.offer_id)
    throw Error("TRIAL_RESULT_UNAVAILABLE");
  const offer = await findOffer(intent.scope, intent.lead.id, primary);
  if (intent.operation === "trial_offer_create_v1") {
    if (
      offer.product_version_id !== intent.request.product_version_id ||
      offer.session_id !== intent.request.session_id ||
      offer.price_minor !== intent.product.price_minor ||
      offer.currency !== intent.product.currency
    )
      throw Error("TRIAL_RESULT_UNAVAILABLE");
  } else if (
    offer.state !== "accepted" ||
    offer.version <= intent.offer.version ||
    !offer.registration_id ||
    offer.session_id !== intent.offer.session_id
  )
    throw Error("TRIAL_RESULT_UNAVAILABLE");
  return offer;
}
