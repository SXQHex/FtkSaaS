import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { readWorkspace } from "../workspace/workspace";
import { LeadsView, type LeadTab } from "./leads-view";
import { LeadEditor, type LeadTarget } from "./lead-editor";
import { ApplicationEditor } from "./application-editor";
import { LeadApplicationsView } from "./lead-lists";
import { readLeadsPage, readApplicationsPage } from "./leads-read";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
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
    router = useRouter();
  const [tab, setTab] = useState<LeadTab>("board"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [appCursors, setAppCursors] = useState<(string | undefined)[]>([undefined]),
    [appIndex, setAppIndex] = useState(0),
    [target, setTarget] = useState<LeadTarget | null | undefined>(),
    [application, setApplication] = useState<string>(),
    [locked, setLocked] = useState(false);
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
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
  const leads = useQuery({
    queryKey: ["leads", scope.accountId, scope.orgId, scope.centerId, query, cursors[index]],
    queryFn: () => readLeadsPage(scope, query, cursors[index]),
    enabled: Boolean(current),
    retry: false,
  });
  const applications = useQuery({
    queryKey: [
      "lead-applications",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      appCursors[appIndex],
    ],
    queryFn: () => readApplicationsPage(scope, appCursors[appIndex]),
    enabled: Boolean(current) && tab === "apps",
    retry: false,
  });
  useEffect(() => {
    const error = leads.error;
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      void router.invalidate();
  }, [leads.error, router]);
  const data = leads.isError && !preservePending ? undefined : leads.data;
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
    await leads.refetch({ throwOnError: true });
  }
  const rows = (data?.items ?? []).map((row) => ({
    id: row.id,
    name:
      data?.people.find((person) => person.id === row.person_id)?.display_name ??
      t(($) => $.leads.unknownPerson),
    source: sourceName(row.source),
    interest: row.interest,
    stageKey: row.pipeline?.stage.key ?? null,
    stageName: row.pipeline?.stage.name ?? null,
    assignedName: row.assigned_to
      ? (data?.people.find((person) => person.id === row.assigned_to)?.display_name ??
        t(($) => $.leads.unknownPerson))
      : null,
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
        summary={{ open: null, today: null, late: null, converted: null }}
        tab={tab}
        onTab={(value) => {
          if (!locked) setTab(value);
        }}
        search={search}
        onSearch={setSearch}
        owner=""
        owners={[]}
        stageFilter="all"
        disabled={locked || !current}
        onSelect={(id) => select(id)}
        onStage={(id, stage) => select(id, "stage", stage)}
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
            <Alert>
              <AlertDescription>{t(($) => $.leads.filtersMissing)}</AlertDescription>
            </Alert>
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
                if (next) {
                  setCursors([...cursors.slice(0, index + 1), next]);
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
          <Alert>
            <AlertDescription>{t(($) => $.leads.followupsMissing)}</AlertDescription>
          </Alert>
        }
        applications={
          <div className="flex flex-col gap-3">
            {applications.isPending && <p role="status">{t(($) => $.leads.loading)}</p>}
            {applications.isError ? (
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
                    submitted: "—",
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
      {target !== undefined && timezone && (
        <LeadEditor
          key={target?.id ?? "new"}
          scope={scope}
          target={target}
          catalog={data?.pipeline_catalog}
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
          onSaved={async () => {
            await applications.refetch({ throwOnError: true });
            await refresh();
          }}
          onLockChange={onLocked}
        />
      )}
    </>
  );
}
