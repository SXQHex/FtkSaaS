import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { SettingsViewData } from "./settings-view";
import { readSettingsSubscription } from "./settings-subscription";

export function useSettingsSubscription({
  scope,
  enabled,
  timezone,
  locked,
  onAccessLost,
}: {
  scope: ClientScope;
  enabled: boolean;
  timezone: string;
  locked: boolean;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["settings-subscription", scope.accountId, scope.orgId],
    queryFn: () => readSettingsSubscription(scope),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const scopedSource =
    enabled && !query.isError && !query.isFetching && query.data
      ? { ...query.data, scope }
      : undefined;
  const source = scopedSource?.subscription;
  const date = (value: string | null) =>
    value === null
      ? t(($) => $.settings.unsetHint)
      : new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: timezone,
        }).format(new Date(value));
  const billing = source?.billing;
  const pending = billing?.pending_period_change;
  const data: Pick<SettingsViewData, "metrics" | "plan"> = {
    metrics: source?.usage.entries.map((usage) => {
      const limit = source.limits.entries.find((row) => row.key === usage.key);
      return {
        id: usage.key,
        label: t(($) => $.settings.subscriptionLimits[usage.key]),
        value: usage.value,
        maximum: limit && "value" in limit ? limit.value : null,
        unlimited: !!limit && "unlimited" in limit && limit.unlimited,
        limitDescription:
          !limit && usage.key === "disciplines"
            ? t(($) => $.settings.subscriptionNoNumericLimit)
            : undefined,
      };
    }),
    plan: source
      ? {
          name: t(($) => $.settings.subscriptionPlans[source.plan]),
          renewalActionLabel: source.cancel_at_period_end
            ? t(($) => $.settings.subscriptionResumeRenewal)
            : t(($) => $.settings.subscriptionStopRenewal),
          nextInvoice: t(($) => $.settings.subscriptionPeriod, {
            start: date(source.period_start),
            end: date(source.period_end),
          }),
          paymentMethod: t(($) => $.settings.subscriptionManualPayment),
          paymentDescription: billing
            ? t(($) => $.settings.subscriptionTerms, {
                period: t(($) => $.settings.subscriptionPeriods[billing.current.period]),
                amount: formatMinorAmount(billing.current.amount_minor, billing.current.currency),
              })
            : null,
          subscriptionState: t(($) => $.settings.subscriptionStatus, {
            state: t(($) => $.settings.subscriptionStates[source.state]),
            renewal: source.cancel_at_period_end
              ? t(($) => $.settings.off)
              : t(($) => $.settings.on),
            grace: date(source.grace_until),
          }),
          pendingDescription: pending
            ? t(($) => $.settings.subscriptionPendingPeriod, {
                period: t(($) => $.settings.subscriptionPeriods[pending.target.period]),
                amount: formatMinorAmount(pending.target.amount_minor, pending.target.currency),
                effective: date(pending.effective_at),
              })
            : source.pending_change
              ? t(($) => $.settings.subscriptionPendingChange)
              : billing
                ? t(($) => $.settings.subscriptionNoPendingChange)
                : t(($) => $.settings.unknown),
        }
      : undefined,
  };
  return {
    data,
    downgradeSource:
      source?.subscription_version && source.billing?.downgrade_options?.length
        ? scopedSource
        : undefined,
    upgradeSource:
      source?.subscription_version && source.billing?.upgrade_options?.length
        ? scopedSource
        : undefined,
    cancelSource:
      source && (source.pending_change || source.billing?.pending_period_change)
        ? scopedSource
        : undefined,
    periodSource:
      source?.subscription_version && source.billing?.period_change_options.length
        ? scopedSource
        : undefined,
    paymentSource: source?.billing?.current.currency ? scopedSource : undefined,
    renewalSource:
      scopedSource &&
      source?.state === "active" &&
      source.period_end &&
      Date.parse(source.period_end) > scopedSource.readAt &&
      source.subscription_version &&
      !source.billing?.pending_period_change
        ? scopedSource
        : undefined,

    notice:
      enabled && query.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {t(($) => $.settings.subscriptionReadError)}{" "}
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
