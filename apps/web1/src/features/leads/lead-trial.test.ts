import { beforeEach, expect, it, vi } from "vitest";
import type { SessionView } from "../../lib/api-contracts/generated";
import type { LeadDetail } from "./leads-read";
import {
  trialOfferIntent,
  trialConfirmIntent,
  readTrialReceipt,
  readTrialResult,
  writeTrial,
  type TrialOffer,
  type TrialProduct,
} from "./lead-trial";
const { call, leadRead } = vi.hoisted(() => ({ call: vi.fn(), leadRead: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
vi.mock("./leads-read", () => ({ readLeadDetail: leadRead }));
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const lead: LeadDetail = {
  id: id(4),
  personId: id(5),
  version: 2,
  state: "open",
  values: {
    person_id: id(5),
    source: "manual",
    interest: "Tango",
    assigned_to: null,
    pipeline: null,
  },
};
const product: TrialProduct = {
  kind: "trial_product",
  product_version_id: id(6),
  product_name: "Deneme",
  price_minor: "9007199254740993",
  currency: "TRY",
  offer_minutes: 60,
  offer_policy_state: "available",
  confirmation_requires_session: true,
  confirmation_requires_paid_entitlement: true,
  version: 1,
};
const offer: TrialOffer = {
  kind: "trial_offer",
  offer_id: id(7),
  created_at: "2026-11-17T12:00:00Z",
  product_version_id: product.product_version_id,
  session_id: id(8),
  expires_at: "2099-01-01T00:00:00Z",
  state: "active",
  registration_id: null,
  price_minor: product.price_minor,
  currency: product.currency,
  version: 2,
};
const session: SessionView = {
  id: id(8),
  class_id: null,
  discipline_id: id(9),
  format: "group",
  starts_at: "2099-01-01T12:00:00Z",
  ends_at: "2099-01-01T13:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  version: 3,
  capacity: {
    total: 12,
    held: 0,
    remaining: 12,
    category_held: null,
    category_remaining: null,
    room_capacity: 20,
  },
};
let liveProduct: TrialProduct, liveOffer: TrialOffer, liveSession: SessionView;
function row(
  type: string,
  entityId: string,
  version: number,
  operation: string,
  discovery?: TrialOffer | TrialProduct,
) {
  return {
    operation,
    exists: true,
    entity: { type, id: entityId },
    versions: [{ entity: { type, id: entityId }, version }],
    state: discovery?.kind === "trial_offer" ? discovery.state : "active",
    as_of: "2026-11-17T12:00:00Z",
    current: null,
    crm_discovery: discovery,
  };
}
beforeEach(() => {
  call.mockReset();
  leadRead.mockReset();
  leadRead.mockResolvedValue(structuredClone(lead));
  liveProduct = structuredClone(product);
  liveOffer = structuredClone(offer);
  liveSession = structuredClone(session);
  call.mockImplementation(async (operation, request) => {
    if (operation === "session_get_v1") return liveSession;
    if (operation === "management_state_get_v1") {
      const key = request.selector.key;
      if (key.directory === "products")
        return {
          items: [
            row(
              "product_versions",
              product.product_version_id,
              liveProduct.version,
              request.operation,
              liveProduct,
            ),
          ],
          next_cursor: null,
        };
      if (key.directory === "history")
        return {
          items: [
            row("trial_offers", offer.offer_id, liveOffer.version, request.operation, liveOffer),
          ],
          next_cursor: null,
        };
      if (request.operation === "trial_registration_confirm_v1")
        return {
          items: [
            {
              ...row(
                "trial_offers",
                offer.offer_id,
                liveOffer.version,
                request.operation,
                liveOffer,
              ),
              current: { operation: request.operation, values: { offer_id: offer.offer_id } },
            },
          ],
          next_cursor: null,
        };
    }
    if (operation === "operation_status_get_v1")
      return {
        operation: request.operation,
        key: request.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "trial_offers", id: offer.offer_id },
      };
    if (operation === "trial_offer_create_v1" || operation === "trial_registration_confirm_v1")
      return { primary_id: offer.offer_id, versions: [], job_ids: [] };
    throw Error("UNEXPECTED_NATIVE_OPERATION");
  });
});
it("keeps immutable integer money and native product/session identity without creating sale or entitlement writers", async () => {
  const intent = await trialOfferIntent(scope, lead, product, session, "", true);
  await writeTrial(intent);
  expect(intent.operation).toBe("trial_offer_create_v1");
  expect(intent.request).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    lead_id: lead.id,
    product_version_id: product.product_version_id,
    session_id: session.id,
  });
  expect(intent.request).not.toHaveProperty("price_minor");
  expect(call.mock.calls.filter(([op]) => op.endsWith("_create_v1"))).toHaveLength(1);
  await expect(readTrialResult(intent, offer.offer_id)).resolves.toMatchObject({
    price_minor: "9007199254740993",
  });
});
it("allows an explicitly sessionless offer but refuses to confirm it", async () => {
  const created = await trialOfferIntent(scope, lead, product, undefined, "", true);
  expect(created.request).toMatchObject({ session_id: null });
  liveOffer.session_id = null;
  await expect(
    trialConfirmIntent(scope, lead, { ...offer, session_id: null }, true),
  ).rejects.toThrow("TRIAL_SOURCE_CHANGED");
  expect(call.mock.calls.some(([op]) => op === "trial_registration_confirm_v1")).toBe(false);
});
it.each(["policy", "version", "price", "session"])(
  "rejects changed %s sources before any offer writer",
  async (mode) => {
    if (mode === "policy") liveProduct.offer_policy_state = "quota_exceeded";
    if (mode === "version") liveProduct.version++;
    if (mode === "price") liveProduct.price_minor = "1";
    if (mode === "session") liveSession.version++;
    await expect(trialOfferIntent(scope, lead, product, session, "", true)).rejects.toThrow(
      "TRIAL_SOURCE_CHANGED",
    );
    expect(call.mock.calls.some(([op]) => op === "trial_offer_create_v1")).toBe(false);
  },
);
it("requires a real category only for a natively split session", async () => {
  liveSession.capacity.category_remaining = { male: 6, female: 6 };
  const split = structuredClone(liveSession);
  await expect(trialOfferIntent(scope, lead, product, split, "", true)).rejects.toThrow();
  const intent = await trialOfferIntent(scope, lead, product, split, "female", true);
  expect(intent.request).toMatchObject({ booking_category: "female" });
});
it("uses the same operation key in receipt recovery and rejects a foreign offer reference", async () => {
  const intent = await trialConfirmIntent(scope, lead, offer, true);
  await readTrialReceipt(intent);
  expect(call.mock.lastCall?.[1]).toMatchObject({
    operation: intent.operation,
    key: intent.request.operation_key,
    org_id: scope.orgId,
  });
  expect(call.mock.lastCall?.[1]).not.toHaveProperty("center_id");
  call.mockResolvedValue({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "trial_offers", id: id(999) },
  });
  await expect(readTrialReceipt(intent)).rejects.toThrow("TRIAL_RECEIPT_UNAVAILABLE");
});
it("requires native accepted state, advanced version and real registration for confirmation success", async () => {
  const intent = await trialConfirmIntent(scope, lead, offer, true);
  await expect(readTrialResult(intent, offer.offer_id)).rejects.toThrow("TRIAL_RESULT_UNAVAILABLE");
  liveOffer = { ...offer, state: "accepted", version: 3 };
  await expect(readTrialResult(intent, offer.offer_id)).rejects.toThrow("TRIAL_RESULT_UNAVAILABLE");
  liveOffer.registration_id = id(10);
  await expect(readTrialResult(intent, offer.offer_id)).resolves.toMatchObject({
    registration_id: id(10),
  });
});
