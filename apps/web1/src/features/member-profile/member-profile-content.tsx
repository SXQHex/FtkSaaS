import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MemberProfileView, type ProfileTab } from "./member-profile-view";
import { readMemberReservations, memberReservationRows } from "./reservations";
import { CancelReservation } from "./cancel-reservation";
import { readNegativeLimit } from "./negative-limit";
import { NegativeLimitEditor } from "./negative-limit-editor";
import { RightAdjustmentEditor } from "./right-adjustment-editor";
import { SaleEditor } from "./sale-editor";
import { readProfileRights, readProfileCatalog, readProfileDisciplines } from "./profile-read";
import { entitlementRows, profileMetrics, scopedProfileDebt } from "./profile-presentation";
import { readPerson } from "../people/people";
import { readWorkspace } from "../workspace/workspace";
import { readFinancePage } from "../finance/finance";
import { CollectionEditor } from "../finance/finance-content";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Field, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function MemberProfileContent({
  scope,
  personId,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  personId: string;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    navigate = useNavigate(),
    router = useRouter(),
    queries = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("rights"),
    [filter, setFilter] = useState<"all" | "upcoming" | "past">("all"),
    [currencyDraft, setCurrencyDraft] = useState(""),
    [currency, setCurrency] = useState<string>(),
    [currencyInvalid, setCurrencyInvalid] = useState(false),
    [index, setIndex] = useState(0),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [sale, setSale] = useState(false),
    [collect, setCollect] = useState(false),
    [locked, setLocked] = useState(false),
    [commandInvalid, setInvalid] = useState(false),
    [negativeDiscipline, setNegativeDiscipline] = useState(""),
    [editNegative, setEditNegative] = useState(false),
    [rightTarget, setRightTarget] = useState<{
      action: "adjust" | "extend";
      saleId: string;
      label: string;
      endDate: string;
      timezone: string;
    }>(),
    [cancelTarget, setCancelTarget] = useState<{ id: string; sessionId: string; label: string }>(),
    [reservationIndex, setReservationIndex] = useState(0),
    [reservationCursors, setReservationCursors] = useState<(string | undefined)[]>([undefined]);
  const reservationRetry = useRef<HTMLButtonElement>(null);
  const workspace = useQuery({
      queryKey: ["workspace", scope.accountId, scope.orgId],
      queryFn: () => readWorkspace(scope.accountId, scope.orgId),
      retry: false,
    }),
    center = workspace.data?.centers.find((x) => x.id === scope.centerId && x.accessible);
  const personKey = ["profile-person", scope.accountId, scope.orgId, scope.centerId, personId],
    rightsKey = ["profile-rights", scope.accountId, scope.orgId, scope.centerId, personId];
  const person = useQuery({
    queryKey: personKey,
    queryFn: () => readPerson(scope, personId),
    enabled: Boolean(center),
    retry: false,
  });
  const rights = useQuery({
    queryKey: rightsKey,
    queryFn: () => readProfileRights(scope, personId),
    enabled: Boolean(center && person.data),
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ["profile-catalog", scope.accountId, scope.orgId, scope.centerId],
    queryFn: () => readProfileCatalog(scope),
    enabled: Boolean(center && person.data),
    retry: false,
  });
  const disciplines = useQuery({
    queryKey: ["profile-disciplines", scope.accountId, scope.orgId, scope.centerId],
    queryFn: () => readProfileDisciplines(scope),
    enabled: Boolean(center && person.data),
    retry: false,
  });
  const reservations = useQuery({
    queryKey: [
      "profile-reservations",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      reservationCursors[reservationIndex],
    ],
    queryFn: () => readMemberReservations(scope, personId, reservationCursors[reservationIndex]),
    enabled: Boolean(center && person.data && tab === "reservations"),
    retry: false,
  });
  const negativeKey = [
    "profile-negative-limit",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    personId,
    negativeDiscipline,
  ];
  const negativeLimit = useQuery({
    queryKey: negativeKey,
    queryFn: () => readNegativeLimit(scope, personId, negativeDiscipline),
    enabled: Boolean(center && person.data && negativeDiscipline),
    retry: false,
  });
  const financeKey = (code: string, cursor?: string) => [
    "finance",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    personId,
    code,
    cursor,
  ];
  const finance = useQuery({
    queryKey: financeKey(currency ?? "", cursors[index]),
    queryFn: () => readFinancePage(scope, { personId, currency: currency! }, cursors[index]),
    enabled: Boolean(center && person.data && currency),
    retry: false,
  });
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED", "FORBIDDEN"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        setInvalid(true);
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router],
  );
  const authLost = (error: unknown) =>
    (error instanceof BackendError && ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
    (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message));
  const queryAccessLost =
    authLost(person.error) ||
    (person.error instanceof BackendError && person.error.code === "FORBIDDEN") ||
    [
      workspace.error,
      rights.error,
      catalog.error,
      disciplines.error,
      finance.error,
      reservations.error,
      negativeLimit.error,
    ].some(authLost);
  const invalid = commandInvalid || queryAccessLost;
  useEffect(() => {
    if (queryAccessLost) void router.invalidate();
  }, [queryAccessLost, router]);
  const changeLock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const sourceAvailable = Boolean(
      center && !workspace.isError && person.data && !person.isError && !invalid,
    ),
    p = person.isError ? undefined : person.data,
    f = finance.isError ? undefined : finance.data;
  if (invalid)
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(($) => $.memberProfile.profileUnavailable)}</AlertDescription>
      </Alert>
    );
  const notices = (
    <>
      {(workspace.isError ||
        person.isError ||
        rights.isError ||
        catalog.isError ||
        disciplines.isError ||
        finance.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.memberProfile.profileReadError)}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked}
                onPress={() => {
                  void Promise.allSettled([
                    workspace.refetch(),
                    person.refetch(),
                    rights.refetch(),
                    catalog.refetch(),
                    disciplines.refetch(),
                    ...(currency ? [finance.refetch()] : []),
                  ]);
                }}
              >
                {t(($) => $.finance.retry)}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t(($) => $.memberProfile.financeScope)}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            method="post"
            aria-label={t(($) => $.memberProfile.financeScope)}
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked) return;
              if (!/^[A-Z]{3}$/.test(currencyDraft)) {
                setCurrencyInvalid(true);
                return;
              }
              setCurrency(currencyDraft);
              setCursors([undefined]);
              setIndex(0);
              setCurrencyInvalid(false);
            }}
          >
            <Field className="max-w-56">
              <FieldLabel htmlFor="member-finance-currency">
                {t(($) => $.finance.currency)}
              </FieldLabel>
              <Input
                id="member-finance-currency"
                name="currency"
                value={currencyDraft}
                autoComplete="off"
                disabled={locked}
                aria-invalid={currencyInvalid}
                aria-describedby={currencyInvalid ? "member-currency-error" : undefined}
                onChange={(event) => setCurrencyDraft(event.target.value)}
              />
              <FieldError id="member-currency-error">
                {currencyInvalid ? t(($) => $.memberProfile.currencyInvalid) : undefined}
              </FieldError>
            </Field>
            <Button type="submit" isDisabled={!sourceAvailable || locked}>
              {t(($) => $.finance.read)}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(($) => $.memberProfile.currencyHint)}
          </p>
        </CardContent>
      </Card>
    </>
  );
  const contactRows =
    p?.contacts?.map((row, i) => ({
      id: String(i),
      label: t(($) => $.memberProfile.contactKinds[row.kind]),
      value: row.value,
      verification: t(($) =>
        row.verified_at ? $.memberProfile.verified : $.memberProfile.unverified,
      ),
      source: t(($) => $.studio.personFieldSource[row.field_policy?.source ?? "unknown"]),
    })) ?? null;
  const presentedRights =
    !rights.isError && rights.data
      ? (entitlementRows(rights.data, catalog.isError ? [] : (catalog.data ?? []), t)?.map(
          (row) => {
            const source = rights.data.find((x) => x.sale_id === row.id)!;
            return {
              ...row,
              actions: row.actions.map((action) =>
                action.kind === "adjust" || action.kind === "extend"
                  ? {
                      ...action,
                      disabled:
                        !sourceAvailable ||
                        locked ||
                        rights.isFetching ||
                        source.state !== "active" ||
                        source.sale_state !== "active" ||
                        !source.account_id ||
                        !source.version,
                      onPress: () =>
                        setRightTarget({
                          action: action.kind as "adjust" | "extend",
                          saleId: row.id,
                          label: row.name,
                          endDate: source.end_date,
                          timezone: source.timezone,
                        }),
                    }
                  : action,
              ),
            };
          },
        ) ?? null)
      : null;
  const closedSales = new Set(
    rights.data?.filter((x) => x.state === "closed").map((x) => x.sale_id) ?? [],
  );
  const selectedNegativeDiscipline = disciplines.data?.find((x) => x.id === negativeDiscipline);
  const reservationRows =
    center && reservations.data && !reservations.isError
      ? memberReservationRows(
          reservations.data.items,
          center.timezone,
          disciplines.isError ? [] : (disciplines.data ?? []),
          t,
        ).map((row) => {
          const source = reservations.data.items.find((x) => x.reservation.id === row.id)!;
          return {
            ...row,
            ...(source.reservation.state === "active" && sourceAvailable && !locked
              ? {
                  onCancel: () =>
                    setCancelTarget({
                      id: row.id,
                      sessionId: source.reservation.session_id,
                      label: `${p?.display_name ?? ""} · ${row.lesson} · ${row.date}`,
                    }),
                }
              : {}),
          };
        })
      : null;
  return (
    <>
      <MemberProfileView
        name={p?.display_name ?? t(($) => $.memberProfile.title)}
        initials={
          p?.display_name
            .split(/\s+/)
            .slice(0, 2)
            .map((x) => x[0])
            .join("") ?? ""
        }
        stateLabel={
          p
            ? t(($) =>
                p.relationships.some(
                  (x) =>
                    x.center_id === scope.centerId && x.kind === "student" && x.state === "active",
                )
                  ? $.people.states.active
                  : p.relationships.some(
                        (x) => x.center_id === scope.centerId && x.kind === "student",
                      )
                    ? $.people.states.inactive
                    : $.memberProfile.studentUnknown,
              )
            : t(($) => $.memberProfile.readRequired)
        }
        joined={null}
        actions={[
          { kind: "renew", disabled: true },
          { kind: "change", disabled: true },
          ...(p?.relationships.some((x) => x.center_id === scope.centerId && x.kind === "student")
            ? [
                {
                  kind: p.relationships.some(
                    (x) =>
                      x.center_id === scope.centerId &&
                      x.kind === "student" &&
                      x.state === "active",
                  )
                    ? ("deactivate" as const)
                    : ("activate" as const),
                  disabled: true,
                },
              ]
            : []),
          {
            kind: "allocate",
            disabled:
              !sourceAvailable ||
              rights.isError ||
              !rights.data ||
              catalog.isError ||
              !catalog.data ||
              locked,
            onPress: () => setSale(true),
          },
          {
            kind: "collect",
            disabled: !sourceAvailable || !currency || locked,
            onPress: () => setCollect(true),
          },
        ]}
        metrics={
          p
            ? profileMetrics(p, t, center?.timezone, f)
            : {
                available: { value: null, detail: null },
                upcoming: { value: null, detail: null },
                debt: { value: null, detail: null },
                attendance: { value: null, detail: null },
              }
        }
        tab={tab}
        onTab={setTab}
        entitlements={presentedRights?.filter((x) => !closedSales.has(x.id)) ?? null}
        past={
          presentedRights
            ?.filter((x) => closedSales.has(x.id))
            .map((x) => ({ id: x.id, title: x.name, date: x.period, detail: x.state })) ?? null
        }
        ledger={null}
        negative={{
          limit:
            negativeLimit.isError || negativeLimit.data?.effective_limit == null
              ? t(($) => $.memberProfile.unknown)
              : String(negativeLimit.data.effective_limit),
          used:
            negativeLimit.data && !negativeLimit.isError
              ? t(($) => $.memberProfile.negativeDeficit, {
                  reserved: negativeLimit.data.reserved_deficit,
                  consumed: negativeLimit.data.consumed_deficit,
                })
              : t(($) => $.memberProfile.unknown),
          unitValue: null,
          action: {
            kind: "negative",
            disabled:
              !sourceAvailable ||
              locked ||
              !negativeLimit.data ||
              negativeLimit.isError ||
              negativeLimit.isFetching ||
              negativeLimit.data.personal_override_enabled !== true,
            onPress: () => setEditNegative(true),
          },
          selector: (
            <>
              <Field>
                <FieldLabel htmlFor="profile-negative-discipline">
                  {t(($) => $.memberProfile.fields.disciplineId)}
                </FieldLabel>
                <NativeSelect
                  id="profile-negative-discipline"
                  name="negativeDiscipline"
                  value={negativeDiscipline}
                  disabled={locked || disciplines.isError || !disciplines.data?.length}
                  onChange={(event) => setNegativeDiscipline(event.target.value)}
                >
                  <NativeSelectOption value="">
                    {t(($) => $.memberProfile.choose)}
                  </NativeSelectOption>
                  {(!disciplines.isError ? (disciplines.data ?? []) : []).map((row) => (
                    <NativeSelectOption key={row.id} value={row.id}>
                      {row.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {negativeLimit.data?.personal_override_enabled !== true &&
                negativeLimit.isSuccess && (
                  <p className="text-sm text-muted-foreground">
                    {t(($) =>
                      negativeLimit.data?.personal_override_enabled === false
                        ? $.memberProfile.personalLimitDisabled
                        : $.memberProfile.negativeReadError,
                    )}
                  </p>
                )}
              {negativeLimit.isFetching && (
                <p role="status">{t(($) => $.memberProfile.negativeReading)}</p>
              )}
              {negativeLimit.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(($) => $.memberProfile.negativeReadError)}
                    <Button
                      variant="outline"
                      isDisabled={locked || negativeLimit.isFetching}
                      onPress={() => {
                        void negativeLimit.refetch();
                      }}
                    >
                      {t(($) => $.finance.retry)}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </>
          ),
        }}
        reservations={reservationRows}
        reservationFilter={filter}
        onReservationFilter={setFilter}
        reservationFiltersAvailable={false}
        reservationFooter={
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {t(($) => $.memberProfile.reservationFiltersUnavailable)}
            </p>
            {(reservations.isError || reservations.data?.partial) && (
              <Alert variant={reservations.isError ? "destructive" : "default"}>
                <AlertDescription>
                  {t(($) =>
                    reservations.isError
                      ? $.memberProfile.reservationReadError
                      : $.memberProfile.reservationPartial,
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={locked || reservations.isFetching || reservationIndex === 0}
                onPress={() => setReservationIndex((i) => i - 1)}
              >
                {t(($) => $.memberProfile.reservationPrevious)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                isDisabled={
                  locked ||
                  reservations.isFetching ||
                  reservations.isError ||
                  !reservations.data?.nextCursor
                }
                onPress={() => {
                  const cursor = reservations.data?.nextCursor;
                  if (cursor) {
                    setReservationCursors((old) => [...old.slice(0, reservationIndex + 1), cursor]);
                    setReservationIndex((i) => i + 1);
                  }
                }}
              >
                {t(($) => $.memberProfile.reservationNext)}
              </Button>
              <Button
                ref={reservationRetry}
                size="sm"
                variant="outline"
                isDisabled={locked || reservations.isFetching}
                onPress={() => {
                  void reservations.refetch();
                }}
              >
                {t(($) => $.memberProfile.reservationRetry)}
              </Button>
              {!reservations.isError && reservations.data && (
                <span className="text-xs text-muted-foreground">
                  {t(($) => $.memberProfile.reservationPageCount, {
                    count: reservations.data.items.length,
                  })}
                </span>
              )}
            </div>
          </div>
        }
        payments={
          f
            ? f.movements.items.map((row) => ({
                id: row.id,
                date: new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: center?.timezone,
                }).format(new Date(row.occurred_at)),
                kind: t(($) => $.finance.movementKinds[row.kind]),
                detail: row.payment
                  ? t(($) =>
                      row.payment!.method === "cash"
                        ? $.finance.cash
                        : row.payment!.method === "card_pos"
                          ? $.finance.card
                          : $.finance.bank,
                    ) + (row.payment.reference ? ` · ${row.payment.reference}` : "")
                  : t(($) => $.finance.unknown),
                amount: formatMinorAmount(row.amount_minor, row.currency),
              }))
            : null
        }
        debt={
          p?.member_summary?.debt.status === "available"
            ? p.member_summary.debt.by_currency.length
              ? p.member_summary.debt.by_currency
                  .map((x) => formatMinorAmount(x.remaining_minor, x.currency))
                  .join(" · ")
              : t(($) => $.people.rowSummary.noDebt)
            : f
              ? scopedProfileDebt(f)
              : null
        }
        contacts={contactRows}
        back={() => {
          if (!locked)
            void navigate({
              to: "/o/$orgId/c/$centerId/people",
              params: { orgId: scope.orgId, centerId: scope.centerId },
            });
        }}
        loading={person.isPending}
        notice={notices}
        paymentPagination={
          currency && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={index === 0 || locked || finance.isFetching}
                onPress={() => setIndex((x) => x - 1)}
              >
                {t(($) => $.finance.previous)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                isDisabled={!f?.movements.next_cursor || locked || finance.isFetching}
                onPress={() => {
                  const next = f?.movements.next_cursor;
                  if (next) {
                    setCursors((old) => [...old.slice(0, index + 1), next]);
                    setIndex((x) => x + 1);
                  }
                }}
              >
                {t(($) => $.finance.next)}
              </Button>
            </div>
          )
        }
      />
      {rightTarget && (sourceAvailable || preservePending) && (
        <RightAdjustmentEditor
          key={`${rightTarget.saleId}:${rightTarget.action}`}
          scope={scope}
          personId={personId}
          personLabel={p?.display_name ?? ""}
          action={rightTarget.action}
          saleId={rightTarget.saleId}
          sourceLabel={rightTarget.label}
          endDate={rightTarget.endDate}
          timezone={rightTarget.timezone}
          sourceAvailable={sourceAvailable}
          onClose={() => setRightTarget(undefined)}
          onLockChange={changeLock}
          onAccessLost={accessLost}
          onRefresh={async (result) => {
            queries.setQueryData(rightsKey, result.rights);
            await queries.invalidateQueries({
              queryKey: [
                "profile-reservations",
                scope.accountId,
                scope.orgId,
                scope.centerId,
                personId,
              ],
            });
            await person.refetch({ throwOnError: true });
            void queries.invalidateQueries({
              queryKey: ["people", scope.accountId, scope.orgId, scope.centerId],
            });
          }}
        />
      )}
      {editNegative &&
        center &&
        negativeLimit.data &&
        selectedNegativeDiscipline &&
        (sourceAvailable || preservePending) && (
          <NegativeLimitEditor
            scope={scope}
            personId={personId}
            personLabel={p?.display_name ?? ""}
            discipline={selectedNegativeDiscipline}
            initialLimit={negativeLimit.data.override ?? negativeLimit.data.effective_limit}
            timezone={center.timezone}
            sourceAvailable={sourceAvailable}
            onClose={() => setEditNegative(false)}
            onLockChange={changeLock}
            onAccessLost={accessLost}
            onRefresh={async (result) => {
              queries.setQueryData(negativeKey, result.limit);
              queries.setQueryData(rightsKey, result.rights);
              await person.refetch({ throwOnError: true });
              void queries.invalidateQueries({
                queryKey: ["people", scope.accountId, scope.orgId, scope.centerId],
              });
            }}
          />
        )}
      {cancelTarget && (sourceAvailable || preservePending) && (
        <CancelReservation
          key={cancelTarget.id}
          scope={scope}
          personId={personId}
          reservationId={cancelTarget.id}
          sessionId={cancelTarget.sessionId}
          label={cancelTarget.label}
          sourceAvailable={sourceAvailable}
          onLockChange={changeLock}
          onAccessLost={accessLost}
          onClose={(saved) => {
            setCancelTarget(undefined);
            if (saved) requestAnimationFrame(() => reservationRetry.current?.focus());
          }}
          onRefresh={async (result) => {
            queries.setQueryData(rightsKey, result.rights);
            await reservations.refetch({ throwOnError: true });
            void queries.invalidateQueries({
              queryKey: ["people", scope.accountId, scope.orgId, scope.centerId],
            });
          }}
        />
      )}
      {sale && center && (sourceAvailable || preservePending) && (
        <SaleEditor
          key={`${personId}:sale`}
          scope={scope}
          personId={personId}
          personLabel={p?.display_name ?? t(($) => $.memberProfile.title)}
          timezone={center.timezone}
          products={catalog.isError ? [] : (catalog.data ?? [])}
          productNames={{
            centers: workspace.isError ? [] : (workspace.data?.centers ?? []),
            disciplines: disciplines.isError ? [] : (disciplines.data ?? []),
          }}
          sourceAvailable={sourceAvailable && !catalog.isError && !rights.isError}
          onClose={() => setSale(false)}
          onLockChange={changeLock}
          onAccessLost={accessLost}
          onRefresh={async (result) => {
            queries.setQueryData(rightsKey, result.entitlements);
            queries.setQueryData(financeKey(result.finance.currency), result.finance);
            setCurrency(result.finance.currency);
            setCurrencyDraft(result.finance.currency);
            setIndex(0);
            setCursors([undefined]);
            await person.refetch({ throwOnError: true });
            void queries.invalidateQueries({
              queryKey: ["people", scope.accountId, scope.orgId, scope.centerId],
            });
          }}
          onCollect={(code) => {
            setCurrency(code);
            setCurrencyDraft(code);
            setSale(false);
            setCollect(true);
          }}
        />
      )}
      {collect && currency && center && (sourceAvailable || preservePending) && (
        <CollectionEditor
          key={`${personId}:${currency}`}
          scope={scope}
          selection={{ personId, currency }}
          personLabel={p?.display_name ?? t(($) => $.memberProfile.title)}
          timezone={center.timezone}
          canWrite={sourceAvailable}
          onClose={() => setCollect(false)}
          onLockChange={changeLock}
          onAccessLost={accessLost}
          onRefresh={async () => {
            await Promise.all([
              finance.refetch({ throwOnError: true }),
              person.refetch({ throwOnError: true }),
            ]);
          }}
        />
      )}
    </>
  );
}
