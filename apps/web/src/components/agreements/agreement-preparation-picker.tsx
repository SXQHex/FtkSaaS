"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import {
  agreementPreparations,
  preparationKey,
  type PreparedAgreement,
} from "../../lib/agreement-preparations";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
export function AgreementPreparationPicker({
  scope,
  disciplineId,
  format,
  disabled,
  onStart,
  onResolved,
  onFailed,
}: {
  scope: SetupScope;
  disciplineId?: string;
  format?: string;
  disabled: boolean;
  onStart: () => void;
  onResolved: (value: PreparedAgreement, name: string) => void;
  onFailed: () => void;
}) {
  const t = useTranslations("agreements"),
    request = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof agreementPreparations.list>> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const life = new AbortController();
    request.current = life;
    void agreementPreparations
      .list(scope)
      .then((items) => {
        if (!life.signal.aborted) setRows(items);
      })
      .catch((cause) => {
        if (!life.signal.aborted) setError(flowError(cause));
      });
    return () => {
      life.abort();
    };
  }, [scope, attempt]);
  const available = rows?.filter(
    ({ template }) =>
      (!disciplineId || disciplineId === template.discipline_id) &&
      (!format || format === template.format),
  );
  return (
    <div className="space-y-3 rounded-md border p-3" aria-label={t("templateHeading")}>
      <p className="text-sm text-muted-foreground">{t("templateNotice")}</p>
      {!rows && !error && <output>{t("loading")}</output>}
      {error && (
        <>
          <FlowError code={error} />
          <Button
            type="button"
            variant="outline"
            disabled={busy || disabled}
            onClick={() => {
              setRows(null);
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            {t("templateRetry")}
          </Button>
        </>
      )}
      {available?.length === 0 && <p>{t("templateEmpty")}</p>}
      {available?.map(({ source, template }) => (
        <Button
          type="button"
          variant="outline"
          key={preparationKey(source)}
          className="h-auto min-h-11 max-w-full justify-start whitespace-normal text-left break-words"
          disabled={busy || disabled}
          onClick={() => {
            const life = request.current;
            if (!life || life.signal.aborted) return;
            setBusy(true);
            setError("");
            onStart();
            void agreementPreparations
              .resolve(scope, source)
              .then((result) => {
                if (life.signal.aborted) return;
                if (
                  result.agreement_request.discipline_id !== template.discipline_id ||
                  result.agreement_request.format !== template.format
                )
                  throw Error("invalidAgreement");
                onResolved(result, template.name);
              })
              .catch((cause) => {
                if (!life.signal.aborted) {
                  setError(flowError(cause));
                  onFailed();
                }
              })
              .finally(() => {
                if (!life.signal.aborted) setBusy(false);
              });
          }}
        >
          {template.name} ·{" "}
          {t(source.scope === "organization" ? "templateOrganization" : "templateCenter")} ·{" "}
          {t("templateVersion", { version: source.version })}
        </Button>
      ))}
      {busy && <output>{t("loading")}</output>}
    </div>
  );
}
