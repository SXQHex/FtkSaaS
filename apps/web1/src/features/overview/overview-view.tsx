import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { PlusIcon } from "lucide-react";
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
  ItemMedia,
  ItemSeparator,
} from "../../components/ui/item";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Progress } from "../../components/ui/progress";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { Skeleton } from "../../components/ui/skeleton";
export interface OverviewLesson {
  id: string;
  title: string;
  starts: string;
  ends: string;
  metadata: string;
  instructors: string;
  rooms: string;
  state: string;
  past: boolean;
  next: boolean;
  capacity: { held: number; total: number; remaining: number };
}
export interface OverviewParticipant {
  id: string;
  name: string;
  initials: string;
  source: string;
}
export function OverviewView({
  date,
  now,
  lessons,
  selected,
  participants,
  participantNotice,
  onSelect,
  onProgram,
  onAdd,
  onSession,
  onAttendance,
  onAllParticipants,
  canAdd = false,
  canAttend = false,
  notice,
  loading = false,
}: {
  date: string;
  now: string;
  lessons: OverviewLesson[] | null;
  selected?: OverviewLesson;
  participants: OverviewParticipant[] | null;
  participantNotice?: ReactNode;
  onSelect: (id: string) => void;
  onProgram: () => void;
  onAdd: () => void;
  onSession: () => void;
  onAttendance: () => void;
  onAllParticipants: () => void;
  canAdd?: boolean;
  canAttend?: boolean;
  notice?: ReactNode;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const nowRow = (
    <Item
      role="listitem"
      className="relative h-0 gap-0 rounded-none p-0"
      aria-label={t(($) => $.overview.now, { time: now })}
    >
      <ItemSeparator className="m-0 w-full" />
      <Badge className="absolute start-3 -translate-y-1/2" variant="secondary">
        {now}
      </Badge>
    </Item>
  );
  return (
    <div className="@container flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t(($) => $.overview.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onPress={onProgram}>
            {t(($) => $.overview.openProgram)}
          </Button>
          <Button isDisabled={!canAdd} onPress={onAdd}>
            <PlusIcon data-icon="inline-start" />
            {t(($) => $.overview.addLesson)}
          </Button>
        </div>
      </header>
      {notice}
      <div className="grid min-w-0 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 gap-0 py-0">
          <CardHeader className="sr-only">
            <CardTitle>{t(($) => $.overview.timeline)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col gap-4 p-5">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : lessons === null ? (
              <p className="p-5">{t(($) => $.overview.unread)}</p>
            ) : lessons.length === 0 ? (
              <Empty>
                <EmptyDescription>{t(($) => $.overview.empty)}</EmptyDescription>
              </Empty>
            ) : (
              <ItemGroup aria-label={t(($) => $.overview.timeline)} className="gap-0">
                {lessons.map((row, index) => (
                  <Fragment key={row.id}>
                    {row.next && nowRow}
                    {index > 0 && !row.next && <ItemSeparator className="m-0" />}
                    <Item
                      role="listitem"
                      variant={row.next ? "muted" : "default"}
                      className={cn(
                        "grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-3 rounded-none px-5 py-4 @2xl:grid-cols-[4rem_minmax(0,1fr)_auto]",
                        row.past && "opacity-60",
                      )}
                    >
                      <div className="self-start tabular-nums">
                        <p className="font-semibold">{row.starts}</p>
                        <p className="text-xs text-muted-foreground">{row.ends}</p>
                      </div>
                      <ItemContent>
                        <ItemTitle>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto min-w-0 justify-start p-0 text-start whitespace-normal"
                            onPress={() => onSelect(row.id)}
                          >
                            {row.title}
                          </Button>
                        </ItemTitle>
                        <ItemDescription className="line-clamp-none wrap-anywhere">
                          {row.metadata}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions className="col-start-2 flex-wrap @2xl:col-start-3 @2xl:flex-nowrap">
                        <div className="flex w-20 flex-col gap-1 text-center tabular-nums">
                          <span>
                            {row.capacity.held} / {row.capacity.total}
                          </span>
                          {row.capacity.total > 0 && (
                            <Progress
                              aria-label={t(($) => $.overview.capacityProgress, {
                                name: row.title,
                              })}
                              value={Math.min(row.capacity.held, row.capacity.total)}
                              maxValue={row.capacity.total}
                            />
                          )}
                        </div>
                        <Badge variant={row.next ? "default" : "outline"}>{row.state}</Badge>
                      </ItemActions>
                    </Item>
                  </Fragment>
                ))}
                {!lessons.some((row) => row.next) && nowRow}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
        <Card
          className="min-w-0"
          role="region"
          aria-label={t(($) =>
            selected && !selected.next ? $.overview.selectedLesson : $.overview.nextLesson,
          )}
        >
          <CardHeader>
            <CardTitle>
              {selected?.title ??
                t(($) =>
                  loading
                    ? $.overview.loading
                    : lessons === null
                      ? $.overview.unread
                      : $.overview.noNextLesson,
                )}
            </CardTitle>
            {selected && (
              <CardDescription>
                {selected.starts} – {selected.ends}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {selected && (
              <>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t(($) => $.overview.instructor)}</dt>
                  <dd className="wrap-anywhere">{selected.instructors}</dd>
                  <dt className="text-muted-foreground">{t(($) => $.overview.room)}</dt>
                  <dd className="wrap-anywhere">{selected.rooms}</dd>
                  <dt className="text-muted-foreground">{t(($) => $.overview.capacity)}</dt>
                  <dd>{t(($) => $.overview.capacityValue, selected.capacity)}</dd>
                </dl>
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t(($) => $.overview.members)}
                  </h2>
                  {participantNotice}
                  {participants === null ? (
                    <p className="text-sm">{t(($) => $.overview.participantsUnread)}</p>
                  ) : participants.length === 0 ? (
                    <p className="text-sm">{t(($) => $.overview.noParticipants)}</p>
                  ) : (
                    <ItemGroup className="gap-2">
                      {participants.map((row) => (
                        <Item key={row.id} role="listitem" className="p-0">
                          <ItemMedia>
                            <Avatar size="sm">
                              <AvatarFallback>{row.initials}</AvatarFallback>
                            </Avatar>
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>{row.name}</ItemTitle>
                            <ItemDescription className="line-clamp-none wrap-anywhere">
                              {row.source}
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                      ))}
                    </ItemGroup>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto justify-start self-start p-0"
                    onPress={onAllParticipants}
                  >
                    {t(($) => $.overview.allParticipants)}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
          {selected && (
            <CardFooter className="flex-wrap gap-2">
              <Button variant="outline" size="sm" onPress={onSession}>
                {t(($) => $.overview.openSession)}
              </Button>
              <Button size="sm" isDisabled={!canAttend} onPress={onAttendance}>
                {t(($) => $.overview.openAttendance)}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
