import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FinanceContent, type FinanceInitialContext } from "./finance-content";
import { FinanceView, type FinanceTab, type FinanceFilter } from "./finance-view";
import {
  financePeriod,
  financeDirectoryRowKey,
  financeDirectoryTotal,
  readFinanceDirectory,
  type DirectoryKind,
  type DirectoryMethod,
} from "./finance-directory";
import { readFinancePage } from "./finance";
import { SaleRefundEditor } from "./sale-refund-editor";
import { financeKeys, invalidateFinanceViews } from "./finance-query";
import type { SaleRefundSource } from "./sale-refund";

import { BackendError } from "../../lib/backend";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import type { FinanceDirectoryEntry } from "@ftksaas/api-contracts";
import { formatMinorAmount } from "../../lib/money";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Field, FieldGroup, FieldLabel, FieldError } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";

export function FinanceDirectoryContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [saleRefund, setSaleRefund] = useState<SaleRefundSource>();
  const [personal, setPersonal] = useState<FinanceInitialContext>(),
    [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<FinanceTab>("movements"),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState<FinanceFilter>("all"),
    [method, setMethod] = useState("");
  const [filters, setFilters] = useState<{
    query?: string;
    kind?: DirectoryKind;
    method?: DirectoryMethod;
  }>({});
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [page, setPage] = useState(0);
  const [dates, setDates] = useState<{ from?: string; through?: string }>({}),
    [from, setFrom] = useState<string>(),
    [through, setThrough] = useState<string>(),
    [invalidPeriod, setInvalidPeriod] = useState(false);
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const center =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const accessLost = (error: unknown) => {
    const lost =
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message));
    if (lost) {
      queries.removeQueries({ queryKey: ["finance-directory", scope.accountId] });
      queries.removeQueries({ queryKey: ["finance-directory-credit-debts", scope.accountId] });
      void router.invalidate();
    }
    return lost;
  };
  const guard = async <T,>(read: () => Promise<T>): Promise<T> => {
    try {
      return await read();
    } catch (error) {
      accessLost(error);
      throw error;
    }
  };
  const period = useQuery({
    queryKey: [
      "finance-period",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      center?.timezone,
      dates.from,
      dates.through,
    ],
    queryFn: () => financePeriod(center!.timezone, dates.from, dates.through),
    enabled: Boolean(center),
    retry: false,
  });
  const directory = useQuery({
    queryKey: [...financeKeys.directory(scope), tab, period.data?.interval, filters, cursors[page]],
    queryFn: ({ signal, client }) =>
      guard(() =>
        readFinanceDirectory(scope, tab, period.data!.interval, filters, cursors[page], signal, {
          client,
          signal,
        }),
      ),
    enabled: Boolean(center && period.data && !period.isError && !personal),
    retry: false,
  });
  const source = center && !workspace.isError && !directory.isError ? directory.data : undefined;
  const creditRows = source && tab === "credits" && !personal ? source.items : [];
  const creditDebts = useQueries({
    queries: creditRows.map((row) => ({
      queryKey: financeKeys.creditDebt(scope, row.person_id, row.currency),
      queryFn: ({ signal, client }: AccountReadContext) =>
        guard(async () => {
          try {
            const finance = await readFinancePage(
              scope,
              { personId: row.person_id, currency: row.currency },
              undefined,
              signal,
              { client, signal },
            );
            return formatMinorAmount(
              finance.debts
                .reduce((sum, debt) => sum + BigInt(debt.remaining_minor), 0n)
                .toString(),
              row.currency,
            );
          } catch (error) {
            signal.throwIfAborted();
            if (
              (error instanceof BackendError &&
                ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
              (error instanceof Error &&
                ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
            )
              throw error;
            return null;
          }
        }),
      retry: false,
    })),
  });
  const changeLock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const resetPage = () => {
    setCursors([undefined]);
    setPage(0);
  };
  const open = (row: FinanceDirectoryEntry, action: FinanceInitialContext["action"]) =>
    setPersonal({
      selection: { personId: row.person_id, currency: row.currency },
      label: row.display_name ?? t(($) => $.finance.unknown),
      action,
      entityId: row.id,
    });
  if (personal)
    return (
      <>
        <div className="px-4 pt-4 sm:px-6">
          <Button
            variant="outline"
            isDisabled={locked}
            onPress={() => {
              setPersonal(undefined);
              resetPage();
            }}
          >
            {t(($) => $.financeDirectory.back)}
          </Button>
        </div>
        <FinanceContent
          scope={scope}
          initialContext={personal}
          onLockChange={changeLock}
          preservePending={preservePending}
        />
      </>
    );
  const totals = source?.totals ?? [],
    unknown = t(($) => $.finance.unknown);
  const person = (row: FinanceDirectoryEntry) => row.display_name ?? unknown;
  const amount = (row: FinanceDirectoryEntry) =>
    `${row.currency} ${formatMinorAmount(row.amount_minor, row.currency)}`;
  const count = (field: "debt_people" | "credit_people") =>
    totals.length
      ? totals
          .map((row) =>
            t(($) => $.financeDirectory.perCurrencyPeople, {
              currency: row.currency,
              amount: row[field],
            }),
          )
          .join(" · ")
      : null;
  const counts = {
    movements: t(($) => $.financeDirectory.pageCount, { amount: source?.items.length ?? 0 }),
    debts: t(($) => $.financeDirectory.pageCount, { amount: source?.items.length ?? 0 }),
    credits: t(($) => $.financeDirectory.pageCount, { amount: source?.items.length ?? 0 }),
  };
  return (
    <FinanceView
      tab={tab}
      onTab={(value) => {
        setTab(value);
        setKind("all");
        setMethod("");
        setFilters({ query: filters.query });
        resetPage();
      }}
      summary={{
        periodLabel: period.data
          ? t(($) => $.financeDirectory.period, {
              start: period.data.startDate,
              end: period.data.endDate,
            })
          : unknown,
        sales: financeDirectoryTotal(totals, "sales_minor"),
        collections: financeDirectoryTotal(totals, "collections_minor"),
        debt: financeDirectoryTotal(totals, "debt_minor"),
        credit: financeDirectoryTotal(totals, "credit_minor"),
        debtCount: count("debt_people"),
        creditCount: count("credit_people"),
      }}
      movements={
        source?.items
          .filter((row) => !["debt", "credit"].includes(row.kind))
          .map((row) => ({
            id: financeDirectoryRowKey(row),
            date: new Intl.DateTimeFormat("tr-TR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: center!.timezone,
            }).format(new Date(row.occurred_at)),
            person: person(row),
            kind: t(
              ($) =>
                $.finance.movementKinds[
                  row.kind as "sale" | "collection" | "refund" | "correction_in" | "correction_out"
                ],
            ),
            detail:
              row.product_name ??
              (row.method
                ? t(($) =>
                    row.method === "cash"
                      ? $.finance.cash
                      : row.method === "card_pos"
                        ? $.finance.card
                        : $.finance.bank,
                  )
                : unknown),
            amount: amount(row),
            actions:
              row.kind === "collection"
                ? [{ kind: "correct" as const, onPress: () => open(row, "correct") }]
                : row.kind === "sale" && row.source_sale_id === row.id
                  ? [
                      {
                        kind: "sale-refund" as const,
                        onPress: () =>
                          setSaleRefund({
                            saleId: row.source_sale_id!,
                            personId: row.person_id,
                            currency: row.currency,
                            label: `${person(row)} · ${row.product_name ?? unknown}`,
                          }),
                      },
                    ]
                  : [],
          })) ?? []
      }
      debts={
        source?.items
          .filter((row) => row.kind === "debt")
          .map((row) => ({
            id: financeDirectoryRowKey(row),
            person: person(row),
            lastSale: row.product_name,
            amount: amount(row),
            actions: (["offset", "adjust"] as const).map((action) => ({
              kind: action,
              onPress: () => open(row, action),
            })),
          })) ?? []
      }
      credits={
        source?.items
          .filter((row) => row.kind === "credit")
          .map((row, index) => ({
            id: financeDirectoryRowKey(row),
            person: person(row),
            amount: amount(row),
            debt: creditDebts[index]?.data ?? null,
            actions:
              BigInt(row.amount_minor) > 0n
                ? [{ kind: "credit-refund" as const, onPress: () => open(row, "credit-refund") }]
                : [],
          })) ?? []
      }
      state={
        directory.isError || period.isError || workspace.isError
          ? "error"
          : directory.isPending || period.isPending
            ? "loading"
            : "ready"
      }
      nativeKinds
      search={search}
      filter={kind}
      method={method}
      onSearch={setSearch}
      onFilter={setKind}
      onMethod={setMethod}
      onQuery={() => {
        setFilters({
          query: search,
          ...(tab === "movements" && kind !== "all" && kind !== "other" ? { kind } : {}),
          ...(tab === "movements" &&
          (method === "cash" || method === "bank_transfer" || method === "card_pos")
            ? { method }
            : {}),
        });
        resetPage();
      }}
      onCollect={locked ? undefined : () => setPersonal({ label: "", action: "collect" })}
      counts={counts}
      notice={
        <div className="flex min-w-0 flex-col gap-3">
          <form
            aria-label={t(($) => $.financeDirectory.applyPeriod)}
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void financePeriod(
                center!.timezone,
                from ?? period.data?.startDate,
                through ?? period.data?.endDate,
              )
                .then((value) => {
                  setDates({ from: value.startDate, through: value.endDate });
                  setInvalidPeriod(false);
                  resetPage();
                })
                .catch(() => {
                  setInvalidPeriod(true);
                  form.querySelector<HTMLInputElement>("input")?.focus();
                });
            }}
          >
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Field>
                <FieldLabel htmlFor="finance-from">{t(($) => $.financeDirectory.start)}</FieldLabel>
                <Input
                  id="finance-from"
                  name="from"
                  type="date"
                  value={from ?? period.data?.startDate ?? ""}
                  required
                  disabled={!center}
                  aria-invalid={invalidPeriod || undefined}
                  aria-describedby={invalidPeriod ? "finance-period-error" : undefined}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setInvalidPeriod(false);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="finance-through">
                  {t(($) => $.financeDirectory.end)}
                </FieldLabel>
                <Input
                  id="finance-through"
                  name="through"
                  type="date"
                  value={through ?? period.data?.endDate ?? ""}
                  required
                  disabled={!center}
                  onChange={(event) => {
                    setThrough(event.target.value);
                    setInvalidPeriod(false);
                  }}
                />
              </Field>
              <Button type="submit" variant="outline" isDisabled={!center || period.isPending}>
                {t(($) => $.financeDirectory.applyPeriod)}
              </Button>
            </FieldGroup>
            {invalidPeriod && (
              <FieldError id="finance-period-error">
                {t(($) => $.financeDirectory.periodError)}
              </FieldError>
            )}
          </form>
          <p className="text-xs text-muted-foreground">{t(($) => $.financeDirectory.totalsHint)}</p>
          {tab === "credits" && (
            <p className="text-xs text-muted-foreground">
              {t(($) => $.financeDirectory.creditDebtHint)}
            </p>
          )}
          {saleRefund && (
            <SaleRefundEditor
              scope={scope}
              source={saleRefund}
              sourceAvailable={Boolean(center && !workspace.isError)}
              onClose={() => setSaleRefund(undefined)}
              onRefresh={async (result) => {
                await invalidateFinanceViews(
                  queries,
                  scope,
                  saleRefund.personId,
                  saleRefund.currency,
                );
                // The command has already verified this person's native finance
                // readback. Reuse it instead of issuing the same finance_get again.
                queries.setQueryData(
                  [
                    ...financeKeys.person(scope, saleRefund.personId, saleRefund.currency),
                    undefined,
                  ],
                  result.finance,
                );
                await queries.fetchQuery({
                  queryKey: [
                    ...financeKeys.directory(scope),
                    tab,
                    period.data?.interval,
                    filters,
                    undefined,
                  ],
                  queryFn: ({ signal }) =>
                    guard(() =>
                      readFinanceDirectory(
                        scope,
                        tab,
                        period.data!.interval,
                        filters,
                        undefined,
                        signal,
                      ),
                    ),
                  staleTime: 0,
                  retry: false,
                });
                resetPage();
              }}
              onLockChange={changeLock}
              onAccessLost={accessLost}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => setPersonal({ label: "" })}
            >
              {t(($) => $.financeDirectory.personal)}
            </Button>
          </div>
          {(directory.isError || period.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.financeDirectory.readError)}</AlertDescription>
              <Button
                variant="outline"
                onPress={() => {
                  void (period.isError ? period.refetch() : directory.refetch());
                }}
              >
                {t(($) => $.finance.retry)}
              </Button>
            </Alert>
          )}
        </div>
      }
      pagination={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            isDisabled={page === 0 || directory.isFetching}
            onPress={() => setPage((value) => value - 1)}
          >
            {t(($) => $.finance.previous)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={!source?.next_cursor || directory.isFetching}
            onPress={() => {
              if (source?.next_cursor) {
                setCursors((value) => [...value.slice(0, page + 1), source.next_cursor!]);
                setPage((value) => value + 1);
              }
            }}
          >
            {t(($) => $.finance.next)}
          </Button>
        </div>
      }
    />
  );
}
