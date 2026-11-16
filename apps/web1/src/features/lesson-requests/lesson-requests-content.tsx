import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { LessonRequestView } from "../../lib/api-contracts/generated";
import { readWorkspace } from "../workspace/workspace";
import { LessonRequestsView, type RequestRow, type RequestFilter } from "./lesson-requests-view";
import { LessonRequestEditor } from "./lesson-request-editor";
import { readLessonRequests } from "./lesson-requests-read";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function LessonRequestsContent({
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
    queries = useQueryClient();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [filter, setFilter] = useState<RequestFilter>("pending");
  const [locked, setLocked] = useState(false);
  // The selected snapshot outlives list refreshes, including unknown writer outcomes.
  const [selected, setSelected] = useState<{ detail: LessonRequestView; name: string }>();
  const prefix = ["lesson-requests", scope.accountId, scope.orgId, scope.centerId];
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
  const query = useQuery({
    queryKey: [...prefix, filter, cursors[pageIndex]],
    queryFn: async () => {
      const result = await readLessonRequests(scope, cursors[pageIndex], filter);
      if (result.next_cursor && cursors.slice(0, pageIndex + 1).includes(result.next_cursor))
        throw new Error("LESSON_REQUEST_PAGE_UNAVAILABLE");
      return result;
    },
    enabled: Boolean(center),
    retry: false,
  });
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        queries.removeQueries({ queryKey: ["lesson-requests", scope.accountId] });
        queries.removeQueries({ queryKey: ["lesson-request-editor", scope.accountId] });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId],
  );
  useEffect(() => {
    if (query.error) accessLost(query.error);
  }, [query.error, accessLost]);
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const unknown = t(($) => $.lessonRequests.unknown);
  const format = center
    ? new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: center.timezone,
      })
    : undefined;
  const rows: RequestRow[] | null =
    !query.isError && query.data && format
      ? query.data.items.map(({ detail, person, instructor }) => {
          const rights = person?.member_summary?.rights;
          const name = person?.display_name ?? unknown;
          return {
            id: detail.id,
            name,
            initials: person
              ? name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
              : "?",
            rights:
              rights?.status === "available"
                ? t(($) => $.lessonRequests.rightsSummary, {
                    credits: rights.available_credits,
                    packages: rights.available_timed_packages ?? unknown,
                  })
                : rights
                  ? t(($) => $.lessonRequests.visibility[rights.status])
                  : unknown,
            requested: format.format(new Date(detail.requested_start)),
            duration: `${detail.duration_minutes} ${t(($) => $.lessonRequests.minutes)}`,
            instructor:
              instructor?.display_name ??
              (detail.preferred_instructor_id ? unknown : t(($) => $.lessonRequests.noPreference)),
            created: format.format(new Date(detail.created_at)),
            state: detail.state,
          };
        })
      : null;
  function summaryCount(key: "pending" | "alternative_offered" | "approved" | "rejected") {
    return !query.isError && query.data
      ? new Intl.NumberFormat("tr-TR").format(query.data.summary[key])
      : null;
  }
  return (
    <>
      <LessonRequestsView
        filter={filter}
        onFilter={(value) => {
          if (locked || value === filter) return;
          setFilter(value);
          setCursors([undefined]);
          setPageIndex(0);
        }}
        filtersAvailable
        counts={{
          pending: summaryCount("pending"),
          alternative_offered: summaryCount("alternative_offered"),
          approved: summaryCount("approved"),
          rejected: summaryCount("rejected"),
        }}
        rows={rows}
        locked={locked}
        onOpen={(id) => {
          if (locked) return;
          const item = query.data?.items.find((row) => row.detail.id === id);
          if (item)
            setSelected({ detail: item.detail, name: item.person?.display_name ?? unknown });
        }}
        notice={
          <>
            {(query.isError || !center) && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.lessonRequests.sourceError)}</AlertDescription>
              </Alert>
            )}
            <Button
              variant="outline"
              isDisabled={locked || query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.lessonRequests.reload)}
            </Button>
          </>
        }
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              isDisabled={locked || query.isFetching || pageIndex === 0}
              onPress={() => setPageIndex((value) => value - 1)}
            >
              {t(($) => $.lessonRequests.previous)}
            </Button>
            <Button
              variant="outline"
              isDisabled={locked || query.isFetching || query.isError || !query.data?.next_cursor}
              onPress={() => {
                const next = query.data?.next_cursor;
                if (!next || cursors.includes(next)) return;
                setCursors((values) => [...values.slice(0, pageIndex + 1), next]);
                setPageIndex((value) => value + 1);
              }}
            >
              {t(($) => $.lessonRequests.next)}
            </Button>
          </div>
        }
      />
      {selected && center && (
        <LessonRequestEditor
          key={selected.detail.id}
          scope={scope}
          initial={selected.detail}
          name={selected.name}
          timezone={center.timezone}
          onClose={() => {
            if (!locked) setSelected(undefined);
          }}
          onLockChange={lock}
          onAccessLost={accessLost}
          onRefresh={async () => {
            await queries.invalidateQueries({ queryKey: prefix });
            await queries.invalidateQueries({
              queryKey: ["schedule-range", scope.accountId, scope.orgId, scope.centerId],
            });
          }}
        />
      )}
    </>
  );
}
