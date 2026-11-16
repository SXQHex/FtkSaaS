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
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import type { EventState } from "../../lib/api-contracts/generated";

export type EventFilter = "all" | EventState;
export interface EventRow {
  id: string;
  name: string;
  kind: string;
  day: string;
  time: string;
  venue: string;
  registrations: string;
  fee: string;
  state: EventState;
}
export function EventsView({
  rows,
  query,
  onQuery,
  filter,
  onFilter,
  filtersAvailable,
  summary,
  onAdd,
  onOpen,
  notice,
  pagination,
  locked = false,
}: {
  rows: EventRow[] | null;
  query: string;
  onQuery: (value: string) => void;
  filter: EventFilter;
  onFilter: (value: EventFilter) => void;
  filtersAvailable: boolean;
  summary: {
    published: string | null;
    draft: string | null;
    registrations: string | null;
    unpaid: string | null;
  };
  onAdd: () => void;
  onOpen: (id: string) => void;
  notice?: ReactNode;
  pagination?: ReactNode;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t(($) => $.events.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.events.description)}</p>
        </div>
        <Button onPress={onAdd} isDisabled={locked}>
          {t(($) => $.events.add)}
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(["published", "draft", "registrations", "unpaid"] as const).map((key) => (
          <Card key={key} className="min-w-0">
            <CardHeader>
              <CardDescription>{t(($) => $.events.metrics[key])}</CardDescription>
              <CardTitle className="text-2xl tabular-nums wrap-anywhere">
                {summary[key] ?? "—"}
              </CardTitle>
              <CardDescription>{t(($) => $.events.metricHints[key])}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      {notice}
      <Card className="min-w-0">
        <CardContent className="flex min-w-0 flex-col gap-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              type="search"
              name="event_query"
              aria-label={t(($) => $.events.search)}
              placeholder={t(($) => $.events.search)}
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              disabled={locked || !filtersAvailable}
              className="w-full sm:max-w-64"
            />
            <ToggleGroup
              selectionMode="single"
              disallowEmptySelection
              aria-label={t(($) => $.events.status)}
              variant="segmented"
              selectedKeys={[filter]}
              onSelectionChange={(keys) => {
                const key = [...keys][0];
                if (["all", "published", "draft", "occurred", "cancelled"].includes(String(key)))
                  onFilter(key as EventFilter);
              }}
              className="max-w-full overflow-x-auto"
            >
              {(["all", "published", "draft", "occurred", "cancelled"] as const).map((key) => (
                <ToggleGroupItem key={key} id={key} isDisabled={locked || !filtersAvailable}>
                  {t(($) => $.events.filters[key])}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div
            role="region"
            tabIndex={0}
            aria-label={t(($) => $.events.title)}
            className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring [&_[data-slot=table-container]]:max-h-[min(65vh,32rem)]"
          >
            {rows === null ? (
              <p role="status" className="py-8 text-sm text-muted-foreground">
                {t(($) => $.events.unread)}
              </p>
            ) : (
              <Table aria-label={t(($) => $.events.title)} className="min-w-[43rem]">
                <TableHeader className="sticky top-0 z-20 bg-card">
                  <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                    {t(($) => $.events.columns.name)}
                  </TableHead>
                  <TableHead>{t(($) => $.events.columns.date)}</TableHead>
                  <TableHead>{t(($) => $.events.columns.venue)}</TableHead>
                  <TableHead>{t(($) => $.events.columns.registrations)}</TableHead>
                  <TableHead>{t(($) => $.events.columns.fee)}</TableHead>
                  <TableHead>{t(($) => $.events.columns.state)}</TableHead>
                </TableHeader>
                <TableBody
                  renderEmptyState={() => (
                    <Empty>
                      <EmptyDescription>{t(($) => $.events.empty)}</EmptyDescription>
                    </Empty>
                  )}
                >
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      id={row.id}
                      onAction={() => {
                        if (!locked) onOpen(row.id);
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell className="sticky start-0 z-10 bg-card">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.kind}</p>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <p>{row.day}</p>
                        <p className="text-xs text-muted-foreground">{row.time}</p>
                      </TableCell>
                      <TableCell>{row.venue}</TableCell>
                      <TableCell className="tabular-nums">{row.registrations}</TableCell>
                      <TableCell className="tabular-nums">{row.fee}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(($) => $.events.filters[row.state])}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t(($) => $.events.practiceHint)}</p>
          {pagination}
        </CardFooter>
      </Card>
    </div>
  );
}
