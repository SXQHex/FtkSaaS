import { useEffect, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { CardContent } from "@ftksaas/ui/components/card";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import type { ClientScope } from "../../lib/scoped-backend";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import {
  billingTaxIntent,
  readBillingTax,
  readBillingTaxReceipt,
  readBillingTaxResult,
  writeBillingTax,
  type BillingTaxIntent,
} from "./settings-invoices";
import { SettingsReviewDialog } from "./settings-review-dialog";

export function SettingsTaxProfile({
  scope,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  locked: boolean;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const officeId = useId(),
    identifierId = useId(),
    headingId = useId();
  const queryKey = ["billing-tax", scope.accountId, scope.orgId];
  const profile = useQuery({
    queryKey,
    queryFn: () => readBillingTax(scope),
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState<{ office: string; identifier: string; version: number }>();
  const [intent, setIntent] = useState<BillingTaxIntent>();
  const [accepted, setAccepted] = useState(false);
  const command = useMemberCommand({
    write: writeBillingTax,
    readReceipt: readBillingTaxReceipt,
    readResult: readBillingTaxResult,
    onRefresh: async (result) => {
      queries.setQueryData(queryKey, result);
      setDraft(undefined);
    },
    onAccessLost: (error) => {
      if (!onAccessLost(error)) return false;
      setDenied(true);
      setIntent(undefined);
      setDraft(undefined);
      return true;
    },
  });
  useEffect(() => {
    if (!command.locked) return;
    onLockChange(true);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  const source = profile.isError || denied ? undefined : profile.data;
  const editing = draft?.version === source?.version ? draft : undefined;
  const office = editing?.office ?? source?.tax_office ?? "";
  const identifier = editing?.identifier ?? source?.tax_identifier ?? "";
  const changed =
    !!source &&
    ((office.trim() || null) !== source.tax_office ||
      (identifier.trim() || null) !== source.tax_identifier);
  const officeLabel = t(($) => $.settings.invoices.taxOffice);
  const identifierLabel = t(($) => $.settings.invoices.taxIdentifier);
  const clearReview = () => {
    command.reset();
    setIntent(undefined);
    setAccepted(false);
  };
  return (
    <CardContent className="space-y-3">
      <h3 id={headingId} className="text-sm font-semibold">
        {t(($) => $.settings.invoices.taxTitle)}
      </h3>
      {profile.isPending ? (
        <p role="status">{t(($) => $.settings.invoices.loading)}</p>
      ) : !source ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{t(($) => $.settings.invoices.taxReadError)}</p>
            {!denied && (
              <Button
                variant="outline"
                isDisabled={profile.isFetching || locked}
                onPress={() => void profile.refetch()}
              >
                {t(($) => $.auth.retry)}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <form
          method="post"
          aria-labelledby={headingId}
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (locked || profile.isFetching || !changed) return;
            setAccepted(false);
            setIntent(
              billingTaxIntent(scope, source, {
                tax_office: office.trim() || null,
                tax_identifier: identifier.trim() || null,
              }),
            );
          }}
        >
          <Field>
            <FieldLabel htmlFor={officeId}>{officeLabel}</FieldLabel>
            <Input
              id={officeId}
              value={office}
              maxLength={200}
              disabled={locked}
              onChange={(event) => {
                setDraft({ office: event.target.value, identifier, version: source.version });
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={identifierId}>{identifierLabel}</FieldLabel>
            <Input
              id={identifierId}
              value={identifier}
              maxLength={100}
              disabled={locked}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) =>
                setDraft({ office, identifier: event.target.value, version: source.version })
              }
            />
          </Field>
          <div className="flex sm:col-span-2">
            <Button
              type="submit"
              variant="outline"
              isDisabled={locked || profile.isFetching || !changed}
            >
              {t(($) => $.settings.invoices.reviewTax)}
            </Button>
          </div>
        </form>
      )}
      {intent && !denied && (
        <SettingsReviewDialog
          open
          title={t(($) => $.settings.invoices.reviewTax)}
          description={t(($) => $.settings.invoices.taxEffect)}
          rows={[
            {
              id: "office",
              title: officeLabel,
              detail: intent.patch.tax_office ?? t(($) => $.settings.invoices.cleared),
            },
            {
              id: "identifier",
              title: identifierLabel,
              detail: intent.patch.tax_identifier ?? t(($) => $.settings.invoices.cleared),
            },
          ]}
          accepted={accepted}
          onAccepted={setAccepted}
          locked={command.locked}
          onClose={clearReview}
          onApply={
            !locked &&
            command.state === "ready" &&
            source?.version === intent.patch.expected_version
              ? () => void command.start(intent)
              : undefined
          }
          recoveryActions={
            <EventCommandNotice
              command={command}
              onReload={() => {
                if (command.state !== "saved") setDraft(undefined);
                clearReview();
                if (command.state !== "saved") void profile.refetch();
              }}
            />
          }
        />
      )}
    </CardContent>
  );
}
