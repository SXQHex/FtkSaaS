"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { EventView, Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { setupCall, type SetupScope, type SetupCommand } from "../../lib/studio-setup";
import { eventPreviewMatches } from "../../lib/event-command";
import { localTimeChoices } from "../../lib/session-change";
import { LocalTimeField } from "../programs/local-time-field";
import { NativeCommandReview } from "../setup/native-command-review";
import { FinancePreviewReview } from "../finance/finance-preview-review";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { button, control } from "./event-editor";
export function EventActions({
  scope,
  event,
  onSaved,
}: {
  scope: SetupScope;
  event: EventView;
  onSaved: () => void;
}) {
  const t = useTranslations("events"),
    f = useFormatter(),
    [action, setAction] = useState(""),
    [registration, setRegistration] = useState(""),
    [duty, setDuty] = useState(""),
    [reason, setReason] = useState(""),
    [attendance, setAttendance] = useState(""),
    [ineligible, setIneligible] = useState(false),
    [actual, setActual] = useState(""),
    [offset, setOffset] = useState(""),
    [clearActual, setClearActual] = useState(false),
    [review, setReview] = useState<SetupCommand | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const command = useSetupCommand(scope, `event:${event.id}`, onSaved, () => {
    setReview(null);
    setPreview(null);
  });
  const disabled = busy || command.busy || !!command.pending;
  return (
    <section className="space-y-4">
      <h3>{t("actions")}</h3>
      <SetupFeedback command={command} />
      {event.actual_started_at && (
        <p>
          {t("actual")}:{" "}
          {f.dateTime(new Date(event.actual_started_at), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: event.timezone,
          })}
        </p>
      )}
      <ul>
        {event.actual_start_history?.map((h) => (
          <li key={h.id}>
            {f.dateTime(new Date(h.created_at), {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: event.timezone,
            })}{" "}
            · {h.reason}
          </li>
        ))}
      </ul>
      <ul className="space-y-3">
        {event.registrations?.map((r) => (
          <li key={r.id}>
            {r.display_name}
            {r.subscriber_number ? ` · ${r.subscriber_number}` : ""} ·{" "}
            {t(`registrationStates.${r.state}`)} · {t(`attendanceStates.${r.attendance_result}`)}
            {r.package_eligible != null && (
              <p>{t(r.package_eligible ? "eligible" : "ineligible")}</p>
            )}
            {r.package_eligible_at_attendance != null && (
              <p>{t(r.package_eligible_at_attendance ? "eligibleThen" : "ineligibleThen")}</p>
            )}
          </li>
        ))}
      </ul>
      {error && <FlowError code={error} />}
      <form
        className="space-y-4"
        onChange={() => {
          setReview(null);
          setPreview(null);
          setError("");
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (disabled) return;
          setBusy(true);
          setError("");
          try {
            const base = { org_id: scope.orgId, center_id: scope.centerId, operation_key: v7() },
              r = event.registrations?.find((r) => r.id === registration),
              d = event.duties?.find((d) => d.id === duty);
            let c: SetupCommand;
            if (action === "cancel") {
              const p = await setupCall("event_cancel_preview_v1", {
                org_id: scope.orgId,
                center_id: scope.centerId,
                event_id: event.id,
                reason: reason.trim(),
              });
              if (!eventPreviewMatches(p, event.id, event.version)) throw Error("invalidEvent");
              setPreview(p);
              return;
            }
            if (action === "publish" || action === "unpublish")
              c = {
                operation: "event_publish_v1",
                input: { ...base, event_id: event.id, published: action === "publish" },
              };
            else if (action === "complete")
              c = { operation: "event_complete_v1", input: { ...base, event_id: event.id } };
            else if (action === "close")
              c = {
                operation: "event_attendance_close_v1",
                input: { ...base, event_id: event.id, expected_version: event.version },
              };
            else if (action === "actual" || action === "correctActual") {
              const choices = localTimeChoices(actual, event.timezone),
                value =
                  clearActual && action === "correctActual"
                    ? null
                    : choices.length === 1
                      ? choices[0]!.instant
                      : choices.find((c) => c.instant === offset)?.instant;
              if (value === undefined) throw Error("chooseOffsets");
              c =
                action === "actual"
                  ? {
                      operation: "event_actual_start_record_v1",
                      input: {
                        ...base,
                        event_id: event.id,
                        expected_version: event.version,
                        reason: reason.trim(),
                        actual_started_at: value!,
                      },
                    }
                  : {
                      operation: "event_actual_start_correct_v1",
                      input: {
                        ...base,
                        event_id: event.id,
                        expected_version: event.version,
                        reason: reason.trim(),
                        actual_started_at: value,
                      },
                    };
            } else if (action === "performed" || action === "notPerformed") {
              if (!d) throw Error("invalidEvent");
              c = {
                operation: "event_duty_verify_v1",
                input: {
                  ...base,
                  assignment_id: d.id,
                  expected_version: d.version,
                  performed: action === "performed",
                  reason: reason.trim() || undefined,
                },
              };
            } else {
              if (!r || !reason.trim()) throw Error("invalidEvent");
              if (action === "cancelRegistration")
                c = {
                  operation: "event_registration_cancel_v1",
                  input: {
                    ...base,
                    registration_id: r.id,
                    expected_version: r.version,
                    reason: reason.trim(),
                  },
                };
              else {
                if (!["unmarked", "attended", "no_show", "blocked"].includes(attendance))
                  throw Error("invalidEvent");
                const input = {
                  ...base,
                  registration_id: r.id,
                  expected_version: r.version,
                  result: attendance as "unmarked" | "attended" | "no_show" | "blocked",
                  reason: reason.trim(),
                  ...(ineligible ? { record_ineligible_attendance: true } : {}),
                };
                c =
                  action === "mark"
                    ? { operation: "event_attendance_mark_v1", input }
                    : { operation: "event_attendance_correct_v1", input };
              }
            }
            setReview(c);
          } catch (c) {
            setError(flowError(c));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={disabled} className="space-y-3">
          <label className="block">
            {t("action")}
            <select
              className={control}
              required
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setIneligible(false);
                setAttendance("");
                setClearActual(false);
              }}
            >
              <option value="">{t("choose")}</option>
              {(event.state === "cancelled"
                ? ["correctActual"]
                : [
                    "publish",
                    "unpublish",
                    "complete",
                    "cancel",
                    "close",
                    "actual",
                    "correctActual",
                    "cancelRegistration",
                    event.attendance_state === "closed" ? "correctAttendance" : "mark",
                    "performed",
                    "notPerformed",
                  ]
              ).map((a) => (
                <option value={a} key={a}>
                  {t(a)}
                </option>
              ))}
            </select>
          </label>
          {["mark", "correctAttendance", "cancelRegistration"].includes(action) && (
            <label className="block">
              {t("registration")}
              <select
                className={control}
                required
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {event.registrations?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_name}
                    {r.subscriber_number ? ` · ${r.subscriber_number}` : ""} ·{" "}
                    {t(`registrationStates.${r.state}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["mark", "correctAttendance"].includes(action) && (
            <>
              <label className="block">
                {t("attendance")}
                <select
                  className={control}
                  required
                  value={attendance}
                  onChange={(e) => {
                    setAttendance(e.target.value);
                    setIneligible(false);
                  }}
                >
                  <option value="">{t("choose")}</option>
                  {["unmarked", "attended", "no_show", "blocked"].map((s) => (
                    <option key={s} value={s}>
                      {t(`attendanceStates.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              {attendance === "attended" && (
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ineligible}
                    onChange={(e) => setIneligible(e.target.checked)}
                  />
                  {t("ineligibleOverride")}
                </label>
              )}
            </>
          )}
          {["performed", "notPerformed"].includes(action) && (
            <label className="block">
              {t("duty")}
              <select
                className={control}
                required
                value={duty}
                onChange={(e) => setDuty(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {event.duties?.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {t(d.duty)} {i + 1}
                    {d.subscriber_number ? ` · ${d.subscriber_number}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["actual", "correctActual"].includes(action) && (
            <>
              {action === "correctActual" && (
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={clearActual}
                    onChange={(e) => setClearActual(e.target.checked)}
                  />
                  {t("clearActual")}
                </label>
              )}
              {!clearActual && (
                <LocalTimeField
                  label={t("actual")}
                  timeZone={event.timezone}
                  value={actual}
                  choice={offset}
                  onChange={setActual}
                  onChoice={setOffset}
                />
              )}
            </>
          )}
          <label className="block">
            {t("reason")}
            <Input
              required={
                [
                  "cancel",
                  "cancelRegistration",
                  "correctAttendance",
                  "actual",
                  "correctActual",
                ].includes(action) || ineligible
              }
              value={reason}
              maxLength={10000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button className={button}>{t("review")}</Button>
        </fieldset>
      </form>
      {review && !command.pending && (
        <NativeCommandReview
          scope={scope}
          command={review}
          slot={
            "registration_id" in review.input
              ? `event-registration:${review.input.registration_id}`
              : "assignment_id" in review.input
                ? `event-duty:${review.input.assignment_id}`
                : `event:${event.id}`
          }
          onSaved={(code) => {
            setReview(null);
            if (code) setError(code);
            else onSaved();
          }}
          onBack={() => setReview(null)}
        >
          <p>
            {event.name} · {t(action)}
          </p>
          <p>{event.registrations?.find((r) => r.id === registration)?.display_name}</p>
          <p>{reason}</p>
          {ineligible && <p>{t("ineligibleOverride")}</p>}
          <p>{t("actionHint")}</p>
        </NativeCommandReview>
      )}
      {preview && (
        <FinancePreviewReview
          key={preview.id}
          preview={preview}
          timeZone={event.timezone}
          disabled={disabled}
          onBack={() => setPreview(null)}
          onApply={() => {
            if (!eventPreviewMatches(preview, event.id, event.version))
              return setError("PREVIEW_STALE");
            void command.run({
              operation: "event_cancel_apply_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                preview: { id: preview.id, token: preview.token },
              },
            });
          }}
        >
          <p>
            {event.name} · {reason}
          </p>
          <p>{t("cancelHint")}</p>
        </FinancePreviewReview>
      )}
    </section>
  );
}
