"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  Duty,
  AgreementVersionView,
  ScheduleConfigurationRequirement,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { agreementApi, type AgreementApi } from "../../lib/agreements";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { PayTermsSummary } from "./pay-terms-summary";
const AgreementForm = dynamic(() => import("./agreement-form").then((m) => m.AgreementForm));
const EarningsPanel = dynamic(() =>
  import("../earnings/earnings-panel").then((m) => m.EarningsPanel),
);
type Props = {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  requirement?: ScheduleConfigurationRequirement;
  api?: AgreementApi;
  onPublished?: () => void;
  onUseVersion?: (row: AgreementVersionView, duty: Duty) => void;
  targetDuties?: Duty[];
  withEarnings?: boolean;
};
export function InstructorAgreements(props: Props) {
  return (
    <AgreementHistory
      key={JSON.stringify([props.scope, props.personId, props.timeZone, props.requirement])}
      {...props}
    />
  );
}
function AgreementHistory({
  scope: initialScope,
  personId,
  timeZone,
  requirement,
  api = agreementApi,
  onPublished,
  onUseVersion,
  targetDuties = [],
  withEarnings = false,
}: Props) {
  const [scope] = useState(initialScope),
    t = useTranslations("agreements"),
    dutyLabel = useTranslations("program"),
    format = useFormatter(),
    notify = useRef(false);
  const [lastError, setLastError] = useState(""),
    [result, setResult] = useState<{
      page?: Awaited<ReturnType<AgreementApi["list"]>>;
      error?: string;
    } | null>(null),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<{ prior?: AgreementVersionView } | null>(null);
  function refresh(published = false, error = "") {
    setLastError(error);
    notify.current = published;
    setEditing(null);
    setResult(null);
    setCursor(undefined);
    setRevision((v) => v + 1);
  }
  const recovery = useSetupCommand(
    scope,
    `agreements:${personId}`,
    () => refresh(true),
    (code) => refresh(false, code),
  );
  useEffect(() => {
    const life = new AbortController();
    void api
      .list(scope, personId, cursor)
      .then((page) => {
        if (!life.signal.aborted) {
          setResult({ page });
          if (notify.current) {
            notify.current = false;
            onPublished?.();
          }
        }
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, personId, cursor, revision, onPublished]);
  return (
    <section className="min-w-0 space-y-4 border-t pt-4 wrap-anywhere" aria-label={t("title")}>
      <h4 className="font-semibold">{t("title")}</h4>
      <p className="text-sm text-muted-foreground">{t("historyHint")}</p>
      <SetupFeedback command={recovery} />
      {lastError && <FlowError code={lastError} />}
      <Button variant="outline" onClick={() => refresh()}>
        {t("refresh")}
      </Button>
      {!result ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : result.error ? (
        <FlowError code={result.error} />
      ) : (
        result.page && (
          <>
            {withEarnings && (
              <EarningsPanel scope={scope} personId={personId} timeZone={timeZone} management />
            )}
            <p>{t("pageCount", { count: result.page.items.length })}</p>
            {!result.page.items.length && <p>{t("empty")}</p>}
            <ul className="space-y-4">
              {result.page.items.map((row) => (
                <li key={row.id} className="space-y-3 rounded-md border p-4">
                  <p>
                    {t("version", { version: row.version })} · {t(row.format)}
                  </p>
                  <p>
                    {format.dateTime(new Date(row.valid.starts_at), {
                      timeZone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    —{" "}
                    {row.valid.ends_at
                      ? format.dateTime(new Date(row.valid.ends_at), {
                          timeZone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : t("openEnded")}{" "}
                    · {timeZone}
                  </p>
                  <PayTermsSummary terms={row.terms} />
                  {onUseVersion &&
                    requirement &&
                    row.person_id === personId &&
                    row.center_id === scope.centerId &&
                    row.discipline_id === requirement.discipline_id &&
                    row.format === requirement.format &&
                    Date.parse(row.valid.starts_at) <= Date.parse(requirement.starts_at) &&
                    (row.valid.ends_at === null ||
                      Date.parse(requirement.starts_at) < Date.parse(row.valid.ends_at)) &&
                    targetDuties.map((duty) => (
                      <Button
                        key={duty}
                        variant="outline"
                        disabled={recovery.busy || !!recovery.pending || !!editing}
                        onClick={() => onUseVersion(row, duty)}
                      >
                        {t("useForDuty", { version: row.version })} · {dutyLabel(duty)}
                      </Button>
                    ))}
                  {(!requirement ||
                    (requirement.discipline_id === row.discipline_id &&
                      requirement.format === row.format)) && (
                    <Button variant="outline" onClick={() => setEditing({ prior: row })}>
                      {t("newVersion")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {result.page.next_cursor && (
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setEditing(null);
                  setCursor(result.page!.next_cursor!);
                }}
              >
                {t("more")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing({})}>
              {t("create")}
            </Button>
            {editing && (
              <AgreementForm
                key={`${revision}:${editing.prior?.id ?? "new"}`}
                scope={scope}
                personId={personId}
                timeZone={timeZone}
                prior={editing.prior}
                requirement={requirement}
                api={api}
                onSaved={() => refresh(true)}
                onRejected={(code) => refresh(false, code)}
                onCancel={() => setEditing(null)}
              />
            )}
          </>
        )
      )}
    </section>
  );
}
