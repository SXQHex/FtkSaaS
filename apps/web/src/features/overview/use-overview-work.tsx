import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ManagementWorkView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import type { OverviewTask } from "./overview-view";
import { OverviewWorkPanel } from "./overview-work-panel";
import { readOverviewWork } from "./overview-work";

export function useOverviewWork({
  scope,
  enabled,
  timezone,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  enabled: boolean;
  timezone: string | undefined;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [opened, setOpened] = useState<ManagementWorkView>(),
    [locked, setLocked] = useState(false);
  const query = useQuery({
    queryKey: ["overview-work", scope.accountId, scope.orgId, scope.centerId, cursors[index]],
    queryFn: async (context) => {
      const page = await readOverviewWork(scope, cursors[index], undefined, context);
      if (page.next_cursor && cursors.slice(0, index + 1).includes(page.next_cursor))
        throw Error("WORK_CURSOR_UNAVAILABLE");
      return page;
    },
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const source = enabled && !query.isError && !query.isFetching ? query.data : undefined;
  const tasks: OverviewTask[] | null =
    source && timezone
      ? source.items.map((task) => ({
          id: `${task.kind}:${task.id}`,
          title: task.title,
          context: [t(($) => $.overview.workKinds[task.kind]), task.person_name]
            .filter(Boolean)
            .join(" · "),
          status: t(($) => $.overview.workPending),
          due: task.due_at
            ? t(($) => $.overview.workDue, {
                date: new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: timezone,
                }).format(new Date(task.due_at)),
              })
            : undefined,
          actionLabel: t(($) => $.overview.workOpen),
          onAction: () => {
            if (!locked) setOpened(task);
          },
        }))
      : null;
  function close() {
    if (!locked) {
      setOpened(undefined);
      void query.refetch();
    }
  }
  return {
    tasks,
    emptyMessage:
      source && source.summary.total > 0 ? t(($) => $.overview.workPageEmpty) : undefined,
    notice: query.isError ? (
      <Alert role="alert" variant="destructive">
        <AlertDescription>
          {t(($) => $.overview.workReadError)}{" "}
          <Button
            variant="outline"
            isDisabled={!enabled || locked || query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            {t(($) => $.overview.workReload)}
          </Button>
        </AlertDescription>
      </Alert>
    ) : source ? (
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {t(($) => $.overview.workTotal, { count: source.summary.total })}
      </p>
    ) : undefined,
    pagination: (
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t(($) => $.overview.workPage, { page: index + 1 })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            isDisabled={!enabled || locked || query.isFetching || index === 0}
            onPress={() => setIndex((value) => value - 1)}
          >
            {t(($) => $.people.previous)}
          </Button>
          <Button
            variant="outline"
            isDisabled={!enabled || locked || query.isFetching || !source?.next_cursor}
            onPress={() => {
              const cursor = source?.next_cursor;
              if (cursor) {
                setCursors([...cursors.slice(0, index + 1), cursor]);
                setIndex(index + 1);
              }
            }}
          >
            {t(($) => $.people.next)}
          </Button>
          <Button
            variant="outline"
            isDisabled={!enabled || locked || query.isFetching}
            onPress={() => {
              void query.refetch();
            }}
          >
            {t(($) => $.overview.workReload)}
          </Button>
        </div>
      </div>
    ),
    panel:
      opened && enabled ? (
        <OverviewWorkPanel
          key={`${opened.kind}:${opened.id}:${opened.version}`}
          scope={scope}
          task={opened}
          onClose={close}
          onLockChange={setLocked}
          onAccessLost={onAccessLost}
          onSaved={async () => {
            await query.refetch({ throwOnError: true });
          }}
        />
      ) : null,
  };
}
