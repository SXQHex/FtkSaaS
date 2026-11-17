import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export interface MemberUpcomingRow {
  id: string;
  time: string;
  duration: string;
  title: string;
  metadata: string;
  hint: string;
  state: string;
  action?: ReactNode;
  policy?: ReactNode;
}
export interface MemberHistoryRow {
  id: string;
  date: string;
  title: string;
  state: string;
}
export function MemberReservationsView({
  upcoming,
  waiting,
  history,
  upcomingPagination,
  waitingPagination,
  historyPagination,
  notice,
}: {
  upcoming: MemberUpcomingRow[] | null;
  waiting: MemberUpcomingRow[] | null;
  history: MemberHistoryRow[] | null;
  upcomingPagination?: ReactNode;
  waitingPagination?: ReactNode;
  historyPagination?: ReactNode;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  function list(rows: MemberUpcomingRow[] | null, kind: "upcoming" | "waiting") {
    if (rows === null)
      return (
        <p className="py-6 text-sm text-muted-foreground">
          {t(($) => $.memberReservations.unread[kind])}
        </p>
      );
    if (rows.length === 0)
      return (
        <Empty>
          <EmptyDescription>{t(($) => $.memberReservations.empty[kind])}</EmptyDescription>
        </Empty>
      );
    return (
      <ItemGroup className="gap-0 divide-y">
        {rows.map((row) => (
          <Item
            role="listitem"
            key={row.id}
            className="flex-nowrap items-start gap-3 rounded-none border-0 px-0 py-4"
          >
            <div className="w-14 shrink-0 text-sm tabular-nums">
              <p className="font-semibold">{row.time}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.duration}</p>
            </div>
            <ItemContent className="min-w-0">
              <ItemTitle className="break-words">{row.title}</ItemTitle>
              <ItemDescription className="line-clamp-none break-words">
                {row.metadata}
              </ItemDescription>
              <p className="text-xs text-muted-foreground">{row.hint}</p>
              {row.policy}
              <ItemActions className="mt-2 flex-wrap @lg:hidden">
                <Badge variant="outline">{row.state}</Badge>
                {row.action}
              </ItemActions>
            </ItemContent>
            <ItemActions className="hidden shrink-0 flex-col items-end gap-2 @lg:flex">
              <Badge variant="outline">{row.state}</Badge>
              {row.action}
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    );
  }
  return (
    <div className="@container mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 p-4">
      <header>
        <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.02em]">
          {t(($) => $.memberReservations.title)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(($) => $.memberReservations.description)}
        </p>
      </header>
      {notice}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t(($) => $.memberReservations.upcoming)}</CardTitle>
        </CardHeader>
        <CardContent>{list(upcoming, "upcoming")}</CardContent>
        {upcomingPagination && <CardFooter>{upcomingPagination}</CardFooter>}
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t(($) => $.memberReservations.waiting)}</CardTitle>
          <CardDescription>{t(($) => $.memberReservations.waitingHint)}</CardDescription>
        </CardHeader>
        <CardContent>{list(waiting, "waiting")}</CardContent>
        {waitingPagination && <CardFooter>{waitingPagination}</CardFooter>}
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t(($) => $.memberReservations.history)}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 [&_[data-slot=table-container]]:max-h-[min(65dvh,36rem)]">
          {history === null ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(($) => $.memberReservations.unread.history)}
            </p>
          ) : (
            <Table aria-label={t(($) => $.memberReservations.history)} className="min-w-[30rem]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                  {t(($) => $.memberReservations.date)}
                </TableHead>
                <TableHead>{t(($) => $.memberReservations.lesson)}</TableHead>
                <TableHead>{t(($) => $.memberReservations.state)}</TableHead>
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <Empty>
                    <EmptyDescription>
                      {t(($) => $.memberReservations.empty.history)}
                    </EmptyDescription>
                  </Empty>
                )}
              >
                {history.map((row) => (
                  <TableRow key={row.id} id={row.id}>
                    <TableCell className="sticky start-0 z-10 bg-card tabular-nums">
                      {row.date}
                    </TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {historyPagination && <CardFooter>{historyPagination}</CardFooter>}
      </Card>
    </div>
  );
}
