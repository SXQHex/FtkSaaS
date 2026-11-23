import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { hasWorkspaceManagementScope } from "../workspace/workspace";
import { readOverviewDay, readOverviewLabels, readOverviewParticipants } from "./overview-read";
import { scheduleCacheKeys } from "../schedule/schedule-cache";
import { useOverviewWork } from "./use-overview-work";
import { OverviewView } from "./overview-view";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
export function OverviewContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    navigate = useNavigate(),
    router = useRouter();
  const [chosen, setChosen] = useState<string>();
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((c) => c.id === scope.centerId && c.accessible)
      : undefined;
  const program = useQuery({
    queryKey: [...scheduleCacheKeys.overview(scope), center?.timezone],
    queryFn: (context) => readOverviewDay(scope, center!.timezone, undefined, context),
    enabled: !!center,
    retry: false,
    refetchInterval: 60_000,
  });
  const entries = !program.isError ? program.data?.sessions : undefined;
  const selected =
    entries?.find((row) => row.session.id === chosen) ??
    entries?.find((row) => row.session.id === program.data?.nextId);
  const labels = useQuery({
    queryKey: [
      ...scheduleCacheKeys.overviewLabels(scope),
      entries?.map((r) => [
        r.session.id,
        r.session.version,
        r.item.resources?.filter(({ kind }) => kind === "room").map(({ id }) => id),
        r.session.room_labels?.map(({ room_id, name }) => [room_id, name]),
      ]),
    ],
    queryFn: (context) => readOverviewLabels(scope, entries!, context),
    enabled: !!entries,
    retry: false,
  });
  const members = useQuery({
    queryKey: [
      ...scheduleCacheKeys.overviewParticipants(scope),
      selected?.session.id,
      selected?.session.version,
      selected?.session.capacity,
    ],
    queryFn: (context) => readOverviewParticipants(scope, selected!.session.id, context),
    enabled: !!selected,
    retry: false,
  });
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        void router.invalidate();
        return true;
      }
      return cause instanceof BackendError && cause.code === "FORBIDDEN";
    },
    [router],
  );
  const work = useOverviewWork({
    scope,
    enabled: !!center,
    timezone: center?.timezone,
    onLockChange,
    onAccessLost: accessLost,
  });
  useEffect(() => {
    for (const cause of [workspace.error, program.error, labels.error, members.error])
      if (cause) accessLost(cause);
  }, [workspace.error, program.error, labels.error, members.error, accessLost]);
  const date = center
      ? new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: center.timezone })
      : undefined,
    unknown = t(($) => $.sessionDetail.unknown);
  const rows = entries?.map((row) => {
    const detail = !labels.isError ? labels.data?.get(row.session.id) : undefined;
    const instructors = detail?.instructors.join(" · ") || unknown,
      rooms = detail?.rooms.join(" · ") || unknown;
    return {
      id: row.session.id,
      title: row.item.title,
      starts: date!.format(new Date(row.session.starts_at)),
      ends: date!.format(new Date(row.session.ends_at)),
      metadata: `${instructors} · ${rooms}`,
      instructors,
      rooms,
      state: t(($) => $.overview.states[row.session.state]),
      past: row.session.state === "occurred",
      next: row.session.id === program.data?.nextId,
      capacity: row.session.capacity,
    };
  });
  const active = rows?.find((row) => row.id === selected?.session.id);
  const canAdd = !workspace.isError && hasWorkspaceManagementScope(workspace.data, scope.centerId);
  function session(tab: "participants" | "attendance" = "participants") {
    if (!active) return;
    void navigate({
      to: "/o/$orgId/c/$centerId/sessions/$sessionId",
      params: { orgId: scope.orgId, centerId: scope.centerId, sessionId: active.id },
      search: { tab },
    });
  }
  const error = workspace.isError || program.isError || labels.isError || members.isError;
  return (
    <>
      <OverviewView
        tasks={work.tasks}
        taskNotice={work.notice}
        taskPagination={work.pagination}
        taskEmptyMessage={work.emptyMessage}
        date={program.data?.date ?? ""}
        now={program.data?.now ?? ""}
        lessons={rows ?? null}
        loading={!!center && program.isPending}
        selected={active}
        participants={
          selected && !members.isError && members.data
            ? members.data.map((row) => {
                const summary = row.reservation.source_summary,
                  name = row.person?.display_name ?? t(($) => $.overview.memberNameUnavailable);
                return {
                  id: row.reservation.id,
                  name,
                  initials:
                    row.person?.display_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("") ?? "?",
                  source:
                    summary?.status === "available"
                      ? [
                          summary.product_name,
                          summary.kind === "credits" && summary.available_credits !== null
                            ? t(($) => $.overview.remainingRights, {
                                amount: new Intl.NumberFormat("tr-TR").format(
                                  BigInt(summary.available_credits),
                                ),
                              })
                            : undefined,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : t(($) => $.overview.sourceUnavailable),
                };
              })
            : null
        }
        onSelect={setChosen}
        onProgram={() => {
          void navigate({
            to: "/o/$orgId/c/$centerId/schedule",
            params: { orgId: scope.orgId, centerId: scope.centerId },
            search: {},
          });
        }}
        onAdd={() => {
          void navigate({
            to: "/o/$orgId/c/$centerId/schedule",
            params: { orgId: scope.orgId, centerId: scope.centerId },
            search: { create: true },
          });
        }}
        onSession={() => session()}
        onAllParticipants={() => session()}
        onAttendance={() => session("attendance")}
        canAdd={canAdd}
        canAttend={!!selected}
        notice={
          error ? (
            <Alert variant="destructive">
              <AlertDescription>
                <p>
                  {t(($) =>
                    program.isError || workspace.isError
                      ? $.overview.unread
                      : labels.isError
                        ? $.overview.labelsUnread
                        : $.overview.participantsUnread,
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    if (!center) {
                      void workspace.refetch();
                      return;
                    }
                    void program.refetch();
                    if (entries) void labels.refetch();
                    if (selected) void members.refetch();
                  }}
                >
                  {t(($) => $.memberReservations.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          ) : undefined
        }
      />
      {work.panel}
    </>
  );
}
