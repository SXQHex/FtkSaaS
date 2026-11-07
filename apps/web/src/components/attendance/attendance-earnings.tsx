"use client";
import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
const EarningsPanel = dynamic(() =>
  import("../earnings/earnings-panel").then((m) => m.EarningsPanel),
);
export function AttendanceEarnings({
  scope,
  session,
  timeZone,
}: {
  scope: SetupScope;
  session: SessionView;
  timeZone: string;
}) {
  const t = useTranslations("earnings"),
    id = useId(),
    [personId, setPersonId] = useState("");
  const people = [...new Set(session.assignments.map((a) => a.person_id))];
  if (!people.length) return null;
  return (
    <section className="min-w-0 space-y-2 wrap-anywhere">
      <Label htmlFor={id}>{t("chooseInstructor")}</Label>
      <select
        id={id}
        value={personId}
        className="min-h-11 w-full rounded-md border bg-background px-3"
        onChange={(e) => setPersonId(e.target.value)}
      >
        <option value="">{t("choose")}</option>
        {people.map((person, index) => (
          <option key={person} value={person}>
            {t("assignedInstructor", { number: index + 1 })}
          </option>
        ))}
      </select>
      {people.includes(personId) && (
        <EarningsPanel scope={scope} personId={personId} timeZone={timeZone} />
      )}
    </section>
  );
}
