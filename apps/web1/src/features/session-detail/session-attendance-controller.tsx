import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  AttendanceCorrection,
  AttendanceResult,
  AttendanceView,
  SessionView,
} from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { SessionAttendance } from "./session-detail-view";
import { AttendanceCorrectionRequests } from "./attendance-correction-requests";
import { SessionAttendanceStart, SessionAttendanceClose } from "./session-detail-panels";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { useMemberCommand } from "../member-profile/use-member-command";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import {
  attendanceStartIntent,
  attendanceMarkIntent,
  attendanceCloseIntent,
  hasUnmarkedAttendance,
  previewAttendanceCorrection,
  attendanceCorrectionIntent,
  attendanceWindowState,
  writeSessionAttendance,
  readSessionAttendanceReceipt,
  readSessionAttendanceResult,
  type AttendanceReview,
  type SessionAttendanceIntent,
} from "./session-attendance";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function SessionAttendanceController({
  scope,
  audience = "management",
  canCorrectAttendance = false,
  startTime,
  session,
  attendance,
  names,
  instructors,
  timezone,
  disabled,
  onLockChange,
  onAccessLost,
  onRefresh,
  onRetry,
  children,
}: {
  scope: ClientScope;
  audience?: "management" | "instructor";
  canCorrectAttendance?: boolean;
  startTime?: string;
  session: SessionView;
  attendance?: AttendanceView;
  names: Map<string, string>;
  instructors: { id: string; name: string }[];
  timezone?: string;
  disabled: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (failure: unknown) => boolean;
  onRefresh: () => Promise<void>;
  onRetry: () => void;
  children: (view: { panel: ReactNode; overlays: ReactNode; onStart?: () => void }) => ReactNode;
}) {
  const { t } = useTranslation();
  const window = attendance?.attendance_window;
  const [now, updateTime] = useState(Date.now);
  const phase = attendanceWindowState(window, now);
  const draftAllowed = phase !== "upcoming" && phase !== "elapsed";
  useEffect(() => {
    if (!window || phase === "elapsed") return;
    const next = Date.parse(phase === "upcoming" ? window.opens_at : window.closes_at);
    const delay = Math.min(Math.max(0, next - Date.now()), 2_147_483_647);
    const timer = setTimeout(() => updateTime(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [window, phase, now]);
  const [startOpen, setStartOpen] = useState(false),
    [closeOpen, setCloseOpen] = useState(false),
    [reason, setReason] = useState(""),
    [accepted, setAccepted] = useState(false),
    [performed, setPerformed] = useState(false),
    [performedIds, setPerformedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false),
    [results, setResults] = useState<Record<string, AttendanceResult>>({}),
    [review, setReview] = useState<AttendanceReview>(),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [rightsUnavailable, setRightsUnavailable] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState(session.version);
  const [acceptedStartTime, setAcceptedStartTime] = useState<string>();
  const liveAccepted =
    accepted &&
    acceptedVersion === session.version &&
    (!startOpen ||
      (audience === "management" && startTime === undefined) ||
      Boolean(startTime && acceptedStartTime === startTime));
  const command = useMemberCommand({
    write: async (intent: SessionAttendanceIntent) => {
      try {
        return await writeSessionAttendance(intent);
      } catch (failure) {
        setError(
          scheduleBackendError(
            failure instanceof BackendError ? failure.code : "SOURCE_UNAVAILABLE",
            t,
          ),
        );
        throw failure;
      }
    },
    readReceipt: readSessionAttendanceReceipt,
    readResult: (intent) => readSessionAttendanceResult(intent, audience === "management"),
    onAccessLost,
    onRefresh: async (result) => {
      setRightsUnavailable(result.rightsUnavailable);
      await onRefresh();
      setResults({});
      setEditing(false);
    },
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function reset() {
    if (locked) return;
    command.reset();
    setError(undefined);
    setRightsUnavailable(false);
  }
  async function run(intent: () => SessionAttendanceIntent | Promise<SessionAttendanceIntent>) {
    if (locked || disabled || !attendance || command.unavailable) return;
    setBusy(true);
    setError(undefined);
    try {
      command.reset();
      await command.start(await intent());
    } catch (failure) {
      if (!onAccessLost(failure))
        setError(
          failure instanceof Error && failure.message === "SESSION_ATTENDANCE_WINDOW_CLOSED"
            ? t(($) => $.sessionDetail.windowUnavailable)
            : t(($) => $.sessionDetail.sourceChanged),
        );
    } finally {
      setBusy(false);
    }
  }
  const message = t(($) => $.sessionDetail.attendanceStates[command.state]);
  const notice = (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && <p role="status">{message}</p>}
      {rightsUnavailable && (
        <Alert>
          <AlertDescription>{t(($) => $.sessionDetail.rightsUnavailable)}</AlertDescription>
        </Alert>
      )}
    </>
  );
  const recovery = (
    <div className="flex flex-wrap gap-2">
      {["unknown", "pending", "saved-unread"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.readReceipt();
          }}
        >
          {t(($) => $.sessionDetail.readReceipt)}
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
          {t(($) => $.sessionDetail.retryWrite)}
        </Button>
      )}
      {["stale", "rejected"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={locked}
          onPress={() => {
            reset();
            setReview(undefined);
            setReviewed(false);
            setAccepted(false);
            void onRefresh();
          }}
        >
          {t(($) => $.sessionDetail.readSources)}
        </Button>
      )}
    </div>
  );
  const corrections: AttendanceCorrection[] =
    attendance?.entries.flatMap((entry) => {
      const result = results[entry.reservation_id];
      if (!result || result === entry.result || result === "unmarked") return [];
      const blockReason = entry.eligibility_snapshot?.reason ?? entry.blocked_reason;
      return [
        {
          reservation_id: entry.reservation_id,
          result,
          ...(result === "blocked" && blockReason ? { reason: blockReason } : {}),
        },
      ];
    }) ?? [];
  async function preview() {
    if (
      !canCorrectAttendance ||
      !attendance ||
      locked ||
      disabled ||
      !reason.trim() ||
      !corrections.length
    )
      return;
    reset();
    setBusy(true);
    setReview(undefined);
    setReviewed(false);
    try {
      setReview(await previewAttendanceCorrection(scope, session, attendance, corrections, reason));
    } catch (failure) {
      if (!onAccessLost(failure))
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
  const incomplete = Boolean(
    attendance && attendance.closure_state === "open" && hasUnmarkedAttendance(attendance),
  );
  const canClose = Boolean(attendance?.actual_started_at && !incomplete);
  const dateLabel = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  });
  const panel = (
    <SessionAttendance
      rows={
        attendance?.entries.map((entry) => ({
          id: entry.reservation_id,
          name:
            names.get(entry.person_id) ??
            `${t(($) => $.sessionDetail.unknown)} · ${entry.reservation_id.slice(-8)}`,
          result: results[entry.reservation_id] ?? entry.result,
          protected: entry.protected,
          canBlock:
            !entry.protected &&
            entry.eligibility_snapshot?.eligible === false &&
            Boolean(entry.eligibility_snapshot.reason),
          readOnly: attendance.closure_state === "open" && entry.result === "blocked",
          detail: entry.blocked_reason
            ? t(($) => $.sessionDetail.blockReasons[entry.blocked_reason!])
            : undefined,
        })) ?? []
      }
      startedAt={
        attendance?.actual_started_at && timezone
          ? dateLabel.format(new Date(attendance.actual_started_at))
          : undefined
      }
      unavailable={!attendance}
      closed={session.attendance_state === "closed"}
      incomplete={incomplete}
      editing={editing}
      reason={reason}
      locked={locked || disabled}
      onReason={(value) => {
        if (!locked) {
          reset();
          setReason(value);
          setReview(undefined);
          setReviewed(false);
        }
      }}
      onResult={
        attendance &&
        (editing ||
          (draftAllowed && attendance.closure_state === "open" && attendance.actual_started_at))
          ? (id, value) => {
              if (!locked) {
                reset();
                setReview(undefined);
                setReviewed(false);
                setResults((old) => ({ ...old, [id]: value }));
              }
            }
          : undefined
      }
      onSaveRow={
        draftAllowed && attendance?.actual_started_at
          ? (id) => {
              const entry = attendance.entries.find((row) => row.reservation_id === id),
                result = results[id] ?? entry?.result;
              if (result === "attended" || result === "no_show")
                void run(() => attendanceMarkIntent(scope, session, attendance, id, result));
            }
          : undefined
      }
      onBlock={
        draftAllowed && attendance?.actual_started_at
          ? (id) => {
              const reason = attendance.entries.find((row) => row.reservation_id === id)
                ?.eligibility_snapshot?.reason;
              if (reason)
                void run(() => attendanceMarkIntent(scope, session, attendance, id, reason));
            }
          : undefined
      }
      onEdit={
        attendance && canCorrectAttendance
          ? () => {
              reset();
              setResults({});
              setReason("");
              setEditing(true);
            }
          : undefined
      }
      onCancel={() => {
        if (!locked) {
          reset();
          setReview(undefined);
          setResults({});
          setEditing(false);
        }
      }}
      onPreview={
        canCorrectAttendance && corrections.length
          ? () => {
              void preview();
            }
          : undefined
      }
      onClose={
        canClose
          ? () => {
              reset();
              setCloseOpen(true);
              setPerformed(false);
              setPerformedIds([]);
              setAccepted(false);
            }
          : undefined
      }
      notice={
        <>
          {window && timezone && (
            <p className="text-sm text-muted-foreground">
              {t(($) => $.sessionDetail.attendanceWindow, {
                opens: dateLabel.format(new Date(window.opens_at)),
                closes: dateLabel.format(new Date(window.closes_at)),
              })}
              {!draftAllowed && attendance?.closure_state === "open"
                ? ` ${t(($) => $.sessionDetail.windowUnavailable)}`
                : ""}
            </p>
          )}
          {!attendance && (
            <Alert>
              <AlertDescription>
                <p>{t(($) => $.sessionDetail.readFailed)}</p>
                <Button variant="outline" size="sm" onPress={onRetry}>
                  {t(($) => $.sessionDetail.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {notice}
          {recovery}
        </>
      }
      correction={
        attendance?.closure_state === "closed" &&
        attendance.correction_requests && (
          <AttendanceCorrectionRequests
            key={attendance.revision}
            revision={attendance.revision}
            requests={attendance.correction_requests}
            instructors={instructors}
          />
        )
      }
    />
  );
  return children({
    panel,
    onStart:
      (audience === "management" || Boolean(startTime)) &&
      attendance &&
      !attendance.actual_started_at &&
      attendance.closure_state === "open" &&
      session.state === "planned" &&
      draftAllowed &&
      !disabled
        ? () => {
            if (!locked) {
              reset();
              setReason("");
              setAccepted(false);
              setStartOpen(true);
            }
          }
        : undefined,
    overlays: (
      <>
        <SessionAttendanceStart
          open={startOpen}
          actualLabel={
            startTime && timezone
              ? new Intl.DateTimeFormat("tr-TR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "shortOffset",
                  timeZone: timezone,
                }).format(new Date(startTime))
              : undefined
          }
          reason={reason}
          accepted={liveAccepted}
          locked={locked}
          onReason={(value) => {
            reset();
            setReason(value);
            setAccepted(false);
          }}
          onAccepted={(value) => {
            setAcceptedStartTime(startTime);
            setAcceptedVersion(session.version);
            setAccepted(value);
          }}
          onClose={() => {
            if (!locked) setStartOpen(false);
          }}
          onSubmit={
            attendance &&
            (audience === "management" || Boolean(startTime)) &&
            command.state !== "saved" &&
            draftAllowed &&
            !attendance.actual_started_at
              ? () => {
                  if (liveAccepted)
                    void run(() =>
                      attendanceStartIntent(scope, session, attendance, reason, startTime),
                    );
                }
              : undefined
          }
          notice={notice}
          recovery={recovery}
        />
        <SessionAttendanceClose
          open={closeOpen}
          performed={performed}
          instructors={instructors}
          selectedInstructors={performedIds}
          reviewed={liveAccepted}
          onPerformed={(value) => {
            if (!locked) {
              reset();
              setPerformed(value);
              setPerformedIds([]);
              setAccepted(false);
            }
          }}
          onInstructors={(ids) => {
            if (!locked) {
              reset();
              setPerformedIds(ids);
              setAccepted(false);
            }
          }}
          onReviewed={(value) => {
            setAcceptedVersion(session.version);
            setAccepted(value);
          }}
          onClose={() => {
            if (!locked) setCloseOpen(false);
          }}
          onSubmit={
            attendance && canClose && command.state !== "saved"
              ? () => {
                  if (liveAccepted)
                    void run(() =>
                      attendanceCloseIntent(scope, session, attendance, performed, performedIds),
                    );
                }
              : undefined
          }
          locked={locked}
          notice={notice}
          recovery={recovery}
        />
        {review && canCorrectAttendance && (
          <SettingsReviewDialog
            open
            title={t(($) => $.sessionDetail.previewCorrection)}
            description={review.reason}
            rows={review.preview.effects.map((effect, i) => ({
              id: `${effect.entity.type}:${effect.entity.id}:${i}`,
              title: t(($) => $.sessionDetail.effectActions[effect.action]),
              detail:
                [
                  effect.quantity != null ? String(effect.quantity) : null,
                  effect.amount_minor != null && effect.currency
                    ? formatMinorAmount(effect.amount_minor, effect.currency)
                    : null,
                  effect.reason,
                ]
                  .filter(Boolean)
                  .join(" · ") || t(($) => $.memberProfile.nativeEffectsHint),
            }))}
            blockers={review.preview.blockers.map((blocker, i) => ({
              id: String(i),
              text: scheduleBackendError(blocker.code, t),
            }))}
            accepted={reviewed}
            locked={locked}
            onAccepted={setReviewed}
            onClose={() => {
              if (!locked) {
                reset();
                setReview(undefined);
              }
            }}
            onApply={
              reviewed && !review.preview.blockers.length && command.state === "ready"
                ? () => {
                    void run(() => attendanceCorrectionIntent(review));
                  }
                : undefined
            }
            applyLabel={t(($) => $.sessionDetail.saveCorrection)}
            notice={message || error}
            recoveryActions={recovery}
          />
        )}
      </>
    ),
  });
}
