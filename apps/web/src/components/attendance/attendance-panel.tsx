"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { attendanceApi, type AttendanceApi } from "../../lib/attendance";
import type { SetupScope } from "../../lib/studio-setup";
import { flowError } from "../bookings/flow-controls";
import { AttendanceRoster } from "./attendance-roster";
import { AttendanceRights } from "./attendance-rights";
import { AttendanceError } from "./attendance-error";

export function AttendancePanel({
  scope: initialScope,
  sessionId,
  timeZone,
  onChanged,
  api = attendanceApi,
}: {
  scope: SetupScope;
  sessionId: string;
  timeZone: string;
  onChanged?: (session: SessionView) => void;
  api?: AttendanceApi;
}) {
  const [scope] = useState(initialScope),
    t = useTranslations("attendance"),
    format = useFormatter();
  const [lastError, setLastError] = useState<{ code: string; reservationId?: string } | null>(null);
  const [revision, setRevision] = useState(0),
    [withRights, setWithRights] = useState(false);
  const [result, setResult] = useState<{
    revision: number;
    data?: Awaited<ReturnType<AttendanceApi["read"]>>;
    error?: string;
  } | null>(null);
  const current = result?.revision === revision ? result : null;
  useEffect(() => {
    const life = new AbortController();
    void api
      .read(scope, sessionId)
      .then((data) => {
        if (!life.signal.aborted) {
          setResult({ revision, data });
          onChanged?.(data.session);
        }
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ revision, error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, sessionId, revision, onChanged]);
  const refresh = (readRights = false, error = "", reservationId?: string) => {
    setLastError(error ? { code: error, reservationId } : null);
    setWithRights((previous) => previous || readRights);
    setRevision((v) => v + 1);
  };
  return (
    <div className="min-w-0 space-y-5 wrap-anywhere">
      <Button variant="outline" onClick={() => refresh(withRights)}>
        {t("refresh")}
      </Button>
      {lastError && <AttendanceError code={lastError.code} />}
      {!current ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : current.error ? (
        <AttendanceError code={current.error} />
      ) : (
        current.data && (
          <>
            <p>{t(current.data.view.closure_state === "closed" ? "closed" : "draft")}</p>
            <p>{t("revision", { version: current.data.view.revision })}</p>
            <p>
              {t("plannedTime")}:{" "}
              {format.dateTime(new Date(current.data.session.starts_at), {
                timeZone,
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              —{" "}
              {format.dateTime(new Date(current.data.session.ends_at), {
                timeZone,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p>
              {t("actualStart")}:{" "}
              {current.data.view.actual_started_at
                ? format.dateTime(new Date(current.data.view.actual_started_at), {
                    timeZone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : t(
                    current.data.view.actual_started_at === null ? "notStarted" : "unknownStart",
                  )}{" "}
              · {timeZone}
            </p>
            <p className="text-sm text-muted-foreground">{t("draftHint")}</p>
            <AttendanceRoster
              key={revision}
              scope={scope}
              data={current.data}
              timeZone={timeZone}
              api={api}
              failedReservation={lastError?.reservationId}
              onSaved={refresh}
            />
            <Button
              variant="outline"
              aria-expanded={withRights}
              onClick={() => setWithRights((value) => !value)}
            >
              {t(withRights ? "hideRights" : "readRights")}
            </Button>
            {withRights && (
              <AttendanceRights key={revision} scope={scope} view={current.data.view} api={api} />
            )}
          </>
        )
      )}
    </div>
  );
}
