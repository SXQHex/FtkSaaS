import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { readEntitlementLedger } from "../member-profile/entitlement-ledger";
import { readOwnPackages, readOwnDebt } from "./member-entitlements-read";
import { MemberEntitlementsView } from "./member-entitlements-view";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
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
    for (const error of [rights.error, debt.error, ledger.error]) if (error) accessLost(error);
  }, [rights.error, debt.error, ledger.error, accessLost]);
  const numbers = new Intl.NumberFormat("tr-TR"),
    signed = new Intl.NumberFormat("tr-TR", { signDisplay: "exceptZero" }),
    dates = new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    });
  const packageRows = sources?.map((row, index) => ({
    id: row.id,
    name: `${t(($) => $.memberEntitlements.unknownName)} (${index + 1})`,
    validity: row.validity,
    state:
      row.saleState && row.saleState !== "active"
        ? t(($) => $.memberEntitlements.saleStates[row.saleState!])
        : t(($) => $.memberProfile.rightStates[row.state]),
    ...(row.kind === "credits"
      ? {
          counts: {
            available: numbers.format(row.counts.available),
            reserved: numbers.format(row.counts.reserved),
            consumed: numbers.format(row.counts.consumed),
          },
        }
      : {}),
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
  const balance =
    !debt.isError && debt.data?.status === "available" ? (
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
  return (
    <MemberEntitlementsView
      packages={packageRows ?? null}
      selected={selected?.id ?? ""}
      onSelect={(id) => {
        setSelection(id);
        setCursors([undefined]);
      }}
      movements={
        selected && !ledger.isError && ledger.data
          ? ledger.data.items.map((row) => ({
              id: row.id,
              date: dates.format(new Date(row.created_at)),
              title: `${t(($) => $.memberProfile.ledgerKinds[row.kind])} · ${t(($) => $.memberEntitlements.quantity, { count: row.quantity })}`,
              quantity: signed.format(row.balance_delta),
            }))
          : null
      }
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
      payments={null}
      balance={
        <>
          {balance}
          <p className="text-xs font-normal text-muted-foreground">
            {t(($) => $.memberEntitlements.creditUnknown)}
          </p>
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
          <Alert>
            <AlertDescription>{t(($) => $.memberEntitlements.sourceLimits)}</AlertDescription>
          </Alert>
          {(rights.isError || debt.isError || (selected && ledger.isError)) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.memberEntitlements.unread)}</AlertDescription>
            </Alert>
          )}
          {(rights.isPending || debt.isPending || (selected && ledger.isPending)) && (
            <p role="status">{t(($) => $.memberEntitlements.loading)}</p>
          )}
          <Button
            variant="outline"
            isDisabled={rights.isFetching || debt.isFetching || ledger.isFetching}
            onPress={() => {
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
