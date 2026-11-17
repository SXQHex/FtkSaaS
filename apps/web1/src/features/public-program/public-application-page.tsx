import { useEffect, useRef, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PublicShell } from "./public-shell";
import { PublicUnavailableView } from "./public-unavailable-view";
import { PublicApplicationView } from "./public-application-view";
import { publicCalendarInterval, readPublicCalendar } from "./public-calendar-read";
import { PublicTurnstile } from "./public-turnstile";
import {
  preparePublicApplication,
  submitPublicApplication,
  type PublicApplicationAttempt,
} from "./public-application-submit";
import { BackendError } from "../../lib/backend";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

const route = getRouteApi("/public/$slug/apply");
export function PublicApplicationRoutePage() {
  const { slug } = route.useParams();
  const { center_id } = route.useSearch();
  return (
    <PublicApplicationPage key={`${slug}:${center_id ?? ""}`} slug={slug} centerId={center_id} />
  );
}
export function PublicApplicationPage({ slug, centerId }: { slug: string; centerId?: string }) {
  const { t } = useTranslation();
  const [openedAt] = useState(Date.now);
  const discovery = useQuery({
    queryKey: ["public-application-discovery", slug, centerId, openedAt],
    queryFn: async ({ signal }) =>
      readPublicCalendar(
        { slug, centerId, interval: await publicCalendarInterval(openedAt) },
        signal,
      ),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const profile = discovery.data?.center_profile ?? discovery.data?.organization_profile;
  const params = new URLSearchParams(centerId ? { center_id: centerId } : {});
  const calendarHref = `/public/${encodeURIComponent(slug)}/calendar${params.size ? `?${params}` : ""}`;
  const form =
    discovery.data?.application.state === "open" ? discovery.data.application.form : undefined;
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
  const attempt = useRef<PublicApplicationAttempt | undefined>(undefined);
  const busy = useRef(false);
  const enabled =
    !!form &&
    !discovery.isError &&
    !discovery.isFetching &&
    !!import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  async function send(prepared: PublicApplicationAttempt) {
    if (busy.current) return;
    if (!proof) {
      setError(t(($) => $.publicApplication.botPending));
      return;
    }
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
            <h1 className="text-2xl font-semibold">{t(($) => $.publicApplication.success)}</h1>
            <p>{t(($) => $.publicApplication.successHint)}</p>
            <Button type="button" variant="outline" onPress={refresh}>
              {t(($) => $.publicApplication.again)}
            </Button>
          </CardContent>
        </Card>
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
            botWidget={enabled ? <PublicTurnstile key={widget} onProof={setProof} /> : undefined}
            notice={
              <>
                {state === "sending" && (
                  <p role="status">{t(($) => $.publicApplication.submitting)}</p>
                )}
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
            }
            onSubmit={
              enabled
                ? (event) => {
                    if (!form || busy.current || state !== "idle") return;
                    try {
                      const prepared = preparePublicApplication(
                        form,
                        new FormData(event.currentTarget),
                        centerId,
                      );
                      void send(prepared);
                    } catch (cause) {
                      setError(
                        t(($) =>
                          cause instanceof Error && cause.message === "CONTACT_REQUIRED"
                            ? $.publicApplication.contactError
                            : cause instanceof Error && cause.message === "HONEYPOT"
                              ? $.publicApplication.honeypotError
                              : $.publicApplication.invalid,
                        ),
                      );
                    }
                  }
                : undefined
            }
          />
        </>
      )}
    </PublicShell>
  );
}
