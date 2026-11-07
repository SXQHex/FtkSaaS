import { beforeEach, expect, test } from "vitest";
import { v7 } from "uuid";
import { recoverSetup, setupStorageKey, type SetupScope } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
const person = v7(),
  lead = v7(),
  activity = v7(),
  offer = v7(),
  application = v7(),
  session = v7(),
  product = v7(),
  scope: SetupScope = { actorId: v7(), orgId: v7(), centerId: v7() };
const cases = [
  {
    operation: "lead_save_v1",
    slot: `crm-person:${person}`,
    input: { person_id: person, source: "whatsapp", interest: "Tango" },
  },
  {
    operation: "crm_activity_save_v1",
    slot: `crm-lead:${lead}`,
    input: { lead_id: lead, kind: "followup", note: "Call back", due_at: "2026-11-08T12:00:00Z" },
  },
  {
    operation: "crm_activity_save_v1",
    slot: `crm-activity:${activity}`,
    input: {
      lead_id: lead,
      activity_id: activity,
      expected_version: 2,
      kind: "outcome",
      note: "Follow-up completed",
    },
  },
  { operation: "lead_convert_v1", slot: `crm-lead:${lead}`, input: { lead_id: lead } },
  {
    operation: "trial_offer_create_v1",
    slot: `crm-lead:${lead}`,
    input: {
      lead_id: lead,
      product_version_id: product,
      session_id: session,
      booking_category: "female",
    },
  },
  {
    operation: "trial_registration_confirm_v1",
    slot: `crm-offer:${offer}`,
    input: { offer_id: offer },
  },
  {
    operation: "public_application_review_v1",
    slot: `crm-application:${application}`,
    input: {
      application_id: application,
      expected_version: 1,
      action: "match_existing",
      person_id: person,
    },
  },
  {
    operation: "publication_set_v1",
    slot: `publication:${session}`,
    input: {
      session_id: session,
      published: true,
      public_details: {
        title: "Tango practice",
        venue_public_label: "Studio",
        fee_minor: "0",
        currency: "TRY",
        public_conditions: "Contact studio",
      },
    },
  },
];
beforeEach(() => sessionStorage.clear());
test.each(cases)(
  "native $operation journal recovers only the original target and operation key",
  (c) => {
    const command = {
      operation: c.operation,
      input: { org_id: scope.orgId, center_id: scope.centerId, operation_key: v7(), ...c.input },
    };
    sessionStorage.setItem(setupStorageKey(scope, c.slot), JSON.stringify({ command }));
    expect(recoverSetup(scope, c.slot)).toEqual({ command });
    expect(discoverPendingOperations(scope.actorId)?.[0].kind).toBe("crm");
    const foreignSlot = `crm-person:${v7()}`;
    sessionStorage.setItem(setupStorageKey(scope, foreignSlot), JSON.stringify({ command }));
    expect(recoverSetup(scope, foreignSlot)).toBe("invalid");
  },
);
test("old activity version, mismatched center and unknown payload fields cannot recover", () => {
  const slot = `crm-activity:${activity}`,
    base = {
      operation: "crm_activity_save_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: v7(),
        lead_id: lead,
        activity_id: activity,
        expected_version: 1,
        kind: "outcome",
        note: "Complete",
      },
    };
  for (const input of [
    { ...base.input, expected_version: 0 },
    { ...base.input, center_id: v7() },
    { ...base.input, actor_role: "owner" },
  ]) {
    sessionStorage.setItem(
      setupStorageKey(scope, slot),
      JSON.stringify({ command: { ...base, input } }),
    );
    expect(recoverSetup(scope, slot)).toBe("invalid");
  }
});

test("organization inbox assignment recovers without a current center and keeps its destination", () => {
  const orgScope = { actorId: scope.actorId, orgId: scope.orgId };
  const slot = `crm-application:${application}`;
  const command = {
    operation: "public_application_review_v1",
    input: {
      org_id: scope.orgId,
      operation_key: v7(),
      application_id: application,
      expected_version: 2,
      action: "assign_center",
      target_center_id: scope.centerId,
    },
  };
  sessionStorage.setItem(setupStorageKey(orgScope, slot), JSON.stringify({ command }));
  expect(recoverSetup(orgScope, slot)).toEqual({ command });
  expect(discoverPendingOperations(scope.actorId)?.[0].scope).toEqual(orgScope);
  command.input.action = "match_existing";
  sessionStorage.setItem(setupStorageKey(orgScope, slot), JSON.stringify({ command }));
  expect(recoverSetup(orgScope, slot)).toBe("invalid");
});
