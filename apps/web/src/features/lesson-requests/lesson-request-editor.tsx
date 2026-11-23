import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { ClientScope } from "../../lib/scoped-backend";
import type { LessonRequestView } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { getTemporal } from "../../lib/temporal";
import { LessonRequestSheet, type RequestDraft, type RequestStage } from "./lesson-requests-view";
import {
  readLessonRequest,
  readRequestInstructors,
  readRequestSessions,
  requestInterval,
} from "./lesson-requests-read";
import {
  requestIntent,
  writeRequest,
  readRequestReceipt,
  readRequestResult,
} from "./lesson-request-command";
import { readStudioRooms } from "../studio/studio";
import { useMemberCommand } from "../member-profile/use-member-command";
import { ScheduleTimeError } from "../schedule/schedule-time";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
const initialDraft = (): RequestDraft => ({
  reason: "",
  day: "",
  time: "",
  instructorId: "",
  roomId: "",
  sessionId: "",
  mode: "existing",
  capacity: "",
  accepted: false,
  windowException: false,
  offset: "",
});
export function LessonRequestEditor({
  scope,
  initial,
  name,
  timezone,
  onClose,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  initial: LessonRequestView;
  name: string;
  timezone: string;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (failure: unknown) => boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [draft, setDraft] = useState(initialDraft),
    [stage, setStage] = useState<RequestStage>("view"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof RequestDraft, string>>>({}),
    [offsets, setOffsets] = useState<{ id: string; label: string }[]>([]),
    [saved, setSaved] = useState<Awaited<ReturnType<typeof readRequestResult>>>();
  const prefix = [
    "lesson-request-editor",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    initial.id,
  ];
  const source = useQuery({
    queryKey: [...prefix, "source"],
    queryFn: (readContext) => readLessonRequest(scope, initial.id, readContext),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const current = source.isError ? undefined : (saved?.request ?? source.data);
  const instructors = useQuery({
    queryKey: [...prefix, "instructors", current?.person_id],
    queryFn: (readContext) => readRequestInstructors(scope, current!.person_id, readContext),
    enabled: Boolean(
      current && (stage === "alternative" || (stage === "approve" && draft.mode === "create")),
    ),
    retry: false,
  });
  const rooms = useQuery({
    queryKey: [...prefix, "rooms"],
    queryFn: (readContext) => readStudioRooms(scope, readContext),
    enabled: Boolean(current && stage === "approve" && draft.mode === "create"),
    retry: false,
  });
  const sessions = useQuery({
    queryKey: [...prefix, "sessions", current?.version],
    queryFn: (readContext) => readRequestSessions(scope, current!, readContext),
    enabled: Boolean(current && stage === "approve" && draft.mode === "existing"),
    retry: false,
  });
  const command = useMemberCommand({
    write: writeRequest,
    readReceipt: readRequestReceipt,
    readResult: readRequestResult,
    onAccessLost,
    onRefresh: async (result) => {
      queries.setQueryData([...prefix, "source"], result.request);
      setSaved(result);
      await onRefresh();
    },
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const failure of [source.error, instructors.error, rooms.error, sessions.error])
      if (failure) onAccessLost(failure);
  }, [source.error, instructors.error, rooms.error, sessions.error, onAccessLost]);
  async function changeStage(next: RequestStage) {
    if (locked) return;
    command.reset();
    setError(undefined);
    setErrors({});
    setOffsets([]);
    const fresh = initialDraft();
    if (current) {
      const temporal = await getTemporal(),
        local = temporal.Instant.from(current.requested_start).toZonedDateTimeISO(timezone);
      fresh.day = local.toPlainDate().toString();
      fresh.time = local.toPlainTime().toString({ smallestUnit: "minute" });
      fresh.instructorId = current.preferred_instructor_id ?? "";
      if (next === "approve")
        try {
          fresh.instructorId = (await requestInterval(current)).instructorId ?? "";
        } catch {
          setError(t(($) => $.lessonRequests.alternativeNotAccepted));
          return;
        }
    }
    setDraft(fresh);
    setStage(next);
  }
  async function submit() {
    if (
      locked ||
      !current ||
      stage === "view" ||
      !["ready", "stale", "rejected"].includes(command.state)
    )
      return;
    setErrors({});
    setError(undefined);
    const shape =
      stage === "reject"
        ? z.object({ reason: z.string().trim().min(1) })
        : stage === "alternative"
          ? z.object({
              day: z.iso.date(),
              time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
              instructorId: z.union([z.literal(""), z.uuid()]),
              ...(draft.windowException ? { reason: z.string().trim().min(1) } : {}),
            })
          : draft.mode === "existing"
            ? z.object({ sessionId: z.uuid(), accepted: z.literal(true) })
            : z.object({
                roomId: z.uuid(),
                instructorId: z.uuid(),
                capacity: z.string().regex(/^[1-9]\d*$/),
                accepted: z.literal(true),
              });
    const checked = shape.safeParse(draft);
    if (!checked.success) {
      const next: Partial<Record<keyof RequestDraft, string>> = {};
      for (const issue of checked.error.issues)
        next[issue.path[0] as keyof RequestDraft] = t(($) => $.lessonRequests.invalid);
      setErrors(next);
      return;
    }
    if (
      stage === "alternative" &&
      draft.instructorId &&
      (instructors.isError || !instructors.data?.some((row) => row.id === draft.instructorId))
    ) {
      setError(t(($) => $.lessonRequests.sourceError));
      return;
    }
    if (
      stage === "approve" &&
      (draft.mode === "existing"
        ? sessions.isError || !sessions.data?.some((row) => row.id === draft.sessionId)
        : rooms.isError ||
          instructors.isError ||
          !rooms.data?.some((row) => row.id === draft.roomId && row.active) ||
          !instructors.data?.some((row) => row.id === draft.instructorId))
    ) {
      setError(t(($) => $.lessonRequests.sourceError));
      return;
    }
    setBusy(true);
    try {
      const fresh = (await source.refetch({ throwOnError: true })).data;
      if (!fresh || fresh.version !== current.version) {
        setSaved(undefined);
        setDraft((value) => ({ ...value, accepted: false }));
        setStage("view");
        setError(t(($) => $.lessonRequests.sourceChanged));
        return;
      }
      const intent = await requestIntent(scope, fresh, stage, draft, timezone);
      command.reset();
      await command.start(intent);
    } catch (failure) {
      if (failure instanceof ScheduleTimeError && failure.message === "SCHEDULE_TIME_AMBIGUOUS") {
        setOffsets(failure.requests[0]?.choices ?? []);
        setError(t(($) => $.lessonRequests.offsetRequired));
      } else if (!onAccessLost(failure))
        setError(
          scheduleBackendError(
            failure instanceof BackendError ? failure.code : "SOURCE_UNAVAILABLE",
            t,
          ),
        );
    } finally {
      setBusy(false);
    }
  }
  const unknown = t(($) => $.lessonRequests.unknown),
    format = new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    });
  const available =
    current &&
    ["pending", "alternative_offered"].includes(current.state) &&
    command.state !== "saved" &&
    !command.unavailable;
  const eligible: { id: string; label: string; value: string }[] = [
    {
      id: "native",
      label: t(($) => $.lessonRequests.eligibility),
      value: t(($) => $.lessonRequests.approveNote),
    },
  ];
  if (saved && "reservation" in saved && saved.reservation)
    eligible.push({
      id: "reservation",
      label: t(($) => $.lessonRequests.reservation),
      value:
        saved.reservation.status === "available"
          ? t(($) => $.lessonRequests.reservationConfirmed)
          : t(
              ($) =>
                $.lessonRequests.visibility[
                  saved.reservation.status === "restricted" ? "restricted" : "not_enabled"
                ],
            ),
    });
  if (saved && "rights" in saved && saved.rights)
    eligible.push({
      id: "rights",
      label: t(($) => $.lessonRequests.rights),
      value:
        saved.rights.status === "available"
          ? t(($) => $.lessonRequests.rightsRead)
          : t(
              ($) =>
                $.lessonRequests.visibility[
                  saved.rights.status === "restricted" ? "restricted" : "not_enabled"
                ],
            ),
    });
  return (
    <LessonRequestSheet
      name={current ? name : unknown}
      subtitle={
        current
          ? `${format.format(new Date(current.requested_start))} · ${current.duration_minutes} ${t(($) => $.lessonRequests.minutes)} · ${timezone}`
          : unknown
      }
      state={current?.state}
      note={current?.student_note}
      stage={stage}
      onStage={(next) => {
        void changeStage(next);
      }}
      draft={draft}
      onDraft={(value) => {
        if (!locked) {
          setDraft(value);
          setErrors({});
          setError(undefined);
          command.reset();
        }
      }}
      eligibility={current ? eligible : null}
      rooms={
        rooms.isError
          ? []
          : (rooms.data
              ?.filter((row) => row.active)
              .map((row) => ({ id: row.id, name: row.name })) ?? [])
      }
      instructors={instructors.isError ? [] : (instructors.data ?? [])}
      sessions={
        sessions.isError
          ? []
          : (sessions.data?.map((row) => ({
              id: row.id,
              name: `${format.format(new Date(row.starts_at))} · ${row.id.slice(-8)}`,
            })) ?? [])
      }
      offsets={offsets}
      instructorFixed={
        stage === "approve" &&
        Boolean(
          current &&
          (current.state === "alternative_offered"
            ? current.alternatives.find((row) => row.state === "accepted")?.instructor_id
            : current.preferred_instructor_id),
        )
      }
      locked={locked}
      canResolve={Boolean(available)}
      canApprove={Boolean(
        available &&
        (current?.state !== "alternative_offered" ||
          current.alternatives.some((row) => row.state === "accepted")),
      )}
      errors={errors}
      onClose={() => {
        if (!locked) onClose();
      }}
      onSubmit={
        available
          ? () => {
              void submit();
            }
          : undefined
      }
      notice={
        <>
          {(error ||
            source.isError ||
            instructors.isError ||
            rooms.isError ||
            sessions.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? t(($) => $.lessonRequests.sourceError)}</AlertDescription>
            </Alert>
          )}
          {command.state !== "ready" && (
            <p role="status">{t(($) => $.lessonRequests.commandStates[command.state])}</p>
          )}
        </>
      }
      recovery={
        <div className="flex flex-wrap gap-2">
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.readReceipt();
              }}
            >
              {t(($) => $.finance.readResult)}
            </Button>
          )}
          {command.state === "unknown" && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.retry();
              }}
            >
              {t(($) => $.finance.retrySame)}
            </Button>
          )}
          <Button
            variant="outline"
            isDisabled={locked}
            onPress={() => {
              setDraft((value) => ({ ...value, accepted: false }));
              setStage("view");
              command.reset();
              void source.refetch().then((result) => {
                if (!result.error) setSaved(undefined);
              });
            }}
          >
            {t(($) => $.lessonRequests.readSource)}
          </Button>
        </div>
      }
    />
  );
}
