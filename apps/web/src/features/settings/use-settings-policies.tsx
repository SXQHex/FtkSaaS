import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PolicyValue, PolicyView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { readSettingsPolicies } from "./settings-policies";
import type { SettingsLevel } from "./settings-document";
import type { SettingsViewData } from "./settings-view";

export function useSettingsPolicies({
  scope,
  level,
  enabled,
  timezone,
  onAccessLost,
  onEdit,
  writable = false,
  locked = false,
}: {
  scope: ClientScope;
  level: SettingsLevel;
  enabled: boolean;
  timezone: string;
  onAccessLost: (cause: unknown) => boolean;
  onEdit?: (policy: PolicyView) => void;
  writable?: boolean;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["settings-policies", scope.accountId, scope.orgId, scope.centerId, level],
    queryFn: () => readSettingsPolicies(scope, level),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const source = enabled && !query.isError && !query.isFetching ? query.data : undefined;
  function describe(value: PolicyValue): string {
    const effect = (value: "release" | "consume") => t(($) => $.settings.nativePolicies[value]);
    switch (value.kind) {
      case "integer":
        return String(value.value);
      case "boolean":
        return value.value ? t(($) => $.settings.on) : t(($) => $.settings.off);
      case "window":
        return t(($) => $.settings.nativePolicies.window, {
          opens: value.opens_minutes_before,
          closes: value.closes_minutes_before,
          exception: value.manager_exception ? t(($) => $.settings.on) : t(($) => $.settings.off),
        });
      case "attendance_window":
        return t(($) => $.settings.nativePolicies.attendanceWindow, {
          opens: value.opens_minutes_before,
          closes: value.closes_minutes_after,
        });
      case "cancellation":
        return t(($) => $.settings.nativePolicies.cancellation, {
          cutoff: value.terms.cutoff_minutes ?? t(($) => $.settings.unsetHint),
          before: effect(value.terms.before_cutoff),
          after: effect(value.terms.after_cutoff),
          absent: effect(value.terms.no_show),
        });
      case "blocked_credit":
        return effect(value.effect);
      case "valuation":
        return formatMinorAmount(value.amount_minor, value.currency);
      case "documents":
        return t(($) => $.settings.nativePolicies.documents, { count: value.requirements.length });
    }
  }
  const fields: NonNullable<SettingsViewData["fields"]> = {};
  const opening = source?.items.find((row) => row.key === "reservation_window");
  if (opening?.value.kind === "window")
    fields["ay-acilis"] = {
      value: String(opening.value.opens_minutes_before),
      writable: false,
      options: [{ id: String(opening.value.opens_minutes_before), label: describe(opening.value) }],
    };
  const offer = source?.items.find((row) => row.key === "waitlist_offer_minutes");
  if (offer?.value.kind === "integer")
    fields["ay-teklif"] = {
      value: String(offer.value.value),
      writable: false,
      options: [
        {
          id: String(offer.value.value),
          label: t(($) => $.settings.nativePolicies.minutes, { count: offer.value.value }),
        },
      ],
    };
  const table: NonNullable<SettingsViewData["tables"]>["politika"] = source
    ? {
        columns: ["policy", "version", "summary", "action"],
        rows: source.items.map((row) => ({
          id: row.key,
          cells: [
            t(($) => $.settings.nativePolicies.keys[row.key]),
            t(($) => $.settings.nativePolicies.version, {
              version: row.version,
              effective: new Intl.DateTimeFormat("tr-TR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: timezone,
              }).format(new Date(row.effective_at)),
              scope:
                row.scope.kind === "organization"
                  ? t(($) => $.settings.nativePolicies.organization)
                  : t(($) => $.settings.nativePolicies.center),
              mandatory: row.mandatory
                ? t(($) => $.settings.nativePolicies.mandatory)
                : t(($) => $.settings.nativePolicies.advisory),
            }),
            describe(row.value),
            <Button
              key="edit"
              variant="outline"
              size="sm"
              isDisabled={
                locked ||
                !writable ||
                !onEdit ||
                row.value.kind === "documents" ||
                (level === "center" && row.scope.kind === "organization" && row.mandatory)
              }
              onPress={() => onEdit?.(row)}
            >
              {t(($) => $.settings.policyNative.edit)}
            </Button>,
          ],
        })),
      }
    : undefined;
  return {
    fields,
    table,
    notice: query.isError ? (
      <Alert variant="destructive" role="alert">
        <AlertDescription>
          {t(($) => $.settings.nativePolicies.readError)}{" "}
          <Button
            variant="outline"
            isDisabled={query.isFetching}
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
