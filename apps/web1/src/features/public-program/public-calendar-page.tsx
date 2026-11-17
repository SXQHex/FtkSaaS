import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { PublicShell } from "./public-shell";
import { PublicUnavailableView } from "./public-unavailable-view";
import { PublicCalendarView } from "./public-calendar-view";
import {
  publicCalendarInterval,
  publicProgramRows,
  readPublicCalendar,
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
  const interval = useQuery({
    queryKey: ["public-calendar-interval", openedAt],
    queryFn: () => publicCalendarInterval(openedAt),
    staleTime: Infinity,
  });
  const program = useInfiniteQuery({
    queryKey: ["public-calendar", slug, centerId, interval.data, disciplineId],
    enabled: !!interval.data,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      readPublicCalendar(
        {
          slug,
          centerId,
          disciplineId: disciplineId || undefined,
          interval: interval.data!,
          cursor: pageParam,
        },
        signal,
      ),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const presentation = useQuery({
    queryKey: ["public-calendar-presentation", slug, centerId, program.data],
    enabled: !!program.data,
    queryFn: () => publicProgramRows(program.data!.pages),
    retry: false,
  });
  const latest = program.data?.pages.at(-1);
  const profile = latest?.center_profile ?? latest?.organization_profile;
  const params = new URLSearchParams(centerId ? { center_id: centerId } : {});
  const suffix = params.size ? `?${params}` : "";
  const calendarHref = `/public/${encodeURIComponent(slug)}/calendar${suffix}`;
  const applyHref =
    latest?.publication_state === "available" &&
    latest.application.state === "open" &&
    !program.isRefetchError
      ? `/public/${encodeURIComponent(slug)}/apply${suffix}`
      : undefined;
  const unavailable = !program.isError && latest?.publication_state === "unavailable";
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
          rows={(presentation.data?.rows ?? []).map((row) => ({ ...row, applyHref }))}
          address={profile?.address}
          timezone={presentation.data?.timezone}
          disciplines={
            latest?.center_profile?.disciplines ?? latest?.organization_profile?.disciplines ?? []
          }
          selected={disciplineId}
          onSelect={setDisciplineId}
          filterAvailable={!!latest && !unavailable}
          applyHref={applyHref}
          applicationUnavailable={!program.isError && latest?.application.state === "unavailable"}
          loading={
            interval.isPending || program.isPending || (!!program.data && presentation.isPending)
          }
          error={
            interval.isError ||
            (program.isError && (!program.data || latest?.publication_state === "unavailable")) ||
            presentation.isError
          }
          onRetry={() => {
            if (interval.isError) void interval.refetch();
            else if (presentation.isError) void presentation.refetch();
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
