import { useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, PlusIcon, CreditCardIcon } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardHeader, CardTitle, CardContent } from "@ftksaas/ui/components/card";
import { Avatar, AvatarFallback } from "@ftksaas/ui/components/avatar";
import { Badge } from "@ftksaas/ui/components/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ftksaas/ui/components/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@ftksaas/ui/components/table";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import { Progress } from "@ftksaas/ui/components/progress";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
export type ProfileTab = "rights" | "reservations" | "payments";
export type MemberAction =
  | "allocate"
  | "renew"
  | "change"
  | "freeze"
  | "unfreeze"
  | "cancelFreeze"
  | "extend"
  | "adjust"
  | "negative"
  | "terminate"
  | "collect"
  | "deactivate"
  | "activate"
  | "cancelReservation";
export interface ProfileAction {
  kind: MemberAction;
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
}
export interface ProfileMetric {
  value: string | null;
  detail: string | null;
}
export interface ProfileEntitlement {
  id: string;
  name: string;
  period: string;
  state: string;
  kind: "credit" | "timed";
  counts?: { total?: number; available: number; reserved: number; consumed: number };
  note?: string;
  policyNote?: string;
  actions: ProfileAction[];
  freezes?: { id: string; period: string; state: string; action?: ProfileAction; note?: string }[];
}
export interface ProfileReservation {
  id: string;
  lesson: string;
  date: string;
  reservation: string;
  attendance: string;
  credit: string;
  onCancel?: () => void;
}
export interface ProfilePayment {
  id: string;
  date: string;
  kind: string;
  detail: string;
  amount: string;
}
export interface ProfileHistory {
  id: string;
  title: string;
  date: string;
  detail: string;
}
export function MemberProfileView({
  name,
  initials,
  stateLabel,
  joined,
  actions,
  studentTools,
  metrics,
  tab,
  onTab,
  entitlements,
  past,
  ledger,
  ledgerPanel,
  negative,
  reservations,
  reservationFilter,
  onReservationFilter,
  payments,
  debt,
  contacts,
  back,
  notice,
  loading = false,
  paymentPagination,
  reservationFooter,
  reservationFiltersDisabled = false,
}: {
  name: string;
  initials: string;
  stateLabel: string;
  joined: string | null;
  actions: ProfileAction[];
  studentTools?: ReactNode;
  metrics: {
    available: ProfileMetric;
    upcoming: ProfileMetric;
    debt: ProfileMetric;
    attendance: ProfileMetric;
  };
  tab: ProfileTab;
  onTab: (tab: ProfileTab) => void;
  entitlements: ProfileEntitlement[] | null;
  past: ProfileHistory[] | null;
  ledger: ProfileHistory[] | null;
  ledgerPanel?: ReactNode;
  negative: {
    limit: string;
    used: string;
    unitValue: string | null;
    action?: ProfileAction;
    selector?: ReactNode;
  } | null;
  reservations: ProfileReservation[] | null;
  reservationFilter: "all" | "upcoming" | "past";
  onReservationFilter: (value: "all" | "upcoming" | "past") => void;
  payments: ProfilePayment[] | null;
  debt: string | null;
  contacts:
    | { id: string; label: string; value: string; verification: string; source: string }[]
    | null;
  back: () => void;
  notice?: ReactNode;
  loading?: boolean;
  paymentPagination?: ReactNode;
  reservationFooter?: ReactNode;
  reservationFiltersDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const revealSelectedTab = useCallback((element: HTMLDivElement | null) => {
    const options = { block: "nearest", inline: "nearest", container: "nearest" } as const;
    element?.scrollIntoView(options);
  }, []);
  const actionLabel = (kind: MemberAction) => t(($) => $.memberProfile.actions[kind]);
  const buttons = (list: ProfileAction[], small = false) =>
    list.map((action) => (
      <Button
        key={action.kind}
        variant={
          action.kind === "allocate" || action.kind === "activate"
            ? "default"
            : action.kind === "terminate" || action.kind === "deactivate"
              ? "ghost"
              : "outline"
        }
        size={small ? "sm" : "default"}
        isDisabled={action.disabled || !action.onPress}
        onPress={action.onPress}
      >
        {action.kind === "allocate" && <PlusIcon />}
        {action.kind === "collect" && <CreditCardIcon />}
        {action.label ?? actionLabel(action.kind)}
      </Button>
    ));
  const headerActions = actions.filter((x) =>
    ["allocate", "collect", "deactivate", "activate"].includes(x.kind),
  );
  const entitlementActions = actions.filter((x) => x.kind === "renew" || x.kind === "change");
  const labels = {
    available: t(($) => $.memberProfile.available),
    upcoming: t(($) => $.memberProfile.upcoming),
    debt: t(($) => $.memberProfile.debt),
    attendance: t(($) => $.memberProfile.attendance),
  };
  return (
    <div className="@container/profile flex min-w-0 flex-col gap-4 p-4 sm:p-6" aria-busy={loading}>
      <div>
        <Button variant="ghost" size="sm" onPress={back}>
          <ArrowLeftIcon />
          {t(($) => $.memberProfile.back)}
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-[1_1_12rem]">
          <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">{name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{stateLabel}</Badge>
            {joined && (
              <Badge variant="outline">{t(($) => $.memberProfile.joined, { date: joined })}</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {studentTools}
          {buttons(headerActions)}
        </div>
      </div>
      {notice}
      <div
        data-profile-metrics
        className="grid min-w-0 grid-cols-2 gap-3 @min-[901px]/profile:grid-cols-4"
      >
        {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
          <Card key={key}>
            <CardContent className="p-4">
              <dl className="flex min-w-0 flex-col gap-2">
                <dt className="text-sm text-muted-foreground">{labels[key]}</dt>
                <dd className="text-2xl font-semibold tabular-nums wrap-anywhere">
                  {metrics[key].value ?? t(($) => $.memberProfile.unknown)}
                </dd>
                <dd className="text-xs text-muted-foreground wrap-anywhere">
                  {metrics[key].detail ?? t(($) => $.memberProfile.readRequired)}
                </dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid min-w-0 items-start gap-4 @min-[901px]/profile:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0 gap-0 py-0">
          <Tabs selectedKey={tab} onSelectionChange={(key) => onTab(key as ProfileTab)}>
            <div className="min-w-0 overflow-x-auto border-b px-4 pt-3 [scrollbar-gutter:stable]">
              <TabsList
                variant="line"
                aria-label={t(($) => $.memberProfile.sections)}
                className="flex w-max min-w-full justify-start"
              >
                <TabsTrigger
                  id="rights"
                  ref={tab === "rights" ? revealSelectedTab : undefined}
                  className="flex-none after:border-b-2 after:border-current after:bg-transparent"
                >
                  {t(($) => $.memberProfile.tabs.rights)}
                </TabsTrigger>
                <TabsTrigger
                  id="reservations"
                  ref={tab === "reservations" ? revealSelectedTab : undefined}
                  className="flex-none after:border-b-2 after:border-current after:bg-transparent"
                >
                  {t(($) => $.memberProfile.tabs.reservations)}
                </TabsTrigger>
                <TabsTrigger
                  id="payments"
                  ref={tab === "payments" ? revealSelectedTab : undefined}
                  className="flex-none after:border-b-2 after:border-current after:bg-transparent"
                >
                  {t(($) => $.memberProfile.tabs.payments)}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent id="rights">
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{t(($) => $.memberProfile.current)}</h2>
                  <div className="flex flex-wrap gap-2">{buttons(entitlementActions, true)}</div>
                </div>
                {entitlements === null && (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.memberProfile.readRequired)}
                  </p>
                )}
                {entitlements?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.memberProfile.noEntitlement)}
                  </p>
                )}
                {(entitlements ?? []).map((row) => (
                  <Item key={row.id} variant="outline" className="min-w-0 items-start">
                    <ItemContent>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <ItemTitle>{row.name}</ItemTitle>
                        <Badge variant="secondary">{row.state}</Badge>
                      </div>
                      <ItemDescription>{row.period}</ItemDescription>
                      <div className="my-2 flex flex-wrap gap-2">{buttons(row.actions, true)}</div>
                      {row.kind === "credit" && row.counts ? (
                        <>
                          {row.counts.total !== undefined && row.counts.total > 0 && (
                            <Progress
                              aria-label={t(($) => $.memberProfile.available)}
                              value={row.counts.available}
                              maxValue={row.counts.total}
                            />
                          )}
                          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums">
                            {(["available", "reserved", "consumed"] as const).map((key) => (
                              <div key={key}>
                                <dt className="inline text-muted-foreground">
                                  {t(($) => $.memberProfile.counts[key])}:{" "}
                                </dt>
                                <dd className="inline font-semibold">{row.counts![key]}</dd>
                              </div>
                            ))}
                          </dl>
                        </>
                      ) : row.kind === "timed" ? (
                        <p className="text-sm">{t(($) => $.memberProfile.timedHint)}</p>
                      ) : null}
                      {row.note && <p className="mt-2 text-sm text-muted-foreground">{row.note}</p>}
                      {row.policyNote && (
                        <p className="mt-2 text-sm text-muted-foreground">{row.policyNote}</p>
                      )}
                      {Boolean(row.freezes?.length) && (
                        <section
                          className="mt-3 space-y-2"
                          aria-label={t(($) => $.memberProfile.freezePeriods)}
                        >
                          <h3 className="text-sm font-medium">
                            {t(($) => $.memberProfile.freezePeriods)}
                          </h3>
                          <ItemGroup>
                            {row.freezes!.map((freeze) => (
                              <Item key={freeze.id} role="listitem" size="sm" variant="muted">
                                <ItemContent>
                                  <ItemTitle>{freeze.period}</ItemTitle>
                                  <ItemDescription>{freeze.state}</ItemDescription>
                                  {freeze.note && (
                                    <p className="text-sm text-muted-foreground">{freeze.note}</p>
                                  )}
                                </ItemContent>
                                {freeze.action && buttons([freeze.action], true)}
                              </Item>
                            ))}
                          </ItemGroup>
                        </section>
                      )}
                    </ItemContent>
                  </Item>
                ))}
                <section className="flex flex-col gap-3 border-t pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">{t(($) => $.memberProfile.negative)}</h2>
                    {negative?.action && buttons([negative.action], true)}
                  </div>
                  {negative?.selector}
                  {negative ? (
                    <dl className="flex flex-wrap gap-4 text-sm">
                      {(["limit", "used", "unitValue"] as const).map((key) => (
                        <div key={key}>
                          <dt className="text-muted-foreground">
                            {t(($) => $.memberProfile.negativeFields[key])}
                          </dt>
                          <dd className="font-medium tabular-nums">
                            {negative[key] ?? t(($) => $.memberProfile.unknown)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t(($) => $.memberProfile.readRequired)}
                    </p>
                  )}
                </section>
                {(
                  [
                    ["ledger", ledger],
                    ["past", past],
                  ] as const
                ).map(([key, rows]) => (
                  <section key={key} className="border-t pt-4">
                    <h2 className="mb-3 font-semibold">{t(($) => $.memberProfile[key])}</h2>
                    {key === "ledger" && ledgerPanel ? (
                      ledgerPanel
                    ) : (
                      <>
                        <ItemGroup>
                          {(rows ?? []).map((row) => (
                            <Item key={row.id} role="listitem" className="px-0">
                              <ItemContent>
                                <ItemTitle>{row.title}</ItemTitle>
                                <ItemDescription>{row.date}</ItemDescription>
                              </ItemContent>
                              <span className="text-sm tabular-nums">{row.detail}</span>
                            </Item>
                          ))}
                        </ItemGroup>
                        {rows === null && (
                          <p className="text-sm text-muted-foreground">
                            {t(($) => $.memberProfile.readRequired)}
                          </p>
                        )}
                        {rows?.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t(($) => $.memberProfile.noRecords)}
                          </p>
                        )}
                      </>
                    )}
                  </section>
                ))}
              </div>
            </TabsContent>
            <TabsContent id="reservations">
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">{t(($) => $.memberProfile.reservationHistory)}</h2>
                  <ToggleGroup
                    variant="segmented"
                    selectionMode="single"
                    disallowEmptySelection
                    aria-label={t(($) => $.memberProfile.filter)}
                    selectedKeys={new Set([reservationFilter])}
                    onSelectionChange={(keys) => {
                      const key = [...keys][0];
                      if (key === "all" || key === "upcoming" || key === "past")
                        onReservationFilter(key);
                    }}
                  >
                    {(["all", "upcoming", "past"] as const).map((key) => (
                      <ToggleGroupItem key={key} id={key} isDisabled={reservationFiltersDisabled}>
                        {t(($) => $.memberProfile.filters[key])}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div
                  role="region"
                  aria-label={t(($) => $.memberProfile.reservationHistory)}
                  tabIndex={0}
                  className="min-w-0 overflow-x-auto"
                >
                  <Table
                    aria-label={t(($) => $.memberProfile.reservationHistory)}
                    className="min-w-[34rem]"
                  >
                    <TableHeader>
                      <TableHead isRowHeader>{t(($) => $.memberProfile.columns.lesson)}</TableHead>
                      <TableHead>{t(($) => $.memberProfile.columns.reservation)}</TableHead>
                      <TableHead>{t(($) => $.memberProfile.columns.attendance)}</TableHead>
                      <TableHead>{t(($) => $.memberProfile.columns.credit)}</TableHead>
                      <TableHead>
                        <span className="sr-only">{t(($) => $.memberProfile.columns.actions)}</span>
                      </TableHead>
                    </TableHeader>
                    <TableBody
                      renderEmptyState={() =>
                        t(($) =>
                          reservations === null
                            ? $.memberProfile.readRequired
                            : $.memberProfile.noRecords,
                        )
                      }
                    >
                      {(reservations ?? []).map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell>
                            <span>{row.lesson}</span>
                            <p className="text-xs text-muted-foreground">{row.date}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{row.reservation}</Badge>
                          </TableCell>
                          <TableCell>{row.attendance}</TableCell>
                          <TableCell>{row.credit}</TableCell>
                          <TableCell
                            className={row.onCancel ? "pl-[max(26px,1.75rem)]" : undefined}
                          >
                            {row.onCancel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`${t(($) => $.memberProfile.actions.cancelReservation)} · ${row.lesson} · ${row.date}`}
                                onPress={row.onCancel}
                              >
                                {t(($) => $.memberProfile.actions.cancelReservation)}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reservationFooter}
              </div>
            </TabsContent>
            <TabsContent id="payments">
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{t(($) => $.memberProfile.paymentHistory)}</h2>
                  <div className="flex flex-wrap gap-2">
                    {buttons(
                      actions.filter((x) => x.kind === "collect"),
                      true,
                    )}
                  </div>
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <Table aria-label={t(($) => $.memberProfile.paymentHistory)}>
                    <TableHeader>
                      <TableHead isRowHeader>{t(($) => $.memberProfile.columns.date)}</TableHead>
                      <TableHead>{t(($) => $.memberProfile.columns.kind)}</TableHead>
                      <TableHead>{t(($) => $.memberProfile.columns.detail)}</TableHead>
                      <TableHead>{t(($) => $.memberProfile.columns.amount)}</TableHead>
                    </TableHeader>
                    <TableBody
                      renderEmptyState={() =>
                        t(($) =>
                          payments === null
                            ? $.memberProfile.readRequired
                            : $.memberProfile.noRecords,
                        )
                      }
                    >
                      {(payments ?? []).map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.kind}</TableCell>
                          <TableCell>{row.detail}</TableCell>
                          <TableCell>{row.amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {paymentPagination}
                <dl className="mt-3 flex justify-between gap-3 border-t pt-3 text-sm">
                  <dt>{t(($) => $.memberProfile.debt)}</dt>
                  <dd className="font-semibold tabular-nums">
                    {debt ?? t(($) => $.memberProfile.unknown)}
                  </dd>
                </dl>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
        <aside className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>{t(($) => $.memberProfile.contact)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(contacts ?? []).map((row) => (
                <div
                  key={row.id}
                  className="flex min-w-0 flex-wrap items-start justify-between gap-2"
                >
                  <dl className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="text-sm wrap-anywhere">{row.value}</dd>
                    <dd className="mt-1 text-xs text-muted-foreground">{row.source}</dd>
                  </dl>
                  <Badge variant="outline">{row.verification}</Badge>
                </div>
              ))}
              {contacts === null && (
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.memberProfile.readRequired)}
                </p>
              )}
              {contacts?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.memberProfile.noRecords)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t(($) => $.memberProfile.contactHint)}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
