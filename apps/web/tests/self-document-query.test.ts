import { beforeEach, expect, test } from "vitest";
import { selfDocumentQuery, validSelfDocumentContext } from "../src/lib/document-acceptance";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: other, orgId: id, centerId: other };
const context = { gate: "reservation" as const, subject: { type: "sessions" as const, id } };
beforeEach(() => sessionStorage.clear());
test("self requirements preserve a real context without any account-to-person substitution", () => {
  const query = selfDocumentQuery(scope, context);
  expect(query).toEqual({ org_id: id, center_id: other, context });
  expect(query).not.toHaveProperty("person_id");
  expect(query).not.toHaveProperty("actorId");
});
test("self context rejects delegation, extra data and mismatched gate/subject pairs", () => {
  for (const value of [
    { ...context, on_behalf_of_person_id: other },
    { ...context, on_behalf_of_person_id: null },
    { ...context, other: true },
    { ...context, gate: "sale" },
    { ...context, subject: { type: "sessions", id: "../bad" } },
  ])
    expect(validSelfDocumentContext(value)).toBe(false);
  expect(validSelfDocumentContext({ ...context, product_version_id: other })).toBe(true);
});
test("all supported real domain contexts remain reusable for later forms", () => {
  for (const [gate, type] of [
    ["sale", "sales"],
    ["sale", "product_versions"],
    ["reservation", "lesson_requests"],
    ["reservation", "reservations"],
    ["attendance", "reservations"],
    ["event_registration", "events"],
  ])
    expect(validSelfDocumentContext({ gate, subject: { type, id } })).toBe(true);
});
test("durable self acceptance restores the exact version/context but rejects target-person additions", () => {
  const command = {
    operation: "document_accept_v1",
    input: { org_id: id, center_id: other, operation_key: id, document_version_id: other, context },
  };
  const key = setupStorageKey(scope, "document-accept");
  sessionStorage.setItem(key, JSON.stringify({ command }));
  expect(recoverSetup(scope, "document-accept")).toEqual({ command });
  for (const input of [
    { ...command.input, person_id: id },
    { ...command.input, context: { ...context, on_behalf_of_person_id: other } },
    { ...command.input, document_version_id: "invalid" },
    { ...command.input, context: { ...context, gate: "sale" } },
    { ...command.input, org_id: other },
  ]) {
    sessionStorage.setItem(key, JSON.stringify({ command: { ...command, input } }));
    expect(recoverSetup(scope, "document-accept")).toBe("invalid");
  }
});
