import { useEffect, useId, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ftksaas/ui/components/table";
import type { CenterView } from "@ftksaas/api-contracts";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { EventCommandNotice } from "../events/event-command-notice";
import { readApplicationsPage } from "../leads/leads-read";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readPeoplePage } from "../people/people";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";

export function BusinessPeople({ scope, centers }: { scope: ClientScope; centers: CenterView[] }) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const people = useInfiniteQuery({
    queryKey: ["business-people", scope.accountId, scope.orgId, term],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      readPeoplePage({ accountId: scope.accountId, orgId: scope.orgId }, term, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
    gcTime: 0,
  });
  const title = t(($) => $.businessCenters.tabs.people);
  const rows = people.isError ? [] : (people.data?.pages.flatMap((page) => page.items) ?? []);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          method="post"
          className="flex max-w-xl flex-wrap items-end gap-2"
          aria-label={title}
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(draft.trim());
          }}
        >
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={id}>{t(($) => $.people.search)}</FieldLabel>
            <Input
              id={id}
              type="search"
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="outline">
            {t(($) => $.people.search)}
          </Button>
        </form>
        {people.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : people.isError ? (
          <p role="alert">{t(($) => $.businessCenters.directoryError)}</p>
        ) : !rows.length ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : (
          <Table aria-label={title} scrollRegionLabel={title} className="min-w-[32rem]">
            <TableHeader>
              <TableHead isRowHeader>{t(($) => $.businessCenters.person)}</TableHead>
              <TableHead>{t(($) => $.businessCenters.subscriber)}</TableHead>
              <TableHead>{t(($) => $.businessCenters.title)}</TableHead>
            </TableHeader>
            <TableBody items={rows}>
              {(row) => {
                const joined = centers.filter((center) =>
                  row.relationships.some(
                    (membership) =>
                      membership.center_id === center.id && membership.state === "active",
                  ),
                );
                return (
                  <TableRow id={row.id}>
                    <TableCell className="max-w-40 whitespace-normal wrap-anywhere">
                      {row.display_name}
                    </TableCell>
                    <TableCell>{row.subscriber_number ?? "—"}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      {joined.map((center) => (
                        <LinkButton
                          key={center.id}
                          href={`/o/${scope.orgId}/c/${center.id}/people/${row.id}`}
                          variant="ghost"
                          size="sm"
                        >
                          {center.name}
                        </LinkButton>
                      ))}
                    </TableCell>
                  </TableRow>
                );
              }}
            </TableBody>
          </Table>
        )}
        {people.hasNextPage && !people.isError && (
          <Button
            variant="outline"
            isDisabled={people.isFetching}
            onPress={() => void people.fetchNextPage()}
          >
            {t(($) => $.businessCenters.more)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type ApplicationScope = Pick<ClientScope, "accountId" | "orgId">;
type RoutingIntent = {
  scope: ApplicationScope;
  id: string;
  version: number;
  destination: string;
  name: string;
  key: string;
};
async function routeApplication(intent: RoutingIntent) {
  return (await scopedBackend(intent.scope)).call("public_application_review_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    operation_key: intent.key,
    org_id: intent.scope.orgId,
    application_id: intent.id,
    expected_version: intent.version,
    action: "assign_center",
    target_center_id: intent.destination,
  });
}
async function readRoutedApplication(intent: RoutingIntent, id?: string) {
  if (id !== intent.id) throw Error("APPLICATION_RESULT_INVALID");
  const result = await readApplicationsPage(intent.scope, undefined, id);
  const row = result.items[0];
  if (
    result.items.length !== 1 ||
    result.next_cursor ||
    row?.values.center_id !== intent.destination ||
    row.version <= intent.version
  )
    throw Error("APPLICATION_RESULT_INVALID");
  return row;
}

export function BusinessApplications({
  scope,
  centers,
  onLockChange,
}: {
  scope: ClientScope;
  centers: CenterView[];
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const key = ["business-applications", scope.accountId, scope.orgId];
  const [destination, setDestination] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<RoutingIntent>();
  const [accepted, setAccepted] = useState(false);
  const organization = { accountId: scope.accountId, orgId: scope.orgId };
  const applications = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      readApplicationsPage(organization, pageParam, undefined, ["pending"]),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
    gcTime: 0,
  });
  const command = useMemberCommand({
    write: routeApplication,
    readResult: readRoutedApplication,
    onAccessLost: () => false,
    onRefresh: async (row) => {
      setDestination((current) => ({ ...current, [row.id]: "" }));
      await client.invalidateQueries({ queryKey: key });
      await client.invalidateQueries({
        queryKey: ["lead-applications", scope.accountId, scope.orgId],
      });
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  function close() {
    if (command.locked) return;
    if (command.state === "stale" || command.state === "rejected") void applications.refetch();
    command.reset();
    setIntent(undefined);
    setAccepted(false);
  }
  const rows = applications.isError
    ? []
    : (applications.data?.pages.flatMap((page) => page.items) ?? []);
  const title = t(($) => $.businessCenters.tabs.applications);
  const centerName = (id?: string | null) =>
    centers.find((row) => row.id === id)?.name ?? t(($) => $.businessCenters.unassigned);
  const routeLabel = t(($) => $.businessCenters.route);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {applications.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : applications.isError ? (
          <p role="alert">{t(($) => $.businessCenters.directoryError)}</p>
        ) : !rows.length ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const name =
                row.values.contact_intake?.display_name ??
                row.values.intake?.display_name ??
                row.values.contact ??
                t(($) => $.leads.applicant);
              const current = row.values.center_id;
              const selected = destination[row.id] ?? "";
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-end justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 wrap-anywhere">
                    <p className="font-medium">{name}</p>
                    <p>{centerName(current)}</p>
                  </div>
                  <form
                    method="post"
                    aria-label={name}
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (selected && !command.locked && !applications.isFetching)
                        setIntent({
                          scope: organization,
                          id: row.id,
                          version: row.version,
                          destination: selected,
                          name,
                          key: uuidv7(),
                        });
                    }}
                  >
                    <Field>
                      <FieldLabel htmlFor={`destination-${row.id}`}>
                        {t(($) => $.businessCenters.destination)}
                      </FieldLabel>
                      <NativeSelect
                        id={`destination-${row.id}`}
                        value={selected}
                        onChange={(event) =>
                          setDestination({ ...destination, [row.id]: event.target.value })
                        }
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.businessCenters.chooseCenter)}
                        </NativeSelectOption>
                        {centers
                          .filter((center) => center.state === "active" && center.id !== current)
                          .map((center) => (
                            <NativeSelectOption key={center.id} value={center.id}>
                              {center.name}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </Field>
                    <Button
                      variant="outline"
                      type="submit"
                      isDisabled={command.locked || applications.isFetching || !selected}
                    >
                      {routeLabel}
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        {applications.hasNextPage && !applications.isError && (
          <Button
            variant="outline"
            isDisabled={applications.isFetching || command.locked}
            onPress={() => void applications.fetchNextPage()}
          >
            {t(($) => $.businessCenters.more)}
          </Button>
        )}
      </CardContent>
      {intent && (
        <SettingsReviewDialog
          open
          title={routeLabel}
          description={t(($) => $.businessCenters.routeEffect)}
          rows={[{ id: intent.id, title: intent.name, detail: centerName(intent.destination) }]}
          accepted={accepted}
          onAccepted={setAccepted}
          onClose={close}
          locked={command.locked}
          onApply={command.state === "ready" ? () => void command.start(intent) : undefined}
          recoveryActions={
            <EventCommandNotice command={command} receiptAvailable={false} onReload={close} />
          }
        />
      )}
    </Card>
  );
}
