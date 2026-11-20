import { beforeEach, expect, it, vi } from "vitest";
import type { PersonView } from "@ftksaas/api-contracts";
import {
  personEditDraft,
  personEditPatch,
  preparePersonEdit,
  writePersonEdit,
  personEditReceipt,
  readPersonEditResult,
} from "./person-edit";
const { read, call } = vi.hoisted(() => ({ read: vi.fn(), call: vi.fn() }));
vi.mock("../people/people", () => ({ readPerson: read }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const local = { source: "person" as const, person_update_writable: true };
let person: PersonView;
beforeEach(() => {
  person = {
    id: id(4),
    display_name: "Sentetik kişi",
    version: 3,
    relationships: [],
    discipline_relationships: [],
    field_policy: {
      display_name: local,
      given_name: { ...local, person_update_writable: false },
      family_name: { ...local, person_update_writable: false },
    },
    contacts: [
      {
        kind: "email",
        value: "native@example.test",
        verified_at: "2026-11-01T00:00:00Z",
        field_policy: { source: "native_auth", person_update_writable: false },
      },
      { kind: "email", value: "local@example.test", field_policy: local },
      { kind: "phone", value: "+905550000001" },
    ],
  };
  read.mockReset().mockImplementation(async () => structuredClone(person));
  call.mockReset().mockResolvedValue({ primary_id: person.id });
});
it("patches only supported editable fields and preserves protected/unknown tuples without response metadata", async () => {
  const draft = personEditDraft(person);
  draft.name = "Yeni kişi";
  draft.contacts[1]!.value = "new@example.test";
  const intent = await preparePersonEdit(scope, structuredClone(person), draft);
  expect(intent.patch).toEqual({
    display_name: "Yeni kişi",
    contacts: [
      { kind: "email", value: "native@example.test" },
      { kind: "email", value: "new@example.test" },
      { kind: "phone", value: "+905550000001" },
    ],
  });
  await writePersonEdit(intent);
  await writePersonEdit(intent);
  expect(call.mock.calls[0]![0]).toBe("person_update_v1");
  expect(call.mock.calls[0]![1]).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    expected_version: 3,
    person_id: person.id,
    operation_key: intent.key,
    patch: intent.patch,
  });
  expect(call.mock.calls[1]![1].operation_key).toBe(intent.key);
  expect(call.mock.calls[1]![1].request_id).not.toBe(call.mock.calls[0]![1].request_id);
  expect(person.relationships).toEqual([]);
});
it("removes only explicit local blanks, adds a new contact and rejects protected/unknown mutations", () => {
  const draft = personEditDraft(person);
  draft.contacts[1]!.value = "";
  draft.contacts.push({ kind: "phone", value: "+905550000002" });
  expect(personEditPatch(person, draft).contacts).toEqual([
    { kind: "email", value: "native@example.test" },
    { kind: "phone", value: "+905550000001" },
    { kind: "phone", value: "+905550000002" },
  ]);
  draft.contacts[0]!.value = "changed@example.test";
  expect(() => personEditPatch(person, draft)).toThrow("PERSON_FIELD_READONLY");
  draft.contacts[0]!.value = "native@example.test";
  draft.contacts[2]!.value = "";
  expect(() => personEditPatch(person, draft)).toThrow("PERSON_FIELD_READONLY");
});
it("does not infer name ownership, contact visibility or permission from verification", () => {
  const draft = personEditDraft(person);
  delete person.field_policy;
  draft.name = "Değişti";
  expect(() => personEditPatch(person, draft)).toThrow("PERSON_FIELD_READONLY");
  delete person.contacts;
  draft.name = person.display_name;
  expect(() => personEditPatch(person, draft)).toThrow("CONTACTS_UNAVAILABLE");
});
it("rejects malformed/duplicate drafts, unchanged edits and stale policy/version before creating a writer", async () => {
  const base = structuredClone(person),
    draft = personEditDraft(person);
  await expect(preparePersonEdit(scope, base, draft)).rejects.toThrow("PERSON_EDIT_NO_CHANGE");
  draft.contacts[1]!.value = "bad";
  expect(() => personEditPatch(person, draft)).toThrow();
  draft.contacts[1]!.value = "native@example.test";
  expect(() => personEditPatch(person, draft)).toThrow("CONTACT_ALREADY_EXISTS");
  person.version++;
  await expect(preparePersonEdit(scope, base, draft)).rejects.toThrow("PERSON_EDIT_STALE");
  person.version = base.version;
  person.contacts![1]!.field_policy = { source: "native_auth", person_update_writable: false };
  await expect(preparePersonEdit(scope, base, draft)).rejects.toThrow("PERSON_EDIT_STALE");
  expect(call).not.toHaveBeenCalled();
});
it("requires an exact person ACK, exact receipt and newer matching native readback", async () => {
  const draft = personEditDraft(person);
  draft.name = "Yeni kişi";
  const intent = await preparePersonEdit(scope, person, draft);
  call.mockResolvedValue({ primary_id: id(9) });
  await expect(writePersonEdit(intent)).rejects.toThrow("PERSON_EDIT_ACK_UNAVAILABLE");
  call.mockResolvedValue({
    operation: "person_update_v1",
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "people", id: person.id },
  });
  await expect(personEditReceipt(intent)).resolves.toMatchObject({ status: "succeeded" });
  call.mockResolvedValue({
    operation: "person_update_v1",
    key: intent.key,
    result_reference: { type: "people", id: id(9) },
  });
  await expect(personEditReceipt(intent)).rejects.toThrow("PERSON_EDIT_RECEIPT_UNAVAILABLE");
  person.display_name = draft.name;
  await expect(readPersonEditResult(intent)).rejects.toThrow("PERSON_EDIT_RESULT_UNAVAILABLE");
  person.version++;
  await expect(readPersonEditResult(intent)).resolves.toMatchObject({
    version: 4,
    display_name: draft.name,
  });
  await expect(readPersonEditResult(intent, id(9))).rejects.toThrow(
    "PERSON_EDIT_RESULT_UNAVAILABLE",
  );
});

it("leaves unchanged historical values exact, including a protected name, while editing a separate local contact", () => {
  person.display_name = " Sentetik hesap ";
  person.field_policy!.display_name = { source: "account_profile", person_update_writable: false };
  person.contacts![1]!.value = "historical-local-value";
  const draft = personEditDraft(person);
  draft.contacts.push({ kind: "email", value: "new@example.test" });
  const patch = personEditPatch(person, draft);
  expect(patch).not.toHaveProperty("display_name");
  expect(patch.contacts).toContainEqual({ kind: "email", value: "historical-local-value" });
  expect(patch.contacts).toContainEqual({ kind: "email", value: "new@example.test" });
});
