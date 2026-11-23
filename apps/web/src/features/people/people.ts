import { queryBackendRead } from "../../lib/backend";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { JobRef, PersonView } from "@ftksaas/api-contracts";

export type PeopleScope = ClientScope;
export const personEntrySchema = (messages: { name: string; email: string }) =>
  z.object({
    name: z.string().trim().min(1, messages.name),
    email: z.email(messages.email),
  });
export interface PersonCreateIntent {
  scope: PeopleScope;
  name: string;
  email: string;
  key: string;
}
export function personCreateIntent(
  scope: PeopleScope,
  draft: { name: string; email: string },
): PersonCreateIntent {
  return {
    scope: { ...scope },
    ...personEntrySchema({ name: "NAME_REQUIRED", email: "EMAIL_INVALID" }).parse(draft),
    key: uuidv7(),
  };
}
export async function readPeoplePage(
  scope: Pick<PeopleScope, "accountId" | "orgId"> & Partial<Pick<PeopleScope, "centerId">>,
  query: string,
  cursor?: string,
  status?: "active" | "inactive",
  includeSummary = false,
  signal?: AbortSignal,
  context?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, signal, context);
  return queryBackendRead(
    backend,
    "people_list_v1",
    {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      ...(scope.centerId ? { center_id: scope.centerId } : {}),
      ...(query.trim() ? { query: query.trim() } : {}),
      ...(status ? { student_status: status } : {}),
      ...(includeSummary ? { include_member_summary: true } : {}),
      page: { limit: 20, ...(cursor ? { cursor } : {}) },
    },
    signal,
  );
}
export async function createPerson(intent: PersonCreateIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("person_create_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    display_name: intent.name,
    contacts: [{ kind: "email", value: intent.email }],
  });
  if (!receipt.primary_id) throw new Error("PERSON_ACK_UNAVAILABLE");
  return receipt.primary_id;
}
export async function readPerson(
  scope: PeopleScope,
  personId: string,
  options: { membershipDate?: boolean; memberSummary?: boolean } = {},
  context?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, context);
  const person = await backend.call("person_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    ...(options.membershipDate ? { include_membership_date: true } : {}),
    ...(options.memberSummary ? { include_member_summary: true } : {}),
  });
  if (person.membership_started_at != null)
    z.iso.datetime({ offset: true }).parse(person.membership_started_at);
  if (person.id !== personId) throw new Error("PERSON_READ_UNAVAILABLE");
  return person;
}
export interface PersonInvitationIntent {
  scope: PeopleScope;
  personId: string;
  key: string;
}
export function personInvitationIntent(
  scope: PeopleScope,
  person: PersonView,
): PersonInvitationIntent {
  if (!person.contacts?.some((contact) => contact.kind === "email"))
    throw new Error("PERSON_EMAIL_UNAVAILABLE");
  return { scope: { ...scope }, personId: person.id, key: uuidv7() };
}
export async function sendPersonInvitation(intent: PersonInvitationIntent): Promise<JobRef> {
  const backend = await scopedBackend(intent.scope);
  const job = await backend.call("account_access_send_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    person_id: intent.personId,
    operation_key: intent.key,
  });
  if (!job.job_id) throw new Error("INVITATION_ACK_UNAVAILABLE");
  return job;
}
export async function readPersonInvitationJob(scope: PeopleScope, job: JobRef) {
  const backend = await scopedBackend(scope);
  return backend.call("job_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    job_id: job.job_id,
  });
}

export async function readPeopleCenter(scope: PeopleScope, context?: AccountReadContext) {
  const backend = await scopedBackend(scope, undefined, context);
  const page = await backend.call("centers_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    page: { limit: 1 },
  });
  return page.items.find((center) => center.id === scope.centerId && center.accessible) ?? null;
}
