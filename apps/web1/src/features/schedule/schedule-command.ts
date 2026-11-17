import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type { Operations } from "../../lib/api-contracts/operations";
import type {
  Interval,
  DutyInput,
  Preview,
  SessionPatch,
  SessionView,
  Mutation,
} from "../../lib/api-contracts/generated";
import type { ScheduleCreateDraft } from "./schedule-create-sheet";
import type { readScheduleSources } from "./schedule-read";
import { readScheduleSession, readScheduleReplacements } from "./schedule-read";
import { programOffsetChoices, scheduleInterval } from "./schedule-time";

type Sources = Awaited<ReturnType<typeof readScheduleSources>>;
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const integer = (value: string, positive = false) => {
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    (positive && Number(value) < 1)
  )
    throw new Error("SCHEDULE_INVALID");
  return Number(value);
};
export type ScheduleWriteOperation =
  | "session_create_v1"
  | "program_apply_v1"
  | "session_change_apply_v1"
  | "session_cancel_apply_v1"
  | "replacement_session_create_v1";
export type ScheduleIntent = {
  scope: ClientScope;
  expectedPrimaryId?: string;
  expectedSessions: {
    id: string;
    version?: number;
    interval?: Interval;
    assignments?: DutyInput[];
    state?: "planned" | "cancelled";
  }[];
} & {
  [K in ScheduleWriteOperation]: { operation: K; request: Operations[K]["request"] };
}[ScheduleWriteOperation];
export interface ScheduleReview {
  scope: ClientScope;
  operation: "program_apply_v1" | "session_change_apply_v1" | "session_cancel_apply_v1";
  preview: Preview;
  sessionId?: string;
  sourceVersion?: number;
}
function createValues(sources: Sources, draft: ScheduleCreateDraft) {
  const lesson = sources.resources.classes.find((item) => item.id === draft.classId && item.active);
  const room = sources.resources.rooms.find((item) => item.id === draft.roomId && item.active);
  const instructor = sources.instructors.find(
    (item) =>
      item.person.id === draft.instructorId && item.active && item.accountAccessGranted === true,
  );
  if (!lesson || !room || !instructor) throw new Error("SCHEDULE_INVALID");
  return {
    lesson,
    room,
    assignments: [{ person_id: instructor.person.id, duty: "instructor" as const }],
    capacity: { total: integer(draft.capacity) },
    duration: integer(draft.duration, true),
  };
}
export async function singleSessionIntent(
  sources: Sources,
  draft: ScheduleCreateDraft,
): Promise<ScheduleIntent> {
  const value = createValues(sources, draft);
  if (draft.format !== "group" && draft.format !== "private") throw new Error("SCHEDULE_INVALID");
  const interval = await scheduleInterval(
    sources.center.timezone,
    draft.date,
    draft.time,
    value.duration,
    draft.offset,
  );
  return {
    scope: { ...sources.scope },
    operation: "session_create_v1",
    expectedSessions: [],
    request: {
      ...common(sources.scope),
      operation_key: uuidv7(),
      class_id: value.lesson.id,
      discipline_id: value.lesson.disciplineId,
      format: draft.format,
      interval,
      resources: [{ kind: "room", id: value.room.id }],
      assignments: value.assignments,
      inherit_class_assignments: false,
      capacity: value.capacity,
    },
  };
}
export async function previewScheduleProgram(
  sources: Sources,
  draft: ScheduleCreateDraft,
): Promise<ScheduleReview> {
  const value = createValues(sources, draft),
    temporal = await getTemporal();
  const from = temporal.PlainDate.from(draft.date),
    until = from.add({ weeks: integer(draft.weeks, true) });
  const weekdays = [...new Set(draft.weekdays.map(Number))].sort((a, b) => a - b);
  if (!weekdays.length || weekdays.some((day) => !Number.isSafeInteger(day) || day < 1 || day > 7))
    throw new Error("SCHEDULE_INVALID");
  const offsets = await programOffsetChoices({
    timezone: sources.center.timezone,
    startsOn: from.toString(),
    endsOn: until.toString(),
    time: draft.time,
    weekdays,
    selected: draft.offsets ?? {},
  });
  const backend = await scopedBackend(sources.scope);
  const preview = await backend.call("program_preview_v1", {
    ...common(sources.scope),
    class_id: value.lesson.id,
    schedule: {
      weekdays: weekdays as [number, ...number[]],
      local_start: temporal.PlainTime.from(draft.time).toString({ smallestUnit: "second" }),
      starts_on: from.toString(),
      ends_on: until.toString(),
      duration_minutes: value.duration,
      room_id: value.room.id,
      assignments: value.assignments,
      inherit_class_assignments: false,
      capacity: value.capacity,
      ...(offsets.length ? { offset_choices: offsets } : {}),
    },
  });
  if (
    !preview.sessions?.length ||
    preview.sessions.some((item) => !item.session_id) ||
    new Set(preview.sessions.map((item) => item.session_id)).size !== preview.sessions.length
  )
    throw new Error("SCHEDULE_PREVIEW_UNAVAILABLE");
  return { scope: { ...sources.scope }, operation: "program_apply_v1", preview };
}
export async function previewScheduleChange(
  scope: ClientScope,
  session: SessionView,
  patch: SessionPatch,
  changeScope: "single" | "this_and_future",
  reason: string,
): Promise<ScheduleReview> {
  if (!reason.trim() || !Object.keys(patch).length) throw new Error("SCHEDULE_INVALID");
  const backend = await scopedBackend(scope);
  const preview = await backend.call("session_change_preview_v1", {
    ...common(scope),
    session_id: session.id,
    patch: structuredClone(patch),
    scope: changeScope,
    reason: reason.trim(),
  });
  if (!preview.sessions?.some((item) => item.session_id === session.id))
    throw new Error("SCHEDULE_PREVIEW_UNAVAILABLE");
  validateSessionDependency(preview, session);
  return {
    scope: { ...scope },
    operation: "session_change_apply_v1",
    preview,
    sessionId: session.id,
    sourceVersion: session.version,
  };
}
export async function previewScheduleCancel(
  scope: ClientScope,
  session: SessionView,
  reason: string,
): Promise<ScheduleReview> {
  if (!reason.trim()) throw new Error("SCHEDULE_INVALID");
  const backend = await scopedBackend(scope);
  const preview = await backend.call("session_cancel_preview_v1", {
    ...common(scope),
    session_id: session.id,
    reason: reason.trim(),
  });
  validateSessionDependency(preview, session);
  if (
    !preview.effects.some(
      (effect) =>
        effect.entity.type === "sessions" &&
        effect.entity.id === session.id &&
        effect.action === "cancel",
    )
  )
    throw new Error("SCHEDULE_PREVIEW_UNAVAILABLE");
  return {
    scope: { ...scope },
    operation: "session_cancel_apply_v1",
    preview,
    sessionId: session.id,
    sourceVersion: session.version,
  };
}
function validateSessionDependency(preview: Preview, session: SessionView) {
  const versions = preview.dependencies.versions.filter(
    (value) => value.entity.type === "sessions" && value.entity.id === session.id,
  );
  if (versions.length !== 1 || versions[0]?.version !== session.version)
    throw new Error("SCHEDULE_PREVIEW_STALE");
}
export function scheduleApplyIntent(review: ScheduleReview): ScheduleIntent {
  const preview = review.preview;
  if (
    !preview.id ||
    !preview.token ||
    preview.blockers.length ||
    !Number.isFinite(Date.parse(preview.expires_at)) ||
    Date.parse(preview.expires_at) <= Date.now()
  )
    throw new Error("SCHEDULE_PREVIEW_UNAVAILABLE");
  const expectedSessions =
    review.operation === "session_cancel_apply_v1"
      ? [{ id: review.sessionId!, version: review.sourceVersion, state: "cancelled" as const }]
      : preview.sessions!.map((item) => ({
          id: item.session_id,
          version:
            review.operation === "program_apply_v1"
              ? undefined
              : (item.expected_version ??
                preview.dependencies.versions.find(
                  (entry) =>
                    entry.entity.type === "sessions" && entry.entity.id === item.session_id,
                )?.version),
          interval: structuredClone(item.interval),
          ...(review.operation === "session_change_apply_v1"
            ? { assignments: structuredClone(item.assignments) }
            : {}),
          state: "planned" as const,
        }));
  if (
    !expectedSessions.length ||
    new Set(expectedSessions.map((item) => item.id)).size !== expectedSessions.length ||
    (review.operation !== "program_apply_v1" &&
      expectedSessions.some(
        (item) => !item.id || !Number.isSafeInteger(item.version) || (item.version ?? 0) < 1,
      ))
  )
    throw new Error("SCHEDULE_PREVIEW_UNAVAILABLE");
  return {
    scope: { ...review.scope },
    operation: review.operation,
    expectedPrimaryId: review.sessionId,
    request: {
      ...common(review.scope),
      operation_key: uuidv7(),
      preview: { id: preview.id, token: preview.token },
    },
    expectedSessions,
  };
}
export async function replacementSessionIntent(
  scope: ClientScope,
  source: SessionView,
  interval: Interval,
  roomId: string,
): Promise<ScheduleIntent> {
  if (source.state !== "cancelled" || !roomId) throw new Error("SCHEDULE_INVALID");
  const backend = await scopedBackend(scope),
    latest = await backend.call("session_get_v1", { ...common(scope), session_id: source.id });
  if (latest.id !== source.id || latest.state !== "cancelled" || latest.version !== source.version)
    throw new Error("SCHEDULE_PREVIEW_STALE");
  return {
    scope: { ...scope },
    operation: "replacement_session_create_v1",
    expectedSessions: [],
    request: {
      ...common(scope),
      operation_key: uuidv7(),
      replaces_id: source.id,
      interval: { ...interval },
      resources: [{ kind: "room", id: roomId }],
      capacity: { total: source.capacity.total, categories: source.capacity.categories ?? null },
    },
  };
}
export async function writeSchedule(intent: ScheduleIntent): Promise<Mutation> {
  const backend = await scopedBackend(intent.scope);
  const requestId = uuidv7();
  const result = await (async () => {
    switch (intent.operation) {
      case "session_create_v1":
        return backend.call(intent.operation, { ...intent.request, request_id: requestId });
      case "program_apply_v1":
        return backend.call(intent.operation, { ...intent.request, request_id: requestId });
      case "session_change_apply_v1":
        return backend.call(intent.operation, { ...intent.request, request_id: requestId });
      case "session_cancel_apply_v1":
        return backend.call(intent.operation, { ...intent.request, request_id: requestId });
      case "replacement_session_create_v1":
        return backend.call(intent.operation, { ...intent.request, request_id: requestId });
    }
  })();
  if (
    !result.primary_id ||
    (intent.expectedPrimaryId && result.primary_id !== intent.expectedPrimaryId)
  )
    throw new Error("SCHEDULE_ACK_UNAVAILABLE");
  return result;
}
export async function readScheduleReceipt(intent: ScheduleIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  const type = intent.operation === "program_apply_v1" ? "program_versions" : "sessions";
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference &&
      (result.result_reference.type !== type ||
        (intent.expectedPrimaryId && result.result_reference.id !== intent.expectedPrimaryId)))
  )
    throw new Error("SCHEDULE_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readScheduleResult(intent: ScheduleIntent, primaryId?: string) {
  const duties = (values: DutyInput[]) =>
    values.map((row) => `${row.person_id}:${row.duty}`).sort();
  const temporal = await getTemporal();
  const expected = [...intent.expectedSessions];
  if (
    intent.operation === "session_create_v1" ||
    intent.operation === "replacement_session_create_v1"
  ) {
    if (!primaryId) throw new Error("SCHEDULE_REREAD_UNAVAILABLE");
    expected.push({ id: primaryId, interval: intent.request.interval, state: "planned" });
  }
  if (intent.operation === "replacement_session_create_v1") {
    const replacements = await readScheduleReplacements(intent.scope, intent.request.replaces_id);
    if (!replacements.some((row) => row.id === primaryId))
      throw new Error("SCHEDULE_REREAD_UNAVAILABLE");
  }
  for (let index = 0; index < expected.length; index += 4)
    await Promise.all(
      expected.slice(index, index + 4).map(async (item) => {
        const session = await readScheduleSession(intent.scope, item.id);
        if (
          session.state !== item.state ||
          (item.version !== undefined && session.version <= item.version) ||
          (item.assignments !== undefined &&
            JSON.stringify(duties(session.assignments)) !==
              JSON.stringify(duties(item.assignments))) ||
          (item.interval &&
            (!temporal.Instant.from(session.starts_at).equals(
              temporal.Instant.from(item.interval.starts_at),
            ) ||
              !temporal.Instant.from(session.ends_at).equals(
                temporal.Instant.from(item.interval.ends_at),
              )))
        )
          throw new Error("SCHEDULE_REREAD_UNAVAILABLE");
      }),
    );
}
