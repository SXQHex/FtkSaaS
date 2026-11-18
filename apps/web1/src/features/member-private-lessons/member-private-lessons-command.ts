import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  LessonRequestView,
  RequestLessonRequestCreate,
  RequestLessonRequestWithdraw,
  RequestLessonRequestAcceptAlternative,
} from "../../lib/api-contracts/generated";
import type { OwnRequestDraft } from "./member-private-lessons-view";
import { scheduleInterval } from "../schedule/schedule-time";
import { readOwnRequest } from "./member-private-lessons-read";
type Context = { scope: ClientScope; personId: string };
export type OwnRequestIntent = Context &
  (
    | {
        operation: "lesson_request_create_v1";
        request: Omit<RequestLessonRequestCreate, "request_id">;
      }
    | {
        operation: "lesson_request_withdraw_v1";
        request: Omit<RequestLessonRequestWithdraw, "request_id">;
        before: LessonRequestView;
      }
    | {
        operation: "lesson_request_accept_alternative_v1";
        request: Omit<RequestLessonRequestAcceptAlternative, "request_id">;
        before: LessonRequestView;
      }
  );
export async function createOwnRequestIntent(
  scope: ClientScope,
  personId: string,
  draft: OwnRequestDraft,
  timezone: string,
  disciplines: { id: string }[],
  instructors: { id: string }[],
  asOf: string,
): Promise<OwnRequestIntent> {
  z.uuid().parse(personId);
  const values = z
    .object({
      disciplineId: z.uuid(),
      instructorId: z.union([z.literal(""), z.uuid()]),
      day: z.iso.date(),
      time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      duration: z.enum(["45", "60"]),
      offset: z.string(),
    })
    .parse(draft);
  if (
    !disciplines.some((row) => row.id === values.disciplineId) ||
    (values.instructorId && !instructors.some((row) => row.id === values.instructorId))
  )
    throw new Error("OWN_REQUEST_CHOICES_UNAVAILABLE");
  const interval = await scheduleInterval(
    timezone,
    values.day,
    values.time,
    Number(values.duration),
    values.offset,
  );
  if (Date.parse(interval.starts_at) <= Date.parse(asOf)) throw new Error("OWN_REQUEST_PAST");
  return {
    scope: { ...scope },
    personId,
    operation: "lesson_request_create_v1",
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      person_id: personId,
      discipline_id: values.disciplineId,
      requested_start: interval.starts_at,
      duration_minutes: Number(values.duration),
      ...(values.instructorId ? { preferred_instructor_id: values.instructorId } : {}),
    },
  };
}
export function existingOwnRequestIntent(
  scope: ClientScope,
  personId: string,
  before: LessonRequestView,
  mode: "withdraw" | "accept",
  draft: OwnRequestDraft,
  asOf: string,
): OwnRequestIntent {
  if (
    before.person_id !== personId ||
    before.center_id !== scope.centerId ||
    !["pending", "alternative_offered"].includes(before.state) ||
    !draft.reviewed ||
    (before.expires_at && Date.parse(before.expires_at) <= Date.parse(asOf))
  )
    throw new Error("OWN_REQUEST_SOURCE_CHANGED");
  const context = { scope: { ...scope }, personId, before: structuredClone(before) },
    base = {
      client_api_version: 1 as const,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      lesson_request_id: before.id,
      expected_version: before.version,
    };
  if (mode === "withdraw")
    return { ...context, operation: "lesson_request_withdraw_v1", request: base };
  z.object({ alternativeId: z.uuid() }).parse(draft);
  const alternative = before.alternatives.find(
    (row) => row.id === draft.alternativeId && row.state === "offered",
  );
  if (
    before.state !== "alternative_offered" ||
    !alternative ||
    Date.parse(alternative.starts_at) <= Date.parse(asOf)
  )
    throw new Error("OWN_REQUEST_SOURCE_CHANGED");
  return {
    ...context,
    operation: "lesson_request_accept_alternative_v1",
    request: { ...base, alternative_id: alternative.id },
  };
}
export async function writeOwnRequest(intent: OwnRequestIntent) {
  const backend = await scopedBackend(intent.scope),
    request_id = uuidv7();
  switch (intent.operation) {
    case "lesson_request_create_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "lesson_request_withdraw_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
    case "lesson_request_accept_alternative_v1":
      return backend.call(intent.operation, { ...intent.request, request_id });
  }
}
export async function readOwnRequestReceipt(intent: OwnRequestIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.request.operation_key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "lesson_requests" ||
        ("before" in intent && receipt.result_reference.id !== intent.before.id)))
  )
    throw new Error("OWN_REQUEST_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readOwnRequestResult(intent: OwnRequestIntent, id?: string) {
  z.uuid().parse(id);
  if ("before" in intent && id !== intent.before.id)
    throw new Error("OWN_REQUEST_RESULT_UNAVAILABLE");
  const { request: row } = await readOwnRequest(intent.scope, intent.personId, id!);
  if (intent.operation === "lesson_request_create_v1") {
    const expected = intent.request;
    if (
      row.discipline_id !== expected.discipline_id ||
      Date.parse(row.requested_start) !== Date.parse(expected.requested_start) ||
      row.duration_minutes !== expected.duration_minutes ||
      (row.preferred_instructor_id ?? undefined) !== (expected.preferred_instructor_id ?? undefined)
    )
      throw new Error("OWN_REQUEST_RESULT_UNAVAILABLE");
  } else {
    if (row.version <= intent.before.version) throw new Error("OWN_REQUEST_RESULT_UNAVAILABLE");
    if (intent.operation === "lesson_request_withdraw_v1" && row.state !== "withdrawn")
      throw new Error("OWN_REQUEST_RESULT_UNAVAILABLE");
    if (intent.operation === "lesson_request_accept_alternative_v1") {
      const before = intent.before.alternatives.find(
          (item) => item.id === intent.request.alternative_id,
        ),
        after = row.alternatives.find((item) => item.id === intent.request.alternative_id);
      if (
        !before ||
        !after ||
        after.state !== "accepted" ||
        after.version <= before.version ||
        !after.selected_at ||
        Date.parse(after.starts_at) !== Date.parse(before.starts_at) ||
        Date.parse(after.ends_at) !== Date.parse(before.ends_at) ||
        !["alternative_offered", "approved"].includes(row.state)
      )
        throw new Error("OWN_REQUEST_RESULT_UNAVAILABLE");
    }
  }
  return row;
}
