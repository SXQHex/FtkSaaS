import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { PublicShell } from "./public-shell";
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
  const interval = useQuery({
    queryKey: ["public-calendar-interval", openedAt],
    queryFn: () => publicCalendarInterval(openedAt),
    staleTime: Infinity,
  });
  const program = useInfiniteQuery({
    queryKey: ["public-calendar", slug, centerId, interval.data],
    enabled: !!interval.data,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      readPublicCalendar({ slug, centerId, interval: interval.data!, cursor: pageParam }, signal),
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
  const first = program.data?.pages[0];
  const profile = first?.center_profile ?? first?.organization_profile;
  const calendarHref = `/public/${encodeURIComponent(slug)}/calendar${centerId ? `?center_id=${encodeURIComponent(centerId)}` : ""}`;
  return (
    <PublicShell
      name={profile?.name}
      description={profile?.description}
      calendarHref={calendarHref}
    >
      <PublicCalendarView
        rows={presentation.data?.rows ?? []}
        address={profile?.address}
        timezone={presentation.data?.timezone}
        disciplines={profile?.disciplines ?? []}
        selected=""
        onSelect={() => {}}
        loading={
          interval.isPending || program.isPending || (!!program.data && presentation.isPending)
        }
        error={interval.isError || (program.isError && !program.data) || presentation.isError}
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
    </PublicShell>
  );
}
