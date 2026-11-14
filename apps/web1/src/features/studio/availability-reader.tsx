import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { AvailabilityPanel, type AvailabilityDraft } from "./availability-panel";
import {
  availabilityDraft,
  availabilityIntent,
  availabilityPeriod,
  loadAvailability,
  saveAvailabilityStep,
  type AvailabilityBase,
  type AvailabilityIntent,
} from "./availability-edit";
import type { StudioScope } from "./studio";
import type { StudioInstructor } from "./studio-view";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

type Notice =
  | "ready"
  | "loading"
  | "read-error"
  | "invalid"
  | "remove-unsupported"
  | "unknown"
  | "conflict"
  | "rejected"
  | "saved-unread"
  | "saved";

export function StudioAvailabilityReader({
  scope,
  instructors,
  onLockChange,
  onRefresh,
}: {
  scope: StudioScope;
  instructors: StudioInstructor[];
  onLockChange: (value: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [personId, setPersonId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [base, setBase] = useState<AvailabilityBase>();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice>("ready");
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const pending = useRef<AvailabilityIntent | undefined>(undefined);
  const nextStep = useRef(0);
  const accepted = useRef<string[]>([]);
  const targetPeriod = useRef("");
  const mounted = useRef(true);
  const lock = useRef(false);
  const generation = useRef(0);
  const errorSummary = useRef<HTMLDivElement>(null);
  const preventLeave = mutating || notice === "unknown" || notice === "saved-unread";
  const selected = instructors.some((item) => item.id === personId);
  const rows = selected ? base?.records : undefined;
  const periods = [...new Set(rows?.map(availabilityPeriod) ?? [])];
  const original = rows?.filter((item) => availabilityPeriod(item) === periodId) ?? [];
  const valuesKnown = Boolean(rows && (periodId === "new" || original.length));
  const editable = Boolean(
    valuesKnown && !busy && ["ready", "saved", "invalid", "remove-unsupported"].includes(notice),
  );
  const initialByInstructor = valuesKnown ? { [personId]: availabilityDraft(original) } : {};
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    onLockChange(preventLeave);
    return () => onLockChange(false);
  }, [preventLeave, onLockChange]);
  useBlocker({
    shouldBlockFn: () => Boolean(pending.current),
    enableBeforeUnload: preventLeave,
    disabled: !preventLeave,
  });
  async function selectPerson(id: string) {
    if (preventLeave) return;
    const current = ++generation.current;
    setPersonId(id);
    setPeriodId("");
    setBase(undefined);
    setProgress({ done: 0, total: 0 });
    pending.current = undefined;
    nextStep.current = 0;
    accepted.current = [];
    if (!id) {
      setNotice("ready");
      return;
    }
    setBusy(true);
    setNotice("loading");
    try {
      const result = await loadAvailability(scope, id);
      if (!mounted.current || current !== generation.current) return;
      setBase(result);
      setPeriodId(result.records.length ? "" : "new");
      setRevision((value) => value + 1);
      setNotice("ready");
    } catch {
      if (mounted.current && current === generation.current) setNotice("read-error");
    } finally {
      if (mounted.current && current === generation.current) setBusy(false);
    }
  }
  async function finishRead(discard = false) {
    const current = generation.current;
    const next = await loadAvailability(scope, personId);
    if (!discard && accepted.current.some((id) => !next.records.some((item) => item.id === id)))
      throw new Error("STUDIO_UNAVAILABLE");
    await onRefresh();
    if (!mounted.current || current !== generation.current) return;
    setBase(next);
    const wanted = discard ? periodId : targetPeriod.current;
    setPeriodId(
      next.records.some((item) => availabilityPeriod(item) === wanted)
        ? wanted
        : next.records.length
          ? ""
          : "new",
    );
    setRevision((value) => value + 1);
    pending.current = undefined;
    accepted.current = [];
    nextStep.current = 0;
    setProgress({ done: 0, total: 0 });
    setNotice(discard ? "ready" : "saved");
    requestAnimationFrame(() => errorSummary.current?.focus());
  }
  async function write(draft?: AvailabilityDraft) {
    if (lock.current || (!draft && !pending.current)) return;
    let intent = pending.current;
    if (draft) {
      if (!base || !editable) return;
      try {
        intent = availabilityIntent(base, periodId, draft);
      } catch (error) {
        setNotice(
          error instanceof Error && error.message === "AVAILABILITY_REMOVE_UNSUPPORTED"
            ? "remove-unsupported"
            : "invalid",
        );
        requestAnimationFrame(() => errorSummary.current?.focus());
        return;
      }
      targetPeriod.current = JSON.stringify([draft.validFrom, draft.validUntil || null]);
      nextStep.current = 0;
      accepted.current = [];
      pending.current = intent;
      setProgress({ done: 0, total: intent.steps.length });
    }
    if (!intent) return;
    lock.current = true;
    setBusy(true);
    setMutating(true);
    try {
      for (; nextStep.current < intent.steps.length;) {
        if (!mounted.current) return;
        const id = await saveAvailabilityStep(intent, nextStep.current);
        accepted.current.push(id);
        nextStep.current += 1;
        if (mounted.current) setProgress({ done: nextStep.current, total: intent.steps.length });
      }
      if (mounted.current) setNotice("saved-unread");
      await finishRead();
    } catch (error) {
      if (!mounted.current) return;
      if (nextStep.current === intent.steps.length) setNotice("saved-unread");
      else if (
        (error instanceof BackendError &&
          error.code !== "TRANSPORT_ERROR" &&
          (!error.retryable || error.code === "VERSION_CONFLICT")) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        setNotice(
          error instanceof BackendError && error.code === "VERSION_CONFLICT"
            ? "conflict"
            : "rejected",
        );
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setMutating(false);
      }
    }
  }
  async function reload() {
    if (lock.current) return;
    if (!base) {
      await selectPerson(personId);
      return;
    }
    lock.current = true;
    setBusy(true);
    const wasAcknowledged = notice === "saved-unread";
    try {
      await finishRead(!wasAcknowledged);
    } catch {
      if (mounted.current) setNotice(wasAcknowledged ? "saved-unread" : "read-error");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const message = !personId
    ? undefined
    : notice === "loading"
      ? t(($) => $.studio.loading)
      : notice === "read-error"
        ? t(($) => $.studio.resourceReadError)
        : notice === "invalid"
          ? t(($) => $.studio.availabilityInvalid)
          : notice === "remove-unsupported"
            ? t(($) => $.studio.availabilityRemoveUnsupported)
            : notice === "unknown"
              ? t(($) => $.studio.resourceUnknown)
              : notice === "conflict"
                ? t(($) => $.studio.availabilityConflict)
                : notice === "rejected"
                  ? t(($) => $.studio.availabilityRejected)
                  : notice === "saved-unread"
                    ? t(($) => $.studio.availabilitySavedUnread)
                    : notice === "saved"
                      ? t(($) => $.studio.availabilitySaved)
                      : !rows?.length
                        ? t(($) => $.studio.noAvailabilityRules)
                        : !periodId
                          ? t(($) => $.studio.chooseAvailabilityPeriod)
                          : t(($) => $.studio.availabilityWriteHint);
  return (
    <AvailabilityPanel
      key={`${personId}:${periodId}:${revision}`}
      selectedInstructor={personId}
      instructors={instructors}
      initialByInstructor={initialByInstructor}
      readOnly={!editable}
      locked={preventLeave || busy}
      loading={busy}
      valuesKnown={valuesKnown}
      onDirtyChange={setDirty}
      onSelectInstructor={(id) => {
        void selectPerson(id);
      }}
      onSave={(draft) => {
        void write(draft);
      }}
      notice={message}
      periodControl={
        <div className="flex flex-wrap items-end gap-3 px-5 pb-3">
          {base && (
            <Field className="w-full gap-1.5 sm:max-w-sm">
              <FieldLabel htmlFor="availability-period">
                {t(($) => $.studio.availabilityPeriod)}
              </FieldLabel>
              <NativeSelect
                id="availability-period"
                className="w-full"
                value={periodId}
                disabled={
                  dirty ||
                  busy ||
                  preventLeave ||
                  !["ready", "saved", "invalid", "remove-unsupported"].includes(notice)
                }
                onChange={(event) => {
                  setPeriodId(event.target.value);
                  setNotice("ready");
                }}
              >
                <option value="">{t(($) => $.studio.chooseAvailabilityPeriod)}</option>
                {periods.map((period) => {
                  const [from, until] = JSON.parse(period) as [string, string | null];
                  return (
                    <option key={period} value={period}>
                      {from} – {until ?? t(($) => $.studio.noEndDate)}
                    </option>
                  );
                })}
                <option value="new">{t(($) => $.studio.newAvailabilityPeriod)}</option>
              </NativeSelect>
            </Field>
          )}
          {["read-error", "rejected", "conflict", "saved-unread"].includes(notice) && (
            <Button
              variant="outline"
              isDisabled={busy}
              onPress={() => {
                void reload();
              }}
            >
              {notice === "conflict" || notice === "rejected"
                ? t(($) => $.studio.loadLatest)
                : t(($) => $.studio.retryRead)}
            </Button>
          )}
          {notice === "unknown" && (
            <Button
              variant="outline"
              isDisabled={busy}
              onPress={() => {
                void write();
              }}
            >
              {t(($) => $.studio.retrySameRequest)}
            </Button>
          )}
        </div>
      }
      footerContent={
        <div
          ref={errorSummary}
          tabIndex={-1}
          className="max-w-full focus-visible:outline-2 focus-visible:outline-ring"
          role="status"
        >
          {[
            "invalid",
            "remove-unsupported",
            "conflict",
            "rejected",
            "unknown",
            "saved-unread",
          ].includes(notice) && <p className="text-sm">{message}</p>}
          {progress.total > 0 && (
            <Alert>
              <AlertDescription>
                {t(($) => $.studio.availabilityProgress, progress)}
              </AlertDescription>
            </Alert>
          )}
        </div>
      }
    />
  );
}
