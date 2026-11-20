import type { PersonFieldPolicy, PersonView } from "@ftksaas/api-contracts";

export function writablePersonField(policy: PersonFieldPolicy | undefined) {
  return policy?.source === "person" && policy.person_update_writable === true;
}

// The index selects a visible kind/value tuple in this versioned person snapshot,
// never an account identity or an authorization claim.
export function instructorEmailContact(person: PersonView, index: number | null) {
  if (index === null) return undefined;
  const contact = Number.isSafeInteger(index) && index >= 0 ? person.contacts?.[index] : undefined;
  if (!contact || contact.kind !== "email") throw new Error("CONTACT_SELECTION_CHANGED");
  return contact;
}

export function instructorEmailPolicy(
  person: PersonView,
  index: number | null,
): PersonFieldPolicy | undefined {
  if (index === null) {
    // An explicit new contact is a local addition. This does not authorize its
    // writer; the backend still checks the live person, actor, scope and version.
    return person.contacts ? { source: "person", person_update_writable: true } : undefined;
  }
  return instructorEmailContact(person, index)?.field_policy;
}

export function instructorEmailIndex(person: PersonView, selectedEmail?: string): number | null {
  const index =
    person.contacts?.findIndex(
      (contact) =>
        contact.kind === "email" &&
        (selectedEmail === undefined || contact.value === selectedEmail),
    ) ?? -1;
  return index < 0 ? null : index;
}
