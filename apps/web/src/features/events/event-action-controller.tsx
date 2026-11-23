import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventView, Preview } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { scheduleTimeChoices, ScheduleTimeError } from "../schedule/schedule-time";
import { EventActionDialog } from "./event-action-dialog";
import { EventCommandNotice, EventCommandRecovery } from "./event-command-notice";
import {
  EventCorrectionFields,
  EventDutyVerificationFields,
  EventActualOffsetField,
} from "./event-correction-fields";
import { EventPreviewEffects } from "./event-preview-effects";
import {
  prepareEventAction,
  previewEventCancellation,
  eventCancellationIntent,
  writeEventAction,
  readEventActionReceipt,
  readEventActionResult,
  type EventActionInput,
} from "./event-detail-command";

export type EventActionSelection =
  | Exclude<EventActionInput, { action: "verify_duty" }>
  | { action: "verify_duty"; id: string; performed?: boolean; reason: string }
  | { action: "cancel"; reason: string };
export function EventActionController({
  scope,
  before,
  selection,
  recoveryOnly = false,
  onClose,
  onReload,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  before: EventView;
  selection: EventActionSelection;
  recoveryOnly?: boolean;
  onClose: () => void;
  onReload: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState(selection),
    [reviewed, setReviewed] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>(),
    [preview, setPreview] = useState<Preview>(),
    [offsets, setOffsets] = useState<string[]>([]);
  const mounted = useRef(true),
    preparingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeEventAction,
    readReceipt: readEventActionReceipt,
    readResult: readEventActionResult,
    onRefresh: async () => {
      await onSaved();
    },
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  if (recoveryOnly)
    return (
      <EventCommandRecovery locked={locked} onClose={onClose}>
        <EventCommandNotice command={command} onReload={onReload} />
      </EventCommandRecovery>
    );
  function change(value: EventActionSelection) {
    if (locked) return;
    setInput(value);
    setReviewed(false);
    setPreview(undefined);
    setError(undefined);
    setOffsets([]);
  }
  const reason = "reason" in input ? input.reason : "";
  const requireReason =
    [
      "cancel",
      "cancel_registration",
      "correct_attendance",
      "record_start",
      "correct_start",
      "clear_start",
    ].includes(input.action) ||
    (input.action === "verify_duty" &&
      !!before.duties?.find((row) => row.id === input.id)?.verified_at) ||
    ((input.action === "mark" || input.action === "correct_attendance") && input.recordIneligible);
  const title =
    input.action === "mark"
      ? t(($) => $.eventDetail.markFor, {
          name:
            before.registrations?.find((row) => row.id === input.id)?.display_name ??
            t(($) => $.events.unknown),
        })
      : [
            "record_start",
            "correct_start",
            "clear_start",
            "close_attendance",
            "correct_attendance",
          ].includes(input.action)
        ? t(
            ($) =>
              $.eventDetail.attendanceActions[
                input.action as
                  | "record_start"
                  | "correct_start"
                  | "clear_start"
                  | "close_attendance"
                  | "correct_attendance"
              ],
          )
        : t(
            ($) =>
              $.eventDetail.actions[
                input.action as
                  | "publish"
                  | "complete"
                  | "cancel"
                  | "cancel_registration"
                  | "verify_duty"
              ],
          );
  async function submit() {
    if (preparingRef.current || locked || !reviewed || command.state !== "ready") return;
    preparingRef.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      if (input.action === "cancel" && !preview) {
        const value = await previewEventCancellation(scope, before, input.reason);
        if (mounted.current) {
          setPreview(value);
          setReviewed(false);
        }
        return;
      }
      if (input.action === "verify_duty" && input.performed === undefined)
        throw new Error("EVENT_REVIEW_REQUIRED");
      const actionInput =
        input.action === "verify_duty" ? { ...input, performed: input.performed! } : input;
      const intent =
        input.action === "cancel"
          ? eventCancellationIntent(scope, before, preview!, reviewed)
          : await prepareEventAction(scope, before, actionInput as EventActionInput, reviewed);
      if (mounted.current) await command.start(intent);
    } catch (cause) {
      if (!mounted.current || onAccessLost(cause)) return;
      if (
        cause instanceof ScheduleTimeError &&
        cause.message === "SCHEDULE_TIME_AMBIGUOUS" &&
        "actual" in input
      ) {
        const [date, time] = input.actual.split("T");
        setOffsets((await scheduleTimeChoices(before.timezone, date!, time!)).offsets);
        setError(t(($) => $.events.timeAmbiguous));
      } else
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.events.invalid),
        );
    } finally {
      preparingRef.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  return (
    <EventActionDialog
      title={title}
      description={
        <>
          <span className="font-medium">{before.name}</span>
          <span className="mt-2 block">{t(($) => $.eventDetail.actionHint)}</span>
          {input.action === "mark" && (
            <span className="mt-2 block">{t(($) => $.eventDetail.results[input.result])}</span>
          )}
        </>
      }
      confirmLabel={
        input.action === "cancel" && !preview ? t(($) => $.eventDetail.previewAction) : title
      }
      reason={reason}
      onReason={(value) => {
        if ("reason" in input) change({ ...input, reason: value });
      }}
      requireReason={requireReason}
      reviewed={reviewed}
      onReviewed={setReviewed}
      onConfirm={() => {
        void submit();
      }}
      onClose={() => {
        if (!locked) onClose();
      }}
      locked={locked}
      disabled={
        command.state !== "ready" ||
        !!preview?.blockers.length ||
        (input.action === "verify_duty" && input.performed === undefined) ||
        (input.action === "correct_attendance" && !input.id)
      }
      error={error}
      notice={<EventCommandNotice command={command} onReload={onReload} />}
      extra={
        <>
          {preview && <EventPreviewEffects preview={preview} />}
          {input.action === "verify_duty" && (
            <EventDutyVerificationFields
              value={input.performed}
              onChange={(value) => change({ ...input, performed: value })}
              disabled={locked}
            />
          )}
          {(input.action === "mark" || input.action === "correct_attendance") && (
            <EventCorrectionFields
              rows={(before.registrations ?? [])
                .filter(
                  (row) =>
                    row.state === (input.action === "correct_attendance" ? "completed" : "active"),
                )
                .map((row) => ({ id: row.id, name: row.display_name }))}
              selected={input.id}
              onSelect={(id) => change({ ...input, id, recordIneligible: false })}
              result={input.result}
              onResult={(result) => change({ ...input, result, recordIneligible: false })}
              allowIneligible={input.result === "attended"}
              recordIneligible={input.recordIneligible}
              onRecordIneligible={(recordIneligible) => change({ ...input, recordIneligible })}
              disabled={locked}
            />
          )}
          {offsets.length > 1 && "offset" in input && (
            <EventActualOffsetField
              choices={offsets.map((value) => ({ id: value, name: `UTC${value}` }))}
              value={input.offset}
              onChange={(offset) => {
                setInput({ ...input, offset });
                setReviewed(false);
                setError(undefined);
              }}
              disabled={locked}
            />
          )}
        </>
      }
    />
  );
}
