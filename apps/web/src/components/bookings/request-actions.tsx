"use client";
import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { LessonRequestView, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import type { BookingApi } from "../../lib/bookings";
import { sessionInterval } from "../../lib/session-create";
import type { useSetupCommand } from "../setup/setup-command";
import { LocalTimeField } from "../programs/local-time-field";
import { ContextDocuments } from "../documents/context-documents";
import { ConfirmWrite, FlowError, flowError } from "./flow-controls";
type Action = "withdraw" | "reject" | "offer_alternative" | "accept_alternative" | "approve";
export function RequestActions({
  scope,
  row,
  timeZone,
  api,
  command,
}: {
  scope: SetupScope;
  row: LessonRequestView;
  timeZone: string;
  api: BookingApi;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("flows"),
    format = useFormatter(),
    id = useId(),
    [selectedAction, setAction] = useState<Action>("withdraw"),
    [draft, setDraft] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sessions, setSessions] = useState<SessionView[] | null>(null),
    [docs, setDocs] = useState(false);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const action = (
    allowed?.includes(selectedAction) ? selectedAction : (allowed?.[0] ?? "withdraw")
  ) as Action;
  useEffect(() => {
    if (!["pending", "alternative_offered"].includes(row.state)) return;
    let active = true;
    void api
      .requestActions(scope, row)
      .then((result) => {
        if (active) setAllowed(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [api, scope, row]);
  const disabled = command.busy || !!command.pending || !allowed?.length;
  const accepted = row.alternatives.find((item) => item.state === "accepted");
  const fromTime = accepted?.starts_at ?? row.requested_start,
    toTime =
      accepted?.ends_at ??
      new Date(Date.parse(row.requested_start) + row.duration_minutes * 60000).toISOString();
  useEffect(() => {
    if (action !== "approve") return;
    const lifetime = new AbortController();
    void api
      .calendar({
        org_id: scope.orgId,
        center_id: scope.centerId,
        interval: { starts_at: fromTime, ends_at: toTime },
      })
      .then(async (items) => {
        const candidates = items.filter(
          (item) =>
            item.type === "session" &&
            Date.parse(item.starts_at) === Date.parse(fromTime) &&
            Date.parse(item.ends_at) === Date.parse(toTime),
        );
        const details = await Promise.all(
          candidates.map(async (item) => {
            const detail = await api.session(scope.orgId, scope.centerId, item.id);
            if (detail.id !== item.id) throw Error("invalidForm");
            return detail;
          }),
        );
        if (!lifetime.signal.aborted)
          setSessions(
            details.filter(
              (item) =>
                item.format === "private" &&
                item.discipline_id === row.discipline_id &&
                Date.parse(item.starts_at) === Date.parse(fromTime) &&
                Date.parse(item.ends_at) === Date.parse(toTime) &&
                item.state === "planned" &&
                (!(accepted ? accepted.instructor_id : row.preferred_instructor_id) ||
                  item.assignments.some(
                    (assignment) =>
                      assignment.duty === "instructor" &&
                      assignment.person_id ===
                        (accepted ? accepted.instructor_id : row.preferred_instructor_id),
                  )),
            ),
          );
      })
      .catch((cause) => {
        if (!lifetime.signal.aborted) setError(flowError(cause));
      });
    return () => {
      lifetime.abort();
    };
  }, [
    api,
    scope,
    action,
    fromTime,
    toTime,
    row.discipline_id,
    row.preferred_instructor_id,
    accepted,
  ]);
  const alternative =
    draft?.operation === "lesson_request_accept_alternative_v1"
      ? row.alternatives.find((item) => item.id === draft.input.alternative_id)
      : undefined;
  const targetSession =
    draft?.operation === "lesson_request_approve_v1"
      ? sessions?.find((item) => item.id === draft.input.session_id)
      : undefined;
  const offered =
    draft?.operation === "lesson_request_offer_alternative_v1"
      ? draft.input.alternatives[0]?.interval
      : undefined;
  const reviewStart =
    alternative?.starts_at ?? targetSession?.starts_at ?? offered?.starts_at ?? row.requested_start;
  const reviewEnd =
    alternative?.ends_at ??
    targetSession?.ends_at ??
    offered?.ends_at ??
    new Date(Date.parse(row.requested_start) + row.duration_minutes * 60000).toISOString();
  if (!["pending", "alternative_offered"].includes(row.state)) return null;
  if (!allowed) return error ? <FlowError code={error} /> : <output>{t("loading")}</output>;
  if (!allowed.length) return <p>{t("noRequestActions")}</p>;
  return (
    <div className="min-w-0 space-y-4">
      <form
        className="space-y-3"
        onChange={() => setDraft(null)}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !scope.centerId) return;
          try {
            const data = new FormData(event.currentTarget),
              common = {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                lesson_request_id: row.id,
                expected_version: row.version,
              },
              reason = String(data.get("reason") ?? "").trim(),
              exception = data.get("exception") === "on";
            if (exception && !reason) throw Error("invalidForm");
            let next: SetupCommand;
            if (action === "withdraw")
              next = { operation: "lesson_request_withdraw_v1", input: common };
            else if (action === "reject") {
              if (!reason) throw Error("invalidForm");
              next = { operation: "lesson_request_reject_v1", input: { ...common, reason } };
            } else if (action === "offer_alternative")
              next = {
                operation: "lesson_request_offer_alternative_v1",
                input: {
                  ...common,
                  alternatives: [{ interval: sessionInterval(start, end, timeZone, from, to) }],
                  ...(exception ? { window_exception: true, reason } : {}),
                },
              };
            else if (action === "accept_alternative") {
              const alternative = String(data.get("alternative"));
              if (
                !row.alternatives.some(
                  (item) => item.id === alternative && item.state === "offered",
                )
              )
                throw Error("invalidForm");
              next = {
                operation: "lesson_request_accept_alternative_v1",
                input: {
                  ...common,
                  alternative_id: alternative,
                  ...(exception ? { window_exception: true, reason } : {}),
                },
              };
            } else {
              const chosen = String(data.get("session")),
                category = String(data.get("category") ?? "");
              if (!sessions?.some((item) => item.id === chosen)) throw Error("invalidForm");
              next = {
                operation: "lesson_request_approve_v1",
                input: {
                  ...common,
                  session_id: chosen,
                  ...(category === "male" || category === "female"
                    ? { booking_category: category }
                    : {}),
                },
              };
            }
            setError("");
            setDraft(next);
          } catch (cause) {
            setError(flowError(cause));
          }
        }}
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
          <Label htmlFor={`${id}-action`}>{t("requestAction")}</Label>
          <select
            id={`${id}-action`}
            value={action}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            onChange={(event) => {
              setAction(event.target.value as Action);
              setDraft(null);
              setError("");
              setSessions(null);
            }}
          >
            {(allowed ?? []).map((value) => (
              <option key={value} value={value}>
                {t(`requestActions.${value}`)}
              </option>
            ))}
          </select>
          {action === "offer_alternative" && (
            <>
              <LocalTimeField
                label={t("start")}
                value={start}
                onChange={setStart}
                choice={from}
                onChoice={setFrom}
                timeZone={timeZone}
              />
              <LocalTimeField
                label={t("end")}
                value={end}
                onChange={setEnd}
                choice={to}
                onChoice={setTo}
                timeZone={timeZone}
              />
            </>
          )}
          {action === "accept_alternative" && (
            <>
              <Label htmlFor={`${id}-alt`}>{t("alternative")}</Label>
              <select
                id={`${id}-alt`}
                name="alternative"
                required
                className="min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">{t("choose")}</option>
                {row.alternatives
                  .filter((item) => item.state === "offered")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {format.dateTime(new Date(item.starts_at), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      — {format.dateTime(new Date(item.ends_at), { timeStyle: "short" })}
                    </option>
                  ))}
              </select>
              <p>{t("alternativeHint")}</p>
            </>
          )}
          {action === "approve" && (
            <>
              <p>{t("approvalHint")}</p>
              {!sessions && !error ? (
                <output>{t("loading")}</output>
              ) : (
                <>
                  <Label htmlFor={`${id}-session`}>{t("session")}</Label>
                  <select
                    id={`${id}-session`}
                    name="session"
                    required
                    className="min-h-11 w-full rounded-md border bg-background px-3"
                  >
                    <option value="">{t("choose")}</option>
                    {sessions?.map((item, i) => (
                      <option key={item.id} value={item.id}>
                        {t("sessionNumber", { number: i + 1 })} ·{" "}
                        {format.dateTime(new Date(item.starts_at), {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        · {t("remaining", { count: item.capacity.remaining })}
                      </option>
                    ))}
                  </select>
                  {sessions?.length === 0 && <p>{t("noPrivateSession")}</p>}
                </>
              )}
              <Label htmlFor={`${id}-category`}>{t("category")}</Label>
              <select
                id={`${id}-category`}
                name="category"
                className="min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">{t("noCategory")}</option>
                <option value="male">{t("male")}</option>
                <option value="female">{t("female")}</option>
              </select>
            </>
          )}
          {action !== "withdraw" && action !== "approve" && (
            <>
              <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
              <Input id={`${id}-reason`} name="reason" required={action === "reject"} />
              {action !== "reject" && (
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name="exception" />
                  {t("windowException")}
                </label>
              )}
            </>
          )}
          <Button className="h-auto min-h-11 max-w-full whitespace-normal">{t("review")}</Button>
        </fieldset>
      </form>
      {error && <FlowError code={error} />}
      {draft && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={() => setDraft(null)}
        >
          <p>{t(`requestActions.${action}`)}</p>
          <p>
            {format.dateTime(new Date(reviewStart), { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <p>{format.dateTime(new Date(reviewEnd), { dateStyle: "medium", timeStyle: "short" })}</p>
          {draft.operation === "lesson_request_reject_v1" && <p>{draft.input.reason}</p>}
          {"window_exception" in draft.input && draft.input.window_exception && (
            <p>
              {t("windowException")}: {draft.input.reason}
            </p>
          )}
          {draft.operation === "lesson_request_approve_v1" && (
            <p>
              {t("category")}:{" "}
              {draft.input.booking_category ? t(draft.input.booking_category) : t("noCategory")}
            </p>
          )}

          <p>{t(action === "approve" ? "approvalHint" : "requestHint")}</p>
        </ConfirmWrite>
      )}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={docs}
        onClick={() => setDocs((value) => !value)}
      >
        {t("documents")}
      </Button>
      {docs && (
        <ContextDocuments
          actorId={scope.actorId}
          actions={api.documents}
          query={{
            org_id: scope.orgId,
            center_id: scope.centerId,
            person_id: row.person_id,
            context: { gate: "reservation", subject: { type: "lesson_requests", id: row.id } },
          }}
        />
      )}
    </div>
  );
}
