import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { ClientScope } from "../../lib/scoped-backend";
import type { LessonRequestView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { ScheduleTimeError } from "../schedule/schedule-time";
import { useMemberCommand } from "../member-profile/use-member-command";
import {
  readOwnRequests,
  readOwnRequest,
  readOwnRequestChoices,
} from "./member-private-lessons-read";
import {
  createOwnRequestIntent,
  existingOwnRequestIntent,
  writeOwnRequest,
  readOwnRequestReceipt,
  readOwnRequestResult,
} from "./member-private-lessons-command";
import {
  MemberPrivateLessonsView,
  OwnRequestSheet,
  type OwnRequestDraft,
} from "./member-private-lessons-view";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
const blank = (): OwnRequestDraft => ({
  disciplineId: "",
  instructorId: "",
  day: "",
  time: "",
  duration: "45",
  offset: "",
  studentNote: "",
  alternativeId: "",
  reviewed: false,
});
export function MemberPrivateLessonsContent({
  scope,
  personId,
  timezone,
  onLockChange,
  requestId,
}: {
  scope: ClientScope;
  personId: string;
  timezone: string;
  onLockChange: (locked: boolean) => void;
  requestId?: string;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [draft, setDraft] = useState(blank),
    [target, setTarget] = useState<{
      mode: "create" | "withdraw" | "accept";
      request?: LessonRequestView;
    }>();
  const [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof OwnRequestDraft, string>>>({}),
    [offsets, setOffsets] = useState<{ id: string; label: string }[]>([]),
    [saved, setSaved] = useState<LessonRequestView>();
  const retryButton = useRef<HTMLButtonElement>(null);
  const prefix = ["member-private-lessons", scope.accountId, scope.orgId, scope.centerId, personId];
  const list = useQuery({
    queryKey: [...prefix, "list", cursors.at(-1), requestId],
    queryFn: () => readOwnRequests(scope, personId, cursors.at(-1), requestId),
    ...(requestId ? { staleTime: 0 } : {}),
    retry: false,
  });
  const disciplines = useQuery({
    queryKey: [...prefix, "disciplines"],
    queryFn: () => readOwnRequestChoices(scope, personId, "disciplines"),
    retry: false,
  });
  const instructors = useQuery({
    queryKey: [...prefix, "instructors"],
    queryFn: () => readOwnRequestChoices(scope, personId, "instructors"),
    retry: false,
  });
  const accessLost = useCallback(
    (failure: unknown) => {
      const lost =
        (failure instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(failure.code)) ||
        (failure instanceof Error &&
          ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(failure.message));
      if (lost) void router.invalidate();
      return lost;
    },
    [router],
  );
  const command = useMemberCommand({
    write: writeOwnRequest,
    readReceipt: readOwnRequestReceipt,
    readResult: readOwnRequestResult,
    onAccessLost: accessLost,
    onRefresh: async (result) => {
      setSaved(result);
      await list.refetch({ throwOnError: true });
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const failure of [list.error, disciplines.error, instructors.error])
      if (failure) accessLost(failure);
  }, [list.error, disciplines.error, instructors.error, accessLost]);
  const date = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
    timeZoneName: undefined,
  });
  const exactTime = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const time = new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: timezone });
  const loading = list.isPending || Boolean(requestId && list.isFetching);
  const entries = !list.isError && !loading ? list.data?.items : undefined;
  const asOf = list.data?.asOf;
  const isOffered = (row: LessonRequestView["alternatives"][number]) =>
    row.state === "offered" && asOf !== undefined && Date.parse(row.starts_at) > Date.parse(asOf);
  const choicesReady =
    !disciplines.isError &&
    !instructors.isError &&
    Boolean(disciplines.data?.length) &&
    Boolean(instructors.data);
  function open(mode: "create" | "withdraw" | "accept", request?: LessonRequestView) {
    if (locked) return;
    command.reset();
    setError(undefined);
    setErrors({});
    setOffsets([]);
    const next = blank();
    if (request) {
      const offered = request.alternatives.filter(isOffered);
      if (offered.length === 1) next.alternativeId = offered[0]!.id;
    }
    setDraft(next);
    setTarget({ mode, request });
  }
  async function submit() {
    if (!target || locked || command.state !== "ready") return;
    setPreparing(true);
    setError(undefined);
    setErrors({});
    try {
      if (target.mode === "create") {
        if (!choicesReady || list.isError) throw new Error("OWN_REQUEST_CHOICES_UNAVAILABLE");
        const { data } = await list.refetch({ throwOnError: true });
        if (!data) throw new Error("OWN_REQUEST_SOURCE_UNAVAILABLE");
        await command.start(
          await createOwnRequestIntent(
            scope,
            personId,
            draft,
            timezone,
            disciplines.data!,
            instructors.data!,
            data.asOf,
          ),
        );
      } else {
        const { request: fresh, asOf: freshAsOf } = await readOwnRequest(
          scope,
          personId,
          target.request!.id,
        );
        if (fresh.version !== target.request!.version) {
          setTarget({ ...target, request: fresh });
          setDraft((value) => ({ ...value, reviewed: false }));
          await list.refetch();
          throw new Error("OWN_REQUEST_SOURCE_CHANGED");
        }
        await command.start(
          existingOwnRequestIntent(scope, personId, fresh, target.mode, draft, freshAsOf),
        );
      }
    } catch (failure) {
      if (failure instanceof z.ZodError) {
        const invalid: Partial<Record<keyof OwnRequestDraft, string>> = {};
        for (const issue of failure.issues) {
          const field = issue.path[0];
          if (typeof field === "string" && field in draft)
            invalid[field as keyof OwnRequestDraft] = t(($) =>
              field === "studentNote"
                ? $.memberPrivateLessons.noteInvalid
                : $.memberPrivateLessons.invalid,
            );
        }
        setErrors(invalid);
        setError(t(($) => $.memberPrivateLessons.invalid));
      } else if (failure instanceof ScheduleTimeError) {
        setOffsets(failure.requests[0]?.choices ?? []);
        setErrors({ time: t(($) => $.memberPrivateLessons.invalid) });
        setError(
          t(($) =>
            failure.message === "SCHEDULE_TIME_AMBIGUOUS"
              ? $.lessonRequests.offsetRequired
              : $.lessonRequests.invalid,
          ),
        );
      } else if (failure instanceof Error && failure.message === "OWN_REQUEST_PAST") {
        setErrors({ time: t(($) => $.memberPrivateLessons.pastTime) });
        setError(t(($) => $.memberPrivateLessons.pastTime));
      } else if (!accessLost(failure)) setError(t(($) => $.memberPrivateLessons.sourceChanged));
    } finally {
      setPreparing(false);
    }
  }
  const alternativeName = (row: LessonRequestView["alternatives"][number]) =>
    `${date.format(new Date(row.starts_at))} – ${exactTime.format(new Date(row.ends_at))}`;
  const nativeState = (request: LessonRequestView) =>
    request.state === "alternative_offered" &&
    request.alternatives.some((row) => row.state === "accepted")
      ? t(($) => $.memberPrivateLessons.awaitingApproval)
      : t(($) => $.memberPrivateLessons.states[request.state]);
  const next = list.data?.nextCursor;
  return (
    <>
      <MemberPrivateLessonsView
        pending={loading}
        rows={
          entries?.map((row) => ({
            id: row.id,
            time: time.format(new Date(row.requested_start)),
            duration: t(($) => $.memberReservations.duration, { minutes: row.duration_minutes }),
            title: [
              t(($) => $.memberPrivateLessons.title),
              row.preferred_instructor_id
                ? (instructors.data?.find((person) => person.id === row.preferred_instructor_id)
                    ?.name ?? t(($) => $.memberPrivateLessons.unknownInstructor))
                : t(($) => $.memberPrivateLessons.noInstructor),
            ].join(" · "),
            metadata: date.format(new Date(row.requested_start)),
            studentNote: row.student_note,
            hint: [
              t(($) => $.memberPrivateLessons.sent, {
                date: date.format(new Date(row.created_at)),
              }),
              ...row.alternatives
                .filter((item) => ["offered", "accepted"].includes(item.state))
                .map(alternativeName),
              row.expires_at
                ? t(($) => $.memberPrivateLessons.validUntil, {
                    date: date.format(new Date(row.expires_at)),
                  })
                : undefined,
            ]
              .filter(Boolean)
              .join(" · "),
            state: nativeState(row),
            actions:
              asOf &&
              ["pending", "alternative_offered"].includes(row.state) &&
              (!row.expires_at || Date.parse(row.expires_at) > Date.parse(asOf)) ? (
                <div className="flex flex-wrap gap-2">
                  {row.alternatives.some(isOffered) && (
                    <Button
                      size="sm"
                      isDisabled={locked || Boolean(target)}
                      onPress={() => open("accept", row)}
                    >
                      {t(($) => $.memberPrivateLessons.actions.accept)}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={locked || Boolean(target)}
                    onPress={() => open("withdraw", row)}
                  >
                    {t(($) => $.memberPrivateLessons.actions.withdraw)}
                  </Button>
                </div>
              ) : undefined,
          })) ?? null
        }
        onCreate={() => open("create")}
        disabled={locked || Boolean(target) || !choicesReady || list.isPending || list.isError}
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              isDisabled={locked || list.isFetching || cursors.length === 1}
              onPress={() => setCursors((old) => old.slice(0, -1))}
            >
              {t(($) => $.memberPrivateLessons.previous)}
            </Button>
            <Button
              variant="outline"
              isDisabled={
                locked || list.isFetching || list.isError || !next || cursors.includes(next)
              }
              onPress={() => {
                if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
              }}
            >
              {t(($) => $.memberPrivateLessons.next)}
            </Button>
          </div>
        }
        notice={
          <div className="space-y-3">
            {(disciplines.isError || instructors.isError) && (
              <Alert>
                <AlertDescription>
                  {t(($) => $.memberPrivateLessons.catalogUnread)}
                </AlertDescription>
              </Alert>
            )}
            {saved && !target && (
              <Alert>
                <AlertDescription>
                  {t(($) => $.memberPrivateLessons.saved)} ·{" "}
                  {date.format(new Date(saved.requested_start))} · {nativeState(saved)}
                </AlertDescription>
              </Alert>
            )}
            <Button
              ref={retryButton}
              variant="outline"
              isDisabled={
                locked || list.isFetching || disciplines.isFetching || instructors.isFetching
              }
              onPress={() => {
                void list.refetch();
                void disciplines.refetch();
                void instructors.refetch();
              }}
            >
              {t(($) => $.memberPrivateLessons.retry)}
            </Button>
          </div>
        }
      />
      {target && (
        <OwnRequestSheet
          mode={target.mode}
          draft={draft}
          onDraft={(value) => {
            if (!locked) {
              command.reset();
              setError(undefined);
              setErrors({});
              if (value.day !== draft.day || value.time !== draft.time) {
                setOffsets([]);
                value = { ...value, offset: "" };
              }
              setDraft(value);
            }
          }}
          disciplines={disciplines.isError ? [] : (disciplines.data ?? [])}
          instructors={instructors.isError ? [] : (instructors.data ?? [])}
          alternatives={
            target.request?.alternatives
              .filter(isOffered)
              .map((row) => ({ id: row.id, name: alternativeName(row) })) ?? []
          }
          offsets={offsets}
          errors={errors}
          locked={locked}
          readOnly={command.state === "saved"}
          timezone={timezone}
          onClose={() => {
            if (!locked) {
              setTarget(undefined);
              requestAnimationFrame(() => retryButton.current?.focus());
            }
          }}
          onSubmit={
            command.state === "ready" &&
            !command.unavailable &&
            (target.mode !== "create" || choicesReady)
              ? () => {
                  void submit();
                }
              : undefined
          }
          notice={
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {command.state !== "ready" && (
                <p role="status">
                  {command.state === "saved"
                    ? t(($) => $.memberPrivateLessons.saved)
                    : t(($) => $.lessonRequests.commandStates[command.state])}
                </p>
              )}
              {command.state === "saved" && saved && <p>{nativeState(saved)}</p>}
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
              {["stale", "rejected"].includes(command.state) && (
                <Button
                  variant="outline"
                  isDisabled={locked}
                  onPress={() => {
                    command.reset();
                    setTarget(undefined);
                    void list.refetch();
                    void disciplines.refetch();
                    void instructors.refetch();
                  }}
                >
                  {t(($) => $.memberPrivateLessons.retry)}
                </Button>
              )}
            </div>
          }
        />
      )}
    </>
  );
}
