import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDaysIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";

export interface InstructorSessionRow {
  id: string;
  time: string;
  duration: string;
  title: string;
  context: string;
  state: string;
  action: string;
  current?: boolean;
  closed?: boolean;
}
export interface InstructorTodayData {
  date: string;
  timezone: string;
  metrics: {
    today: { value: string | null; detail: string };
    pending: { value: string | null; detail: string };
    week: { value: string | null; detail: string };
    earnings: { value: string | null; detail: string; label: string };
  };
  today: InstructorSessionRow[] | null;
  next: InstructorSessionRow[] | null;
  attendanceHint: string;
}
export function InstructorTodayView({
  data,
  calendarLoading,
  notice,
  onSchedule,
  onOpen,
}: {
  data: InstructorTodayData;
  calendarLoading: boolean;
  notice?: ReactNode;
  onSchedule?: () => void;
  onOpen?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const metricLabels = {
    today: t(($) => $.instructorToday.metrics.today),
    pending: t(($) => $.instructorToday.metrics.pending),
    week: t(($) => $.instructorToday.metrics.week),
    earnings: data.metrics.earnings.label,
  };
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(($) => $.instructorToday.title)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.date}</p>
        </div>
        <Button variant="outline" isDisabled={!onSchedule} onPress={onSchedule}>
          <CalendarDaysIcon data-icon="inline-start" />
          {t(($) => $.instructorToday.schedule)}
        </Button>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-4 @sm:grid-cols-2 @4xl:grid-cols-4">
        {(["today", "pending", "week", "earnings"] as const).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{metricLabels[key]}</CardDescription>
              {calendarLoading && key !== "earnings" ? (
                <Skeleton aria-hidden="true" className="h-8 w-20 motion-reduce:animate-none" />
              ) : (
                <>
                  <CardTitle className="break-words text-2xl tabular-nums">
                    {data.metrics[key].value ?? "—"}
                  </CardTitle>
                  <CardDescription>{data.metrics[key].detail}</CardDescription>
                </>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{data.timezone}</p>
      {notice}
      {(["today", "next"] as const).map((key) => (
        <Card key={key} className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>{t(($) => $.instructorToday.sections[key])}</h2>
            </CardTitle>
            {key === "today" && <CardDescription>{data.attendanceHint}</CardDescription>}
          </CardHeader>
          <CardContent>
            {calendarLoading ? (
              key === "today" ? (
                <Skeleton
                  role="progressbar"
                  aria-label={t(($) => $.instructorSchedule.loading)}
                  className="h-12 w-full motion-reduce:animate-none"
                />
              ) : (
                <Skeleton aria-hidden="true" className="h-12 w-full motion-reduce:animate-none" />
              )
            ) : data[key] === null ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t(($) => $.instructorToday.unread)}
              </p>
            ) : data[key].length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(($) => $.instructorToday.empty[key])}
              </p>
            ) : (
              <ItemGroup aria-label={t(($) => $.instructorToday.sections[key])}>
                {data[key].map((row) => (
                  <Item
                    key={row.id}
                    role="listitem"
                    variant={row.current ? "outline" : "default"}
                    className={row.closed ? "text-muted-foreground" : undefined}
                  >
                    <div className="w-16 shrink-0 tabular-nums">
                      <p className="font-semibold">{row.time}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.duration}</p>
                    </div>
                    <ItemContent className="min-w-0 basis-36">
                      <ItemTitle className="break-words">{row.title}</ItemTitle>
                      <ItemDescription className="break-words">{row.context}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex-wrap gap-2">
                      <Badge variant="outline" className="max-w-full whitespace-normal">
                        {row.state}
                      </Badge>
                      <Button
                        size="sm"
                        variant={row.current ? "default" : "outline"}
                        isDisabled={!onOpen}
                        aria-label={t(($) => $.instructorToday.openSession, {
                          title: row.title,
                          time: row.time,
                          action: row.action,
                        })}
                        onPress={() => onOpen?.(row.id)}
                      >
                        {row.action}
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      ))}
      <p className="text-sm text-muted-foreground">{t(($) => $.instructorToday.privacy)}</p>
    </div>
  );
}
