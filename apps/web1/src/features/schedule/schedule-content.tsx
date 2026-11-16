import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useRouter, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Card, CardContent } from "../../components/ui/card";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type { Interval, SessionPatch } from "../../lib/api-contracts/generated";
import { ScheduleView, type ScheduleDraftChange } from "./schedule-view";
import { ScheduleCreateSheet, type ScheduleCreateDraft } from "./schedule-create-sheet";
import {
  ScheduleSessionSheet,
  type SchedulePanelMode,
  type ScheduleSessionDraft,
} from "./schedule-session-sheet";
import { ScheduleChangeDialog } from "./schedule-change-dialog";
import { ScheduleDiscardDialog } from "./schedule-discard-dialog";
import {
  readScheduleSources,
  readScheduleRange,
  readScheduleEditor,
  readScheduleSession,
  scheduleLocalDate,
} from "./schedule-read";
import {
  scheduleEvents,
  scheduleBackendError,
  scheduleSessionDraft,
  scheduleSessionPanel,
} from "./schedule-presentation";
import {
  singleSessionIntent,
  previewScheduleProgram,
  previewScheduleChange,
  previewScheduleCancel,
  replacementSessionIntent,
  scheduleApplyIntent,
  type ScheduleReview,
} from "./schedule-command";
import { scheduleInterval, ScheduleTimeError, type ScheduleOffsetRequest } from "./schedule-time";
import { useScheduleCommand } from "./use-schedule-command";
import { ScheduleRoster } from "./schedule-roster";
import { ScheduleReplacements } from "./schedule-replacements";

type Sources = Awaited<ReturnType<typeof readScheduleSources>>;
type Editor = Awaited<ReturnType<typeof readScheduleEditor>>;
const emptyCreate = (date: string): ScheduleCreateDraft => ({
  mode: "single",
  classId: "",
  instructorId: "",
  roomId: "",
  capacity: "",
  date,
  time: "",
  duration: "",
  weeks: "",
  weekdays: [],
  offset: "",
  offsets: {},
});
export function ScheduleContent({
  scope,
  onLockChange,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    navigate = useNavigate(),
    queries = useQueryClient();
  const [now] = useState(() => new Date().toISOString());
  const [range, setRange] = useState<Interval>(),
    [room, setRoom] = useState(""),
    [instructor, setInstructor] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string>(),
    [error, setError] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false),
    [createSource, setCreateSource] = useState<Sources>(),
    [createDraft, setCreateDraft] = useState(() => emptyCreate(""));
  const [selected, setSelected] = useState<Editor>(),
    [sessionDraft, setSessionDraft] = useState<ScheduleSessionDraft>(),
    [initialDraft, setInitialDraft] = useState<ScheduleSessionDraft>(),
    [sessionTitle, setSessionTitle] = useState("");
  const [mode, setMode] = useState<SchedulePanelMode>("view"),
    [review, setReview] = useState<ScheduleReview>();
  const [offsetRequests, setOffsetRequests] = useState<ScheduleOffsetRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraftChange>>({}),
    [changesOpen, setChangesOpen] = useState(false),
    [changeScope, setChangeScope] = useState<"single" | "this_and_future">("single"),
    [reason, setReason] = useState("");
  const [discard, setDiscard] = useState(false);
  const [rosterLocked, setRosterLocked] = useState(false);
  const afterDiscard = useRef<(() => void) | undefined>(undefined);
  const reading = useRef(false),
    mounted = useRef(true),
    lost = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const accessLost = useCallback(
    (failure: unknown, preserveQuery?: readonly unknown[]) => {
      const code =
        failure instanceof BackendError
          ? failure.code
          : failure instanceof Error
            ? failure.message
            : undefined;
      if (
        !code ||
        !["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED", "FORBIDDEN"].includes(code)
      )
        return false;
      lost.current = true;
      setSelected(undefined);
      setSessionDraft(undefined);
      setInitialDraft(undefined);
      setCreateSource(undefined);
      setCreateOpen(false);
      setReview(undefined);
      setDrafts({});
      setNotice(undefined);
      setError(undefined);
      for (const key of [
        "schedule-sources",
        "schedule-range",
        "schedule-group",
        "schedule-group-people",
        "schedule-group-rights",
        "schedule-group-sessions",
        "schedule-replacements",
      ])
        queries.removeQueries({
          queryKey: [key, scope.accountId, scope.orgId, scope.centerId],
          predicate: (q) =>
            !preserveQuery || JSON.stringify(q.queryKey) !== JSON.stringify(preserveQuery),
        });
      void router.invalidate();
      return true;
    },
    [queries, router, scope.accountId, scope.orgId, scope.centerId],
  );
  const sources = useQuery({
    queryKey: ["schedule-sources", scope.accountId, scope.orgId, scope.centerId],
    queryFn: async ({ queryKey }) => {
      try {
        const source = await readScheduleSources(scope);
        return { ...source, initialDate: await scheduleLocalDate(now, source.center.timezone) };
      } catch (failure) {
        if (accessLost(failure, queryKey)) command.abandon();
        throw failure;
      }
    },
    retry: false,
  });
  const calendar = useQuery({
    queryKey: [
      "schedule-range",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      range?.starts_at,
      range?.ends_at,
      room,
      instructor,
    ],
    enabled: Boolean(sources.data && range),
    queryFn: async ({ queryKey }) => {
      try {
        return await readScheduleRange(scope, range!, {
          ...(room ? { roomId: room } : {}),
          ...(instructor ? { instructorId: instructor } : {}),
        });
      } catch (failure) {
        if (accessLost(failure, queryKey)) command.abandon();
        throw failure;
      }
    },
    retry: false,
  });
  const command = useScheduleCommand({
    onAccessLost: accessLost,
    onRefresh: async (intent) => {
      if (intent.operation === "replacement_session_create_v1")
        await queries.invalidateQueries({
          queryKey: [
            "schedule-replacements",
            scope.accountId,
            scope.orgId,
            scope.centerId,
            intent.request.replaces_id,
          ],
        });
      const result = await calendar.refetch();
      if (result.error) throw result.error;
      if (intent.operation === "session_create_v1" || intent.operation === "program_apply_v1")
        setCreateOpen(false);
      const temporal = await getTemporal();
      const completed = new Set(intent.expectedSessions.map((x) => x.id));
      const remaining = Object.fromEntries(
        Object.entries(drafts).filter(([id, draft]) => {
          const expected = intent.expectedSessions.find((item) => item.id === id);
          if (!expected) return true;
          if (expected.state === "cancelled") return false;
          return (
            !expected.interval ||
            !temporal.Instant.from(expected.interval.starts_at).equals(
              temporal.Instant.from(draft.start),
            ) ||
            !temporal.Instant.from(expected.interval.ends_at).equals(
              temporal.Instant.from(draft.end),
            )
          );
        }),
      );
      setDrafts(remaining);
      if (!Object.keys(remaining).length) setChangesOpen(false);
      const sourceTimezone = sources.data!.center.timezone;
      if (selected && completed.has(selected.session.id)) {
        const next =
          intent.operation === "session_cancel_apply_v1"
            ? { ...selected, session: await readScheduleSession(scope, selected.session.id) }
            : await readScheduleEditor(scope, selected.session.id);
        if (mounted.current) {
          setSelected(next);
          if (intent.operation !== "session_cancel_apply_v1") {
            const baseline = await scheduleSessionDraft(
              next.session,
              next.resources,
              sourceTimezone,
            );
            if (!mounted.current) return;
            setSessionDraft(baseline);
            setInitialDraft(baseline);
            setMode("view");
          }
        }
      }
      if (intent.operation === "replacement_session_create_v1") setSelected(undefined);
      setReview(undefined);
      setError(undefined);
    },
  });
  const locked = busy || command.locked || rosterLocked;
  const dirty = Object.keys(drafts).length > 0;
  const blocker = useBlocker({
    shouldBlockFn: () => !lost.current && dirty && !command.locked,
    enableBeforeUnload: dirty && !command.locked,
    disabled: !dirty || command.locked,
    withResolver: true,
  });
  useEffect(() => {
    onLockChange(locked || dirty);
    return () => onLockChange(false);
  }, [locked, dirty, onLockChange]);
  const onRange = useCallback(
    (next: { start: string; end: string; timezone: string }) =>
      setRange((old) =>
        old?.starts_at === next.start && old.ends_at === next.end
          ? old
          : { starts_at: next.start, ends_at: next.end },
      ),
    [],
  );
  function handle(failure: unknown) {
    if (accessLost(failure)) {
      command.abandon();
      return;
    }
    if (failure instanceof ScheduleTimeError) {
      setOffsetRequests(failure.requests);
      setError(
        failure.message === "SCHEDULE_TIME_GAP"
          ? t(($) => $.schedule.timeGap)
          : t(($) => $.schedule.timeAmbiguous),
      );
    } else if (failure instanceof BackendError) {
      setError(scheduleBackendError(failure.code, t));
    } else
      setError(
        failure instanceof Error && failure.message === "SCHEDULE_PREVIEW_STALE"
          ? t(($) => $.schedule.stale)
          : t(($) => $.schedule.invalid),
      );
  }
  async function perform(action: () => Promise<void>) {
    if (reading.current || locked || lost.current) return;
    reading.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      if (mounted.current) handle(failure);
    } finally {
      reading.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function resetReview(clearOffsets = true) {
    setReview(undefined);
    setError(undefined);
    setNotice(undefined);
    if (clearOffsets) setOffsetRequests([]);
    command.reset();
  }
  function guarded(action: () => void) {
    if (locked) return;
    if (dirty) {
      afterDiscard.current = action;
      setDiscard(true);
    } else action();
  }
  async function openSession(id: string) {
    const entry = calendar.data?.entries.find((x) => `${x.type}:${x.item.id}` === id);
    if (!entry) return;
    if (entry.type === "event") {
      setNotice(t(($) => $.schedule.eventLabel));
      return;
    }
    await perform(async () => {
      const editor = await readScheduleEditor(scope, entry.item.id);
      const draft = await scheduleSessionDraft(
        editor.session,
        editor.resources,
        sources.data!.center.timezone,
      );
      if (!mounted.current) return;
      resetReview();
      setSelected(editor);
      setSessionDraft(draft);
      setInitialDraft(draft);
      setSessionTitle(entry.item.title);
      setMode("view");
    });
  }
  async function submitCreate() {
    await perform(async () => {
      if (!createSource) return;
      const fresh = await readScheduleSources(scope);
      const same =
        fresh.center.timezone === createSource.center.timezone &&
        fresh.resources.classes.find((x) => x.id === createDraft.classId)?.version ===
          createSource.resources.classes.find((x) => x.id === createDraft.classId)?.version &&
        fresh.resources.rooms.find((x) => x.id === createDraft.roomId)?.version ===
          createSource.resources.rooms.find((x) => x.id === createDraft.roomId)?.version;
      if (!same) throw new Error("SCHEDULE_PREVIEW_STALE");
      if (createDraft.mode === "single") {
        const intent = await singleSessionIntent(fresh, createDraft);
        if (!mounted.current) return;
        command.reset();
        await command.start(intent);
      } else {
        const next = await previewScheduleProgram(fresh, createDraft);
        if (mounted.current) {
          setReview(next);
          setNotice(next.preview.blockers.length ? undefined : t(($) => $.schedule.previewReady));
        }
      }
    });
  }
  async function previewSession() {
    await perform(async () => {
      if (!selected || !sessionDraft || !initialDraft || !sources.data) return;
      const fresh =
        mode === "cancel"
          ? { session: await readScheduleSession(scope, selected.session.id), resources: null }
          : await readScheduleEditor(scope, selected.session.id);
      if (fresh.session.version !== selected.session.version)
        throw new Error("SCHEDULE_PREVIEW_STALE");
      let next: ScheduleReview;
      if (mode === "cancel")
        next = await previewScheduleCancel(scope, fresh.session, sessionDraft.reason);
      else {
        if (!fresh.resources) throw new Error("SCHEDULE_EDITOR_UNAVAILABLE");
        const patch: SessionPatch = {};
        if (mode === "instructor") {
          if (
            !sources.data.instructors.some(
              (x) =>
                x.active &&
                x.accountAccessGranted === true &&
                x.person.id === sessionDraft.instructorId,
            )
          )
            throw new Error("SCHEDULE_INVALID");
          patch.assignments = [
            ...fresh.session.assignments.filter((x) => x.duty !== "instructor"),
            { person_id: sessionDraft.instructorId, duty: "instructor" },
          ];
        } else if (mode === "edit") {
          if (
            sessionDraft.date !== initialDraft.date ||
            sessionDraft.time !== initialDraft.time ||
            sessionDraft.duration !== initialDraft.duration
          )
            patch.interval = await scheduleInterval(
              sources.data.center.timezone,
              sessionDraft.date,
              sessionDraft.time,
              Number(sessionDraft.duration),
              sessionDraft.offset,
            );
          if (sessionDraft.roomId !== initialDraft.roomId) {
            if (!sources.data.resources.rooms.some((x) => x.active && x.id === sessionDraft.roomId))
              throw new Error("SCHEDULE_INVALID");
            patch.resources = [
              ...fresh.resources.filter((x) => x.kind !== "room"),
              { kind: "room", id: sessionDraft.roomId },
            ];
          }
          if (sessionDraft.capacity !== initialDraft.capacity) {
            const total = Number(sessionDraft.capacity);
            if (!/^\d+$/.test(sessionDraft.capacity) || !Number.isSafeInteger(total))
              throw new Error("SCHEDULE_INVALID");
            patch.capacity = { total, categories: fresh.session.capacity.categories ?? null };
          }
        } else throw new Error("SCHEDULE_INVALID");
        next = await previewScheduleChange(
          scope,
          fresh.session,
          patch,
          sessionDraft.scope,
          sessionDraft.reason,
        );
      }
      if (mounted.current) {
        setReview(next);
        setNotice(next.preview.blockers.length ? undefined : t(($) => $.schedule.previewReady));
      }
    });
  }
  async function previewChanges() {
    await perform(async () => {
      const change = Object.values(drafts)[0];
      if (!change) return;
      const session = await readScheduleSession(scope, change.id);
      const next = await previewScheduleChange(
        scope,
        session,
        { interval: { starts_at: change.start, ends_at: change.end } },
        changeScope,
        reason,
      );
      if (mounted.current) {
        setReview(next);
        setNotice(t(($) => $.schedule.batchHint));
      }
    });
  }
  async function apply() {
    if (locked || !review) return;
    try {
      const intent = scheduleApplyIntent(review);
      command.reset();
      await command.start(intent);
    } catch (failure) {
      handle(failure);
    }
  }
  async function replacement() {
    await perform(async () => {
      if (!selected || !sessionDraft || !sources.data) return;
      if (
        !sources.data.resources.rooms.some(
          (x) => x.id === sessionDraft.replacementRoomId && x.active,
        )
      )
        throw new Error("SCHEDULE_INVALID");
      const interval = await scheduleInterval(
        sources.data.center.timezone,
        sessionDraft.replacementDate,
        sessionDraft.replacementTime,
        Number(sessionDraft.duration),
        sessionDraft.replacementOffset,
      );
      const intent = await replacementSessionIntent(
        scope,
        selected.session,
        interval,
        sessionDraft.replacementRoomId,
      );
      if (!mounted.current) return;
      command.reset();
      await command.start(intent);
    });
  }
  const message =
    command.state === "unknown"
      ? t(($) => $.schedule.writeUnknown)
      : command.state === "saved-unread"
        ? t(($) => $.schedule.savedUnread)
        : command.state === "saved"
          ? t(($) => $.schedule.saved)
          : command.state === "stale"
            ? t(($) => $.schedule.stale)
            : command.state === "rejected"
              ? t(($) => $.schedule.rejected)
              : command.state === "pending"
                ? t(($) => $.schedule.receiptPending)
                : notice;
  const source = sources.data;
  if (!source || sources.isError)
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyDescription>
              {sources.isError
                ? t(($) => $.schedule.sourceUnavailable)
                : t(($) => $.schedule.loadingSources)}
            </EmptyDescription>
            {sources.isError && (
              <Button
                variant="outline"
                onPress={() => {
                  void sources.refetch();
                }}
              >
                {t(($) => $.people.refresh)}
              </Button>
            )}
          </Empty>
        </CardContent>
      </Card>
    );
  const events = scheduleEvents(calendar.data?.entries ?? [], source).map((event) => {
    const draft = drafts[event.id.replace(/^session:/, "")];
    return draft ? { ...event, start: draft.start, end: draft.end, draft: true } : event;
  });
  const rooms = source.resources.rooms.map((x) => ({ id: x.id, label: x.name })),
    teachers = [
      ...new Map(
        source.instructors.map((x) => [
          x.person.id,
          { id: x.person.id, label: x.person.display_name },
        ]),
      ).values(),
    ];
  const activeRooms = rooms.filter((x) =>
      source.resources.rooms.some((r) => r.id === x.id && r.active),
    ),
    activeTeachers = teachers.filter((x) =>
      source.instructors.some(
        (r) => r.person.id === x.id && r.active && r.accountAccessGranted === true,
      ),
    );
  const ready = calendar.isSuccess && !calendar.isFetching;
  const format = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: source.center.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    }).format(new Date(value));
  const previewRows =
    review?.preview.sessions?.map((item) => ({
      id: item.session_id,
      title:
        source.resources.classes.find((x) => x.id === createDraft.classId)?.name ??
        t(($) => $.schedule.unknown),
      detail: `${format(item.interval.starts_at)} – ${format(item.interval.ends_at)}`,
      blocked: review.preview.blockers.length > 0,
    })) ?? [];
  const previewError =
    error ??
    (review?.preview.blockers.length
      ? [
          ...new Set(
            review.preview.blockers.map((blocker) => scheduleBackendError(blocker.code, t)),
          ),
        ].join(" ")
      : undefined);
  const canApply = Boolean(
    review && !review.preview.blockers.length && command.state === "ready" && !locked,
  );
  // A missing edit projection must not hide resources already read for
  // this exact calendar/session version. They remain read-only context.
  const selectedCalendarEntry = calendar.data?.entries.find(
    (entry) =>
      entry.type === "session" &&
      entry.session.id === selected?.session.id &&
      entry.session.version === selected.session.version,
  );
  const panel = selected
    ? scheduleSessionPanel(
        selected.session,
        selected.resources ?? selectedCalendarEntry?.item.resources ?? null,
        source,
        t,
        sessionTitle,
      )
    : undefined;
  if (panel && review)
    panel.effects = review.preview.effects.map((item, index) => ({
      id: String(index),
      title: t(($) => $.schedule.effects[item.action]),
      detail: item.reason ?? t(($) => $.schedule.unknown),
    }));
  const recovery = ["unknown", "saved-unread", "pending"].includes(command.state) ? (
    <div className="flex flex-wrap gap-2">
      {command.state === "unknown" && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.retry();
          }}
        >
          {t(($) => $.schedule.retryWrite)}
        </Button>
      )}
      {["unknown", "saved-unread", "pending"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.readReceipt();
          }}
        >
          {command.state === "saved-unread"
            ? t(($) => $.schedule.readResult)
            : t(($) => $.schedule.readReceipt)}
        </Button>
      )}
    </div>
  ) : undefined;
  return (
    <>
      {(message || error) && (
        <Alert id="schedule-notice" role={error ? "alert" : "status"}>
          <AlertDescription>{error ?? message}</AlertDescription>
          {!createOpen && !selected && !changesOpen && recovery}
        </Alert>
      )}
      <ScheduleView
        key={source.center.timezone}
        events={events}
        timezone={source.center.timezone}
        initialDate={source.initialDate}
        rooms={rooms}
        instructors={teachers}
        room={room}
        instructor={instructor}
        state={calendar.isError ? "error" : ready ? "ready" : "loading"}
        locked={locked}
        pending={Object.keys(drafts).length}
        onRange={onRange}
        onRoom={(id) => guarded(() => setRoom(id))}
        onInstructor={(id) => guarded(() => setInstructor(id))}
        onAdd={
          ready
            ? () =>
                guarded(() => {
                  resetReview();
                  setCreateSource(source);
                  setCreateDraft(emptyCreate(source.initialDate));
                  setCreateOpen(true);
                })
            : undefined
        }
        onEvent={(id) => {
          void openSession(id);
        }}
        onDraftChange={(change) => {
          const entry = calendar.data?.entries.find(
            (x) => x.type === "session" && `session:${x.item.id}` === change.id,
          );
          if (!entry || entry.type !== "session" || entry.session.state !== "planned" || locked)
            return;
          resetReview();
          setDrafts((old) => ({ ...old, [entry.item.id]: { ...change, id: entry.item.id } }));
        }}
        onUndo={() => {
          afterDiscard.current = undefined;
          setDiscard(true);
        }}
        onSave={() => {
          resetReview();
          setChangesOpen(true);
        }}
        onRetry={() => {
          void calendar.refetch();
        }}
      />
      <ScheduleCreateSheet
        recoveryActions={recovery}
        open={createOpen}
        timezone={createSource?.center.timezone ?? source.center.timezone}
        draft={createDraft}
        classes={source.resources.classes
          .filter((x) => x.active)
          .map((x) => ({ id: x.id, label: x.name }))}
        rooms={activeRooms}
        instructors={activeTeachers}
        offsetChoices={createDraft.mode === "single" ? offsetRequests[0]?.choices : undefined}
        offsetRequests={createDraft.mode === "weekly" ? offsetRequests : undefined}
        preview={previewRows}
        locked={locked}
        notice={message}
        error={previewError}
        onClose={() => {
          if (!locked) {
            setCreateOpen(false);
            resetReview();
          }
        }}
        onDraft={(draft) => {
          const changed =
            draft.date !== createDraft.date ||
            draft.time !== createDraft.time ||
            draft.weeks !== createDraft.weeks ||
            draft.weekdays.join() !== createDraft.weekdays.join();
          setCreateDraft(changed ? { ...draft, offset: "", offsets: {} } : draft);
          resetReview(changed);
        }}
        onSubmit={() => {
          void submitCreate();
        }}
        onApply={
          createDraft.mode === "weekly" && canApply
            ? () => {
                void apply();
              }
            : undefined
        }
      />
      {selected && sessionDraft && panel && (
        <ScheduleSessionSheet
          onDetail={() => {
            if (locked) return;
            void navigate({
              to: "/o/$orgId/c/$centerId/sessions/$sessionId",
              params: {
                orgId: scope.orgId,
                centerId: scope.centerId,
                sessionId: selected.session.id,
              },
            });
          }}
          recoveryActions={recovery}
          open
          mode={mode}
          panel={panel}
          draft={sessionDraft}
          rooms={activeRooms}
          instructors={activeTeachers}
          offsetChoices={offsetRequests[0]?.choices}
          locked={locked}
          notice={
            [
              selected.session.state === "cancelled"
                ? t(($) => $.schedule.sessionStates.cancelled)
                : null,
              message ??
                (!selected.resources && mode !== "cancel" && mode !== "roster"
                  ? t(($) => $.schedule.editorUnavailable)
                  : null),
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          error={previewError}
          canFuture
          canEdit={Boolean(selected.resources)}
          canRoster={Boolean(selected.session.class_id && range)}
          historyContent={
            selected.session.state === "cancelled" &&
            sources.data && (
              <ScheduleReplacements
                scope={scope}
                sessionId={selected.session.id}
                timezone={sources.data.center.timezone}
                onAccessLost={accessLost}
              />
            )
          }
          rosterContent={
            selected.session.class_id &&
            range &&
            sources.data && (
              <ScheduleRoster
                key={`${selected.session.id}:${range.starts_at}:${range.ends_at}:${mode === "roster"}`}
                scope={scope}
                classId={selected.session.class_id}
                interval={range}
                timezone={sources.data.center.timezone}
                editing={mode === "roster"}
                onLockChange={setRosterLocked}
                onAccessLost={accessLost}
                onRefresh={async () => {
                  await calendar.refetch({ throwOnError: true });
                  const fresh = await readScheduleEditor(scope, selected.session.id);
                  if (mounted.current) setSelected(fresh);
                }}
              />
            )
          }
          cancelled={selected.session.state === "cancelled"}
          onClose={() => {
            if (!locked) {
              setSelected(undefined);
              resetReview();
            }
          }}
          onMode={(value) => {
            if (locked || (!selected.resources && ["edit", "instructor"].includes(value))) return;
            resetReview();
            setMode(value);
          }}
          onDraft={
            mode !== "roster"
              ? (draft) => {
                  const changed =
                    draft.date !== sessionDraft.date ||
                    draft.time !== sessionDraft.time ||
                    draft.replacementDate !== sessionDraft.replacementDate ||
                    draft.replacementTime !== sessionDraft.replacementTime;
                  setSessionDraft(
                    changed ? { ...draft, offset: "", replacementOffset: "" } : draft,
                  );
                  resetReview(changed);
                }
              : undefined
          }
          onPreview={
            mode !== "roster" && selected.session.state === "planned"
              ? () => {
                  void previewSession();
                }
              : undefined
          }
          onApply={
            canApply
              ? () => {
                  void apply();
                }
              : undefined
          }
          onReplacement={
            selected.session.state === "cancelled" && sessionDraft.replacement
              ? () => {
                  void replacement();
                }
              : undefined
          }
        />
      )}
      <ScheduleChangeDialog
        recoveryActions={recovery}
        open={changesOpen}
        rows={Object.values(drafts).map((draft) => {
          const entry = calendar.data?.entries.find(
            (x) => x.type === "session" && x.item.id === draft.id,
          );
          return {
            id: draft.id,
            title: entry?.item.title ?? t(($) => $.schedule.unknown),
            from: entry ? format(entry.item.starts_at) : t(($) => $.schedule.unknown),
            to: format(draft.start),
            detail: null,
            status: null,
          };
        })}
        scope={changeScope}
        reason={reason}
        notify={false}
        affectedLabel={review?.preview.sessions ? String(review.preview.sessions.length) : null}
        notice={t(($) => $.schedule.batchHint)}
        error={previewError}
        locked={locked}
        onScope={(value) => {
          setChangeScope(value);
          resetReview();
        }}
        onReason={(value) => {
          setReason(value);
          resetReview();
        }}
        onClose={() => {
          if (!locked) {
            setChangesOpen(false);
            resetReview();
          }
        }}
        onPreview={() => {
          void previewChanges();
        }}
        onApply={
          canApply
            ? () => {
                void apply();
              }
            : undefined
        }
      />
      <ScheduleDiscardDialog
        open={discard || blocker.status === "blocked"}
        onClose={() => {
          setDiscard(false);
          afterDiscard.current = undefined;
          if (blocker.status === "blocked") blocker.reset();
        }}
        onDiscard={() => {
          setDrafts({});
          setDiscard(false);
          setChangesOpen(false);
          resetReview();
          afterDiscard.current?.();
          afterDiscard.current = undefined;
          if (blocker.status === "blocked") blocker.proceed();
        }}
      />
    </>
  );
}
