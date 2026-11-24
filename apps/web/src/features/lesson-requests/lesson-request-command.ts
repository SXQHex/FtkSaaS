import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import type {
  LessonRequestView,
  Mutation,
  RequestLessonRequestReject,
  RequestLessonRequestOfferAlternative,
  RequestLessonRequestApprove,
} from "@ftksaas/api-contracts";
import type { RequestDraft } from "./lesson-requests-view";
import { readLessonRequest, readRequestSessions, requestInterval } from "./lesson-requests-read";
import { scheduleInterval } from "../schedule/schedule-time";
import { readProfileRights } from "../member-profile/profile-read";
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export type RequestIntent = { scope: ClientScope; before: LessonRequestView } & (
  | {
      operation: "lesson_request_reject_v1";
      request: Omit<RequestLessonRequestReject, "request_id">;
    }
  | {
      operation: "lesson_request_offer_alternative_v1";
      request: Omit<RequestLessonRequestOfferAlternative, "request_id">;
    }
  | {
      operation: "lesson_request_approve_v1";
      request: Omit<RequestLessonRequestApprove, "request_id">;
    }
);
export async function requestIntent(
  scope: ClientScope,
  before: LessonRequestView,
  stage: "reject" | "alternative" | "approve",
  draft: RequestDraft,
  timezone: string,
): Promise<RequestIntent> {
  if (
    before.center_id !== scope.centerId ||
    !["pending", "alternative_offered"].includes(before.state)
  )
    throw new Error("LESSON_REQUEST_SOURCE_CHANGED");
  const base = {
    ...common(scope),
    operation_key: uuidv7(),
    lesson_request_id: before.id,
    expected_version: before.version,
  };
  const context = { scope: { ...scope }, before: structuredClone(before) };
  if (stage === "reject")
    return {
      ...context,
      operation: "lesson_request_reject_v1",
      request: { ...base, reason: z.string().trim().min(1).parse(draft.reason) },
    };
  if (stage === "alternative") {
    const values = z
      .object({
        day: z.iso.date(),
        time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        instructorId: z.union([z.literal(""), z.uuid()]),
        windowException: z.boolean(),
        offset: z.string(),
      })
      .parse(draft);
    const interval = await scheduleInterval(
      timezone,
      values.day,
      values.time,
      before.duration_minutes,
      values.offset,
    );
    return {
      ...context,
      operation: "lesson_request_offer_alternative_v1",
      request: {
        ...base,
        alternatives: [
          { interval, ...(values.instructorId ? { instructor_id: values.instructorId } : {}) },
        ],
        ...(values.windowException
          ? { window_exception: true, reason: z.string().trim().min(1).parse(draft.reason) }
          : {}),
      },
    };
  }
  if (!draft.accepted) throw new Error("LESSON_REQUEST_REVIEW_REQUIRED");
  if (draft.mode === "existing")
    return {
      ...context,
      operation: "lesson_request_approve_v1",
      request: { ...base, session_id: z.uuid().parse(draft.sessionId) },
    };
  const instructor = z.uuid().parse(draft.instructorId),
    room = z.uuid().parse(draft.roomId),
    total = z.coerce.number().int().positive().safe().parse(draft.capacity);
  const { interval, instructorId } = await requestInterval(before);
  if (instructorId && instructor !== instructorId)
    throw new Error("LESSON_REQUEST_INSTRUCTOR_CHANGED");
  return {
    ...context,
    operation: "lesson_request_approve_v1",
    request: {
      ...base,
      session: {
        interval,
        format: "private",
        discipline_id: before.discipline_id,
        resources: [{ kind: "room", id: room }],
        assignments: [{ person_id: instructor, duty: "instructor" }],
        capacity: { total },
      },
    },
  };
}
export async function writeRequest(intent: RequestIntent) {
  const backend = await scopedBackend(intent.scope);
  switch (intent.operation) {
    case "lesson_request_reject_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "lesson_request_offer_alternative_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
    case "lesson_request_approve_v1":
      return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  }
}
export async function readRequestReceipt(intent: RequestIntent) {
  const backend = await scopedBackend(intent.scope),
    receipt = await backend.call("operation_status_get_v1", {
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
        receipt.result_reference.id !== intent.before.id))
  )
    throw new Error("LESSON_REQUEST_RECEIPT_UNAVAILABLE");
  return receipt;
}
function visibility(error: unknown) {
  if (error instanceof BackendError && ["FORBIDDEN", "NOT_FOUND"].includes(error.code))
    return "restricted" as const;
  if (error instanceof BackendError && error.code === "PLAN_FEATURE_UNAVAILABLE")
    return "not_enabled" as const;
  throw error;
}
const approvalReferences = z.array(z.object({ type: z.string(), id: z.uuid() }));

function acknowledgedSessionId(related: Mutation["related"] | undefined, reservationId: string) {
  const references = approvalReferences.safeParse(related);
  if (!references.success) return;
  const sessions = references.data.filter((reference) => reference.type === "sessions");
  const reservations = references.data.filter((reference) => reference.type === "reservations");
  if (sessions.length === 1 && reservations.length === 1 && reservations[0]?.id === reservationId)
    return sessions[0]?.id;
}

async function approvedReservation(
  intent: RequestIntent,
  personId: string,
  reservationId: string,
  sessionId?: string,
) {
  const sessionBeforeLookup = sessionId
    ? (await readRequestSessions(intent.scope, intent.before, undefined, sessionId))[0]
    : undefined;
  if (sessionId && !sessionBeforeLookup) throw Error("LESSON_REQUEST_RESULT_UNAVAILABLE");
  const backend = await scopedBackend(intent.scope);
  const page = await backend.call("reservation_list_v1", {
    ...common(intent.scope),
    request_id: uuidv7(),
    person_id: personId,
    reservation_id: reservationId,
    ...(sessionId ? { session_id: sessionId } : {}),
    page: { limit: 1 },
  });
  const [reservation] = page.items;
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    reservation?.id !== reservationId ||
    reservation.person_id !== personId ||
    (sessionId && reservation.session_id !== sessionId) ||
    reservation.state !== "active" ||
    reservation.mode !== "flexible"
  )
    throw Error("LESSON_REQUEST_RESULT_UNAVAILABLE");
  z.number().int().positive().safe().parse(reservation.version);
  const confirmedSessionId = z.uuid().parse(reservation.session_id);
  const session =
    sessionBeforeLookup ??
    (await readRequestSessions(intent.scope, intent.before, undefined, confirmedSessionId))[0];
  if (!session) throw Error("LESSON_REQUEST_RESULT_UNAVAILABLE");
  return { status: "available" as const, reservation, session };
}
export async function readRequestResult(
  intent: RequestIntent,
  id?: string,
  related?: Mutation["related"],
) {
  if (id && id !== intent.before.id) throw new Error("LESSON_REQUEST_RESULT_UNAVAILABLE");
  const request = await readLessonRequest(intent.scope, intent.before.id);
  const state =
    intent.operation === "lesson_request_reject_v1"
      ? "rejected"
      : intent.operation === "lesson_request_offer_alternative_v1"
        ? "alternative_offered"
        : "approved";
  if (
    request.person_id !== intent.before.person_id ||
    request.version <= intent.before.version ||
    request.state !== state
  )
    throw new Error("LESSON_REQUEST_RESULT_UNAVAILABLE");
  if (intent.operation === "lesson_request_offer_alternative_v1") {
    for (const expected of intent.request.alternatives) {
      if (
        !request.alternatives.some(
          (row) =>
            row.state === "offered" &&
            Date.parse(row.starts_at) === Date.parse(expected.interval.starts_at) &&
            Date.parse(row.ends_at) === Date.parse(expected.interval.ends_at) &&
            (row.instructor_id ?? undefined) === (expected.instructor_id ?? undefined),
        )
      )
        throw new Error("LESSON_REQUEST_RESULT_UNAVAILABLE");
    }
  }
  if (intent.operation !== "lesson_request_approve_v1") return { request };
  const reservationId = z.uuid().parse(request.reservation_id);
  // An ACK can narrow discovery after the fresh request confirms the reservation identity.
  const sessionId = intent.request.session_id ?? acknowledgedSessionId(related, reservationId);
  const reservation = await approvedReservation(
    intent,
    request.person_id,
    reservationId,
    sessionId,
  ).catch((error: unknown) => ({ status: visibility(error) }));
  const rights = await readProfileRights(intent.scope, request.person_id)
    .then((items) => ({ status: "available" as const, items }))
    .catch((error: unknown) => ({ status: visibility(error) }));
  return { request, reservation, rights };
}
