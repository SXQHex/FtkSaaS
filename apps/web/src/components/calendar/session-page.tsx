"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { ApiFailure, errorMessageKey, getSession } from "../../lib/api";
import { browserClient } from "../../lib/supabase/client";
import { sessionPath } from "../../lib/session-route";
import { Preferences } from "../preferences";
import { SessionSummary } from "./session-detail";
import { SessionChange } from "./session-change";

export function SessionPage({
  orgId,
  sessionId,
  actorId,
}: {
  orgId: string;
  sessionId: string;
  actorId: string;
}) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const api = useTranslations("api");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<{
    key: string;
    session?: SessionView;
    timeZone?: string;
    error?: string;
  } | null>(null);
  const key = `${orgId}:${sessionId}:${attempt}`;
  useEffect(() => {
    let active = true;
    function leave() {
      active = false;
      setResult(null);
      router.replace(`/giris?next=${encodeURIComponent(sessionPath(orgId, sessionId))}`);
      router.refresh();
    }
    const { data } = browserClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") leave();
    });
    getSession(orgId, undefined, sessionId)
      .then((session) => {
        if (active)
          setResult({ key, session, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
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
  }, [orgId, sessionId, key, router]);
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
          key={`${key}:${actorId}`}
          session={current.session}
          orgId={orgId}
          actorId={actorId}
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
