import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, LinkButton } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Textarea } from "../../components/ui/textarea";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { usePlatformActivity } from "./platform-activity-context";
import { PlatformInvoices } from "./platform-invoices";
import { PlatformReadError } from "./platform-read-error";
import {
  platformAccessDenied,
  platformOrganizationsKey,
  readPlatformOrganization,
  readSuspensionResult,
  suspensionIntent,
  suspensionReason,
  writeSuspension,
} from "./platform-directory";

export function PlatformOrganizationDetail({
  accountId,
  organizationId,
  canSuspend,
  paymentsHref,
  onDenied,
}: {
  accountId: string;
  organizationId: string;
  canSuspend: boolean;
  paymentsHref?: string;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const { record } = usePlatformActivity();
  const labelId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [intent, setIntent] = useState<ReturnType<typeof suspensionIntent>>();
  const [accepted, setAccepted] = useState(false);
  const key = ["platform-organization", accountId, organizationId];
  const detail = useQuery({
    queryKey: key,
    queryFn: () => readPlatformOrganization(accountId, organizationId),
    retry: false,
    refetchOnMount: "always",
    gcTime: 0,
  });
  const command = useMemberCommand({
    write: writeSuspension,
    readResult: readSuspensionResult,
    onAccessLost: (error) => {
      if (!platformAccessDenied(error)) return false;
      onDenied();
      return true;
    },
    onRefresh: async (data) => {
      if (intent)
        record({
          key: intent.key,
          kind: data.organization.platform_suspended ? "suspended" : "resumed",
          subject: data.organization.name,
        });
      queries.setQueryData(key, data);
      await queries.invalidateQueries({ queryKey: platformOrganizationsKey(accountId) });
      await queries.invalidateQueries({ queryKey: ["platform-grace", accountId, organizationId] });
      setReason("");
    },
  });
  const closeReview = () => {
    command.reset();
    setAccepted(false);
    setIntent(undefined);
  };
  const row = detail.isError ? undefined : detail.data?.organization;
  const subscription = row?.subscription_state;
  const action = t(($) =>
    (intent ? !intent.suspended : row?.platform_suspended) ? $.platform.resume : $.platform.suspend,
  );
  if (platformAccessDenied(detail.error))
    return <PlatformReadError error={detail.error} onRetry={() => void detail.refetch()} />;
  return (
    <>
      {detail.isPending ? (
        <p role="status">{t(($) => $.platform.loading)}</p>
      ) : detail.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{t(($) => $.platform.readError)}</p>
            <Button variant="outline" onPress={() => void detail.refetch()}>
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : row ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2 className="wrap-anywhere">{row.name}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">{t(($) => $.platform.lifecycle)}</dt>
                <dd>{t(($) => $.platform.states[row.state])}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  {t(($) => $.platform.subscription)}
                </dt>
                <dd>
                  {subscription
                    ? t(($) => $.platform.subscriptions[subscription])
                    : t(($) => $.platform.noSubscription)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t(($) => $.platform.access)}</dt>
                <dd className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {t(($) => $.platform.accessModes[row.access_mode])}
                  </Badge>
                  {row.platform_suspended && (
                    <Badge variant="destructive">{t(($) => $.platform.suspended)}</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t(($) => $.platform.owner)}</dt>
                <dd className="wrap-anywhere">
                  {detail.data?.owner?.display_name ?? t(($) => $.platform.noOwner)}
                </dd>
              </div>
              {row.grace_until && (
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t(($) => $.platform.graceUntil)}
                  </dt>
                  <dd>
                    <time dateTime={row.grace_until}>
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(row.grace_until))}
                    </time>
                  </dd>
                </div>
              )}
            </dl>
            {paymentsHref && (
              <LinkButton href={paymentsHref} variant="outline" isDisabled={command.locked}>
                {t(($) => $.platform.billing.organizationPayments)}
              </LinkButton>
            )}
            {canSuspend && (row.state === "active" || row.platform_suspended) && (
              <form
                className="space-y-3 border-t pt-4"
                method="post"
                noValidate
                aria-label={t(($) => $.platform.access)}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (intent || command.locked || detail.isFetching) return;
                  const parsed = suspensionReason.safeParse(reason);
                  if (!parsed.success) {
                    setInvalid(true);
                    field.current?.focus();
                    return;
                  }
                  setAccepted(false);
                  setIntent(suspensionIntent(accountId, row, parsed.data));
                }}
              >
                <Field>
                  <FieldLabel htmlFor={labelId}>{t(($) => $.platform.reason)}</FieldLabel>
                  <Textarea
                    id={labelId}
                    ref={field}
                    value={reason}
                    required
                    maxLength={1000}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? labelId + "-error" : undefined}
                    disabled={command.locked}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setInvalid(false);
                    }}
                  />
                  {invalid && (
                    <FieldError id={labelId + "-error"}>
                      {t(($) => $.platform.reasonError)}
                    </FieldError>
                  )}
                </Field>
                <Button
                  variant="outline"
                  type="submit"
                  isDisabled={command.locked || detail.isFetching}
                >
                  {action}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>{t(($) => $.platform.missing)}</AlertDescription>
        </Alert>
      )}
      {row && (
        <PlatformInvoices
          key={row.id}
          accountId={accountId}
          orgId={row.id}
          name={row.name}
          onDenied={onDenied}
        />
      )}
      {intent && (
        <SettingsReviewDialog
          open
          title={action}
          description={t(($) =>
            intent.suspended ? $.platform.suspendEffect : $.platform.resumeEffect,
          )}
          rows={[
            {
              id: intent.orgId,
              title: row?.name ?? t(($) => $.platform.organization),
              detail: intent.reason,
            },
          ]}
          accepted={accepted}
          onAccepted={setAccepted}
          locked={command.locked}
          onClose={closeReview}
          onApply={
            canSuspend &&
            !detail.isFetching &&
            row?.version === intent.version &&
            command.state === "ready"
              ? () => void command.start(intent)
              : undefined
          }
          recoveryActions={
            <EventCommandNotice
              command={command}
              receiptAvailable={false}
              onReload={() => {
                closeReview();
                if (command.state !== "saved") void detail.refetch();
              }}
            />
          }
        />
      )}
    </>
  );
}
