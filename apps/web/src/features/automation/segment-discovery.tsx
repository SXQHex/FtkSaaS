import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { SegmentDiscoveryView } from "./segment-discovery-view";
import { automationDiscoveryKey, readSegmentDiscovery } from "./automation-discovery";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function SegmentDiscovery({
  scope,
  target,
  onClose,
  onAccessLost,
}: {
  scope: ClientScope;
  target: { id: string; name: string; mode: "matches" | "automations" };
  onClose: () => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0);
  const query = useQuery({
    queryKey: [...automationDiscoveryKey(scope), target.id, target.mode, cursors[index]],
    queryFn: async (context) => {
      const page = await readSegmentDiscovery(
        scope,
        target.id,
        target.mode,
        cursors[index],
        context,
      );
      if (page.nextCursor && cursors.includes(page.nextCursor))
        throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      return page;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  return (
    <SegmentDiscoveryView
      loading={query.isPending}
      name={target.name}
      mode={target.mode}
      summary={!query.isError ? query.data?.summary : undefined}
      rows={
        !query.isError
          ? (query.data?.items.map((row) => ({
              ...row,
              status:
                row.enabled === undefined
                  ? undefined
                  : row.enabled
                    ? t(($) => $.automation.enabledState)
                    : t(($) => $.automation.disabledState),
            })) ?? null)
          : null
      }
      notice={
        query.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.automation.readError)}{" "}
              <Button
                variant="outline"
                onPress={() => {
                  if (index === 0) void query.refetch();
                  else {
                    setCursors([undefined]);
                    setIndex(0);
                  }
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )
      }
      pagination={
        <>
          <Button
            variant="outline"
            isDisabled={query.isFetching || index === 0}
            onPress={() => setIndex((value) => value - 1)}
          >
            {t(($) => $.people.previous)}
          </Button>
          <Button
            variant="outline"
            isDisabled={query.isFetching || query.isError || !query.data?.nextCursor}
            onPress={() => {
              const next = query.data?.nextCursor;
              if (next && !cursors.includes(next)) {
                setCursors([...cursors.slice(0, index + 1), next]);
                setIndex((value) => value + 1);
              }
            }}
          >
            {t(($) => $.people.next)}
          </Button>
        </>
      }
      onClose={onClose}
    />
  );
}
