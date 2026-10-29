"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { SessionChangeFlow } from "../calendar/session-change";
import { SessionSummary } from "../calendar/session-detail";
import { Preferences } from "../preferences";
import { sampleChangeActions, sampleSession } from "./session-change-fixtures";

export function SessionChangePreview() {
  const t = useTranslations("sessionChange");
  const calendar = useTranslations("calendar");
  const [editing, setEditing] = useState(false);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-5 py-8 outline-none wrap-anywhere"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/tasarim#schedule" className="text-sm underline underline-offset-4">
          {calendar("backToSchedule")}
        </Link>
        <Preferences />
      </header>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("demoTitle")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t("demoHint")}</p>
      </div>
      {editing ? (
        <SessionChangeFlow
          session={sampleSession}
          orgId="design"
          actorId="design"
          timeZone="Europe/Istanbul"
          actions={sampleChangeActions}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-6">
          <SessionSummary session={sampleSession} timeZone="Europe/Istanbul" />
          <Button onClick={() => setEditing(true)} className="h-auto min-h-11 whitespace-normal">
            {calendar("changeSession")}
          </Button>
        </div>
      )}
    </main>
  );
}
