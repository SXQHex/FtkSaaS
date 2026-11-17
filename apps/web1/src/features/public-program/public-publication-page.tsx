import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PublicShell } from "./public-shell";
import { PublicUnavailableView } from "./public-unavailable-view";
import { publicCalendarInterval, readPublicCalendar } from "./public-calendar-read";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { Button, LinkButton } from "../../components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "../../components/ui/empty";

const route = getRouteApi("/public/$slug/unavailable");
export function PublicPublicationRoutePage() {
  const { slug } = route.useParams();
  const { center_id } = route.useSearch();
  return (
    <PublicPublicationPage key={`${slug}:${center_id ?? ""}`} slug={slug} centerId={center_id} />
  );
}
function PublicPublicationPage({ slug, centerId }: { slug: string; centerId?: string }) {
  const { t } = useTranslation();
  const [openedAt] = useState(Date.now);
  const publication = useQuery({
    queryKey: ["public-publication-state", slug, centerId, openedAt],
    queryFn: async ({ signal }) =>
      readPublicCalendar(
        { slug, centerId, interval: await publicCalendarInterval(openedAt) },
        signal,
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const params = new URLSearchParams(centerId ? { center_id: centerId } : {});
  const calendarHref = `/public/${encodeURIComponent(slug)}/calendar${params.size ? `?${params}` : ""}`;
  const profile = publication.data?.center_profile ?? publication.data?.organization_profile;
  return (
    <PublicShell
      name={profile?.name}
      description={profile?.description}
      calendarHref={calendarHref}
    >
      {publication.isPending ? (
        <>
          <h1 className="text-3xl font-semibold">{t(($) => $.publicProgram.stateTitle)}</h1>
          <p role="status">{t(($) => $.publicProgram.loading)}</p>
        </>
      ) : publication.isError ? (
        <>
          <h1 className="text-3xl font-semibold">{t(($) => $.publicProgram.stateTitle)}</h1>
          <Alert>
            <AlertTitle>{t(($) => $.publicProgram.stateError)}</AlertTitle>
            <AlertDescription>{t(($) => $.publicProgram.stateErrorHint)}</AlertDescription>
          </Alert>
        </>
      ) : publication.data.publication_state === "unavailable" ? (
        <PublicUnavailableView />
      ) : (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle>
              <h1>{t(($) => $.publicProgram.available)}</h1>
            </EmptyTitle>
            <EmptyDescription>{t(($) => $.publicProgram.availableHint)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <LinkButton href={calendarHref}>{t(($) => $.publicProgram.program)}</LinkButton>
          </EmptyContent>
        </Empty>
      )}
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          isDisabled={publication.isFetching}
          onPress={() => {
            void publication.refetch();
          }}
        >
          {t(($) => $.publicProgram.checkAgain)}
        </Button>
      </div>
    </PublicShell>
  );
}
