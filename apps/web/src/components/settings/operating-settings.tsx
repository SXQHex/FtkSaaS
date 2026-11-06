"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import {
  operatingApi,
  operatingSlot,
  writableOperating,
  type OperatingApi,
  type OperatingTarget,
} from "../../lib/operating-settings";
import type { SetupScope } from "../../lib/studio-setup";
import { OperatingField } from "./operating-field";
import { SettingsHistory } from "./settings-history";
export function OperatingSettings(props: {
  scope: SetupScope;
  target: OperatingTarget;
  api?: OperatingApi;
}) {
  const scope =
    props.target === "organization"
      ? { actorId: props.scope.actorId, orgId: props.scope.orgId }
      : props.scope;
  return (
    <SettingsConnection key={JSON.stringify([scope, props.target])} {...props} scope={scope} />
  );
}
function SettingsConnection({
  scope: initialScope,
  target,
  api = operatingApi,
}: {
  scope: SetupScope;
  target: OperatingTarget;
  api?: OperatingApi;
}) {
  const [scope] = useState(initialScope),
    t = useTranslations("operatingSettings");
  const [result, setResult] = useState<{
      source?: Awaited<ReturnType<OperatingApi["read"]>>;
      error?: string;
    } | null>(null),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [history, setHistory] = useState(false),
    [lastError, setLastError] = useState("");
  function reload(code = "") {
    setSelected("");
    setResult(null);
    setLastError(code);
    setRevision((v) => v + 1);
  }
  const recovery = useSetupCommand(scope, operatingSlot(target), () => reload(), reload);
  useEffect(() => {
    const life = new AbortController();
    void api
      .read(scope, target)
      .then((source) => {
        if (!life.signal.aborted) setResult({ source });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [scope, target, api, revision]);
  const fields = result?.source ? writableOperating(result.source.catalog) : [];
  return (
    <section
      className="min-w-0 space-y-4 rounded-md border p-4 wrap-anywhere"
      aria-label={t(target)}
    >
      <h3 className="font-semibold">{t(target)}</h3>
      <SetupFeedback command={recovery} />
      {lastError && <FlowError code={lastError} />}
      <Button type="button" variant="outline" onClick={() => reload()}>
        {t("refresh")}
      </Button>
      {!result ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : result.error ? (
        <FlowError code={result.error} />
      ) : (
        result.source && (
          <>
            <p>{t("version", { version: result.source.view.version })}</p>
            <div className="flex flex-wrap gap-2">
              {fields.map((field) => (
                <Button
                  type="button"
                  variant="outline"
                  key={field.key}
                  aria-pressed={selected === field.key}
                  onClick={() => setSelected(field.key)}
                >
                  {t(`fields.${field.key}`)}
                </Button>
              ))}
            </div>
            {!fields.length && <p>{t("noFields")}</p>}
            {fields
              .filter((field) => field.key === selected)
              .map((field) => (
                <OperatingField
                  key={`${revision}:${field.key}`}
                  scope={scope}
                  target={target}
                  field={field}
                  source={result.source!}
                  api={api}
                  onSaved={() => reload()}
                  onRejected={reload}
                />
              ))}
            <Button
              type="button"
              variant="outline"
              aria-expanded={history}
              onClick={() => setHistory((v) => !v)}
            >
              {t("history")}
            </Button>
            {history && <SettingsHistory key={revision} scope={scope} target={target} api={api} />}
          </>
        )
      )}
    </section>
  );
}
