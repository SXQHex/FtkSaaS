import { cacheVerifiedReadback, invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { useEffect, useId, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { readTeamPage, type ManagerRole } from "../settings/settings-team";
import { settlementAuthority, settlementRequest } from "./business-settlement-api";

type AuthorityIntent = {
  scope: ClientScope;
  target: string;
  role: ManagerRole;
  granted: boolean;
  version: number;
  reason: string;
  key: string;
};
async function writeAuthority(intent: AuthorityIntent) {
  const backend = await scopedBackend(intent.scope);
  const base = {
    ...settlementRequest(intent.scope),
    operation_key: intent.key,
    reason: intent.reason,
    person_id: intent.target,
    expected_version: intent.version,
    granted: intent.granted,
  };
  if (intent.role === "org_manager") {
    const { center_id: _center, ...organization } = base;
    return backend.call("settlement_delegation_set_v1", organization);
  }
  return backend.call("settlement_authority_set_v1", base);
}
function currentGrant(row: Awaited<ReturnType<typeof settlementAuthority>>, role: ManagerRole) {
  return role === "org_manager"
    ? row.delegation_allowed
    : row.center_grants.some((entry) => entry.granted);
}
async function readAuthorityResult(intent: AuthorityIntent, id?: string) {
  if (id !== intent.scope.orgId) throw Error("SETTLEMENT_AUTHORITY_RESULT_INVALID");
  const result = await settlementAuthority(intent.scope, intent.target);
  if (result.version <= intent.version || intent.granted !== currentGrant(result, intent.role))
    throw Error("SETTLEMENT_AUTHORITY_RESULT_INVALID");
  return result;
}

export function BusinessSettlementAuthority({
  scope,
  owner,
  onLockChange,
}: {
  scope: ClientScope;
  owner: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const client = useQueryClient();
  const [role, setRole] = useState<ManagerRole>("center_manager");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [intent, setIntent] = useState<AuthorityIntent>();
  const [accepted, setAccepted] = useState(false);
  const directory = useInfiniteQuery({
    queryKey: ["business-settlement-managers", scope.accountId, scope.orgId, scope.centerId, role],
    initialPageParam: undefined as string | undefined,
    queryFn: (context) =>
      readTeamPage(scope, role, context.pageParam, undefined, undefined, context),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    gcTime: 0,
    retry: false,
  });
  const managers = directory.isError
    ? []
    : (directory.data?.pages.flatMap((page) => page.records) ?? []);
  const person = managers.find((row) => row.personId === target);
  const key = ["business-settlement-admin", scope.accountId, scope.orgId, scope.centerId, target];
  const read = useQuery({
    queryKey: key,
    queryFn: (context) => settlementAuthority(scope, target, context),
    enabled: Boolean(person),
    gcTime: 0,
    retry: false,
  });
  const source = read.isError ? undefined : read.data;
  const command = useMemberCommand({
    write: writeAuthority,
    readResult: readAuthorityResult,
    onAccessLost: () => false,
    onRefresh: async (data) => {
      await cacheVerifiedReadback(client, key, data);
      await invalidateCachedFamilies(client, [
        ["business-settlement", scope.accountId, scope.orgId],
      ]);
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  function close() {
    if (command.locked) return;
    if (command.state === "saved") setReason("");
    if (command.state === "stale" || command.state === "rejected") void read.refetch();
    command.reset();
    setIntent(undefined);
    setAccepted(false);
  }
  const title = t(($) => $.businessCenters.settlement.authority);
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
          aria-label={title}
          className="max-w-xl space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!source || !person || !reason.trim() || read.isFetching || command.locked) return;
            setIntent({
              scope,
              target,
              role,
              granted: !currentGrant(source, role),
              reason: reason.trim(),
              version: source.version,
              key: uuidv7(),
            });
          }}
        >
          {owner && (
            <Field>
              <FieldLabel htmlFor={id + "-role"}>
                {t(($) => $.businessCenters.settlement.role)}
              </FieldLabel>
              <NativeSelect
                id={id + "-role"}
                value={role}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "org_manager" || value === "center_manager") {
                    setRole(value);
                    setTarget("");
                  }
                }}
              >
                <NativeSelectOption value="center_manager">
                  {t(($) => $.workspace.roles.center_manager)}
                </NativeSelectOption>
                <NativeSelectOption value="org_manager">
                  {t(($) => $.workspace.roles.org_manager)}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor={id + "-who"}>{t(($) => $.businessCenters.person)}</FieldLabel>
            <NativeSelect
              id={id + "-who"}
              value={target}
              disabled={directory.isError || directory.isPending}
              onChange={(event) => setTarget(event.target.value)}
            >
              <NativeSelectOption value="">
                {t(($) => $.businessCenters.settlement.choosePerson)}
              </NativeSelectOption>
              {managers.map((row) => (
                <NativeSelectOption key={row.id} value={row.personId}>
                  {row.person.display_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {directory.hasNextPage && !directory.isError && (
            <Button
              variant="outline"
              isDisabled={directory.isFetching}
              onPress={() => void directory.fetchNextPage()}
            >
              {t(($) => $.businessCenters.more)}
            </Button>
          )}
          {(directory.isError || read.isError) && (
            <p role="alert">{t(($) => $.businessCenters.settlement.readError)}</p>
          )}
          {source && (
            <>
              <p>
                {t(($) =>
                  currentGrant(source, role)
                    ? $.businessCenters.settlement.hasGrant
                    : $.businessCenters.settlement.noGrant,
                )}
              </p>
              <Field>
                <FieldLabel htmlFor={id + "-reason"}>{t(($) => $.platform.reason)}</FieldLabel>
                <Textarea
                  id={id + "-reason"}
                  value={reason}
                  maxLength={1000}
                  required
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                isDisabled={!reason.trim() || read.isFetching || command.locked}
              >
                {t(($) =>
                  currentGrant(source, role)
                    ? $.businessCenters.settlement.revoke
                    : $.businessCenters.settlement.grant,
                )}
              </Button>
            </>
          )}
        </form>
      </CardContent>
      {intent && person && (
        <SettingsReviewDialog
          open
          title={t(($) =>
            intent.granted
              ? $.businessCenters.settlement.grant
              : $.businessCenters.settlement.revoke,
          )}
          description={t(($) => $.businessCenters.settlement.authorityEffect)}
          rows={[{ id: intent.target, title: person.person.display_name, detail: intent.reason }]}
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
