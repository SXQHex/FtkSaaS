"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WorkspaceLoading } from "../workspace-loading";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { ApiFailure, errorMessageKey, getAccount, getSession } from "../../lib/api";
import { browserClient } from "../../lib/supabase/client";
import { sessionPath } from "../../lib/session-route";
import { Preferences } from "../preferences";
import { SessionBookings } from "../bookings/session-bookings";
import { SessionSummary } from "./session-summary";
import { SessionDocuments } from "../documents/session-documents";
const SessionChange = dynamic(
  () => import("./session-change").then((module) => module.SessionChange),
  { loading: WorkspaceLoading },
);

export function SessionPage({
  orgId,
  sessionId,
  actorId: authUserId,
  centerId,
}: {
  orgId: string;
  sessionId: string;
  // Native Auth identity; command scopes use account_get_v1.id.
  actorId: string;
  centerId?: string;
}) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const api = useTranslations("api");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    session?: SessionView;
    accountId?: string;
    timeZone?: string;
    error?: string;
  } | null>(null);
  const key = `${authUserId}:${orgId}:${centerId ?? "unscoped"}:${sessionId}:${attempt}`;
  useEffect(() => {
    let active = true;
    function leave() {
      active = false;
      setResult(null);
      router.replace(`/login?next=${encodeURIComponent(sessionPath(orgId, sessionId, centerId))}`);
      router.refresh();
    }
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && session?.user.id !== authUserId))
        leave();
    });
    Promise.all([getSession(orgId, centerId, sessionId), getAccount()])
      .then(([session, account]) => {
        if (active)
          setResult({
            key,
            session,
            accountId: account.id,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (
          cause instanceof ApiFailure &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.failure.error.code)
        ) {
          leave();
          return;
        }
        setResult({ key, error: errorMessageKey(cause) });
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authUserId, orgId, centerId, sessionId, key, router]);
  const bookingChanged = useCallback(
    (session: SessionView) => {
      setResult((previous) =>
        previous?.key === key && previous.session?.id === session.id
          ? { ...previous, session }
          : previous,
      );
    },
    [key],
  );
  const current = result?.key === key ? result : null;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh w-full min-w-0 max-w-3xl space-y-8 px-5 py-6 outline-none wrap-anywhere sm:px-8 sm:py-10"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" className="h-auto min-h-11 whitespace-normal">
          <Link href="/#schedule">
            <ArrowLeft aria-hidden="true" />
            {t("backToSchedule")}
          </Link>
        </Button>
        <Preferences />
      </header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("detailTitle")}</h1>
          {current?.timeZone && (
            <p className="text-sm text-muted-foreground">
              {t("deviceTimezone", { timezone: current.timeZone })}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          disabled={!current || editing}
          className="h-auto min-h-11 whitespace-normal"
          onClick={() => setAttempt((value) => value + 1)}
        >
          <RefreshCw aria-hidden="true" />
          {t("refreshDetail")}
        </Button>
      </div>
      {!current ? (
        <output className="block py-8 text-sm text-muted-foreground" aria-live="polite">
          {t("detailLoading")}
        </output>
      ) : current.error ? (
        <div role="alert" className="space-y-4 rounded-xl border p-5">
          <p>{api(current.error)}</p>
          <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            {t("retry")}
          </Button>
        </div>
      ) : current.session && editing ? (
        <SessionChange
          key={`${key}:${current.accountId}`}
          session={current.session}
          orgId={orgId}
          centerId={centerId}
          actorId={current.accountId!}
          timeZone={current.timeZone ?? "UTC"}
          onClose={() => {
            setEditing(false);
            setAttempt((value) => value + 1);
          }}
          onSaved={() => {
            setEditing(false);
            setAttempt((value) => value + 1);
          }}
        />
      ) : current.session ? (
        <div className="space-y-6">
          <SessionSummary session={current.session} timeZone={current.timeZone ?? "UTC"} />
          {centerId && (
            <SessionBookings
              scope={{ actorId: current.accountId!, orgId, centerId }}
              session={current.session}
              onChanged={bookingChanged}
            />
          )}
          <SessionDocuments
            key={`${current.accountId}:${orgId}:${centerId ?? "unscoped"}:${sessionId}`}
            scope={{ actorId: current.accountId!, orgId, centerId }}
            sessionId={sessionId}
          />
          <Button
            variant="outline"
            className="h-auto min-h-11 whitespace-normal"
            onClick={() => setEditing(true)}
          >
            {t("changeSession")}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
