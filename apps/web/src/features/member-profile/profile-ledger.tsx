import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { readEntitlementLedger } from "./entitlement-ledger";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Button } from "@ftksaas/ui/components/button";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function ProfileLedger({
  scope,
  personId,
  sales,
  available,
  revision,
  timezone,
  onAccessLost,
}: {
  scope: ClientScope;
  personId: string;
  sales: { id: string; label: string }[];
  available: boolean;
  revision: number;
  timezone: string;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    [draftSale, setDraftSale] = useState(""),
    [saleId, setSaleId] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0);
  const selected = available && sales.some((row) => row.id === saleId);
  const ledger = useQuery({
    queryKey: [
      "profile-ledger",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      saleId,
      revision,
      cursors[index],
    ],
    queryFn: async (readContext) => {
      try {
        return await readEntitlementLedger(scope, personId, saleId, cursors[index], readContext);
      } catch (error) {
        if (
          (error instanceof BackendError &&
            ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
          (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
        )
          onAccessLost(error);
        throw error;
      }
    },
    enabled: Boolean(selected),
    retry: false,
  });
  const source = selected && !ledger.isError ? ledger.data : undefined;
  const numbers = new Intl.NumberFormat("tr-TR", { signDisplay: "exceptZero" }),
    dates = new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form
        className="flex min-w-0 flex-wrap items-end gap-2"
        aria-label={t(($) => $.memberProfile.ledger)}
        onSubmit={(event) => {
          event.preventDefault();
          if (!available || !sales.some((row) => row.id === draftSale)) return;
          setSaleId(draftSale);
          setCursors([undefined]);
          setIndex(0);
        }}
      >
        <Field className="min-w-0 basis-48 flex-1">
          <FieldLabel htmlFor="profile-ledger-sale">
            {t(($) => $.memberProfile.ledgerSale)}
          </FieldLabel>
          <NativeSelect
            id="profile-ledger-sale"
            name="ledgerSale"
            required
            disabled={!available || !sales.length}
            value={draftSale}
            onChange={(event) => {
              setDraftSale(event.target.value);
              setSaleId("");
            }}
          >
            <NativeSelectOption value="">{t(($) => $.finance.choose)}</NativeSelectOption>
            {sales.map((row) => (
              <NativeSelectOption key={row.id} value={row.id}>
                {row.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Button variant="outline" type="submit" isDisabled={!available || !sales.length}>
          {t(($) => $.memberProfile.readLedger)}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t(($) => $.memberProfile.ledgerHint)}</p>
      {ledger.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.memberProfile.ledgerError)}</AlertDescription>
          <Button
            variant="outline"
            onPress={() => {
              setCursors([undefined]);
              setIndex(0);
              if (index === 0) void ledger.refetch();
            }}
          >
            {t(($) => $.finance.retry)}
          </Button>
        </Alert>
      )}
      <ItemGroup>
        {source?.items.map((row) => (
          <Item key={row.id} role="listitem" className="flex-wrap px-0">
            <ItemContent>
              <ItemTitle>{t(($) => $.memberProfile.ledgerKinds[row.kind])}</ItemTitle>
              <ItemDescription>
                {dates.format(new Date(row.created_at))}
                {row.previous_id ? ` · ${t(($) => $.memberProfile.linkedLedger)}` : ""}
              </ItemDescription>
              <ItemDescription className="line-clamp-none break-all">
                {t(($) => $.memberProfile.ledgerSource, {
                  id: row.source.id,
                  source: t(($) =>
                    row.source.type === "sales"
                      ? $.memberProfile.ledgerSources.sale
                      : row.source.type === "reservations"
                        ? $.memberProfile.ledgerSources.reservation
                        : row.source.type === "event_registrations"
                          ? $.memberProfile.ledgerSources.event
                          : $.memberProfile.ledgerSources.record,
                  ),
                })}
              </ItemDescription>
            </ItemContent>
            <span className="basis-full text-sm tabular-nums sm:basis-auto">
              {t(($) => $.memberProfile.ledgerValues, {
                quantity: row.quantity,
                delta: numbers.format(row.balance_delta),
              })}
            </span>
          </Item>
        ))}
      </ItemGroup>
      {!selected && (
        <p className="text-sm text-muted-foreground">
          {t(($) =>
            available && !sales.length
              ? $.memberProfile.ledgerNoSource
              : $.memberProfile.readRequired,
          )}
        </p>
      )}
      {selected && ledger.isPending && <p role="status">{t(($) => $.finance.loading)}</p>}
      {source?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t(($) => $.memberProfile.noRecords)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          isDisabled={!source || index === 0 || ledger.isFetching}
          onPress={() => setIndex((value) => value - 1)}
        >
          {t(($) => $.finance.previous)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          isDisabled={!source?.next_cursor || ledger.isFetching}
          onPress={() => {
            if (source?.next_cursor) {
              setCursors((value) => [...value.slice(0, index + 1), source.next_cursor!]);
              setIndex((value) => value + 1);
            }
          }}
        >
          {t(($) => $.finance.next)}
        </Button>
      </div>
    </div>
  );
}
