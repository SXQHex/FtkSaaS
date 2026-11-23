import { useEffect, useRef, useState, type FormEventHandler } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PublicShell } from "./public-shell";
import { PublicUnavailableView } from "./public-unavailable-view";
import { PublicApplicationView } from "./public-application-view";
import { PublicEventApplicationView } from "./public-event-application-view";
import {
  publicCalendarInterval,
  publicProgramRows,
  readPublicCalendar,
} from "./public-calendar-read";
import { PublicTurnstile } from "./public-turnstile";
import {
  preparePublicApplication,
  preparePublicEventApplication,
  submitPublicApplication,
  type PublicApplicationAttempt,
  type PublicEventApplicationAttempt,
} from "./public-application-submit";
import { BackendError } from "../../lib/backend";
import { Alert, AlertTitle, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent } from "@ftksaas/ui/components/card";

const route = getRouteApi("/public/$slug/apply");
export function PublicApplicationRoutePage() {
  const { slug } = route.useParams();
  const { center_id, event } = route.useSearch();
  return (
    <PublicApplicationPage
      key={`${slug}:${center_id ?? ""}:${event ?? ""}`}
      slug={slug}
      centerId={center_id}
      eventId={event}
    />
  );
}

async function readApplicationContext(
  slug: string,
  centerId: string | undefined,
  eventId: string | undefined,
  openedAt: number,
  signal: AbortSignal,
) {
  const interval = await publicCalendarInterval(openedAt);
  const cursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const data = await readPublicCalendar(
      { slug, centerId, interval, cursor, discoveryOnly: !eventId },
      signal,
    );
    const publication = eventId
      ? data.items.find((item) => item.publication_id === eventId && item.kind === "event")
      : undefined;
    if (publication) {
      const {
        rows: [event],
      } = await publicProgramRows([{ ...data, items: [publication] }]);
      return { ...data, event };
    }
    if (!eventId || !data.next_cursor) return { ...data, event: undefined };
    if (cursors.has(data.next_cursor)) throw Error("PUBLIC_EVENT_CURSOR_INVALID");
    cursors.add(data.next_cursor);
    cursor = data.next_cursor;
  }
}

type Attempt = PublicApplicationAttempt | PublicEventApplicationAttempt;
export function PublicApplicationPage({
  slug,
  centerId,
  eventId,
}: {
  slug: string;
  centerId?: string;
  eventId?: string;
}) {
  const { t } = useTranslation();
  const [openedAt] = useState(Date.now);
  const discovery = useQuery({
    queryKey: ["public-application-discovery", slug, centerId, openedAt, eventId],
    queryFn: ({ signal }) => readApplicationContext(slug, centerId, eventId, openedAt, signal),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const profile = discovery.data?.center_profile ?? discovery.data?.organization_profile;
  const params = new URLSearchParams(centerId ? { center_id: centerId } : {});
  const calendarHref = `/public/${encodeURIComponent(slug)}/calendar${params.size ? `?${params}` : ""}`;
  const form =
    discovery.data?.application.state === "open" ? discovery.data.application.form : undefined;
  const event = discovery.data?.event;
  const [proof, setProof] = useState("");
  const [widget, setWidget] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "uncertain" | "rejected" | "success">(
    "idle",
  );
  const [error, setError] = useState("");
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  const attempt = useRef<Attempt | undefined>(undefined);
  const busy = useRef(false);
  const enabled =
    !!(eventId ? event : form) &&
    !discovery.isError &&
    !discovery.isFetching &&
    !!import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  async function send(prepared: Attempt) {
    if (busy.current) return;
    if (!proof) {
      setError(t(($) => $.publicApplication.botPending));
      return;
    }
    const recovering = state === "uncertain";
    busy.current = true;
    attempt.current = prepared;
    setState("sending");
    setError("");
    try {
      await submitPublicApplication(prepared, proof);
      setState("success");
      attempt.current = undefined;
    } catch (cause) {
      // Preserve the immutable intent on any ambiguous result, including malformed success.
      const definitive =
        !recovering &&
        cause instanceof BackendError &&
        !cause.retryable &&
        [
          "VALIDATION_FAILED",
          "BOT_VERIFICATION_FAILED",
          "FORBIDDEN",
          "NOT_FOUND",
          "PLAN_FEATURE_UNAVAILABLE",
          "POLICY_NOT_CONFIGURED",
          "CLIENT_UPDATE_REQUIRED",
          "SERVICE_UNAVAILABLE",
        ].includes(cause.code);
      setState(definitive ? "rejected" : "uncertain");
      setError(
        t(($) => (definitive ? $.publicApplication.rejected : $.publicApplication.uncertain)),
      );
    } finally {
      busy.current = false;
      setProof("");
      setWidget((value) => value + 1);
    }
  }
  const refresh = () => {
    attempt.current = undefined;
    setState("idle");
    setError("");
    setProof("");
    setWidget((value) => value + 1);
    void discovery.refetch();
  };
  const handleSubmit: FormEventHandler<HTMLFormElement> = (submission) => {
    if (!enabled || busy.current || state !== "idle") return;
    const values = new FormData(submission.currentTarget);
    try {
      if (event) void send(preparePublicEventApplication(event.id, slug, values, centerId));
      else if (form) void send(preparePublicApplication(form, values, centerId));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : undefined;
      setError(
        t(($) =>
          message === "CONTACT_REQUIRED"
            ? $.publicApplication.contactError
            : message === "HONEYPOT"
              ? $.publicApplication.honeypotError
              : $.publicApplication.invalid,
        ),
      );
    }
  };
  const botWidget = enabled ? <PublicTurnstile key={widget} onProof={setProof} /> : undefined;
  const notice = (
    <>
      {state === "sending" && <p role="status">{t(($) => $.publicApplication.submitting)}</p>}
      {error && (
        <Alert role="alert" ref={errorSummary} tabIndex={-1}>
          <AlertTitle>{error}</AlertTitle>
          <AlertDescription>
            {state === "uncertain" && (
              <Button
                type="button"
                variant="outline"
                onPress={() => {
                  if (attempt.current) void send(attempt.current);
                }}
              >
                {t(($) => $.publicApplication.retry)}
              </Button>
            )}
            {state === "rejected" && (
              <Button type="button" variant="outline" onPress={refresh}>
                {t(($) => $.publicApplication.refresh)}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
  return (
    <PublicShell
      name={profile?.name}
      description={profile?.description}
      calendarHref={calendarHref}
    >
      {discovery.isPending ? (
        <p role="status">{t(($) => $.publicApplication.loading)}</p>
      ) : discovery.isError ? (
        <>
          <h1 className="text-3xl font-semibold">{t(($) => $.publicApplication.title)}</h1>
          <Alert>
            <AlertTitle>{t(($) => $.publicApplication.readError)}</AlertTitle>
            <AlertDescription>
              <Button type="button" variant="outline" onPress={refresh}>
                {t(($) => $.publicApplication.refresh)}
              </Button>
            </AlertDescription>
          </Alert>
        </>
      ) : discovery.data.publication_state === "unavailable" ? (
        <PublicUnavailableView />
      ) : state === "success" ? (
        <Card>
          <CardContent className="space-y-3" role="status">
            <h1 className="text-2xl font-semibold">
              {t(($) => (eventId ? $.publicApplication.eventPending : $.publicApplication.success))}
            </h1>
            <p>
              {t(($) =>
                eventId ? $.publicApplication.eventPendingHint : $.publicApplication.successHint,
              )}
            </p>
            {!eventId && (
              <Button type="button" variant="outline" onPress={refresh}>
                {t(($) => $.publicApplication.again)}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : eventId ? (
        event ? (
          <PublicEventApplicationView
            event={event}
            locked={state !== "idle"}
            botWidget={botWidget}
            notice={notice}
            onSubmit={enabled ? handleSubmit : undefined}
          />
        ) : (
          <PublicUnavailableView />
        )
      ) : (
        <>
          {discovery.data.application.state === "closed" && (
            <Alert>
              <AlertTitle>{t(($) => $.publicApplication.closed)}</AlertTitle>
              <AlertDescription>{t(($) => $.publicApplication.closedHint)}</AlertDescription>
            </Alert>
          )}
          <PublicApplicationView
            key={form ? JSON.stringify(form) : "unavailable"}
            form={form}
            interests={(profile?.disciplines ?? []).map((row) => ({ id: row.id, name: row.name }))}
            locked={state !== "idle"}
            botWidget={botWidget}
            notice={notice}
            onSubmit={enabled ? handleSubmit : undefined}
          />
        </>
      )}
    </PublicShell>
  );
}
