"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { v7, validate as isUuid } from "uuid";
import type { ChangeScope, Preview, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { applySessionChange, getSessionChangeStatus, previewSessionChange } from "../../lib/api";
import {
  changeError,
  changePatch,
  localDateTime,
  localTimeChoices,
  uncertainChange,
} from "../../lib/session-change";

type Pending = { operation_key: string; preview: { id: string; token: string } };
type Props = {
  session: SessionView;
  orgId: string;
  actorId: string;
  timeZone: string;
  onClose: () => void;
  onSaved: () => void;
};
export type SessionChangeActions = {
  preview: typeof previewSessionChange;
  apply: typeof applySessionChange;
  status: typeof getSessionChangeStatus;
};
const liveActions: SessionChangeActions = {
  preview: previewSessionChange,
  apply: applySessionChange,
  status: getSessionChangeStatus,
};
type Stage =
  | { phase: "edit" | "previewing"; error?: string }
  | { phase: "review"; preview: Preview; operationKey: string; error?: string }
  | {
      phase: "applying" | "uncertain" | "checking";
      pending: Pending;
      error?: string;
      expired?: boolean;
    }
  | { phase: "success" | "storageInvalid" };

function recover(key: string): Stage {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { phase: "edit" };
    const value = JSON.parse(raw) as Partial<Pending>;
    if (
      typeof value.operation_key !== "string" ||
      !isUuid(value.operation_key) ||
      typeof value.preview?.id !== "string" ||
      !isUuid(value.preview.id) ||
      typeof value.preview.token !== "string" ||
      !value.preview.token
    )
      return { phase: "storageInvalid" };
    return {
      phase: "uncertain",
      pending: { operation_key: value.operation_key, preview: value.preview },
    };
  } catch {
    return { phase: "storageInvalid" };
  }
}

// Mounted by an explicit user action; pending commands survive refresh in this tab.
export function SessionChange(props: Props) {
  return <SessionChangeFlow {...props} actions={liveActions} />;
}

export function SessionChangeFlow({
  session,
  orgId,
  actorId,
  timeZone,
  onClose,
  onSaved,
  actions,
}: Props & { actions: SessionChangeActions }) {
  const t = useTranslations("sessionChange");
  const locale = useLocale();
  const storageKey = `ftksaas:session-change:${actorId}:${orgId}:${session.id}`;
  const [stage, setStage] = useState<Stage>(() => recover(storageKey));
  const locked = useRef(false);
  const [start, setStart] = useState(() => localDateTime(session.starts_at, timeZone));
  const [end, setEnd] = useState(() => localDateTime(session.ends_at, timeZone));
  const [startChoice, setStartChoice] = useState(session.starts_at);
  const [endChoice, setEndChoice] = useState(session.ends_at);
  const [total, setTotal] = useState(String(session.capacity.total));
  const [categories, setCategories] = useState(!!session.capacity.categories);
  const [male, setMale] = useState(String(session.capacity.categories?.male ?? ""));
  const [female, setFemale] = useState(String(session.capacity.categories?.female ?? ""));
  const [scope, setScope] = useState<ChangeScope>("single");
  const [reason, setReason] = useState("");
  const starts = localTimeChoices(start, timeZone);
  const ends = localTimeChoices(end, timeZone);
  const chosen = (choices: typeof starts, value: string) =>
    choices.length === 1
      ? choices[0].instant
      : choices.find(
          (choice) =>
            Math.floor(Date.parse(choice.instant) / 1000) === Math.floor(Date.parse(value) / 1000),
        )?.instant;
  const message = (code: string) =>
    t(t.has(`errors.${code}`) ? `errors.${code}` : "errors.unknown");
  const dateTime = (instant: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
      hourCycle: "h23",
    }).format(new Date(instant));
  const busy = ["previewing", "applying", "checking"].includes(stage.phase);
  function clearPending() {
    sessionStorage.removeItem(storageKey);
  }

  async function preview(event: FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    // An untouched field must preserve the backend instant, including fractional seconds.
    const from =
      start === localDateTime(session.starts_at, timeZone) && startChoice === session.starts_at
        ? session.starts_at
        : chosen(starts, startChoice);
    const to =
      end === localDateTime(session.ends_at, timeZone) && endChoice === session.ends_at
        ? session.ends_at
        : chosen(ends, endChoice);
    const count = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
    if (!from || !to || Date.parse(from) >= Date.parse(to)) {
      setStage({ phase: "edit", error: "invalidTime" });
      return;
    }
    if (!count(total) || (categories && (!count(male) || !count(female))) || !reason.trim()) {
      setStage({ phase: "edit", error: "invalidForm" });
      return;
    }
    const patch = changePatch(session, from, to, {
      total: Number(total),
      categories: categories ? { male: Number(male), female: Number(female) } : null,
    });
    if (!Object.keys(patch).length) {
      setStage({ phase: "edit", error: "noChanges" });
      return;
    }
    locked.current = true;
    setStage({ phase: "previewing" });
    try {
      const result = await actions.preview({
        org_id: orgId,
        session_id: session.id,
        patch,
        scope,
        reason: reason.trim(),
      });
      setStage({ phase: "review", preview: result, operationKey: v7() });
    } catch (error) {
      setStage({ phase: "edit", error: changeError(error) });
    } finally {
      locked.current = false;
    }
  }
  async function apply(pending: Pending, recovering = false) {
    if (locked.current) return;
    // Save before sending. If durable recovery is unavailable, do not send a command.
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pending));
    } catch {
      setStage({ phase: "storageInvalid" });
      return;
    }
    locked.current = true;
    setStage({ phase: "applying", pending });
    try {
      await actions.apply({ org_id: orgId, ...pending });
      clearPending();
      setStage({ phase: "success" });
    } catch (error) {
      if (recovering || uncertainChange(error))
        setStage({
          phase: "uncertain",
          pending,
          error: changeError(error),
          expired: ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(
            changeError(error),
          ),
        });
      else {
        clearPending();
        setStage({ phase: "edit", error: changeError(error) });
      }
    } finally {
      locked.current = false;
    }
  }
  async function check(pending: Pending) {
    if (locked.current) return;
    locked.current = true;
    setStage({ phase: "checking", pending });
    try {
      const result = await actions.status(orgId, pending.operation_key);
      if (result.operation !== "session_change_apply_v1" || result.key !== pending.operation_key)
        throw new Error("Unexpected operation status");
      if (
        result.status === "succeeded" &&
        result.result_reference?.type === "sessions" &&
        result.result_reference.id === session.id
      ) {
        clearPending();
        setStage({ phase: "success" });
      } else if (result.status === "failed_final") {
        clearPending();
        setStage({ phase: "edit", error: "failedFinal" });
      } else
        setStage({
          phase: "uncertain",
          pending,
          expired: result.status === "result_expired",
          error: result.status,
        });
    } catch (error) {
      setStage({ phase: "uncertain", pending, error: changeError(error) });
    } finally {
      locked.current = false;
    }
  }
  const timeField = (kind: "start" | "end") => {
    const choices = kind === "start" ? starts : ends;
    const value = kind === "start" ? start : end;
    const choice = kind === "start" ? startChoice : endChoice;
    return (
      <div className="min-w-0 space-y-2">
        <Label htmlFor={`change-${kind}`}>{t(kind)}</Label>
        <Input
          id={`change-${kind}`}
          type="datetime-local"
          step="1"
          required
          value={value}
          className="h-auto min-h-11 min-w-0 max-w-full py-2"
          onChange={(event) => {
            if (kind === "start") {
              setStart(event.target.value);
              setStartChoice("");
            } else {
              setEnd(event.target.value);
              setEndChoice("");
            }
          }}
        />
        {choices.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor={`offset-${kind}`}>{t("ambiguousTime")}</Label>
            <select
              id={`offset-${kind}`}
              className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
              required
              value={chosen(choices, choice) ?? ""}
              onChange={(event) =>
                kind === "start"
                  ? setStartChoice(event.target.value)
                  : setEndChoice(event.target.value)
              }
            >
              <option value="">{t("chooseOffset")}</option>
              {choices.map((item) => (
                <option
                  key={item.instant}
                  value={item.instant}
                >{`UTC${item.offsetMinutes < 0 ? "−" : "+"}${String(Math.floor(Math.abs(item.offsetMinutes) / 60)).padStart(2, "0")}:${String(Math.abs(item.offsetMinutes) % 60).padStart(2, "0")}`}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };
  return (
    <section aria-labelledby="session-change-title" className="min-w-0 space-y-6 wrap-anywhere">
      <div className="space-y-2">
        <h2 id="session-change-title" className="text-xl font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("hint", { timezone: timeZone })}
        </p>
      </div>
      {"error" in stage && stage.error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
          {message(stage.error)}
        </p>
      )}
      {(stage.phase === "edit" || stage.phase === "previewing") && (
        <form onSubmit={preview} className="space-y-5" aria-busy={busy}>
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <legend className="sr-only">{t("title")}</legend>
            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              {timeField("start")}
              {timeField("end")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-total">{t("total")}</Label>
              <Input
                id="change-total"
                type="number"
                min="0"
                step="1"
                required
                value={total}
                onChange={(event) => setTotal(event.target.value)}
              />
              <p className="text-xs leading-5 text-muted-foreground">{t("capacityHint")}</p>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={categories}
                onChange={(event) => setCategories(event.target.checked)}
                className="size-4 shrink-0"
              />
              {t("categories")}
            </label>
            {categories && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="change-male">{t("male")}</Label>
                  <Input
                    id="change-male"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={male}
                    onChange={(event) => setMale(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="change-female">{t("female")}</Label>
                  <Input
                    id="change-female"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={female}
                    onChange={(event) => setFemale(event.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="change-scope">{t("scope")}</Label>
              <select
                id="change-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as ChangeScope)}
                className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
              >
                <option value="single">{t("single")}</option>
                <option value="this_and_future">{t("future")}</option>
              </select>
              <p className="text-xs leading-5 text-muted-foreground">{t("scopeHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">{t("reason")}</Label>
              <textarea
                id="change-reason"
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full min-w-0 rounded-md border bg-background p-3 text-sm"
              />
            </div>
          </fieldset>
          <Button
            type="submit"
            disabled={busy}
            className="h-auto min-h-11 max-w-full whitespace-normal"
          >
            {t(busy ? "previewing" : "preview")}
          </Button>
        </form>
      )}
      {stage.phase === "review" && (
        <div className="space-y-5">
          <h3 className="font-medium">
            {t("affected", { count: stage.preview.sessions?.length ?? 0 })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("expires", { time: dateTime(stage.preview.expires_at) })}
          </p>
          <ul className="divide-y rounded-xl border px-4">
            {stage.preview.sessions?.map((item) => (
              <li key={item.session_id} className="space-y-2 py-4 text-sm">
                <p className="font-medium">
                  {dateTime(item.interval.starts_at)} – {dateTime(item.interval.ends_at)}
                </p>
                <p>{t("previewCapacity", { count: item.capacity.total })}</p>
                {item.capacity.categories && (
                  <p>{t("previewCategories", { ...item.capacity.categories })}</p>
                )}
              </li>
            ))}
          </ul>
          {!!stage.preview.blockers.length && (
            <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4">
              <p className="font-medium">{t("blocked")}</p>
              <ul className="list-inside list-disc space-y-2 text-sm">
                {stage.preview.blockers.map((error, index) => (
                  <li key={index}>{message(error.code)}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setStage({ phase: "edit" })}
              className="h-auto min-h-11 max-w-full whitespace-normal"
            >
              {t("edit")}
            </Button>
            <Button
              disabled={stage.preview.blockers.length > 0 || !stage.preview.sessions?.length}
              className="h-auto min-h-11 max-w-full whitespace-normal"
              onClick={() => {
                if (Date.parse(stage.preview.expires_at) <= Date.now()) {
                  setStage({ phase: "edit", error: "PREVIEW_STALE" });
                  return;
                }
                void apply({
                  operation_key: stage.operationKey,
                  preview: { id: stage.preview.id, token: stage.preview.token },
                });
              }}
            >
              {t("apply")}
            </Button>
          </div>
        </div>
      )}
      {["applying", "checking"].includes(stage.phase) && (
        <output className="block text-sm" aria-live="polite">
          {t(stage.phase === "applying" ? "applying" : "checking")}
        </output>
      )}
      {stage.phase === "uncertain" && (
        <div className="space-y-4 rounded-xl border p-5">
          <h3 className="font-medium">{t("uncertain")}</h3>
          <p className="text-sm leading-6">{t("uncertainHint")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void check(stage.pending)}
              className="h-auto min-h-11 max-w-full whitespace-normal"
            >
              {t("check")}
            </Button>
            {!stage.expired && (
              <Button
                variant="outline"
                onClick={() => void apply(stage.pending, true)}
                className="h-auto min-h-11 max-w-full whitespace-normal"
              >
                {t("retrySame")}
              </Button>
            )}
          </div>
        </div>
      )}
      {stage.phase === "success" && (
        <div className="space-y-4 rounded-xl border p-5">
          <output className="block font-medium" aria-live="polite">
            {t("saved")}
          </output>
          <Button onClick={onSaved} className="h-auto min-h-11 max-w-full whitespace-normal">
            {t("viewCurrent")}
          </Button>
        </div>
      )}
      {stage.phase === "storageInvalid" && (
        <p role="alert" className="rounded-xl border p-5 text-sm leading-6">
          {t("storageInvalid")}
        </p>
      )}
      {stage.phase !== "success" && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={onClose}
          className="h-auto min-h-11 max-w-full whitespace-normal"
        >
          {t(stage.phase === "uncertain" ? "later" : "cancel")}
        </Button>
      )}
    </section>
  );
}
