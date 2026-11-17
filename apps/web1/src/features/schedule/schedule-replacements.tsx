import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { readScheduleReplacements } from "./schedule-read";

export function ScheduleReplacements({
  scope,
  sessionId,
  timezone,
  onAccessLost,
}: {
  scope: ClientScope;
  sessionId: string;
  timezone: string;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["schedule-replacements", scope.accountId, scope.orgId, scope.centerId, sessionId],
    queryFn: () => readScheduleReplacements(scope, sessionId),
    retry: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const date = new Intl.DateTimeFormat("tr-TR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  return (
    <section className="flex flex-col gap-2" aria-label={t(($) => $.schedule.replacementHistory)}>
      <h3 className="text-sm font-medium">{t(($) => $.schedule.replacementHistory)}</h3>
      {query.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.scheduleRoster.readError)}
            <Button
              variant="outline"
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.people.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <p>{t(($) => $.products.historyLoading)}</p>
      ) : query.data.length === 0 ? (
        <p>{t(($) => $.schedule.noReplacements)}</p>
      ) : (
        <ItemGroup>
          {query.data.map((row) => (
            <Item key={row.id} role="listitem" variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>
                  {date.format(new Date(row.interval.starts_at))} –{" "}
                  {date.format(new Date(row.interval.ends_at))}
                </ItemTitle>
                <ItemDescription>{t(($) => $.schedule.sessionStates[row.state])}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
