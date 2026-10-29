// Fictional, isolated design data. Never imported by the live workspace as a fallback.
import type { PersonView } from "@ftksaas/api-contracts";
import { ApiFailure } from "../../lib/api";
import type { StudentActions, StudentScope } from "../../lib/students";

export const sampleStudentScope: StudentScope = {
  actorId: "design",
  orgId: "design-org",
  centerId: "design-center",
};
export const sampleStudents: PersonView[] = [
  {
    id: "019a2b3c-4d5e-7000-8000-000000000021",
    display_name: "Deniz Örnek",
    version: 1,
    discipline_relationships: [],
    relationships: [{ center_id: sampleStudentScope.centerId, kind: "student", state: "active" }],
    contacts: [
      { kind: "email", value: "deniz@example.invalid", verified_at: "2030-10-29T12:00:00Z" },
    ],
  },
  {
    id: "019a2b3c-4d5e-7000-8000-000000000022",
    display_name: "Selin Örnek",
    version: 1,
    discipline_relationships: [],
    relationships: [{ center_id: sampleStudentScope.centerId, kind: "student", state: "inactive" }],
    contacts: [],
  },
  {
    id: "019a2b3c-4d5e-7000-8000-000000000023",
    display_name: "Ece Örnek",
    version: 1,
    discipline_relationships: [],
    relationships: [{ center_id: sampleStudentScope.centerId, kind: "student", state: "active" }],
    contacts: [{ kind: "email", value: "ece@example.invalid" }],
  },
];
export function createSampleStudentActions(): StudentActions {
  const people = structuredClone(sampleStudents);
  const completed = new Map<string, string>();
  return {
    list: async ({ query, cursor }) => {
      const filtered = people.filter((person) =>
        person.display_name.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")),
      );
      const start = cursor === "design-page-2" ? 2 : 0;
      return {
        items: structuredClone(filtered.slice(start, start + 2)),
        next_cursor: filtered.length > start + 2 ? "design-page-2" : null,
        as_of: new Date().toISOString(),
      };
    },
    person: async (_org, _center, personId) =>
      structuredClone(people.find((person) => person.id === personId)!),
    change: async ({ operation, input }) => {
      if (input.person_id === sampleStudents[2].id)
        throw new ApiFailure({
          ok: false,
          error: {
            code: "OPEN_OPERATIONS_EXIST",
            retryable: false,
            trace_id: sampleStudents[2].id,
          },
        });
      const person = people.find((item) => item.id === input.person_id)!;
      const replayed = completed.has(input.operation_key);
      if (!replayed) {
        person.relationships = [
          {
            center_id: sampleStudentScope.centerId,
            kind: "student",
            state: operation === "student_activate_v1" ? "active" : "inactive",
          },
        ];
        person.version++;
      }
      completed.set(input.operation_key, operation);
      return {
        operation_id: input.operation_key,
        primary_id: "design-relationship",
        related: [],
        replayed,
      };
    },
    status: async (_org, operation, key) => ({
      operation,
      key,
      status: completed.has(key) ? "succeeded" : "in_progress",
      result_available: completed.has(key),
      result_reference: completed.has(key)
        ? { type: "center_relationships", id: "design-relationship" }
        : null,
    }),
    update: async (input) => {
      const person = people.find((item) => item.id === input.person_id)!;
      if (input.patch.display_name) person.display_name = input.patch.display_name;
      if (input.patch.contacts) person.contacts = structuredClone(input.patch.contacts);
      person.version++;
      completed.set(input.operation_key, "person_update_v1");
      return {
        operation_id: input.operation_key,
        primary_id: person.id,
        related: [],
        replayed: false,
      };
    },
    operationStatus: async (_org, operation, key) => ({
      operation,
      key,
      status: completed.has(key) ? "succeeded" : "in_progress",
      result_available: completed.has(key),
      result_reference: completed.has(key)
        ? {
            type: operation === "person_update_v1" ? "people" : "center_relationships",
            id: operation === "person_update_v1" ? people[0]!.id : "design-relationship",
          }
        : null,
    }),
    create: async (input) => {
      const person: PersonView = {
        id: `019a2b3c-4d5e-7000-8000-${String(100 + people.length).padStart(12, "0")}`,
        display_name: input.display_name,
        version: 1,
        discipline_relationships: [],
        relationships: [],
        contacts: structuredClone(input.contacts),
      };
      people.push(person);
      completed.set(input.operation_key, "person_create_v1");
      return {
        operation_id: input.operation_key,
        primary_id: person.id,
        related: [],
        replayed: false,
      };
    },
    invite: async (input) => ({ job_id: input.operation_key, state: "pending" }),
    jobStatus: async (_org, _center, jobId) => ({
      id: jobId,
      state: "pending",
      progress_count: 0,
      total_count: null,
      result_reference: null,
      safe_error_code: null,
    }),
    operationResult: async (_org, operation, key) => ({
      operation,
      key,
      status: completed.has(key) ? "succeeded" : "in_progress",
      result_available: completed.has(key),
      result_reference: completed.has(key)
        ? { type: operation === "person_create_v1" ? "people" : "invitations", id: people[0]!.id }
        : null,
    }),
  };
}
