"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
const AttendancePanel = dynamic(() => import("./attendance-panel").then((m) => m.AttendancePanel));
export function AttendanceAccess(props: {
  scope: SetupScope;
  sessionId: string;
  timeZone: string;
  onChanged?: (session: SessionView) => void;
}) {
  const [open, setOpen] = useState(false),
    t = useTranslations("attendance");
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("title")}>
      <h3 className="font-semibold">{t("title")}</h3>
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {t(open ? "hide" : "open")}
      </Button>
      {open && (
        <AttendancePanel
          key={JSON.stringify([props.scope, props.sessionId, props.timeZone])}
          {...props}
        />
      )}
    </section>
  );
}
