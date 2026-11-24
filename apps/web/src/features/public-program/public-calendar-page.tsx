import { useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getTemporal } from "../../lib/temporal";
import { PublicShell } from "./public-shell";
import { PublicUnavailableView } from "./public-unavailable-view";
import { PublicCalendarView } from "./public-calendar-view";
import {
  combinePublicProgramRows,
  publicCalendarIntervalAt,
  readPublicProgramPage,
} from "./public-calendar-read";

const route = getRouteApi("/public/$slug/calendar");
export function PublicCalendarRoutePage() {
  const { slug } = route.useParams();
  const { center_id } = route.useSearch();
  return <PublicCalendarPage key={`${slug}:${center_id ?? ""}`} slug={slug} centerId={center_id} />;
}

export function PublicCalendarPage({ slug, centerId }: { slug: string; centerId?: string }) {
  const [openedAt] = useState(Date.now);
  const [disciplineId, setDisciplineId] = useState("");
  const temporal = useQuery({
    queryKey: ["public-calendar-temporal"],
    queryFn: getTemporal,
    staleTime: Infinity,
    retry: false,
  });
  const interval = useMemo(
    () => temporal.data && publicCalendarIntervalAt(temporal.data, openedAt),
    [openedAt, temporal.data],
  );
  const program = useInfiniteQuery({
    queryKey: ["public-calendar", slug, centerId, interval, disciplineId],
    enabled: !!interval,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      readPublicProgramPage(
        temporal.data!,
        {
          slug,
          centerId,
          disciplineId: disciplineId || undefined,
          interval: interval!,
          cursor: pageParam,
        },
        signal,
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const pages = program.data?.pages;
  const presentation = useMemo(() => {
    if (!temporal.data || !pages) return {};
    try {
      return { data: combinePublicProgramRows(temporal.data, pages) };
    } catch (error) {
      return { error };
    }
  }, [pages, temporal.data]);
  const latest = pages?.at(-1);
  const profile = latest?.profile;
  const publicPath = `/public/${encodeURIComponent(slug)}`;
  const suffix = centerId ? `?${new URLSearchParams({ center_id: centerId })}` : "";
  const calendarHref = `${publicPath}/calendar${suffix}`;
  const applyHref =
    latest?.publicationState === "available" &&
    latest.applicationState === "open" &&
    !program.isRefetchError
      ? `${publicPath}/apply${suffix}`
      : undefined;
  const canApplyForEvent = !program.isError && latest?.publicationState === "available";
  const rows = useMemo(() => {
    return (presentation.data?.rows ?? []).map((row) => {
      const href =
        row.kind === "event"
          ? canApplyForEvent
            ? `${publicPath}/apply?${new URLSearchParams({
                ...(centerId ? { center_id: centerId } : {}),
                event: row.id,
              })}`
            : undefined
          : applyHref;
      return href ? { ...row, applyHref: href } : row;
    });
  }, [presentation.data, canApplyForEvent, centerId, publicPath, applyHref]);
  const unavailable = !program.isError && latest?.publicationState === "unavailable";
  return (
    <PublicShell
      name={profile?.name}
      description={profile?.description}
      calendarHref={calendarHref}
      applyHref={applyHref}
    >
      {unavailable ? (
        <PublicUnavailableView />
      ) : (
        <PublicCalendarView
          rows={rows}
          address={profile?.address}
          timezone={presentation.data?.timezone}
          disciplines={latest?.disciplines ?? []}
          selected={disciplineId}
          onSelect={setDisciplineId}
          filterAvailable={!!latest && !unavailable}
          applyHref={applyHref}
          applicationUnavailable={!program.isError && latest?.applicationState === "unavailable"}
          loading={temporal.isPending || (program.isPending && !temporal.isError)}
          error={
            temporal.isError ||
            (program.isError && (!program.data || latest?.publicationState === "unavailable")) ||
            Boolean(presentation.error)
          }
          onRetry={() => {
            if (temporal.isError) void temporal.refetch();
            else void program.refetch();
          }}
          hasNext={program.hasNextPage}
          onNext={() => {
            void program.fetchNextPage();
          }}
          loadingNext={program.isFetchingNextPage}
          nextError={program.isFetchNextPageError}
          refreshError={program.isRefetchError && !program.isFetchNextPageError}
        />
      )}
    </PublicShell>
  );
}
