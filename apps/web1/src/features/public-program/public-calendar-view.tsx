import { useTranslation } from "react-i18next";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button, LinkButton } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "../../components/ui/empty";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";

export interface PublicProgramRow {
  id: string;
  title: string;
  day: string;
  dayLabel: string;
  start: string;
  end: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  fee: string;
  conditions: string;
  kind?: "lesson" | "event";
  instructor?: string;
  availability?: string;
  applyHref?: string;
}

export function PublicCalendarView({
  rows,
  address,
  timezone,
  disciplines,
  selected,
  onSelect,
  filterAvailable = false,
  loading,
  error,
  onRetry,
  hasNext,
  onNext,
  loadingNext,
  nextError,
  refreshError,
  applyHref,
}: {
  rows: PublicProgramRow[];
  address?: string;
  timezone?: string;
  disciplines: { id: string; name: string }[];
  selected: string;
  onSelect: (value: string) => void;
  filterAvailable?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  hasNext?: boolean;
  onNext?: () => void;
  loadingNext?: boolean;
  nextError?: boolean;
  refreshError?: boolean;
  applyHref?: string;
}) {
  const { t } = useTranslation();
  const events = rows.filter((row) => row.kind === "event");
  const groups = Map.groupBy(
    rows.filter((row) => row.kind !== "event"),
    (row) => row.day,
  );
  function item(row: PublicProgramRow) {
    return (
      <li
        key={row.id}
        className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
      >
        <div className="flex flex-col text-sm tabular-nums">
          <time dateTime={row.startsAt} className="font-semibold">
            {row.start}
          </time>
          <time dateTime={row.endsAt} className="text-muted-foreground">
            {row.end}
          </time>
        </div>
        <div className="flex min-w-0 flex-col gap-1 break-words">
          <h3 className="text-sm font-semibold">{row.title}</h3>
          {row.kind === "event" && <p className="text-sm text-muted-foreground">{row.dayLabel}</p>}
          <p className="text-sm text-muted-foreground">
            {[row.venue, row.instructor].filter(Boolean).join(" · ")}
          </p>
          {row.conditions && <p className="text-sm text-muted-foreground">{row.conditions}</p>}
        </div>
        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3">
          <Badge variant="secondary">{row.fee}</Badge>
          {row.availability && <Badge variant="outline">{row.availability}</Badge>}
          {row.applyHref && (
            <LinkButton
              href={row.applyHref}
              variant="outline"
              size="sm"
              aria-label={t(($) => $.publicProgram.applyFor, { title: row.title })}
            >
              {t(($) => $.publicProgram.apply)}
            </LinkButton>
          )}
        </div>
      </li>
    );
  }
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">{t(($) => $.publicProgram.title)}</h1>
        {address && <p className="mt-1 break-words text-muted-foreground">{address}</p>}
      </div>
      <Field>
        <FieldLabel htmlFor="public-discipline">{t(($) => $.publicProgram.discipline)}</FieldLabel>
        <NativeSelect
          id="public-discipline"
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
          disabled={!filterAvailable || loading}
          className="w-full max-w-64"
        >
          <NativeSelectOption value="">{t(($) => $.publicProgram.allLessons)}</NativeSelectOption>
          {disciplines.map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {!filterAvailable && !loading && (
        <p className="text-sm text-muted-foreground">
          {t(($) => $.publicProgram.filterUnavailable)}
        </p>
      )}
      {!loading && !error && (
        <p className="text-sm text-muted-foreground">
          {timezone
            ? t(($) => $.publicProgram.timezone, { timezone })
            : t(($) => $.publicProgram.utc)}
        </p>
      )}
      {loading ? (
        <div
          aria-busy="true"
          aria-label={t(($) => $.publicProgram.loading)}
          className="flex flex-col gap-4"
        >
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>{t(($) => $.publicProgram.failed)}</AlertTitle>
          <AlertDescription>{t(($) => $.publicProgram.failedHint)}</AlertDescription>
          <Button variant="outline" onPress={onRetry}>
            {t(($) => $.publicProgram.retry)}
          </Button>
        </Alert>
      ) : (
        <>
          {refreshError && (
            <Alert variant="destructive">
              <AlertTitle>{t(($) => $.publicProgram.refreshFailed)}</AlertTitle>
              <AlertDescription>{t(($) => $.publicProgram.refreshHint)}</AlertDescription>
              <Button variant="outline" onPress={onRetry}>
                {t(($) => $.publicProgram.retry)}
              </Button>
            </Alert>
          )}
          {rows.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t(($) => $.publicProgram.empty)}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
          {[...groups].map(([day, entries]) => (
            <section key={day} aria-label={entries[0]!.dayLabel} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{entries[0]!.dayLabel}</h2>
              <Card>
                <CardContent>
                  <ul className="divide-y">{entries.map(item)}</ul>
                </CardContent>
              </Card>
            </section>
          ))}
          {events.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t(($) => $.publicProgram.events)}
              </h2>
              <Card>
                <CardContent>
                  <ul className="divide-y">{events.map(item)}</ul>
                </CardContent>
              </Card>
            </section>
          )}
          {nextError && (
            <Alert variant="destructive">
              <AlertTitle>{t(($) => $.publicProgram.moreFailed)}</AlertTitle>
            </Alert>
          )}
          {hasNext && (
            <Button variant="outline" onPress={onNext} isDisabled={loadingNext}>
              {loadingNext ? t(($) => $.publicProgram.loading) : t(($) => $.publicProgram.more)}
            </Button>
          )}
          {applyHref && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle>{t(($) => $.publicProgram.cta)}</CardTitle>
                  <CardDescription>{t(($) => $.publicProgram.ctaHint)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LinkButton href={applyHref}>{t(($) => $.publicProgram.apply)}</LinkButton>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
