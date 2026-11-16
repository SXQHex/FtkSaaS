import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { AutomationJobView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { readWorkspace } from "../workspace/workspace";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventActionDialog } from "../events/event-action-dialog";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { AutomationView, type AutomationTab } from "./automation-view";
import { AutomationEditor, type AutomationEditorProps } from "./automation-editor";
import {
  readAutomations,
  readSegments,
  automationIntent,
  writeAutomation,
  readAutomationReceipt,
  readAutomationResult,
  type AutomationRecord,
} from "./automation";
import { segmentDraft } from "./automation-form";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function AutomationContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    router = useRouter();
  const [tab, setTab] = useState<AutomationTab>("automations"),
    [autoCursors, setAutoCursors] = useState<(string | undefined)[]>([undefined]),
    [autoIndex, setAutoIndex] = useState(0),
    [segmentCursors, setSegmentCursors] = useState<(string | undefined)[]>([undefined]),
    [segmentIndex, setSegmentIndex] = useState(0),
    [jobsFor, setJobsFor] = useState(""),
    [selection, setSelection] = useState<AutomationEditorProps["selection"]>(),
    [action, setAction] = useState<{
      before: AutomationRecord;
      enabled?: boolean;
      retry?: AutomationJobView;
    }>(),
    [locked, setLocked] = useState(false),
    [notice, setNotice] = useState<string>();
  const prefix = ["automation", scope.accountId, scope.orgId, scope.centerId];
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const autos = useQuery({
    queryKey: [...prefix, "automations", autoCursors[autoIndex]],
    queryFn: async () => {
      const page = await readAutomations(scope, undefined, autoCursors[autoIndex]);
      if (page.next_cursor && autoCursors.includes(page.next_cursor))
        throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      return page;
    },
    enabled: !!center,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const segments = useQuery({
    queryKey: [...prefix, "segments", segmentCursors[segmentIndex]],
    queryFn: async () => {
      const page = await readSegments(scope, undefined, segmentCursors[segmentIndex]);
      if (page.next_cursor && segmentCursors.includes(page.next_cursor))
        throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      return page;
    },
    enabled: !!center,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const jobsSource = useQuery({
    queryKey: [...prefix, "jobs", jobsFor],
    queryFn: () => readAutomations(scope, jobsFor),
    enabled: !!center && !!jobsFor,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        queries.removeQueries({ queryKey: ["automation", scope.accountId] });
        queries.removeQueries({ queryKey: ["automation-segment-choices", scope.accountId] });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId],
  );
  useEffect(() => {
    for (const cause of [workspace.error, autos.error, segments.error, jobsSource.error])
      if (cause) accessLost(cause);
  }, [workspace.error, autos.error, segments.error, jobsSource.error, accessLost]);
  const pending = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  async function refresh() {
    await Promise.all([
      queries.invalidateQueries({ queryKey: prefix }),
      queries.invalidateQueries({
        queryKey: ["automation-segment-choices", scope.accountId, scope.orgId, scope.centerId],
      }),
    ]);
  }
  const unknown = t(($) => $.automation.unknown),
    format = center
      ? new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: center.timezone,
        })
      : undefined;
  const jobRecord = !jobsSource.isError ? jobsSource.data?.items[0] : undefined;
  const jobRows = jobRecord?.jobs?.map((row) => ({
    id: row.id,
    automationId: jobRecord.id,
    automation: jobRecord.definition.name,
    when: row.next_attempt_at
      ? `${t(($) => $.automation.nextAttempt)} ${format!.format(new Date(row.next_attempt_at))}`
      : unknown,
    initiator: unknown,
    state: t(($) => $.automation.jobStates[row.state]),
    targets: unknown,
    emailAccepted:
      jobRecord.definition.action.channel === "in_app"
        ? t(($) => $.automation.notApplicable)
        : unknown,
    delivery:
      jobRecord.definition.action.channel === "in_app"
        ? t(($) => $.automation.notApplicable)
        : unknown,
    canRetry: row.retry_available && row.state === "failed",
  }));
  const pagination =
    tab === "jobs" ? (
      <Field className="w-full max-w-sm">
        <FieldLabel htmlFor="automation-job-target">{t(($) => $.automation.jobsFor)}</FieldLabel>
        <NativeSelect
          id="automation-job-target"
          value={jobsFor}
          disabled={locked || autos.isFetching || autos.isError}
          onChange={(event) => setJobsFor(event.target.value)}
        >
          <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
          {autos.data?.items.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.definition.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    ) : (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          isDisabled={
            locked ||
            (tab === "segments"
              ? segments.isFetching || segmentIndex === 0
              : autos.isFetching || autoIndex === 0)
          }
          onPress={() => {
            if (tab === "segments") setSegmentIndex((value) => value - 1);
            else setAutoIndex((value) => value - 1);
          }}
        >
          {t(($) => $.people.previous)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          isDisabled={
            locked ||
            (tab === "segments"
              ? segments.isFetching || segments.isError || !segments.data?.next_cursor
              : autos.isFetching || autos.isError || !autos.data?.next_cursor)
          }
          onPress={() => {
            if (tab === "segments") {
              const next = segments.data?.next_cursor;
              if (next && !segmentCursors.includes(next)) {
                setSegmentCursors([...segmentCursors.slice(0, segmentIndex + 1), next]);
                setSegmentIndex((value) => value + 1);
              }
            } else {
              const next = autos.data?.next_cursor;
              if (next && !autoCursors.includes(next)) {
                setAutoCursors([...autoCursors.slice(0, autoIndex + 1), next]);
                setAutoIndex((value) => value + 1);
              }
            }
          }}
        >
          {t(($) => $.people.next)}
        </Button>
      </div>
    );
  return (
    <>
      <AutomationView
        tab={tab}
        onTab={(value) => {
          if (!locked) {
            setTab(value);
            setNotice(undefined);
          }
        }}
        automations={
          !autos.isError
            ? (autos.data?.items.map((row) => ({
                id: row.id,
                name: row.definition.name,
                trigger: t(($) => $.automation.triggers[row.definition.trigger.kind]),
                action:
                  row.definition.action.channel === "email"
                    ? t(($) => $.automation.actions.email)
                    : row.definition.action.kind === "create_followup"
                      ? t(($) => $.automation.followup)
                      : t(($) => $.automation.actions.inbox),
                lastJob: row.jobs?.[0]
                  ? t(($) => $.automation.jobStates[row.jobs![0]!.state])
                  : unknown,
                enabled: row.definition.enabled,
                canRun: false,
              })) ?? null)
            : null
        }
        segments={
          !segments.isError
            ? (segments.data?.items.map((row) => ({
                id: row.id,
                name: row.name,
                conditions:
                  row.definition.all
                    ?.map((condition) =>
                      condition.field === "remaining_credits" &&
                      condition.operator === "lte" &&
                      typeof condition.value === "number"
                        ? `${t(($) => $.automation.conditions.remaining)} ≤ ${condition.value}`
                        : condition.field === "active_student" && condition.value === true
                          ? t(($) => $.automation.activeMembers)
                          : t(($) => $.automation.existingCondition),
                    )
                    .join(" · ") || t(($) => $.automation.existingCondition),
                members: unknown,
                usedBy: unknown,
              })) ?? null)
            : null
        }
        jobs={jobRows ?? null}
        jobsPlaceholder={
          <p>
            {!jobsFor
              ? t(($) => $.automation.chooseJobs)
              : jobsSource.isError
                ? t(($) => $.automation.readError)
                : jobRecord && jobRecord.jobs === undefined
                  ? t(($) => $.automation.unknown)
                  : t(($) => $.automation.loading)}
          </p>
        }
        locked={locked}
        pagination={pagination}
        onAdd={() => {
          if (!locked) setSelection({ kind: tab === "segments" ? "segment" : "automation" });
        }}
        onEdit={(id) => {
          if (!locked) {
            const row = autos.data?.items.find((value) => value.id === id);
            if (row) setSelection({ kind: "automation", before: structuredClone(row) });
          }
        }}
        onSegment={(id) => {
          if (locked) return;
          const row = segments.data?.items.find((value) => value.id === id);
          if (!row) return;
          if (!segmentDraft(row)) {
            setNotice(t(($) => $.automation.conditionUnsupported));
            return;
          }
          setSelection({ kind: "segment", before: structuredClone(row) });
        }}
        onToggle={(id, enabled) => {
          if (!locked) {
            const row = autos.data?.items.find((value) => value.id === id);
            if (row) setAction({ before: structuredClone(row), enabled });
          }
        }}
        onRun={() => {}}
        onRetry={(automationId, id) => {
          if (!locked && jobRecord?.id === automationId) {
            const row = jobRecord.jobs?.find((value) => value.id === id);
            if (row?.retry_available)
              setAction({ before: structuredClone(jobRecord), retry: structuredClone(row) });
          }
        }}
        notice={
          <>
            <Alert>
              <AlertDescription>
                {t(($) => $.automation.nativeLimit)} {t(($) => $.automation.jobsLimit)}
              </AlertDescription>
            </Alert>
            {notice && (
              <Alert>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {(autos.isError || segments.isError || jobsSource.isError) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t(($) => $.automation.readError)}
                  <Button
                    variant="outline"
                    isDisabled={locked}
                    onPress={() => {
                      void refresh();
                    }}
                  >
                    {t(($) => $.auth.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </>
        }
      />
      {selection && center && (
        <AutomationEditor
          key={`${selection.kind}:${selection.before?.id ?? "new"}`}
          scope={scope}
          selection={selection}
          ownPersonId={workspace.data?.selected?.self_context?.person_id}
          centerName={center.name}
          onSaved={refresh}
          onClose={() => {
            if (!locked) {
              setSelection(undefined);
              void refresh();
            }
          }}
          onLockChange={pending}
          onAccessLost={accessLost}
        />
      )}
      {action && (
        <AutomationAction
          key={`${action.before.id}:${action.retry?.id ?? "toggle"}`}
          scope={scope}
          before={action.before}
          enabled={action.enabled}
          retryJob={action.retry}
          onSaved={refresh}
          onClose={() => {
            if (!locked) {
              setAction(undefined);
              void refresh();
            }
          }}
          onLockChange={pending}
          onAccessLost={accessLost}
        />
      )}
    </>
  );
}
function AutomationAction({
  scope,
  before,
  enabled,
  retryJob,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  before: AutomationRecord;
  enabled?: boolean;
  retryJob?: AutomationJobView;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    [reviewed, setReviewed] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>(),
    running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeAutomation,
    readReceipt: readAutomationReceipt,
    readResult: readAutomationResult,
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
  async function confirm() {
    if (running.current || locked || !reviewed || command.state !== "ready") return;
    running.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await automationIntent(
        scope,
        { ...structuredClone(before.definition), ...(enabled !== undefined ? { enabled } : {}) },
        true,
        before,
        retryJob,
      );
      if (mounted.current) await command.start(intent);
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.automation.invalid),
        );
    } finally {
      running.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const title = retryJob
    ? t(($) => $.automation.retry)
    : enabled
      ? t(($) => $.automation.enable)
      : t(($) => $.automation.disable);
  return (
    <EventActionDialog
      title={title}
      description={
        <>
          {before.definition.name}
          <span className="mt-2 block">
            {retryJob ? t(($) => $.automation.retryHint) : t(($) => $.automation.toggleHint)}
          </span>
        </>
      }
      confirmLabel={title}
      reason=""
      onReason={() => {}}
      reviewed={reviewed}
      onReviewed={setReviewed}
      onConfirm={() => {
        void confirm();
      }}
      onClose={onClose}
      locked={locked}
      disabled={command.state !== "ready"}
      error={error}
      notice={<EventCommandNotice command={command} onReload={onClose} />}
    />
  );
}
