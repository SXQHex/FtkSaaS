import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export interface MemberClassRow {
  id: string;
  time: string;
  duration: string;
  title: string;
  metadata: string;
  state: string;
  fixedGroup?: boolean;
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
          <Button variant="outline" onPress={() => onWeek(0)}>
            {t(($) => $.memberClasses.thisWeek)}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t(($) => $.memberClasses.previousWeek)}
            onPress={() => onWeek(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t(($) => $.memberClasses.nextWeek)}
            onPress={() => onWeek(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
        <strong className="text-sm tabular-nums">{range}</strong>
      </div>
      <ToggleGroup
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
          {rows === null ? (
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
                  className="flex-nowrap items-start gap-3 rounded-none border-0 px-0 py-4"
                >
                  <div className="w-14 shrink-0 text-sm tabular-nums">
                    <p className="font-semibold">{row.time}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.duration}</p>
                  </div>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex-wrap break-words">
                      {row.title}
                      {row.fixedGroup && (
                        <Badge variant="secondary">{t(($) => $.memberClasses.fixedGroup)}</Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-none break-words">
                      {row.metadata}
                    </ItemDescription>
                    {row.hint && <p className="text-xs text-muted-foreground">{row.hint}</p>}
                    <ItemActions className="mt-2 flex-wrap @lg:hidden">
                      <Badge variant="outline">{row.state}</Badge>
                      {row.action && (
                        <Button
                          size="sm"
                          isDisabled={row.action.disabled}
                          onPress={row.action.onPress}
                        >
                          {row.action.label}
                        </Button>
                      )}
                    </ItemActions>
                  </ItemContent>
                  <ItemActions className="hidden shrink-0 flex-col items-end gap-2 @lg:flex">
                    <Badge variant="outline">{row.state}</Badge>
                    {row.action && (
                      <Button
                        size="sm"
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
