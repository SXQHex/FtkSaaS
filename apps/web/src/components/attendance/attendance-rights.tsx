"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AttendanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
import type { AttendanceApi } from "../../lib/attendance";
import { flowError } from "../bookings/flow-controls";
import { AttendanceError } from "./attendance-error";
export function AttendanceRights({
  scope,
  view,
  api,
}: {
  scope: SetupScope;
  view: AttendanceView;
  api: AttendanceApi;
}) {
  const t = useTranslations("attendance");
  const people = [...new Set(view.entries.map((row) => row.person_id))];
  return (
    <section aria-label={t("rights")} className="space-y-3 border-t pt-4">
      <h4 className="font-semibold">{t("rights")}</h4>
      {people.length === 0 && <p>{t("empty")}</p>}
      {people.map((personId) => (
        <PersonRights key={personId} scope={scope} view={view} api={api} personId={personId} />
      ))}
    </section>
  );
}
function PersonRights({
  scope,
  view,
  api,
  personId,
}: {
  scope: SetupScope;
  view: AttendanceView;
  api: AttendanceApi;
  personId: string;
}) {
  const t = useTranslations("attendance"),
    index = view.entries.findIndex((row) => row.person_id === personId),
    entry = view.entries[index];
  const [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      rows?: Awaited<ReturnType<AttendanceApi["rights"]>>[number]["rows"];
      error?: string;
    } | null>(null);
  useEffect(() => {
    const life = new AbortController();
    void api
      .rights(scope, { ...view, entries: view.entries.filter((row) => row.person_id === personId) })
      .then((rows) => {
        const current = rows.find((row) => row.personId === personId);
        if (rows.length !== 1 || !current) throw Error("invalidAttendance");
        if (!life.signal.aborted) setResult(current);
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, view, personId, attempt]);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <h5 className="font-medium">
        {entry?.subscriber_number
          ? t("subscriber", { number: entry.subscriber_number })
          : t("participant", { number: index + 1 })}
      </h5>
      {!result ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : result.error ? (
        <>
          <AttendanceError code={result.error} />
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setAttempt((v) => v + 1);
            }}
          >
            {t("retryRights")}
          </Button>
        </>
      ) : !result.rows?.length ? (
        <p>{t("noRights")}</p>
      ) : (
        result.rows.map((row) => (
          <p key={row.sale_id}>
            {t("rightCounts", {
              available: row.available,
              reserved: row.reserved,
              consumed: row.consumed,
            })}
          </p>
        ))
      )}
    </div>
  );
}
