import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { readEntitlementLedger } from "../member-profile/entitlement-ledger";
import { readOwnPackages, readOwnDebt, readOwnFinanceCurrencies } from "./member-entitlements-read";
import {
  MemberEntitlementsView,
  type MemberLedgerRead,
  type MemberPaymentMovement,
  type MemberRightMovement,
} from "./member-entitlements-view";
import { MemberReadSkeleton } from "../member/member-read-skeleton";
import { readFinancePage } from "../finance/finance";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function MemberEntitlementsContent({
  scope,
  personId,
  timezone,
}: {
  scope: ClientScope;
  personId: string;
  timezone: string;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [selection, setSelection] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [currencySelection, setCurrencySelection] = useState(""),
    [paymentCursors, setPaymentCursors] = useState<(string | undefined)[]>([undefined]);
  const prefix = ["member-entitlements", scope.accountId, scope.orgId, scope.centerId, personId];
  const rights = useQuery({
    queryKey: [...prefix, "rights"],
    queryFn: () => readOwnPackages(scope, personId),
    retry: false,
  });
  const debt = useQuery({
    queryKey: [...prefix, "debt"],
    queryFn: () => readOwnDebt(scope, personId),
    retry: false,
  });
  const currencies = useQuery({
    queryKey: [...prefix, "currencies"],
    queryFn: () => readOwnFinanceCurrencies(scope, personId),
    retry: false,
  });
  const currency = !currencies.isError
    ? (currencies.data?.find((c) => c === currencySelection) ??
      (currencySelection === "" && currencies.data?.length === 1 ? currencies.data[0] : undefined))
    : undefined;
  const payments = useQuery({
    queryKey: [...prefix, "payments", currency, paymentCursors.at(-1)],
    queryFn: () => readFinancePage(scope, { personId, currency: currency! }, paymentCursors.at(-1)),
    enabled: !!currency,
    retry: false,
  });
  const sources = !rights.isError ? rights.data : undefined;
  const selected =
    sources?.find((row) => row.id === selection) ??
    (selection === "" && sources?.length === 1 ? sources[0] : undefined);
  const ledger = useQuery({
    queryKey: [...prefix, "ledger", selected?.id, cursors.at(-1)],
    queryFn: () => readEntitlementLedger(scope, personId, selected!.id, cursors.at(-1)),
    enabled: Boolean(selected),
    retry: false,
  });
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      )
        void router.invalidate();
    },
    [router],
  );
  useEffect(() => {
    for (const error of [rights.error, debt.error, ledger.error, currencies.error, payments.error])
      if (error) accessLost(error);
  }, [rights.error, debt.error, ledger.error, currencies.error, payments.error, accessLost]);
  const signed = new Intl.NumberFormat("tr-TR", { signDisplay: "exceptZero" }),
    dates = new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    });
  const packageRows = sources?.map((row) => ({
    id: row.id,
    name: row.name,
    usage: row.usage,
    validity: row.validity,
    state:
      row.saleState && row.saleState !== "active"
        ? t(($) => $.memberEntitlements.saleStates[row.saleState!])
        : t(($) => $.memberProfile.rightStates[row.state]),
    counts: row.kind === "credits" ? row.counts : undefined,
    note: [
      row.kind === "timed" ? t(($) => $.memberEntitlements.timed) : undefined,
      row.deficit ? t(($) => $.memberEntitlements.deficit, { count: row.deficit }) : undefined,
      ...row.quotas.map(
        (quota) =>
          `${dates.format(new Date(quota.startsAt))} – ${dates.format(new Date(quota.endsAt))}: ${t(($) => $.memberProfile.quotaUsage, { limit: quota.limit, reserved: quota.reserved, consumed: quota.consumed })}`,
      ),
      ...row.freezes.map(
        (freeze) =>
          `${t(($) => $.memberEntitlements.freeze)}: ${dates.format(new Date(freeze.startsAt))} – ${dates.format(new Date(freeze.endsAt))}`,
      ),
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const balance = debt.isPending ? (
    <MemberReadSkeleton label={t(($) => $.memberEntitlements.balanceLoading)} />
  ) : !debt.isError && debt.data?.status === "available" ? (
    debt.data.by_currency.length === 0 ? (
      <p>{t(($) => $.memberEntitlements.noDebt)}</p>
    ) : (
      debt.data.by_currency.map((row) => (
        <p key={row.currency}>
          {t(($) => $.memberEntitlements.debt, {
            amount: formatMinorAmount(row.remaining_minor, row.currency),
          })}
        </p>
      ))
    )
  ) : (
    <p>{t(($) => $.memberEntitlements.unread)}</p>
  );
  const next = ledger.data?.next_cursor;
  let movements: MemberLedgerRead<MemberRightMovement> = "unread";
  if (rights.isPending || (selected && ledger.isPending)) movements = "loading";
  else if (!rights.isError && !ledger.isError) {
    if (selected && ledger.data) {
      movements = ledger.data.items.map((row) => ({
        id: row.id,
        date: dates.format(new Date(row.created_at)),
        title: `${t(($) => $.memberProfile.ledgerKinds[row.kind])} · ${t(($) => $.memberEntitlements.quantity, { count: row.quantity })}`,
        quantity: signed.format(row.balance_delta),
      }));
    } else if (!selected) movements = sources?.length ? "choose" : [];
  }
  let paymentHistory: MemberLedgerRead<MemberPaymentMovement> = "unread";
  if (currencies.isPending || (currency && payments.isPending)) paymentHistory = "loading";
  else if (!currencies.isError && !payments.isError && currencies.data) {
    if (currencies.data.length === 0) paymentHistory = [];
    else if (!currency) paymentHistory = "choose";
    else if (payments.data) {
      paymentHistory = payments.data.movements.items.map((row) => ({
        id: row.id,
        date: dates.format(new Date(row.occurred_at)),
        title: t(($) => $.finance.movementKinds[row.kind]),
        amount: formatMinorAmount(row.amount_minor, row.currency),
      }));
    }
  }
  return (
    <MemberEntitlementsView
      packages={packageRows ?? null}
      packagesLoading={rights.isPending}
      selected={selected?.id ?? ""}
      onSelect={(id) => {
        setSelection(id);
        setCursors([undefined]);
      }}
      movements={movements}
      movementPagination={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            isDisabled={!selected || ledger.isFetching || cursors.length === 1}
            onPress={() => setCursors((old) => old.slice(0, -1))}
          >
            {t(($) => $.memberEntitlements.previous)}
          </Button>
          <Button
            variant="outline"
            isDisabled={
              !selected || ledger.isFetching || ledger.isError || !next || cursors.includes(next)
            }
            onPress={() => {
              if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
            }}
          >
            {t(($) => $.memberEntitlements.next)}
          </Button>
        </div>
      }
      payments={paymentHistory}
      paymentControl={
        currencies.data && currencies.data.length > 1 && !currencies.isError ? (
          <NativeSelect
            className="mb-4 w-full @md:w-64"
            aria-label={t(($) => $.memberEntitlements.chooseCurrency)}
            value={currency ?? ""}
            onChange={(e) => {
              setCurrencySelection(e.target.value);
              setPaymentCursors([undefined]);
            }}
          >
            <NativeSelectOption value="">
              {t(($) => $.memberEntitlements.chooseCurrency)}
            </NativeSelectOption>
            {currencies.data.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {c}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : undefined
      }
      paymentPagination={
        <div
          role="group"
          aria-label={t(($) => $.memberEntitlements.payments)}
          className="flex flex-wrap gap-2"
        >
          <Button
            variant="outline"
            isDisabled={!currency || payments.isFetching || paymentCursors.length === 1}
            onPress={() => setPaymentCursors((old) => old.slice(0, -1))}
          >
            {t(($) => $.memberEntitlements.previous)}
          </Button>
          <Button
            variant="outline"
            isDisabled={
              !currency ||
              payments.isFetching ||
              payments.isError ||
              !payments.data?.movements.next_cursor ||
              paymentCursors.includes(payments.data.movements.next_cursor)
            }
            onPress={() => {
              const next = payments.data?.movements.next_cursor;
              if (next && !paymentCursors.includes(next))
                setPaymentCursors((old) => [...old, next]);
            }}
          >
            {t(($) => $.memberEntitlements.next)}
          </Button>
        </div>
      }
      balance={
        <>
          {balance}
          {currency && !payments.isError && payments.data ? (
            <p>
              {t(($) => $.memberEntitlements.creditAvailable, {
                amount: formatMinorAmount(payments.data.credit_available_minor, currency),
              })}
            </p>
          ) : currencies.isError || payments.isError || currencies.data?.length === 0 ? (
            <p className="text-xs font-normal text-muted-foreground">
              {currencies.data?.length === 0 && !currencies.isError
                ? t(($) => $.memberEntitlements.noFinanceHistory)
                : t(($) => $.memberEntitlements.creditUnknown)}
            </p>
          ) : null}
        </>
      }
      previous={
        sources
          ? packageRows!.filter((row) => {
              const source = sources.find((item) => item.id === row.id)!;
              return (
                source.state === "closed" || (source.saleState && source.saleState !== "active")
              );
            })
          : null
      }
      notice={
        <div className="space-y-3">
          {(rights.isError ||
            debt.isError ||
            currencies.isError ||
            (currency && payments.isError) ||
            (selected && ledger.isError)) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.memberEntitlements.unread)}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            isDisabled={
              rights.isFetching ||
              debt.isFetching ||
              ledger.isFetching ||
              currencies.isFetching ||
              payments.isFetching
            }
            onPress={() => {
              void currencies.refetch();
              if (currency) void payments.refetch();
              void rights.refetch();
              void debt.refetch();
              if (selected) void ledger.refetch();
            }}
          >
            {t(($) => $.memberEntitlements.retry)}
          </Button>
        </div>
      }
    />
  );
}
