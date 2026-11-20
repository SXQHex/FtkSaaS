import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { ContactInput, PersonPatch, PersonView } from "@ftksaas/api-contracts";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { readPerson } from "../people/people";
import { writablePersonField } from "../studio/instructor-identity";

export interface PersonEditDraft {
  name: string;
  contacts: ContactInput[];
}
export function personEditDraft(person: PersonView): PersonEditDraft {
  return {
    name: person.display_name,
    contacts: person.contacts?.map(({ kind, value }) => ({ kind, value })) ?? [],
  };
}
export function personEditPatch(person: PersonView, draft: PersonEditDraft): PersonPatch {
  const patch: PersonPatch = {};
  if (draft.name !== person.display_name) {
    if (!writablePersonField(person.field_policy?.display_name))
      throw Error("PERSON_FIELD_READONLY");
    patch.display_name = z.string().trim().min(1).parse(draft.name);
  }
  const before = person.contacts;
  if (!before) {
    if (draft.contacts.length) throw Error("CONTACTS_UNAVAILABLE");
    return patch;
  }
  // Existing positions identify exact visible tuples in this version, never account identities.
  if (draft.contacts.length < before.length) throw Error("CONTACT_SELECTION_CHANGED");
  const contacts = draft.contacts.flatMap((contact, index) => {
    const original = before[index];
    if (original && !writablePersonField(original.field_policy)) {
      if (original.kind !== contact.kind || original.value !== contact.value)
        throw Error("PERSON_FIELD_READONLY");
      return [{ kind: original.kind, value: original.value }];
    }
    if (original && contact.kind === original.kind && contact.value === original.value)
      return [{ kind: original.kind, value: original.value }];
    const kind = z.enum(["email", "phone"]).parse(contact.kind);
    if (original && kind !== original.kind) throw Error("CONTACT_SELECTION_CHANGED");
    const value = contact.value.trim();
    if (!value) return [];
    if (kind === "email") z.email().parse(value);
    return [{ kind, value }];
  });
  const keys = contacts.map(({ kind, value }) => `${kind}:${value}`);
  if (new Set(keys).size !== keys.length) throw Error("CONTACT_ALREADY_EXISTS");
  if (
    JSON.stringify(contacts) !== JSON.stringify(before.map(({ kind, value }) => ({ kind, value })))
  )
    patch.contacts = contacts;
  return patch;
}
export async function preparePersonEdit(
  scope: ClientScope,
  base: PersonView,
  draft: PersonEditDraft,
) {
  const person = await readPerson(scope, base.id);
  if (
    person.version !== base.version ||
    JSON.stringify(person.field_policy) !== JSON.stringify(base.field_policy) ||
    JSON.stringify(person.contacts) !== JSON.stringify(base.contacts) ||
    person.display_name !== base.display_name
  )
    throw Error("PERSON_EDIT_STALE");
  z.number().int().positive().safe().parse(person.version);
  const patch = personEditPatch(person, draft);
  if (!Object.keys(patch).length) throw Error("PERSON_EDIT_NO_CHANGE");
  return {
    scope: { ...scope },
    personId: person.id,
    version: person.version,
    before: personEditDraft(person),
    patch,
    key: uuidv7(),
  };
}
export type PersonEditIntent = Awaited<ReturnType<typeof preparePersonEdit>>;
export async function writePersonEdit(intent: PersonEditIntent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("person_update_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    person_id: intent.personId,
    expected_version: intent.version,
    operation_key: intent.key,
    patch: intent.patch,
  });
  if (result.primary_id !== intent.personId) throw Error("PERSON_EDIT_ACK_UNAVAILABLE");
  return result;
}
export async function personEditReceipt(intent: PersonEditIntent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "person_update_v1",
    key: intent.key,
  });
  if (
    result.operation !== "person_update_v1" ||
    result.key !== intent.key ||
    (result.result_reference &&
      (result.result_reference.type !== "people" || result.result_reference.id !== intent.personId))
  )
    throw Error("PERSON_EDIT_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readPersonEditResult(intent: PersonEditIntent, id?: string) {
  if (id && id !== intent.personId) throw Error("PERSON_EDIT_RESULT_UNAVAILABLE");
  const result = await readPerson(intent.scope, intent.personId, {
    membershipDate: true,
    memberSummary: true,
  });
  const tuples = (contacts: ContactInput[]) =>
    contacts.map(({ kind, value }) => `${kind}:${value}`).sort();
  if (
    !Number.isSafeInteger(result.version) ||
    result.version <= intent.version ||
    (intent.patch.display_name !== undefined &&
      result.display_name !== intent.patch.display_name) ||
    (intent.patch.contacts &&
      (!result.contacts ||
        JSON.stringify(tuples(result.contacts)) !== JSON.stringify(tuples(intent.patch.contacts))))
  )
    throw Error("PERSON_EDIT_RESULT_UNAVAILABLE");
  return result;
}
