import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button, LinkButton } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import type { EventState } from "../../lib/api-contracts/generated";

export type EventDetailAction =
  | "edit"
  | "publish"
 
  | "complete"
  | "cancel"
  | "register"
  | "cancel_registration"
  | "payment"
  | "verify_duty";
export interface EventParticipantRow {
  id: string;
  name: string;
  initials: string;
  rights: string;
  payment: string;
  attendance: string;
  warning?: string;
  cancelled: boolean;
  paymentAvailable: boolean;
}
export interface EventDutyRow {
  id: string;
  name: string;
  duty: string;
  fee: string;
  state: string;
  canVerify: boolean;
}
export function EventDetailView({
  name,
  state,
  kind,
  facts,
  rows,
  duties,
  capacity,
  conditions,
  attendance,
  notice,
  backHref,
  tab,
  onTab,
  onAction,
  enabledActions,
  locked = false,
}: {
  name: string;
  state: EventState;
  kind: string;
  facts: { label: string; value: string }[];
  rows: EventParticipantRow[] | null;
  duties: EventDutyRow[] | null;
  capacity: ReactNode;
  conditions: ReactNode;
  attendance: ReactNode;
  notice?: ReactNode;
  backHref: string;
  tab: "participants" | "attendance";
  onTab: (value: "participants" | "attendance") => void;
  onAction: (action: EventDetailAction, id?: string) => void;
  enabledActions: EventDetailAction[];
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const enabled = (action: EventDetailAction) => !locked && enabledActions.includes(action);
  return (
    <div className="flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <div>
        <LinkButton href={backHref} variant="ghost" size="sm" isDisabled={locked}>
          {t(($) => $.events.title)}
        </LinkButton>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="break-words text-2xl font-semibold">{name}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge>{t(($) => $.events.filters[state])}</Badge>
            <Badge variant="secondary">{kind}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "edit",
              ...(state === "draft"
                ? ["publish" as const]
                : state === "published"
                  ? ["complete" as const]
                  : []),
              "cancel",
            ] as const
          ).map((action) => (
            <Button
              key={action}
              variant={action === "publish" ? "default" : "outline"}
              isDisabled={!enabled(action)}
              onPress={() => onAction(action)}
            >
              {t(($) => $.eventDetail.actions[action])}
            </Button>
          ))}
        </div>
      </header>
      {notice}
      <Card>
        <CardContent>
          <dl className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                <dd className="mt-1 break-words text-sm font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <Tabs
            selectedKey={tab}
            onSelectionChange={(key) => {
              if (!locked && (key === "participants" || key === "attendance")) onTab(key);
            }}
          >
            <CardHeader>
              <TabsList
                aria-label={t(($) => $.eventDetail.sections)}
                className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-auto"
              >
                <TabsTrigger id="participants" className="min-h-9" isDisabled={locked}>
                  {t(($) => $.eventDetail.participants)}
                  {rows !== null && <Badge variant="secondary">{rows.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger id="attendance" className="min-h-9" isDisabled={locked}>
                  {t(($) => $.eventDetail.attendance)}
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent id="participants">
              <CardContent className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {rows === null
                      ? t(($) => $.eventDetail.unread)
                      : t(($) => $.eventDetail.visibleCount, { count: rows.length })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={!enabled("register")}
                    onPress={() => onAction("register")}
                  >
                    {t(($) => $.eventDetail.actions.register)}
                  </Button>
                </div>
                {rows === null ? (
                  <p role="status">{t(($) => $.eventDetail.unread)}</p>
                ) : (
                  <div
                    role="region"
                    tabIndex={0}
                    aria-label={t(($) => $.eventDetail.participants)}
                    className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring [&_[data-slot=table-container]]:max-h-[min(65vh,32rem)]"
                  >
                    <Table
                      aria-label={t(($) => $.eventDetail.participants)}
                      className="min-w-[38rem]"
                    >
                      <TableHeader className="sticky top-0 z-20 bg-card">
                        <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                          {t(($) => $.eventDetail.member)}
                        </TableHead>
                        <TableHead>{t(($) => $.eventDetail.rights)}</TableHead>
                        <TableHead>{t(($) => $.eventDetail.payment)}</TableHead>
                        <TableHead>{t(($) => $.eventDetail.attendance)}</TableHead>
                        <TableHead>
                          <span className="sr-only">{t(($) => $.eventDetail.operations)}</span>
                        </TableHead>
                      </TableHeader>
                      <TableBody
                        renderEmptyState={() => (
                          <Empty>
                            <EmptyDescription>{t(($) => $.eventDetail.empty)}</EmptyDescription>
                          </Empty>
                        )}
                      >
                        {rows.map((row) => (
                          <TableRow key={row.id} id={row.id}>
                            <TableCell className="sticky start-0 z-10 bg-card">
                              <div className="flex items-center gap-3">
                                <Avatar size="sm">
                                  <AvatarFallback>{row.initials}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium">{row.name}</p>
                                  {row.warning && (
                                    <p className="text-xs text-destructive">{row.warning}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{row.rights}</TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-2">
                                <Badge variant="secondary">{row.payment}</Badge>
                                {row.paymentAvailable && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    isDisabled={!enabled("payment")}
                                    onPress={() => onAction("payment", row.id)}
                                  >
                                    {t(($) => $.eventDetail.actions.payment)}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.attendance}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                isDisabled={row.cancelled || !enabled("cancel_registration")}
                                onPress={() => onAction("cancel_registration", row.id)}
                              >
                                {t(($) => $.eventDetail.actions.cancel_registration)}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </TabsContent>
            <TabsContent id="attendance">
              <CardContent>{attendance}</CardContent>
            </TabsContent>
          </Tabs>
        </Card>
        <aside className="flex min-w-0 flex-col gap-4" aria-label={t(($) => $.eventDetail.extra)}>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.eventDetail.capacity)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>{capacity}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.eventDetail.duties)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {duties === null ? (
                <p>{t(($) => $.eventDetail.unread)}</p>
              ) : duties.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(($) => $.eventDetail.noDuties)}</p>
              ) : (
                duties.map((duty) => (
                  <div key={duty.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">{duty.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {duty.duty} · {duty.fee}
                      </p>
                      <p className="text-xs text-muted-foreground">{duty.state}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={!duty.canVerify || !enabled("verify_duty")}
                      onPress={() => onAction("verify_duty", duty.id)}
                    >
                      {t(($) => $.eventDetail.actions.verify_duty)}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.eventDetail.conditions)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>{conditions}</CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
