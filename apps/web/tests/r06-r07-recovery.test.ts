import { beforeEach, expect, test } from "vitest";
import { waitlistCommand } from "../src/lib/waitlist-command";
import { paymentCommand } from "../src/lib/instructor-payment-command";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
import type { EarningView } from "@ftksaas/api-contracts";
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002",
  session = "019a2b3c-4d5e-7000-8000-000000000003";
const scope = { actorId: person, orgId: person, centerId: center };
beforeEach(() => sessionStorage.clear());
test.each([
  "waitlist_join_v1",
  "waitlist_leave_v1",
  "seat_offer_accept_v1",
  "seat_offer_reject_v1",
] as const)("%s is independently recoverable under its exact target", (operation) => {
  const target = {
    id: session,
    session_id: session,
    person_id: person,
    version: 3,
    state: operation === "waitlist_leave_v1" ? "waiting" : "active",
    expires_at: "2099-01-01T00:00:00Z",
  } as const;
  const draft = waitlistCommand(scope, session, person, operation, target);
  sessionStorage.setItem(
    setupStorageKey(scope, draft.slot),
    JSON.stringify({ command: draft.command }),
  );
  expect(recoverSetup(scope, draft.slot)).toMatchObject({ command: draft.command });
  expect(discoverPendingOperations(person)).toMatchObject([
    { kind: "reservation", slot: draft.slot },
  ]);
  sessionStorage.setItem(
    setupStorageKey(scope, draft.slot),
    JSON.stringify({
      command: { ...draft.command, input: { ...draft.command.input, center_id: person } },
    }),
  );
  expect(recoverSetup(scope, draft.slot)).toBe("invalid");
});
test("instructor payment survives lost response but cannot be copied to another person's slot", () => {
  const row: EarningView = {
    id: session,
    person_id: person,
    center_id: center,
    session_id: session,
    event_assignment_id: null,
    amount_minor: "1000",
    paid_minor: "0",
    remaining_minor: "1000",
    direction: "add",
    previous_id: null,
    closure_id: session,
    version: 1,
    created_at: "2020-01-01T00:00:00Z",
    currency: "TRY",
    basis: { source: "lesson_agreement", currency: "TRY", quantity: 1, excluded_blocked: 0 },
  };
  const draft = paymentCommand(scope, person, [row], {
    amount: "5",
    currency: "TRY",
    localTime: "2020-01-01T12:00",
    timeZone: "Europe/Istanbul",
    offset: "",
    earningIds: [session],
  });
  sessionStorage.setItem(
    setupStorageKey(scope, draft.slot),
    JSON.stringify({ command: draft.command }),
  );
  expect(recoverSetup(scope, draft.slot)).toMatchObject({ command: draft.command });
  expect(discoverPendingOperations(person)).toMatchObject([{ kind: "finance", slot: draft.slot }]);
  const wrongSlot = `earnings:${center}`;
  sessionStorage.setItem(
    setupStorageKey(scope, wrongSlot),
    JSON.stringify({ command: draft.command }),
  );
  expect(recoverSetup(scope, wrongSlot)).toBe("invalid");
});
