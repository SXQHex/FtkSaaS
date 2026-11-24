import { useId, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@ftksaas/ui/components/badge";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import type { CenterView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { readDisciplineCatalog } from "../settings/discipline-reader";
import { readTeamPage } from "../settings/settings-team";
import { useSettingsPolicies } from "../settings/use-settings-policies";

type Resource = "managers" | "policies" | "disciplines";

export function BusinessCenterResources({
  scope,
  centers,
  resource,
  organization,
}: {
  scope: ClientScope;
  centers: CenterView[];
  resource: Resource;
  organization: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState(scope.centerId);
  const center = centers.find((row) => row.id === selected && row.state === "active");
  const title = t(($) => $.businessCenters.tabs[resource]);
  const settings = { managers: "ekip", policies: "politika", disciplines: "salonlar" } as const;
  const centerScope = center ? { ...scope, centerId: center.id } : null;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field className="w-fit">
          <FieldLabel htmlFor={id}>{t(($) => $.businessCenters.center)}</FieldLabel>
          <NativeSelect
            id={id}
            value={center?.id ?? ""}
            onChange={(event) => setSelected(event.target.value)}
          >
            {!center && (
              <NativeSelectOption value="">
                {t(($) => $.businessCenters.chooseCenter)}
              </NativeSelectOption>
            )}
            {centers
              .filter((row) => row.state === "active")
              .map((row) => (
                <NativeSelectOption key={row.id} value={row.id}>
                  {row.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </Field>
        {center && centerScope && (
          <>
            {resource === "managers" ? (
              <Managers scope={centerScope} organization={organization} />
            ) : resource === "policies" ? (
              <Policies scope={centerScope} timezone={center.timezone} />
            ) : (
              <Disciplines scope={centerScope} />
            )}
            <LinkButton
              href={`/o/${scope.orgId}/c/${center.id}/settings?section=${settings[resource]}`}
              variant="outline"
            >
              {t(($) => $.businessCenters.edit)}
            </LinkButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Managers({ scope, organization }: { scope: ClientScope; organization: boolean }) {
  const { t } = useTranslation();
  const [org, setOrg] = useState(false);
  const role = organization && org ? "org_manager" : "center_manager";
  const read = useInfiniteQuery({
    queryKey: ["business-managers", scope.accountId, scope.orgId, scope.centerId, role],
    initialPageParam: undefined as string | undefined,
    queryFn: (context) =>
      readTeamPage(scope, role, context.pageParam, undefined, undefined, context),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    gcTime: 0,
    retry: false,
  });
  const rows = read.isError ? [] : (read.data?.pages.flatMap((page) => page.records) ?? []);
  return (
    <>
      {organization && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={org ? "outline" : "default"}
            onPress={() => setOrg(false)}
            aria-pressed={!org}
          >
            {t(($) => $.workspace.roles.center_manager)}
          </Button>
          <Button
            variant={org ? "default" : "outline"}
            onPress={() => setOrg(true)}
            aria-pressed={org}
          >
            {t(($) => $.workspace.roles.org_manager)}
          </Button>
        </div>
      )}
      {read.isPending ? (
        <p role="status">{t(($) => $.platform.loading)}</p>
      ) : read.isError ? (
        <p role="alert">{t(($) => $.businessCenters.directoryError)}</p>
      ) : !rows.length ? (
        <p>{t(($) => $.businessCenters.empty)}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border p-3 wrap-anywhere">
              {row.name}
            </li>
          ))}
        </ul>
      )}
      {read.hasNextPage && !read.isError && (
        <Button
          variant="outline"
          isDisabled={read.isFetching}
          onPress={() => void read.fetchNextPage()}
        >
          {t(($) => $.businessCenters.more)}
        </Button>
      )}
    </>
  );
}

function Policies({ scope, timezone }: { scope: ClientScope; timezone: string }) {
  const { t } = useTranslation();
  const { table, notice } = useSettingsPolicies({
    scope,
    level: "center",
    enabled: true,
    timezone,
    onAccessLost: () => false,
  });
  if (notice) return notice;
  if (!table) return <p role="status">{t(($) => $.platform.loading)}</p>;
  if (!table.rows.length) return <p>{t(($) => $.businessCenters.empty)}</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {table.rows.map(({ id, cells }) => (
        <li key={id} className="space-y-1 rounded-md border p-3 wrap-anywhere">
          <p className="font-medium">{cells[0]}</p>
          <p className="text-sm text-muted-foreground">{cells[1]}</p>
          <p>{cells[2]}</p>
        </li>
      ))}
    </ul>
  );
}

function Disciplines({ scope }: { scope: ClientScope }) {
  const { t } = useTranslation();
  const read = useQuery({
    queryKey: ["business-disciplines", scope.accountId, scope.orgId, scope.centerId],
    queryFn: (context) => readDisciplineCatalog(scope, "center", context),
    gcTime: 0,
    retry: false,
  });
  if (read.isPending) return <p role="status">{t(($) => $.platform.loading)}</p>;
  if (read.isError) return <p role="alert">{t(($) => $.businessCenters.directoryError)}</p>;
  if (!read.data.length) return <p>{t(($) => $.businessCenters.empty)}</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {read.data.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 wrap-anywhere"
        >
          {row.name}
          <Badge variant="outline">
            {t(($) =>
              row.state === "active" && row.presentation.center?.state === "active"
                ? $.businessCenters.active
                : $.businessCenters.inactive,
            )}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
