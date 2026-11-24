import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { readInstructorEditor, type InstructorEditorState } from "./instructor-editor-state";
import { studioBackend, type StudioScope } from "./studio";
import {
  instructorEmailContact,
  instructorEmailIndex,
  instructorEmailPolicy,
  writablePersonField,
} from "./instructor-identity";
import type { PersonPatch } from "@ftksaas/api-contracts";

export interface InstructorEditDraft {
  name: string;
  email: string;
  emailContactIndex: number | null;
  classIds: string[];
  impactAccepted: boolean;
}
export type InstructorEditState = InstructorEditorState & {
  scope: StudioScope;
};
type InstructorEditStep =
  | { kind: "profile"; key: string; version: number; patch: PersonPatch }
  | { kind: "discipline"; key: string; disciplineId: string; version?: number }
  | { kind: "class"; key: string; classId: string; active: boolean; id?: string; version?: number };
export interface InstructorEditIntent {
  scope: StudioScope;
  personId: string;
  steps: InstructorEditStep[];
  draft: InstructorEditDraft;
}

export async function loadInstructorEditor(
  scope: StudioScope,
  personId: string,
  signal?: AbortSignal,
): Promise<InstructorEditState> {
  const state = await readInstructorEditor(scope, personId, signal);
  return { ...state, scope: { ...scope } };
}

export function instructorEditDraft(
  base: InstructorEditState,
  selectedEmail?: string,
): InstructorEditDraft {
  const emailContactIndex = instructorEmailIndex(base.person, selectedEmail);
  return {
    name: base.person.display_name,
    email: instructorEmailContact(base.person, emailContactIndex)?.value ?? "",
    emailContactIndex,
    classIds: base.assignments?.filter((item) => item.active).map((item) => item.classId) ?? [],
    impactAccepted: false,
  };
}

export function instructorClassesChanged(base: InstructorEditState, draft: InstructorEditDraft) {
  const original = instructorEditDraft(base).classIds;
  return (
    original.length !== draft.classIds.length || original.some((id) => !draft.classIds.includes(id))
  );
}

export function instructorEditSchema(
  base: InstructorEditState,
  messages: { name: string; email: string; impact: string },
) {
  return z
    .object({
      name: z.string().trim().min(1, messages.name),
      email: z.union([z.literal(""), z.email(messages.email)]),
      emailContactIndex: z.number().int().nonnegative().nullable(),
      classIds: z.array(z.string()),
      impactAccepted: z.boolean(),
    })
    .superRefine((value, context) => {
      if (instructorClassesChanged(base, value) && !value.impactAccepted)
        context.addIssue({ code: "custom", path: ["impactAccepted"], message: messages.impact });
    });
}

export function instructorEditIntent(
  scope: StudioScope,
  base: InstructorEditState,
  draft: InstructorEditDraft,
): InstructorEditIntent {
  if (
    base.scope.accountId !== scope.accountId ||
    base.scope.orgId !== scope.orgId ||
    base.scope.centerId !== scope.centerId
  )
    throw new Error("STUDIO_UNAVAILABLE");
  const value = instructorEditSchema(base, {
    name: "NAME_REQUIRED",
    email: "EMAIL_INVALID",
    impact: "IMPACT_REQUIRED",
  }).parse(draft);
  const steps: InstructorEditStep[] = [];
  const patch: PersonPatch = {};
  if (value.name !== base.person.display_name) {
    if (!writablePersonField(base.person.field_policy?.display_name))
      throw new Error("PERSON_FIELD_READONLY");
    patch.display_name = value.name;
  }
  const originalEmail = instructorEmailContact(base.person, value.emailContactIndex);
  if (value.email !== (originalEmail?.value ?? "")) {
    if (!base.person.contacts) throw new Error("CONTACTS_UNAVAILABLE");
    if (!writablePersonField(instructorEmailPolicy(base.person, value.emailContactIndex)))
      throw new Error("PERSON_FIELD_READONLY");
    if (
      value.email &&
      base.person.contacts.some(
        (contact) =>
          contact !== originalEmail && contact.kind === "email" && contact.value === value.email,
      )
    )
      throw new Error("CONTACT_ALREADY_EXISTS");
    // The form edits the displayed contact only. Other email/phone values and
    // their existing verification remain on the backend's unchanged contact rows.
    patch.contacts = base.person.contacts
      .filter((item) => item !== originalEmail)
      .map(({ kind, value }) => ({ kind, value }));
    if (value.email) patch.contacts.push({ kind: "email", value: value.email });
  }
  if (Object.keys(patch).length)
    steps.push({ kind: "profile", key: uuidv7(), version: base.person.version, patch });
  if (instructorClassesChanged(base, value)) {
    if (!base.assignments || !base.roles.some((item) => item.active))
      throw new Error("ASSIGNMENTS_UNAVAILABLE");
    const selected = new Set(value.classIds);
    if (
      selected.size !== value.classIds.length ||
      value.classIds.some((id) => !base.assignments?.some((item) => item.classId === id))
    )
      throw new Error("ASSIGNMENTS_UNAVAILABLE");
    const requiredDisciplines = new Set<string>();
    for (const assignment of base.assignments) {
      const active = selected.has(assignment.classId);
      if (active === assignment.active) continue;
      const lesson = base.classes.find((item) => item.id === assignment.classId);
      if (
        !lesson ||
        !lesson.active ||
        lesson.scope.accountId !== scope.accountId ||
        lesson.scope.orgId !== scope.orgId ||
        lesson.scope.centerId !== scope.centerId
      )
        throw new Error("ASSIGNMENTS_UNAVAILABLE");
      if (active) requiredDisciplines.add(lesson.disciplineId);
    }
    for (const disciplineId of requiredDisciplines) {
      const relations = base.person.discipline_relationships.filter(
        (item) =>
          item.center_id === scope.centerId &&
          item.discipline_id === disciplineId &&
          item.kind === "instructor",
      );
      if (relations.length > 1) throw new Error("STUDIO_UNAVAILABLE");
      if (relations[0]?.state !== "active")
        steps.push({
          kind: "discipline",
          disciplineId,
          key: uuidv7(),
          ...(relations[0] ? { version: relations[0].version } : {}),
        });
    }
    for (const assignment of base.assignments) {
      const active = selected.has(assignment.classId);
      if (active !== assignment.active)
        steps.push({
          kind: "class",
          classId: assignment.classId,
          active,
          key: uuidv7(),
          id: assignment.id,
          version: assignment.version,
        });
    }
  }
  return {
    scope: { ...scope },
    personId: base.person.id,
    draft: { ...value, classIds: [...value.classIds] },
    steps,
  };
}

export async function saveInstructorEditStep(intent: InstructorEditIntent, index: number) {
  const step = intent.steps[index];
  if (!step) throw new Error("STUDIO_UNAVAILABLE");
  const backend = await studioBackend(intent.scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: step.key,
    person_id: intent.personId,
  };
  const result =
    step.kind === "profile"
      ? await backend.call("person_update_v1", {
          ...common,
          expected_version: step.version,
          patch: step.patch,
        })
      : step.kind === "discipline"
        ? await backend.call("person_discipline_set_v1", {
            ...common,
            discipline_id: step.disciplineId,
            kind: "instructor",
            state: "active",
            ...(step.version === undefined ? {} : { expected_version: step.version }),
          })
        : await backend.call("class_assignment_set_v1", {
            ...common,
            class_id: step.classId,
            duty: "instructor",
            state: step.active ? "active" : "inactive",
            ...(step.version === undefined ? {} : { expected_version: step.version }),
          });
  const expectedId =
    step.kind === "profile" ? intent.personId : step.kind === "class" ? step.id : undefined;
  if (!result.primary_id || (expectedId && result.primary_id !== expectedId))
    throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result;
}
