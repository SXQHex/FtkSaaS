import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { ClientScope } from "../../lib/scoped-backend";
import type { SettingsLevel } from "./settings-document";
import type { SettingsTableData, SettingsFieldValue } from "./settings-view";
import { readSettingsHistory } from "./settings-history";

export function useSettingsHistory({
  scope,
  level,
  timezone,
  enabled,
  locked,
  onAccessLost,
}: {
  scope: ClientScope;
  level: SettingsLevel;
  timezone: string;
  enabled: boolean;
  locked: boolean;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [stacks, setStacks] = useState<Record<SettingsLevel, (string | undefined)[]>>({
    organization: [undefined],
    center: [undefined],
  });
  const stack = stacks[level],
    cursor = stack.at(-1);
  const query = useQuery({
    queryKey: ["settings-history", scope.accountId, scope.orgId, scope.centerId, level, cursor],
    queryFn: () => readSettingsHistory(scope, level, cursor),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const source = enabled && !query.isError && !query.isFetching ? query.data : undefined;
  const repeated = !!source?.next_cursor && stack.includes(source.next_cursor);
  const table: SettingsTableData | undefined = source
    ? {
        columns: ["when", "person", "section", "change"],
        rows: source.items.map((row) => {
          const keys = new Set([...Object.keys(row.before), ...Object.keys(row.after)]);
          const count = [...keys].filter(
            (key) =>
              JSON.stringify(Reflect.get(row.before, key)) !==
              JSON.stringify(Reflect.get(row.after, key)),
          ).length;
          return {
            id: row.id,
            cells: [
              new Intl.DateTimeFormat("tr-TR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: timezone,
              }).format(new Date(row.at)),
              row.actor_account_id === scope.accountId
                ? t(($) => $.settings.historySelf)
                : t(($) => $.settings.historyOther),
              level === "organization"
                ? t(($) => $.settings.nativePolicies.organization)
                : t(($) => $.settings.nativePolicies.center),
              <div key="change" className="flex flex-col gap-1">
                <span>{t(($) => $.settings.historyFields, { count })}</span>
                {row.media_change && <span>{t(($) => $.settings.historyMedia)}</span>}
                {row.reason && <span>{row.reason}</span>}
              </div>,
            ],
          };
        }),
        after: (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="text-xs text-muted-foreground">
              {t(($) => $.settings.historyPage, { page: stack.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                isDisabled={locked || stack.length < 2}
                onPress={() =>
                  setStacks((previous) => ({ ...previous, [level]: previous[level].slice(0, -1) }))
                }
              >
                {t(($) => $.settings.historyPrevious)}
              </Button>
              <Button
                variant="outline"
                type="button"
                isDisabled={locked || !source.next_cursor || repeated}
                onPress={() => {
                  const next = source.next_cursor;
                  if (next && !repeated)
                    setStacks((previous) => ({
                      ...previous,
                      [level]: [...previous[level], next],
                    }));
                }}
              >
                {t(($) => $.settings.historyNext)}
              </Button>
            </div>
          </div>
        ),
      }
    : undefined;
  const filter: SettingsFieldValue = {
    value: "all",
    writable: false,
    options: [{ id: "all", label: t(($) => $.settings.historyAll) }],
    description: t(($) => $.settings.historyScopeHint),
  };
  return {
    table,
    filter,
    notice:
      query.isError || repeated ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {t(($) => $.settings.historyReadError)}{" "}
            <Button
              variant="outline"
              isDisabled={locked || query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null,
  };
}
