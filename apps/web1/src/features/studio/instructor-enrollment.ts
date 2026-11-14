import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { studioBackend, studioPages, type StudioScope } from "./studio";
import { readStudioInstructors } from "./studio-reads";
import type { JobRef, ManagementSelector } from "../../lib/api-contracts/generated";

export const newInstructorSchema = (messages: { name: string; email: string }) =>
  z.object({
    name: z.string().trim().min(1, messages.name),
    email: z.email(messages.email),
  });
export interface NewInstructorIntent {
  scope: StudioScope;
  name: string;
  email: string;
  key: string;
}
export function newInstructorIntent(
  scope: StudioScope,
  draft: { name: string; email: string },
): NewInstructorIntent {
  const value = newInstructorSchema({ name: "NAME_REQUIRED", email: "EMAIL_INVALID" }).parse(draft);
  return { ...value, scope: { ...scope }, key: uuidv7() };
}
export async function createInstructorPerson(intent: NewInstructorIntent) {
  const backend = await studioBackend(intent.scope);
  const result = await backend.call("person_create_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    display_name: intent.name,
    contacts: [{ kind: "email", value: intent.email }],
  });
  if (!result.primary_id) throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result.primary_id;
}

export async function readInstructorEnrollment(scope: StudioScope, personId: string) {
  const backend = await studioBackend(scope);
  const management = (selector: ManagementSelector) =>
    studioPages((cursor) =>
      backend.call("management_state_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: selector.operation,
        selector,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      }),
    );
  const [roles, links, invitations] = await Promise.all([
    readStudioInstructors(scope, personId),
    management({ operation: "account_link_remove_v1", key: { person_id: personId } }).catch(
      (error: unknown) => {
        // Discovery needs a role/relationship/invitation scope; a newly created
        // person may not have one yet. NOT_FOUND does not prove absence of a link.
        if (error instanceof BackendError && error.code === "NOT_FOUND") return null;
        throw error;
      },
    ),
    management({ operation: "account_access_revoke_v1", key: { person_id: personId } }),
  ]);
  const person =
    roles[0]?.person ??
    (await backend.call("person_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
    }));
  const allowedPeople = new Set([person.id, ...(person.linked_person_ids ?? [])]);
  if (
    person.id !== personId ||
    links?.some(
      (item) =>
        !item.exists ||
        item.entity?.type !== "account_links" ||
        item.current?.operation !== "account_link_remove_v1" ||
        !allowedPeople.has(item.current.values.person_id ?? "") ||
        item.current.values.link_id !== item.entity.id,
    ) ||
    invitations.some(
      (item) =>
        !item.exists ||
        item.entity?.type !== "invitations" ||
        item.current?.operation !== "account_access_revoke_v1" ||
        !allowedPeople.has(item.current.values.person_id ?? "") ||
        item.current.values.invitation_id !== item.entity.id ||
        item.current.values.center_id !== scope.centerId,
    )
  )
    throw new Error("STUDIO_UNAVAILABLE");
  return {
    scope: { ...scope },
    person,
    roles,
    activeLink: links === null ? null : links.some((item) => item.state === "active"),
    pendingInvitations: invitations.filter((item) => item.state === "pending").length,
    // This is duty membership, not proof of native access for a legacy offline row.
    activeRole: roles.some((item) => item.active),
    accountAccessGranted: roles.some((item) => item.active && item.accountAccessGranted === true)
      ? true
      : roles.some((item) => item.active && item.accountAccessGranted === null)
        ? null
        : false,
  };
}
export type InstructorEnrollment = Awaited<ReturnType<typeof readInstructorEnrollment>>;
export interface EnrollmentIntent {
  scope: StudioScope;
  personId: string;
  kind: "invite" | "grant";
  key: string;
}
export function enrollmentIntent(
  state: InstructorEnrollment,
  kind: EnrollmentIntent["kind"],
): EnrollmentIntent {
  if (kind === "grant" && state.accountAccessGranted === true)
    throw new Error("ENROLLMENT_CHANGED");
  if ((kind === "invite" && state.activeLink) || (kind === "grant" && state.activeLink === false))
    throw new Error("ENROLLMENT_CHANGED");
  return { scope: { ...state.scope }, personId: state.person.id, kind, key: uuidv7() };
}
export type EnrollmentReceipt = { kind: "invite"; job: JobRef } | { kind: "grant"; roleId: string };
export async function writeInstructorEnrollment(
  intent: EnrollmentIntent,
): Promise<EnrollmentReceipt> {
  const backend = await studioBackend(intent.scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    person_id: intent.personId,
    operation_key: intent.key,
  };
  if (intent.kind === "invite") {
    const job = await backend.call("account_access_send_v1", common);
    if (!job.job_id) throw new Error("STUDIO_ACK_UNAVAILABLE");
    return { kind: "invite", job };
  }
  const result = await backend.call("role_assign_v1", {
    ...common,
    role: "instructor",
    scope: { center_id: intent.scope.centerId },
  });
  if (!result.primary_id) throw new Error("STUDIO_ACK_UNAVAILABLE");
  return { kind: "grant", roleId: result.primary_id };
}

export async function readInstructorInvitationJob(scope: StudioScope, jobId: string) {
  const backend = await studioBackend(scope);
  const job = await backend.call("job_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    job_id: jobId,
  });
  if (job.id !== jobId) throw new Error("STUDIO_UNAVAILABLE");
  return job;
}

export async function findInstructorPeople(scope: StudioScope, query: string, cursor?: string) {
  const backend = await studioBackend(scope);
  return backend.call("people_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    ...(query.trim() ? { query: query.trim() } : {}),
    page: { limit: 50, ...(cursor ? { cursor } : {}) },
  });
}
