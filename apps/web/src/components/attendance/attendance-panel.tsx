"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { attendanceApi, type AttendanceApi } from "../../lib/attendance";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
import { AttendanceRow } from "./attendance-row";
import { AttendanceSessionActions } from "./attendance-session-actions";
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
  const [lastError, setLastError] = useState("");
  const [revision, setRevision] = useState(0),
    [withRights, setWithRights] = useState(false);
  const [result, setResult] = useState<{
    revision: number;
    data?: Awaited<ReturnType<AttendanceApi["read"]>>;
    error?: string;
  } | null>(null);
  const [rights, setRights] = useState<{
    revision: number;
    rows?: Awaited<ReturnType<AttendanceApi["rights"]>>;
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
  useEffect(() => {
    if (!withRights || !current?.data) return;
    const life = new AbortController();
    void api
      .rights(scope, current.data.view)
      .then((rows) => {
        if (!life.signal.aborted) setRights({ revision, rows });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setRights({ revision, error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, revision, withRights, current]);
  const refresh = (readRights = false, error = "") => {
    setLastError(error);
    setWithRights(readRights);
    setRevision((v) => v + 1);
  };
  return (
    <div className="min-w-0 space-y-5 wrap-anywhere">
      <Button variant="outline" onClick={() => refresh(withRights)}>
        {t("refresh")}
      </Button>
      {lastError && <FlowError code={lastError} />}
      {!current ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : current.error ? (
        <FlowError code={current.error} />
      ) : (
        current.data && (
          <>
            <p>{t(current.data.view.closure_state === "closed" ? "closed" : "draft")}</p>
            <p>{t("revision", { version: current.data.view.revision })}</p>
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
            {current.data.session.state === "cancelled" ? (
              <output>{t("cancelled")}</output>
            ) : (
              <AttendanceSessionActions
                scope={scope}
                data={current.data}
                timeZone={timeZone}
                api={api}
                onSaved={refresh}
              />
            )}
            {!current.data.view.entries.length && <p>{t("empty")}</p>}
            <ul className="space-y-3" aria-label={t("participants")}>
              {current.data.view.entries.map((row, index) => (
                <AttendanceRow
                  key={`${revision}:${row.reservation_id}`}
                  scope={scope}
                  view={current.data!.view}
                  row={row}
                  number={index + 1}
                  timeZone={timeZone}
                  api={api}
                  editable={
                    current.data!.session.state !== "cancelled" &&
                    (current.data!.session.state === "planned" ||
                      current.data!.view.closure_state === "closed")
                  }
                  onSaved={refresh}
                />
              ))}
            </ul>
            {current.data.view.closure_state === "closed" && !withRights && (
              <Button variant="outline" onClick={() => setWithRights(true)}>
                {t("readRights")}
              </Button>
            )}
            {withRights && (
              <section aria-label={t("rights")} className="space-y-3 border-t pt-4">
                <h4 className="font-semibold">{t("rights")}</h4>
                {rights?.revision !== revision ? (
                  <output aria-live="polite">{t("loading")}</output>
                ) : rights.error ? (
                  <FlowError code={rights.error} />
                ) : (
                  rights.rows?.map((person) => {
                    const index = current.data!.view.entries.findIndex(
                      (row) => row.person_id === person.personId,
                    );
                    const entry = current.data!.view.entries[index];
                    return (
                      <div key={person.personId}>
                        <p>
                          {entry?.subscriber_number
                            ? t("subscriber", { number: entry.subscriber_number })
                            : t("participant", { number: index + 1 })}
                        </p>
                        {person.rows.length === 0 ? (
                          <p>{t("noRights")}</p>
                        ) : (
                          person.rows.map((row) => (
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
                  })
                )}
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
