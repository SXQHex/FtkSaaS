import { describe, expect, it } from "vitest";
import {
  instructorEditDraft,
  instructorEditIntent,
  type InstructorEditState,
} from "./instructor-edit";
import type { PersonFieldPolicy } from "@ftksaas/api-contracts";

const local: PersonFieldPolicy = { source: "person", person_update_writable: true };
const native: PersonFieldPolicy = { source: "native_auth", person_update_writable: false };
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
function base(): InstructorEditState {
  return {
    scope,
    classes: [],
    assignments: [],
    roles: [],
    person: {
      id: "019a7b00-0000-7000-8000-000000000006",
      version: 4,
      display_name: "Fixture",
      field_policy: {
        display_name: local,
        given_name: { ...local, person_update_writable: false },
        family_name: { ...local, person_update_writable: false },
      },
      relationships: [],
      discipline_relationships: [],
      contacts: [
        { kind: "email", value: "native@example.invalid", field_policy: native },
        {
          kind: "email",
          value: "local@example.invalid",
          verified_at: "2026-11-01T00:00:00Z",
          field_policy: local,
        },
        { kind: "phone", value: "+905550000000", field_policy: native },
      ],
    },
  };
}

describe("instructor person field policy", () => {
  it.each([undefined, { source: "account_profile", person_update_writable: false } as const])(
    "rejects protected or missing name policy before constructing a write (%j)",
    (policy) => {
      const current = base();
      if (policy) current.person.field_policy!.display_name = policy;
      else delete current.person.field_policy;
      expect(() =>
        instructorEditIntent(scope, current, { ...instructorEditDraft(current), name: "Changed" }),
      ).toThrow("PERSON_FIELD_READONLY");
      expect(instructorEditIntent(scope, current, instructorEditDraft(current)).steps).toEqual([]);
    },
  );
  it("allows a local name and keeps the exact person version", () => {
    const current = base();
    expect(
      instructorEditIntent(scope, current, { ...instructorEditDraft(current), name: "Changed" })
        .steps,
    ).toEqual([
      expect.objectContaining({ kind: "profile", version: 4, patch: { display_name: "Changed" } }),
    ]);
  });
  it.each(["", "changed@example.invalid"])(
    "rejects editing or deleting a native email (%s)",
    (email) => {
      const current = base();
      expect(() =>
        instructorEditIntent(scope, current, { ...instructorEditDraft(current), email }),
      ).toThrow("PERSON_FIELD_READONLY");
    },
  );
  it("does not infer ownership from verification and sends only kind/value while preserving protected contacts", () => {
    const current = base();
    const draft = {
      ...instructorEditDraft(current, "local@example.invalid"),
      email: "changed@example.invalid",
    };
    expect(instructorEditIntent(scope, current, draft).steps).toEqual([
      expect.objectContaining({
        patch: {
          contacts: [
            { kind: "email", value: "native@example.invalid" },
            { kind: "phone", value: "+905550000000" },
            { kind: "email", value: "changed@example.invalid" },
          ],
        },
      }),
    ]);
    delete current.person.contacts![1]!.field_policy;
    expect(() => instructorEditIntent(scope, current, draft)).toThrow("PERSON_FIELD_READONLY");
  });
  it("adds an explicit local contact and rejects an existing native value", () => {
    const current = base();
    const draft = { ...instructorEditDraft(current, ""), email: "new@example.invalid" };
    const intent = instructorEditIntent(scope, current, draft);
    expect(intent.steps[0]).toMatchObject({
      patch: {
        contacts: [
          { kind: "email", value: "native@example.invalid" },
          { kind: "email", value: "local@example.invalid" },
          { kind: "phone", value: "+905550000000" },
          { kind: "email", value: "new@example.invalid" },
        ],
      },
    });
    expect(() =>
      instructorEditIntent(scope, current, { ...draft, email: "native@example.invalid" }),
    ).toThrow("CONTACT_ALREADY_EXISTS");
  });
  it("rejects invalid contact selection and fails closed without the complete contact list", () => {
    const current = base();
    const draft = instructorEditDraft(current);
    for (const emailContactIndex of [2, 99])
      expect(() => instructorEditIntent(scope, current, { ...draft, emailContactIndex })).toThrow(
        "CONTACT_SELECTION_CHANGED",
      );
    delete current.person.contacts;
    expect(() =>
      instructorEditIntent(scope, current, {
        ...draft,
        emailContactIndex: null,
        email: "new@example.invalid",
      }),
    ).toThrow("CONTACTS_UNAVAILABLE");
  });
});
