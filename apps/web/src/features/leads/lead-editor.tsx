import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { ClientScope } from "../../lib/scoped-backend";
import type { CrmPipelineConfiguration, PersonSummary } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readPerson } from "../people/people";
import { getTemporal } from "../../lib/temporal";
import { ScheduleTimeError } from "../schedule/schedule-time";
import { PreparationPicker } from "../settings/preparation-picker";
import { LeadTrialEditor } from "./lead-trial-editor";
import { LeadSheet } from "./lead-sheet";
import { LeadPersonPicker } from "./lead-person-picker";
import { LeadCommandNotice } from "./lead-command-notice";
import { LeadActivitiesView } from "./lead-lists";
import { readLeadDetail, readLeadActivities, type LeadDetail } from "./leads-read";
import {
  leadDraft,
  personIntent,
  leadSaveIntent,
  leadActivityIntent,
  leadConvertIntent,
  writeLeadIntent,
  readLeadReceipt,
  readLeadResult,
} from "./leads-command";
import type { LeadMode, LeadDraft } from "./lead-draft";
import { Field, FieldGroup, FieldLabel, FieldError } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Button } from "@ftksaas/ui/components/button";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
export interface LeadTarget {
  id: string;
  personId: string;
  name: string;
  mode?: LeadMode;
  stage?: string;
  activityId?: string;
}
export function LeadEditor({
  scope,
  target,
  catalog,
  advanced = true,
  owners = [],
  assignmentWritable = false,
  timezone,
  onClose,
  onSaved,
  onLockChange,
}: {
  scope: ClientScope;
  target: LeadTarget | null;
  catalog?: CrmPipelineConfiguration;
  advanced?: boolean;
  owners?: { id: string; name: string }[];
  assignmentWritable?: boolean;
  timezone: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const detail = useQuery({
    queryKey: [
      "lead-detail",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      target?.id,
      target?.activityId,
    ],
    queryFn: async (context) => {
      const lead = await readLeadDetail(scope, target!.personId, target!.id, context);
      const page = target?.activityId
        ? await readLeadActivities(scope, lead.id, undefined, target.activityId, context)
        : undefined;
      if (page && (page.items.length !== 1 || page.items[0]?.id !== target?.activityId))
        throw new Error("ACTIVITY_SOURCE_UNAVAILABLE");
      const activity = page?.items[0];
      return {
        lead,
        activity,
        draft: activity ? await activityDraft(lead, activity, timezone) : undefined,
      };
    },
    enabled: Boolean(target),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  if (target && (!detail.isFetchedAfterMount || !detail.data))
    return (
      <LeadSheet
        mode={target.mode ?? "edit"}
        advanced={advanced}
        name={target.name}
        draft={leadDraft()}
        stages={catalog?.stages ?? []}
        tags={[]}
        owners={[]}
        products={[]}
        sessions={[]}
        offers={[]}
        readOnly
        onClose={onClose}
        recovery={
          detail.isPending || detail.isFetching ? (
            <Skeleton className="h-40" />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.leads.readFailed)}{" "}
                <Button variant="outline" onPress={() => void detail.refetch()}>
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )
        }
      />
    );
  return (
    <LeadEditorForm
      scope={scope}
      initial={target ? detail.data?.lead : undefined}
      initialActivity={target ? detail.data?.activity : undefined}
      initialDraft={target ? detail.data?.draft : undefined}
      readError={detail.isError}
      onReadRetry={
        target
          ? async () => {
              const result = await detail.refetch({ throwOnError: true });
              if (!result.data) throw new Error("LEAD_DETAIL_UNAVAILABLE");
              return result.data.lead;
            }
          : undefined
      }
      target={target}
      catalog={catalog}
      advanced={advanced}
      owners={owners}
      assignmentWritable={assignmentWritable}
      timezone={timezone}
      onClose={onClose}
      onSaved={onSaved}
      onLockChange={onLockChange}
    />
  );
}
function LeadEditorForm({
  scope,
  initial,
  initialActivity,
  initialDraft,
  target,
  catalog,
  advanced,
  owners,
  assignmentWritable,
  timezone,
  onClose,
  onSaved,
  onLockChange,
  readError,
  onReadRetry,
}: {
  readError: boolean;
  onReadRetry?: () => Promise<LeadDetail>;
  scope: ClientScope;
  initial?: LeadDetail;
  initialActivity?: Awaited<ReturnType<typeof readLeadActivities>>["items"][number];
  initialDraft?: LeadDraft;
  target: LeadTarget | null;
  catalog?: CrmPipelineConfiguration;
  advanced: boolean;
  owners: { id: string; name: string }[];
  assignmentWritable: boolean;
  timezone: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [before, setBefore] = useState(initial),
    [mode, setMode] = useState<LeadMode>(target?.mode ?? "edit"),
    [draft, setDraft] = useState<LeadDraft>(() => ({
      ...(initialDraft ?? leadDraft(initial)),
      ...(target?.stage ? { stageKey: target.stage, lossReason: "" } : {}),
    }));
  const [selected, setSelected] = useState<PersonSummary | null>(null),
    [personKind, setPersonKind] = useState("new"),
    [personCreated, setPersonCreated] = useState(false),
    [personDraft, setPersonDraft] = useState({ name: "", email: "", phone: "" });
  const [preparing, setPreparing] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Partial<Record<string, string>>>({}),
    [offsets, setOffsets] = useState<{ id: string; label: string }[]>([]),
    [activityCursor, setActivityCursor] = useState<string>();
  const [activity, setActivity] = useState<
    Awaited<ReturnType<typeof readLeadActivities>>["items"][number] | undefined
  >(initialActivity);
  const actionRef = useRef(false),
    errorRef = useRef<HTMLDivElement>(null);
  const history = useQuery({
    queryKey: [
      "lead-activities",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      before?.id,
      activityCursor,
    ],
    queryFn: (context) => readLeadActivities(scope, before!.id, activityCursor, undefined, context),
    enabled: Boolean(before),
    retry: false,
  });
  const command = useMemberCommand({
    write: writeLeadIntent,
    readReceipt: readLeadReceipt,
    readResult: readLeadResult,
    onRefresh: async (result) => {
      if (result.kind === "person") {
        setSelected(result.person);
        setPersonCreated(true);
        return;
      }
      if (result.kind === "lead") {
        setBefore(result.detail);
        setDraft(leadDraft(result.detail));
      }
      if (result.kind === "activity" && before) {
        const current = await readLeadDetail(scope, before.personId, before.id);
        setBefore(current);
        await history.refetch({ throwOnError: true });
      }
      await onSaved();
    },
    onAccessLost: (error) => {
      const lost =
        (error instanceof Error && ["ACCOUNT_CHANGED", "AUTH_REQUIRED"].includes(error.message)) ||
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code));
      if (lost) void router.invalidate();
      return lost;
    },
  });
  const locked = preparing || command.locked;
  useBlocker({
    shouldBlockFn: () => actionRef.current,
    enableBeforeUnload: preparing,
    disabled: !preparing,
  });
  async function reload() {
    if (locked) return;
    setPreparing(true);
    try {
      if (before) {
        const current = onReadRetry
          ? await onReadRetry()
          : await readLeadDetail(scope, before.personId, before.id);
        setBefore(current);
        if (mode === "activity" && activity) {
          const page = await readLeadActivities(scope, current.id, undefined, activity.id);
          if (page.items.length !== 1) throw new Error("ACTIVITY_SOURCE_UNAVAILABLE");
          await applyActivity(page.items[0], current);
        } else setDraft(leadDraft(current));
        await onSaved();
      } else if (selected) setSelected(await readPerson(scope, selected.id));
      command.reset();
      setError("");
      setErrors({});
    } catch {
      invalid(t(($) => $.leads.readFailed));
    } finally {
      setPreparing(false);
    }
  }
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const canSubmit =
    command.state === "ready" &&
    (assignmentWritable || draft.assignedTo === (before?.values.assigned_to ?? "")) &&
    !readError &&
    !command.unavailable &&
    !(mode === "offer" || mode === "confirm") &&
    (!before || before.state === "open");
  function invalid(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLElement>('#lead-form [aria-invalid="true"]');
      (input ?? errorRef.current)?.focus();
    });
  }
  async function submit() {
    if (actionRef.current || !canSubmit) return;
    actionRef.current = true;
    setPreparing(true);
    setError("");
    setErrors({});
    try {
      if (mode === "edit" && !before && !selected) {
        if (personKind === "existing") {
          invalid(t(($) => $.leads.personRequired));
          return;
        }
        await command.start(personIntent(scope, personDraft));
        return;
      }
      const personId = before?.personId ?? selected?.id;
      if (!personId) {
        invalid(t(($) => $.leads.personRequired));
        return;
      }
      if (mode === "edit" || mode === "stage") {
        if (mode === "stage" && !draft.reviewed) throw new Error("LEAD_REVIEW_REQUIRED");
        if (mode === "stage" && !draft.stageKey) throw new Error("LEAD_STAGE_REQUIRED");
        if (!before) await readPerson(scope, personId);
        await command.start(
          await leadSaveIntent(scope, personId, draft, catalog, before, assignmentWritable),
        );
      } else if (mode === "activity" && before)
        await command.start(await leadActivityIntent(scope, before, draft, timezone, activity));
      else if (mode === "convert" && before)
        await command.start(await leadConvertIntent(scope, before, draft.reviewed));
    } catch (error) {
      if (error instanceof ScheduleTimeError) {
        setOffsets(error.requests[0]?.choices ?? []);
        setDraft((value) => ({ ...value, dueOffset: "", reviewed: false }));
        setErrors({
          due: t(($) =>
            error.message === "SCHEDULE_TIME_GAP" ? $.leads.timeGap : $.leads.timeAmbiguous,
          ),
        });
      } else if (error instanceof z.ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) {
          const key = String(issue.path[0] ?? "interest");
          fields[key] = t(($) =>
            key === "email"
              ? $.auth.invalidEmail
              : key === "phone"
                ? $.profile.phoneInvalid
                : key === "lossReason"
                  ? $.leads.lossRequired
                  : $.leads.required,
          );
        }
        setErrors(fields);
      } else if (error instanceof BackendError && error.code === "VERSION_CONFLICT") {
        setDraft((value) => ({ ...value, reviewed: false }));
        invalid(t(($) => $.leads.sourceChanged));
        return;
      }
      invalid(t(($) => $.leads.validationFailed));
    } finally {
      actionRef.current = false;
      setPreparing(false);
    }
  }
  async function applyActivity(
    row: Awaited<ReturnType<typeof readLeadActivities>>["items"][number],
    source: LeadDetail,
  ) {
    if (!row.values.kind) throw new Error("ACTIVITY_SOURCE_UNAVAILABLE");
    setActivity(row);
    setMode("activity");
    setError("");
    setErrors({});
    setDraft(await activityDraft(source, row, timezone));
  }
  async function editActivity(id: string) {
    if (locked || command.state !== "ready") return;
    const row = history.data?.items.find((item) => item.id === id);
    if (!row || !before || !row.values.kind) return;
    setPreparing(true);
    try {
      await applyActivity(row, before);
    } catch {
      invalid(t(($) => $.leads.readFailed));
    } finally {
      setPreparing(false);
    }
  }
  const personFields = (
    <div className="flex flex-col gap-3">
      {!personCreated && (
        <ToggleGroup
          aria-label={t(($) => $.leads.personMode)}
          variant="outline"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([personKind])}
          isDisabled={locked || command.state !== "ready"}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (typeof next === "string") {
              setPersonKind(next);
              setSelected(null);
            }
          }}
        >
          <ToggleGroupItem id="new">{t(($) => $.leads.newPerson)}</ToggleGroupItem>
          <ToggleGroupItem id="existing">{t(($) => $.leads.existingPerson)}</ToggleGroupItem>
        </ToggleGroup>
      )}
      {selected ? (
        <Alert>
          <AlertDescription>
            {selected.display_name} ·{" "}
            {personCreated ? t(($) => $.leads.personCreated) : t(($) => $.leads.personSelected)}
          </AlertDescription>
        </Alert>
      ) : personKind === "existing" ? (
        <LeadPersonPicker
          scope={scope}
          selected={selected}
          onSelect={setSelected}
          disabled={locked || command.state !== "ready"}
        />
      ) : (
        <FieldGroup>
          {(["name", "email", "phone"] as const).map((key) => (
            <Field key={key} data-invalid={Boolean(errors[key])}>
              <FieldLabel htmlFor={`lead-person-${key}`}>
                {t(($) =>
                  key === "name"
                    ? $.people.fullName
                    : key === "email"
                      ? $.auth.email
                      : $.profile.contactPhone,
                )}
              </FieldLabel>
              <Input
                id={`lead-person-${key}`}
                name={key}
                autoComplete={key === "name" ? "name" : key === "email" ? "email" : "tel"}
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                required={key === "name"}
                value={personDraft[key]}
                disabled={locked || command.state !== "ready"}
                aria-invalid={Boolean(errors[key])}
                aria-describedby={`lead-person-${key}-error`}
                onChange={(event) => {
                  setPersonDraft({ ...personDraft, [key]: event.target.value });
                  setErrors({ ...errors, [key]: undefined });
                }}
              />
              <FieldError id={`lead-person-${key}-error`}>{errors[key]}</FieldError>
            </Field>
          ))}
        </FieldGroup>
      )}
    </div>
  );
  const historyRows = (history.isError ? [] : (history.data?.items ?? [])).map((row) => ({
    id: row.id,
    name: target?.name ?? selected?.display_name ?? "",
    kind: t(($) => $.leads.activityKinds[row.values.kind ?? "contact"]),
    note: row.values.note ?? null,
    due: row.values.due_at
      ? new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: timezone,
        }).format(new Date(row.values.due_at))
      : null,
    outcome: row.values.outcome ?? null,
    owner: before?.values.assigned_to ? t(($) => $.leads.assignmentPreserved) : null,
  }));
  if (before && (mode === "offer" || mode === "confirm"))
    return (
      <LeadTrialEditor
        key={`${before.id}:${mode}`}
        scope={scope}
        lead={before}
        mode={mode}
        name={target?.name}
        timezone={timezone}
        onClose={onClose}
        onSaved={onSaved}
        onLockChange={onLockChange}
      />
    );
  return (
    <LeadSheet
      mode={mode}
      advanced={advanced}
      name={before ? (target?.name ?? selected?.display_name) : undefined}
      draft={draft}
      onDraft={(value) => {
        if (!locked && command.state === "ready") {
          if (value.due !== draft.due) setOffsets([]);
          setDraft(value);
          setErrors({});
          setError("");
        }
      }}
      stages={catalog?.stages ?? []}
      tags={catalog?.tags ?? []}
      owners={
        before?.values.assigned_to && !owners.some((row) => row.id === before.values.assigned_to)
          ? [
              { id: before.values.assigned_to, name: t(($) => $.leads.assignmentPreserved) },
              ...owners,
            ]
          : owners
      }
      assignmentWritable={assignmentWritable}
      products={[]}
      sessions={[]}
      offers={[]}
      offsets={offsets}
      personPicker={
        !before ? (
          <>
            {personFields}
            <PreparationPicker
              scope={scope}
              kind="crm"
              disabled={locked || readError || command.state !== "ready"}
              onApply={(preparation) => {
                if (preparation.kind !== "crm") return;
                const { source, interest } = preparation.defaults;
                setDraft((current) => ({ ...current, source, interest, reviewed: false }));
                setErrors({});
                setError("");
              }}
            />
          </>
        ) : undefined
      }
      details={before ? <p>{target?.name}</p> : undefined}
      disabled={locked}
      readOnly={
        readError ||
        command.state !== "ready" ||
        Boolean(before && before.state !== "open") ||
        mode === "offer" ||
        mode === "confirm"
      }
      errors={errors}
      onSubmit={canSubmit ? () => void submit() : undefined}
      submitLabel={
        !before && !selected ? t(($) => $.leads.createPersonContinue) : t(($) => $.leads.save)
      }
      onClose={() => {
        if (!locked) onClose();
      }}
      onMode={(mode) => {
        if (locked || (!advanced && mode !== "activity")) return;
        command.reset();
        setActivity(undefined);
        setMode(mode);
        setDraft({ ...leadDraft(before), kind: "contact" });
        setErrors({});
        setError("");
      }}
      history={
        <>
          <LeadActivitiesView
            rows={historyRows}
            disabled={locked || command.state !== "ready"}
            onOpen={(id) => {
              void editActivity(id);
            }}
          />
          {history.isError && (
            <Button variant="outline" onPress={() => void history.refetch()}>
              {t(($) => $.auth.retry)}
            </Button>
          )}
          {history.data?.next_cursor && (
            <Button
              variant="outline"
              onPress={() => setActivityCursor(history.data?.next_cursor ?? undefined)}
            >
              {t(($) => $.people.next)}
            </Button>
          )}
        </>
      }
      recovery={
        <>
          {readError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.leads.readFailed)}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={locked}
                  onPress={() => void reload()}
                >
                  {t(($) => $.leads.reload)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert ref={errorRef} tabIndex={-1} variant="destructive">
              <AlertDescription>
                {error}{" "}
                {before && (
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={locked}
                    onPress={() => void reload()}
                  >
                    {t(($) => $.leads.reload)}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {(mode === "offer" || mode === "confirm") && (
            <Alert>
              <AlertDescription>{t(($) => $.leads.trialSourceMissing)}</AlertDescription>
            </Alert>
          )}
          <LeadCommandNotice
            command={command}
            onReload={() => {
              void reload();
            }}
          />
          {personCreated && !before && command.state === "saved" && (
            <Button onPress={() => command.reset()}>{t(($) => $.leads.continueLead)}</Button>
          )}
        </>
      }
    />
  );
}

async function activityDraft(
  source: LeadDetail,
  row: Awaited<ReturnType<typeof readLeadActivities>>["items"][number],
  timezone: string,
): Promise<LeadDraft> {
  if (!row.values.kind) throw new Error("ACTIVITY_SOURCE_UNAVAILABLE");
  const T = await getTemporal();
  const due = row.values.due_at
    ? T.Instant.from(row.values.due_at).toZonedDateTimeISO(timezone)
    : undefined;
  return {
    ...leadDraft(source),
    kind: row.values.kind,
    note: row.values.note ?? "",
    outcome: row.values.outcome ?? "",
    due: due?.toPlainDateTime().toString({ smallestUnit: "minute" }) ?? "",
    dueOffset: due?.offset ?? "",
  };
}
