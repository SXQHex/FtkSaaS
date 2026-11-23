import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { AutomationJobView, JobState } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { capturePrivateReadback, invalidateCachedFamilies } from "../../lib/cache-invalidation";

import { useMemberCommand } from "../member-profile/use-member-command";
import { EventActionDialog } from "../events/event-action-dialog";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { AutomationView, type AutomationTab } from "./automation-view";
import { AutomationEditor, type AutomationEditorProps } from "./automation-editor";
import {
  readAutomations,
  automationAt,
  readSegments,
  automationIntent,
  writeAutomation,
  readAutomationReceipt,
  readAutomationResult,
  type AutomationRecord,
} from "./automation";
import { readAutomationQueue } from "./automation-discovery";
import { SegmentDiscovery } from "./segment-discovery";
import { segmentDraft } from "./automation-form";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
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
    [jobState, setJobState] = useState<JobState | "all">("all"),
    [jobCursors, setJobCursors] = useState<(string | undefined)[]>([undefined]),
    [jobIndex, setJobIndex] = useState(0),
    [discovery, setDiscovery] = useState<{
      id: string;
      name: string;
      mode: "matches" | "automations";
    }>(),
    [selection, setSelection] = useState<AutomationEditorProps["selection"]>(),
    [action, setAction] = useState<{
      before: AutomationRecord;
      enabled?: boolean;
      retry?: AutomationJobView;
    }>(),
    [locked, setLocked] = useState(false),
    [notice, setNotice] = useState<string>();
  const preflight = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const prefix = ["automation", scope.accountId, scope.orgId, scope.centerId];
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const autos = useQuery({
    queryKey: [...prefix, "automations", autoCursors[autoIndex]],
    queryFn: async (context) => {
      const page = await readAutomations(scope, undefined, autoCursors[autoIndex], context);
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
    queryFn: async (context) => {
      const page = await readSegments(scope, undefined, segmentCursors[segmentIndex], context);
      if (page.next_cursor && segmentCursors.includes(page.next_cursor))
        throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      return page;
    },
    enabled: !!center,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const jobsSource = useQuery({
    queryKey: [...prefix, "jobs", jobsFor, jobState, jobCursors[jobIndex]],
    queryFn: async (context) => {
      const page = await readAutomationQueue(
        scope,
        { automationId: jobsFor || undefined, state: jobState },
        jobCursors[jobIndex],
        context,
      );
      if (page.nextCursor && jobCursors.includes(page.nextCursor))
        throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      return page;
    },
    enabled: !!center && tab === "jobs",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const creationError = tab === "segments" ? segments.error : autos.error;
  const creationPlanBlocked =
    creationError instanceof BackendError && creationError.code === "PLAN_FEATURE_UNAVAILABLE";
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        queries.removeQueries({ queryKey: ["automation", scope.accountId] });
        queries.removeQueries({ queryKey: ["automation-segment-choices", scope.accountId] });
        queries.removeQueries({ queryKey: ["automation-discovery", scope.accountId] });
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
  async function refresh(segmentWritten = false) {
    const assertCurrent = capturePrivateReadback(queries);
    const choicesKey = ["automation-segment-choices", scope.accountId, scope.orgId, scope.centerId];
    await invalidateCachedFamilies(
      queries,
      [prefix, choicesKey],
      segmentWritten ? [choicesKey] : [],
    );
    assertCurrent();
    // Every cursor family is stale; validate only the visible tab's first page.
    if (tab === "automations") {
      await queries.fetchQuery({
        queryKey: [...prefix, "automations", undefined],
        queryFn: () => readAutomations(scope, undefined, undefined),
        staleTime: 0,
        retry: false,
      });
    } else if (tab === "segments") {
      await queries.fetchQuery({
        queryKey: [...prefix, "segments", undefined],
        queryFn: () => readSegments(scope, undefined, undefined),
        staleTime: 0,
        retry: false,
      });
    } else {
      await queries.fetchQuery({
        queryKey: [...prefix, "jobs", jobsFor, jobState, undefined],
        queryFn: () =>
          readAutomationQueue(scope, { automationId: jobsFor || undefined, state: jobState }),
        staleTime: 0,
        retry: false,
      });
    }
    assertCurrent();
    setAutoCursors([undefined]);
    setAutoIndex(0);
    setSegmentCursors([undefined]);
    setSegmentIndex(0);
    setJobCursors([undefined]);
    setJobIndex(0);
  }
  const unknown = t(($) => $.automation.unknown),
    format = center
      ? new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: center.timezone,
        })
      : undefined;
  const jobRows = !jobsSource.isError
    ? jobsSource.data?.items.map((row) => {
        const result = row.result_reference;
        return {
          id: row.id,
          automationId: row.automation_id,
          automation: row.automation_name,
          when: format!.format(new Date(row.created_at)),
          initiator: t(($) => $.automation.initiatorAutomation),
          state: t(($) => $.automation.jobStates[row.state]),
          result: result
            ? { label: t(($) => $.automation.jobResults[result.type]), id: result.id }
            : undefined,
          targets: "1",
          emailAccepted: t(($) => $.automation.notApplicable),
          delivery: t(($) => $.automation.unsupportedDelivery),
          canRetry: row.retry_available && row.state === "failed",
        };
      })
    : undefined;
  const pagination =
    tab === "jobs" ? (
      <div className="flex w-full flex-wrap items-end gap-3">
        <Button
          variant="outline"
          isDisabled={locked || jobsSource.isFetching || !center}
          onPress={() => void jobsSource.refetch()}
        >
          {t(($) => $.automation.reloadJobs)}
        </Button>
        <Field className="w-full max-w-sm">
          <FieldLabel htmlFor="automation-job-target">{t(($) => $.automation.jobsFor)}</FieldLabel>
          <NativeSelect
            id="automation-job-target"
            value={jobsFor}
            disabled={locked || autos.isFetching || autos.isError}
            onChange={(event) => {
              setJobsFor(event.target.value);
              setJobCursors([undefined]);
              setJobIndex(0);
            }}
          >
            <NativeSelectOption value="">
              {t(($) => $.automation.allAutomations)}
            </NativeSelectOption>
            {autos.data?.items.map((row) => (
              <NativeSelectOption key={row.id} value={row.id}>
                {row.definition.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field className="w-full max-w-xs">
          <FieldLabel htmlFor="automation-job-state">{t(($) => $.automation.jobFilter)}</FieldLabel>
          <NativeSelect
            id="automation-job-state"
            value={jobState}
            disabled={locked}
            onChange={(event) => {
              setJobState(event.target.value as JobState | "all");
              setJobCursors([undefined]);
              setJobIndex(0);
            }}
          >
            <NativeSelectOption value="all">
              {t(($) => $.automation.allJobStates)}
            </NativeSelectOption>
            {(
              ["pending", "running", "retry_wait", "succeeded", "failed", "cancelled"] as const
            ).map((state) => (
              <NativeSelectOption key={state} value={state}>
                {t(($) => $.automation.jobStates[state])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button
          variant="outline"
          isDisabled={locked || jobsSource.isFetching || jobIndex === 0}
          onPress={() => setJobIndex((value) => value - 1)}
        >
          {t(($) => $.people.previous)}
        </Button>
        <Button
          variant="outline"
          isDisabled={
            locked || jobsSource.isFetching || jobsSource.isError || !jobsSource.data?.nextCursor
          }
          onPress={() => {
            const next = jobsSource.data?.nextCursor;
            if (next && !jobCursors.includes(next)) {
              setJobCursors([...jobCursors.slice(0, jobIndex + 1), next]);
              setJobIndex((value) => value + 1);
            }
          }}
        >
          {t(($) => $.people.next)}
        </Button>
      </div>
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
        reportsLink={
          center &&
          !locked &&
          !jobsSource.isError &&
          jobsSource.data && (
            <Link
              to="/o/$orgId/c/$centerId/reports"
              params={{ orgId: scope.orgId, centerId: scope.centerId }}
              className="text-sm font-medium underline underline-offset-4"
            >
              {t(($) => $.automation.centerReports)}
            </Link>
          )
        }
        jobsPlaceholder={
          <p>
            {jobsSource.isError ? t(($) => $.automation.readError) : t(($) => $.automation.loading)}
          </p>
        }
        jobSummary={
          !jobsSource.isError &&
          jobsSource.data && (
            <dl
              aria-label={t(($) => $.automation.queueTitle)}
              className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"
            >
              {(["total", "notifications_created", "followups_created"] as const).map((key) => (
                <div key={key} className="flex gap-2">
                  <dt>{t(($) => $.automation.queueCounts[key])}</dt>
                  <dd className="font-medium tabular-nums">
                    {new Intl.NumberFormat("tr-TR").format(jobsSource.data!.summary[key])}
                  </dd>
                </div>
              ))}
              {(
                ["pending", "running", "retry_wait", "succeeded", "failed", "cancelled"] as const
              ).map((state) => (
                <div key={state} className="flex gap-2">
                  <dt>{t(($) => $.automation.jobStates[state])}</dt>
                  <dd className="tabular-nums">
                    {new Intl.NumberFormat("tr-TR").format(jobsSource.data!.summary[state])}
                  </dd>
                </div>
              ))}
            </dl>
          )
        }
        onDiscover={(id, mode) => {
          if (!locked) {
            const segment = segments.data?.items.find((row) => row.id === id);
            if (segment) setDiscovery({ id, name: segment.name, mode });
          }
        }}
        locked={locked}
        pagination={pagination}
        onAdd={
          creationPlanBlocked
            ? undefined
            : () => {
                if (!locked) setSelection({ kind: tab === "segments" ? "segment" : "automation" });
              }
        }
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
        onRetry={(automationId, id) => {
          if (locked || preflight.current) return;
          const job =
            !jobsSource.isError &&
            jobsSource.data?.items.find(
              (row) => row.id === id && row.automation_id === automationId,
            );
          if (!job || !job.retry_available) return;
          preflight.current = true;
          pending(true);
          void automationAt(scope, automationId)
            .then((before) => {
              if (before.version !== job.automation_version)
                throw new Error("AUTOMATION_SOURCE_UNAVAILABLE");
              if (active.current) setAction({ before, retry: structuredClone(job) });
            })
            .catch((cause) => {
              if (active.current && !accessLost(cause)) setNotice(t(($) => $.automation.readError));
            })
            .finally(() => {
              preflight.current = false;
              if (active.current) pending(false);
            });
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
      {discovery && (
        <SegmentDiscovery
          key={`${discovery.id}:${discovery.mode}`}
          scope={scope}
          target={discovery}
          onClose={() => setDiscovery(undefined)}
          onAccessLost={accessLost}
        />
      )}
      {selection && center && (
        <AutomationEditor
          key={`${selection.kind}:${selection.before?.id ?? "new"}`}
          scope={scope}
          selection={selection}
          ownPersonId={workspace.data?.selected?.self_context?.person_id}
          centerName={center.name}
          onSaved={() => refresh(selection.kind === "segment")}
          onClose={() => {
            if (!locked) setSelection(undefined);
          }}
          onReload={() => {
            if (locked) return;
            setSelection(undefined);
            void refresh().catch(accessLost);
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
            if (!locked) setAction(undefined);
          }}
          onReload={() => {
            if (locked) return;
            setAction(undefined);
            void refresh().catch(accessLost);
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
  onReload,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  before: AutomationRecord;
  enabled?: boolean;
  retryJob?: AutomationJobView;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onReload: () => void;
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
      notice={<EventCommandNotice command={command} onReload={onReload} />}
    />
  );
}
