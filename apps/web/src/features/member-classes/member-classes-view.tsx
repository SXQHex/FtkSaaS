import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent } from "@ftksaas/ui/components/card";
import { Badge } from "@ftksaas/ui/components/badge";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
export interface MemberClassRow {
  id: string;
  time: string;
  duration: string;
  title: string;
  metadata: string;
  state: string;
  priorityBooking?: boolean;
  hint?: string;
  action?: { label: string; disabled?: boolean; onPress: () => void };
}
export function MemberClassesView({
  range,
  days,
  selectedDay,
  onDay,
  onWeek,
  rows,
  notes,
  policy,
  notice,
  loading,
  locked = false,
}: {
  range: string;
  days: {
    id: string;
    weekday: string;
    day: string;
    label: string;
    hasClasses: boolean;
    today: boolean;
  }[];
  selectedDay: string;
  onDay: (day: string) => void;
  onWeek: (direction: -1 | 0 | 1) => void;
  rows: MemberClassRow[] | null;
  notes?: ReactNode;
  policy: ReactNode;
  notice?: ReactNode;
  loading: boolean;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="@container mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 p-4">
      <header>
        <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.02em]">
          {t(($) => $.memberClasses.title)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(($) => $.memberClasses.description)}
        </p>
      </header>
      {notes}
      {notice}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" isDisabled={locked} onPress={() => onWeek(0)}>
            {t(($) => $.memberClasses.thisWeek)}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t(($) => $.memberClasses.previousWeek)}
            isDisabled={locked}
            onPress={() => onWeek(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t(($) => $.memberClasses.nextWeek)}
            isDisabled={locked}
            onPress={() => onWeek(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
        <strong className="text-sm tabular-nums">{range}</strong>
      </div>
      <ToggleGroup
        isDisabled={locked}
        aria-label={t(($) => $.memberClasses.chooseDay)}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([selectedDay])}
        onSelectionChange={(keys) => {
          const value = [...keys][0];
          if (typeof value === "string") onDay(value);
        }}
        className="grid w-full grid-cols-7 gap-1"
        variant="outline"
      >
        {days.map((day) => (
          <ToggleGroupItem
            key={day.id}
            id={day.id}
            aria-label={day.label}
            className="h-auto min-h-20 min-w-0 flex-col gap-1 px-0.5 py-2"
            aria-current={day.today ? "date" : undefined}
          >
            <span className="text-xs text-muted-foreground">{day.weekday}</span>
            <span className="text-lg tabular-nums">{day.day}</span>
            <span
              aria-hidden="true"
              className={`size-1 rounded-full ${day.hasClasses ? "bg-current" : "bg-transparent"}`}
            />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Card className="min-w-0">
        <CardContent className="p-3 @md:p-5">
          {loading ? (
            <div aria-busy="true">
              <p role="status" className="sr-only">
                {t(($) => $.memberClasses.loading)}
              </p>
              <Skeleton className="h-16 w-full" />
            </div>
          ) : rows === null ? (
            <p className="py-6 text-sm text-muted-foreground">{t(($) => $.memberClasses.unread)}</p>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyDescription>{t(($) => $.memberClasses.empty)}</EmptyDescription>
            </Empty>
          ) : (
            <ItemGroup className="gap-0 divide-y">
              {rows.map((row) => (
                <Item
                  role="listitem"
                  key={row.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-none border-0 px-0 py-4 @lg:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  <div className="w-14 shrink-0 text-sm tabular-nums">
                    <p className="font-semibold">{row.time}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.duration}</p>
                  </div>
                  <ItemContent className="min-w-0">
                    <ItemTitle id={`member-class-${row.id}`} className="flex-wrap break-words">
                      {row.title}
                      {row.priorityBooking && (
                        <Badge variant="secondary">
                          {t(($) => $.memberClasses.modes.priority)}
                        </Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-none break-words">
                      {row.metadata}
                    </ItemDescription>
                    {row.hint && <p className="text-xs text-muted-foreground">{row.hint}</p>}
                  </ItemContent>
                  <ItemActions className="col-start-2 flex-wrap gap-2 @lg:col-start-3 @lg:flex-col @lg:items-end">
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      {row.state}
                    </Badge>
                    {row.action && (
                      <Button
                        size="sm"
                        aria-describedby={`member-class-${row.id}`}
                        isDisabled={row.action.disabled}
                        onPress={row.action.onPress}
                      >
                        {row.action.label}
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
      <p className="text-xs leading-relaxed text-muted-foreground">{policy}</p>
    </div>
  );
}
