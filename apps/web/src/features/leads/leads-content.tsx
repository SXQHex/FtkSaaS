import { invalidateLeadPages } from "./leads-query";
import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ManagementSelectorPublicApplicationReviewV1 } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { capturePrivateReadback } from "../../lib/cache-invalidation";

import { readOverviewWork } from "../overview/overview-work";
import { LeadsView, type LeadTab } from "./leads-view";
import { LeadEditor, type LeadTarget } from "./lead-editor";
import { ApplicationEditor } from "./application-editor";
import { PersonFollowupDialog } from "./person-followup-dialog";
import {
  LeadFollowupPicker,
  type LeadFollowupKind,
  LeadActivitiesView,
  LeadApplicationsView,
} from "./lead-lists";
import {
  readLeadsPage,
  readApplicationsPage,
  readLeadAssignees,
  readLeadFollowups,
  readSourceFollowups,
} from "./leads-read";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
const applicationStates = {
  open: ["pending"],
  completed: ["reviewed", "closed"],
} satisfies Record<
  string,
  NonNullable<ManagementSelectorPublicApplicationReviewV1["key"]["states"]>
>;
export function LeadsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    navigate = useNavigate(),
    queries = useQueryClient();
  const [tab, setTab] = useState<LeadTab>("board"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<({ token: string; pipeline: boolean } | undefined)[]>([
      undefined,
    ]),
    [index, setIndex] = useState(0),
    [appCursors, setAppCursors] = useState<(string | undefined)[]>([undefined]),
    [appIndex, setAppIndex] = useState(0),
    [appFilter, setAppFilter] = useState<keyof typeof applicationStates>("open"),
    [followupCursors, setFollowupCursors] = useState<(string | undefined)[]>([undefined]),
    [followupIndex, setFollowupIndex] = useState(0),
    [followupKind, setFollowupKind] = useState<LeadFollowupKind>("manual"),
    [target, setTarget] = useState<LeadTarget | null | undefined>(),
    [application, setApplication] = useState<string>(),
    [personFollowup, setPersonFollowup] = useState<{
      id: string;
      personId: string;
      name: string;
    }>(),
    [locked, setLocked] = useState(false),
    [owner, setOwner] = useState(""),
    [stageFilter, setStageFilter] = useState("all");
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const current =
    (!workspace.isError || preservePending) &&
    workspace.data?.selected?.id === scope.orgId &&
    workspace.data.centers.some((row) => row.id === scope.centerId && row.accessible)
      ? workspace.data
      : undefined;
  const timezone = current?.centers.find((row) => row.id === scope.centerId)?.timezone;
  const canReview =
    !workspace.isError &&
    Boolean(
      current?.roles.some(
        (role) =>
          role.state === "active" &&
          role.account_access_granted !== false &&
          role.person_id === current.selected?.self_context?.person_id &&
          (role.role === "owner" ||
            role.role === "org_manager" ||
            (role.role === "center_manager" && role.scope_center_id === scope.centerId)),
      ),
    );
  const onLocked = useCallback((value: boolean) => setLocked(value), []);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (locked) return;
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursors([undefined]);
      setIndex(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, locked]);
  const assignees = useInfiniteQuery({
    queryKey: ["lead-assignees", scope.accountId, scope.orgId, scope.centerId],
    initialPageParam: undefined as string | undefined,
    queryFn: (context) => readLeadAssignees(scope, context.pageParam, context),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: Boolean(current),
    retry: false,
  });
  const owners =
    !assignees.isError && current
      ? (assignees.data?.pages.flatMap((page) => page.items) ?? [])
      : [];
  const filters = {
    ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
    ...(owner ? { assignedTo: owner === "unassigned" ? null : owner } : {}),
  };
  const leads = useQuery({
    queryKey: [
      "leads",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      query,
      filters,
      cursors[index],
    ],
    queryFn: (context) =>
      readLeadsPage(
        scope,
        query,
        cursors[index]?.token,
        filters,
        cursors[index]?.pipeline,
        context,
      ),
    enabled: Boolean(current),
    retry: false,
  });
  const followups = useQuery({
    queryKey: [
      "lead-followups",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      owner,
      followupCursors[followupIndex],
    ],
    queryFn: (context) =>
      readLeadFollowups(scope, followupCursors[followupIndex], filters.assignedTo, context),
    enabled: Boolean(current) && tab === "tasks" && followupKind === "manual",
    retry: false,
  });
  const sourceFollowups = useQuery({
    queryKey: [
      "lead-source-followups",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      followupKind,
      followupCursors[followupIndex],
    ],
    queryFn: (context) => {
      if (followupKind === "manual") throw Error("FOLLOWUP_KIND_UNAVAILABLE");
      return readSourceFollowups(scope, followupKind, followupCursors[followupIndex], context);
    },
    enabled: Boolean(current) && tab === "tasks" && followupKind !== "manual",
    retry: false,
  });
  const tasks = followupKind === "manual" ? followups : sourceFollowups;
  const applications = useQuery({
    queryKey: [
      "lead-applications",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      appFilter,
      appCursors[appIndex],
    ],
    queryFn: (context) =>
      readApplicationsPage(
        scope,
        appCursors[appIndex],
        undefined,
        applicationStates[appFilter],
        context,
      ),
    enabled: Boolean(current) && tab === "apps",
    retry: false,
  });
  const workSummary = useQuery({
    queryKey: ["lead-work-summary", scope.accountId, scope.orgId, scope.centerId],
    queryFn: async (context) => (await readOverviewWork(scope, undefined, 1, context)).summary,
    enabled: Boolean(current),
    refetchOnMount: "always",
    retry: false,
  });
  useEffect(() => {
    const error =
      leads.error ?? assignees.error ?? tasks.error ?? applications.error ?? workSummary.error;
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      void router.invalidate();
  }, [leads.error, assignees.error, tasks.error, applications.error, workSummary.error, router]);
  const work =
    current && !workSummary.isError && !workSummary.isFetching ? workSummary.data : undefined;
  const data = leads.isError && !preservePending ? undefined : leads.data;
  const advanced = (data?.pipelineAvailable ?? cursors[index]?.pipeline) !== false;
  const activeTab = !advanced && tab === "board" ? "list" : tab;

  const date = (instant: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(instant));
  const sourceName = (source: string) =>
    source === "manual"
      ? t(($) => $.leads.sources.manual)
      : source === "phone"
        ? t(($) => $.leads.sources.phone)
        : source === "whatsapp"
          ? t(($) => $.leads.sources.whatsapp)
          : source;
  async function refresh() {
    const assertCurrent = capturePrivateReadback(queries);
    await invalidateLeadPages(queries, scope);
    assertCurrent();
    await queries.fetchQuery({
      queryKey: ["leads", scope.accountId, scope.orgId, scope.centerId, query, filters, undefined],
      queryFn: () => readLeadsPage(scope, query, undefined, filters),
      staleTime: 0,
      retry: false,
    });
    assertCurrent();
    if (tab === "tasks") {
      if (followupKind === "manual") {
        await queries.fetchQuery({
          queryKey: [
            "lead-followups",
            scope.accountId,
            scope.orgId,
            scope.centerId,
            owner,
            undefined,
          ],
          queryFn: () => readLeadFollowups(scope, undefined, filters.assignedTo),
          staleTime: 0,
          retry: false,
        });
      } else {
        await queries.fetchQuery({
          queryKey: [
            "lead-source-followups",
            scope.accountId,
            scope.orgId,
            scope.centerId,
            followupKind,
            undefined,
          ],
          queryFn: () => readSourceFollowups(scope, followupKind, undefined),
          staleTime: 0,
          retry: false,
        });
      }
    }
    if (tab === "apps" && !applications.isError) {
      await queries.fetchQuery({
        queryKey: [
          "lead-applications",
          scope.accountId,
          scope.orgId,
          scope.centerId,
          appFilter,
          undefined,
        ],
        queryFn: () =>
          readApplicationsPage(scope, undefined, undefined, applicationStates[appFilter]),
        staleTime: 0,
        retry: false,
      });
    }
    assertCurrent();
    const summary = await workSummary.refetch();
    if (
      summary.error &&
      !(
        summary.error instanceof BackendError &&
        ["FORBIDDEN", "PLAN_FEATURE_UNAVAILABLE"].includes(summary.error.code)
      )
    )
      throw summary.error;
    assertCurrent();
    setCursors([undefined]);
    setIndex(0);
    setFollowupCursors([undefined]);
    setFollowupIndex(0);
    setAppCursors([undefined]);
    setAppIndex(0);
  }
  const rows = (data?.items ?? []).map((row) => ({
    id: row.id,
    name: row.display_name ?? t(($) => $.leads.unknownPerson),
    source: sourceName(row.source),
    interest: row.interest,
    stageKey: row.pipeline?.stage.key ?? null,
    stageName: row.pipeline?.stage.name ?? null,
    assignedName: row.assigned_to ? (row.assigned_name ?? t(($) => $.leads.unknownPerson)) : null,
    nextAction: row.due_followup ? t(($) => $.leads.activityKinds.followup) : null,
    due: row.due_followup ? date(row.due_followup) : null,
    tags: row.pipeline?.tags.map((tag) => tag.name) ?? [],
    movable: row.state === "open",
  }));
  function select(id: string, mode?: "stage", stage?: string) {
    if (locked || leads.isError) return;
    const row = data?.items.find((row) => row.id === id);
    if (!row) return;
    setTarget({
      id: row.id,
      personId: row.person_id,
      name: rows.find((item) => item.id === row.id)?.name ?? t(($) => $.leads.candidate),
      mode,
      stage,
    });
  }
  return (
    <>
      <LeadsView
        rows={rows}
        stages={data?.pipeline_catalog?.stages ?? []}
        pipelineSummary={data?.pipeline_summary}
        summary={{
          open: data?.summary ? String(data.summary.open_leads) : null,
          today: data?.summary ? String(data.summary.followups_today) : null,
          late: data?.summary ? String(data.summary.overdue_followups) : null,
          converted: data?.summary ? String(data.summary.converted_last_30_days) : null,
        }}
        tab={activeTab}
        pendingCounts={{
          tasks: work?.crm_followup,
          apps: canReview ? work?.application_review : undefined,
        }}
        advanced={advanced}
        onTab={(value) => {
          if (!locked) setTab(value);
        }}
        search={search}
        onSearch={activeTab === "board" || activeTab === "list" ? setSearch : undefined}
        owner={tab === "tasks" && followupKind !== "manual" ? "" : owner}
        owners={owners}
        onOwner={
          assignees.isError || tab === "apps" || (tab === "tasks" && followupKind !== "manual")
            ? undefined
            : (value) => {
                if (!locked) {
                  setOwner(value);
                  setFollowupCursors([undefined]);
                  setFollowupIndex(0);
                  setCursors([undefined]);
                  setIndex(0);
                }
              }
        }
        stageFilter={stageFilter}
        onStageFilter={
          tab === "board" || tab === "list"
            ? (value) => {
                if (!locked) {
                  setStageFilter(value);
                  setCursors([undefined]);
                  setIndex(0);
                }
              }
            : undefined
        }
        filtersAvailable={!!data?.pipeline_catalog}
        ownerActions={
          assignees.isError ? (
            <Button
              variant="outline"
              isDisabled={locked || assignees.isFetching}
              onPress={() => void assignees.refetch()}
            >
              {t(($) => $.auth.retry)}
            </Button>
          ) : assignees.hasNextPage ? (
            <Button
              variant="outline"
              isDisabled={locked || assignees.isFetching}
              onPress={() => void assignees.fetchNextPage()}
            >
              {t(($) => $.people.next)}
            </Button>
          ) : undefined
        }
        disabled={locked || !current}
        onSelect={(id) => select(id)}
        onStage={advanced ? (id, stage) => select(id, "stage", stage) : undefined}
        onAdd={!leads.isError && current ? () => setTarget(null) : undefined}
        notice={
          <>
            {leads.isPending && <p role="status">{t(($) => $.leads.loading)}</p>}
            {(leads.isError || !current) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t(($) => $.leads.readFailed)}{" "}
                  <Button
                    variant="outline"
                    isDisabled={locked}
                    onPress={() => void leads.refetch()}
                  >
                    {t(($) => $.auth.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </>
        }
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || leads.isFetching || index === 0}
              onPress={() => setIndex((value) => value - 1)}
            >
              {t(($) => $.people.previous)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || leads.isFetching || leads.isError || !data?.next_cursor}
              onPress={() => {
                const next = data?.next_cursor;
                if (next && data) {
                  setCursors([
                    ...cursors.slice(0, index + 1),
                    { token: next, pipeline: data.pipelineAvailable },
                  ]);
                  setIndex(index + 1);
                }
              }}
            >
              {t(($) => $.people.next)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || leads.isFetching}
              onPress={() => void leads.refetch()}
            >
              {t(($) => $.people.refresh)}
            </Button>
          </div>
        }
        tasks={
          <div className="flex flex-col gap-3">
            <LeadFollowupPicker
              advanced={advanced}
              value={followupKind}
              disabled={locked}
              onChange={(value) => {
                if (!locked) {
                  setFollowupKind(value);
                  setFollowupCursors([undefined]);
                  setFollowupIndex(0);
                }
              }}
            />
            {(followupKind === "renewal_due" || followupKind === "inactive_student") && (
              <p className="text-sm text-muted-foreground">
                {t(($) => $.leads.followupSourceHint)}
              </p>
            )}
            {tasks.isError || !current ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{t(($) => $.leads.readFailed)}</AlertDescription>
              </Alert>
            ) : tasks.data ? (
              <LeadActivitiesView
                outcomeLabel={t(($) => $.leads.completedAt)}
                showOutcome={followupKind === "manual"}
                disabled={locked || tasks.isFetching}
                rows={
                  followupKind === "manual"
                    ? (followups.data?.items ?? []).map((row) => ({
                        id: row.activity_id,
                        name: row.display_name,
                        kind: t(($) =>
                          row.completed_at
                            ? $.leads.activityKinds.outcome
                            : $.leads.activityKinds.followup,
                        ),
                        note: row.note,
                        due: date(row.due_at),
                        outcome: row.completed_at ? date(row.completed_at) : null,
                        owner: row.assigned_name,
                      }))
                    : (sourceFollowups.data?.items ?? []).map((row) => ({
                        id: row.id,
                        name: row.name ?? t(($) => $.leads.unknownPerson),
                        kind: t(($) => $.leads.followupKinds[followupKind]),
                        note: null,
                        due: date(row.due_at),
                        outcome: null,
                        owner: row.assigned_to
                          ? (row.assignedName ?? t(($) => $.leads.unknownPerson))
                          : null,
                      }))
                }
                onOpen={(id) => {
                  if (locked || tasks.isFetching) return;
                  if (followupKind === "manual") {
                    const row = followups.data?.items.find((row) => row.activity_id === id);
                    if (row)
                      setTarget({
                        id: row.lead_id,
                        personId: row.person_id,
                        name: row.display_name,
                        activityId: row.activity_id,
                        mode: "activity",
                      });
                  } else {
                    const row = sourceFollowups.data?.items.find((row) => row.id === id);
                    if (!row) return;
                    if (followupKind === "automation_followup") {
                      const name = row.name ?? t(($) => $.leads.unknownPerson);
                      if (row.lead_id)
                        setTarget({
                          id: row.lead_id,
                          personId: row.person_id,
                          name,
                          activityId: row.id,
                          mode: "activity",
                        });
                      else setPersonFollowup({ id: row.id, personId: row.person_id, name });
                    } else
                      void navigate({
                        to: "/o/$orgId/c/$centerId/people/$personId",
                        params: {
                          orgId: scope.orgId,
                          centerId: scope.centerId,
                          personId: row.person_id,
                        },
                      });
                  }
                }}
              />
            ) : (
              <p>{t(($) => $.leads.loading)}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                isDisabled={locked || tasks.isFetching || followupIndex === 0}
                onPress={() => setFollowupIndex((value) => value - 1)}
              >
                {t(($) => $.people.previous)}
              </Button>
              <Button
                variant="outline"
                isDisabled={locked || tasks.isFetching || tasks.isError || !tasks.data?.next_cursor}
                onPress={() => {
                  const next = tasks.data?.next_cursor;
                  if (next) {
                    setFollowupCursors([...followupCursors.slice(0, followupIndex + 1), next]);
                    setFollowupIndex(followupIndex + 1);
                  }
                }}
              >
                {t(($) => $.people.next)}
              </Button>
              <Button
                variant="outline"
                isDisabled={locked || tasks.isFetching}
                onPress={() => void tasks.refetch()}
              >
                {t(($) => $.people.refresh)}
              </Button>
            </div>
          </div>
        }
        applications={
          <div className="flex flex-col gap-3">
            <ToggleGroup
              aria-label={t(($) => $.leads.applicationFilterLabel)}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([appFilter])}
              isDisabled={locked}
              onSelectionChange={(keys) => {
                const filter = [...keys][0];
                if (filter === "open" || filter === "completed") {
                  setAppFilter(filter);
                  setAppCursors([undefined]);
                  setAppIndex(0);
                }
              }}
              variant="outline"
              className="flex-wrap"
            >
              <ToggleGroupItem id="open">
                {t(($) => $.leads.applicationFilters.open)}
              </ToggleGroupItem>
              <ToggleGroupItem id="completed">
                {t(($) => $.leads.applicationFilters.completed)}
              </ToggleGroupItem>
            </ToggleGroup>
            {applications.isPending ? (
              <p role="status">{t(($) => $.leads.loading)}</p>
            ) : applications.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {t(($) => $.leads.applicationReadFailed)}{" "}
                  <Button
                    variant="outline"
                    isDisabled={locked}
                    onPress={() => void applications.refetch()}
                  >
                    {t(($) => $.auth.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <LeadApplicationsView
                rows={(applications.data?.items ?? []).map((row) => {
                  const intake = row.values.contact_intake ?? row.values.intake;
                  return {
                    id: row.id,
                    name: intake?.display_name ?? row.values.contact ?? t(($) => $.leads.applicant),
                    interest: intake?.interest ?? "—",
                    submitted: row.values.received_at ? date(row.values.received_at) : "—",
                    consent: !intake
                      ? "—"
                      : intake.consents.length
                        ? t(($) => $.leads.consentCount, { value: intake.consents.length })
                        : t(($) => $.leads.noConsent),
                    suggestions: row.values.phone_matches
                      ? String(row.values.phone_matches.length)
                      : "—",
                    state:
                      row.state === "pending"
                        ? t(($) => $.leads.applicationStates.pending)
                        : row.state === "reviewed"
                          ? t(($) => $.leads.applicationStates.reviewed)
                          : t(($) => $.leads.applicationStates.closed),
                  };
                })}
                onOpen={(id) => {
                  if (!locked) setApplication(id);
                }}
                disabled={locked}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked || applications.isFetching || appIndex === 0}
                onPress={() => setAppIndex((value) => value - 1)}
              >
                {t(($) => $.people.previous)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={
                  locked ||
                  applications.isFetching ||
                  applications.isError ||
                  !applications.data?.next_cursor
                }
                onPress={() => {
                  const cursor = applications.data?.next_cursor;
                  if (cursor) {
                    setAppCursors([...appCursors.slice(0, appIndex + 1), cursor]);
                    setAppIndex(appIndex + 1);
                  }
                }}
              >
                {t(($) => $.people.next)}
              </Button>
            </div>
          </div>
        }
      />
      {personFollowup && current && timezone && (
        <PersonFollowupDialog
          key={personFollowup.id}
          scope={scope}
          followup={personFollowup}
          formatDate={date}
          onClose={() => setPersonFollowup(undefined)}
        />
      )}
      {target !== undefined && timezone && (
        <LeadEditor
          key={target?.id ?? "new"}
          scope={scope}
          target={target}
          catalog={data?.pipeline_catalog}
          advanced={advanced}
          owners={owners}
          assignmentWritable={
            canReview && assignees.isSuccess && !assignees.isFetching && !assignees.isError
          }
          timezone={timezone}
          onClose={() => setTarget(undefined)}
          onSaved={refresh}
          onLockChange={onLocked}
        />
      )}
      {application && (
        <ApplicationEditor
          key={application}
          scope={scope}
          id={application}
          canReview={canReview}
          onClose={() => setApplication(undefined)}
          onSaved={refresh}
          onLockChange={onLocked}
        />
      )}
    </>
  );
}
