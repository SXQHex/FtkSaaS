"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { NegativeLimitsView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
import type { RightsApi } from "../../lib/rights";
import { ApiFailure } from "../../lib/api";
import { errorKey, type useSetupCommand } from "../setup/setup-command";
import { RightsForm } from "./rights-form";
type Props = {
  scope: SetupScope;
  personId: string;
  api: RightsApi;
  command: ReturnType<typeof useSetupCommand>;
};
export function NegativeRights(props: Props) {
  const t = useTranslations("rights"),
    [rows, setRows] = useState<Awaited<ReturnType<RightsApi["disciplines"]>> | null>(null),
    [error, setError] = useState(false),
    [selected, setSelected] = useState(""),
    [attempt, setAttempt] = useState(0),
    id = useId();
  const { api, scope, command } = props;
  useEffect(() => {
    let active = true;
    void api
      .disciplines(scope)
      .then((items) => {
        if (active) setRows(items);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [api, scope, attempt]);
  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <p role="alert">{t("disciplineError")}</p>
      ) : !rows ? (
        <output>{t("loading")}</output>
      ) : !rows.length ? (
        <p>{t("noDisciplines")}</p>
      ) : (
        <>
          <Label htmlFor={id}>{t("discipline")}</Label>
          <select
            id={id}
            value={selected}
            disabled={command.busy || !!command.pending}
            onChange={(event) => setSelected(event.target.value)}
            className="h-11 w-full rounded-md border bg-background px-3"
          >
            <option value="">{t("chooseDiscipline")}</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          {selected && rows.some((row) => row.id === selected) && (
            <LimitEditor key={selected} {...props} disciplineId={selected} />
          )}
        </>
      )}
      {error && (
        <Button
          variant="outline"
          onClick={() => {
            setError(false);
            setRows(null);
            setSelected("");
            setAttempt((n) => n + 1);
          }}
        >
          {t("reload")}
        </Button>
      )}
    </div>
  );
}
function LimitEditor({
  scope,
  personId,
  api,
  command,
  disciplineId,
}: Props & { disciplineId: string }) {
  const t = useTranslations("rights"),
    errors = useTranslations("setup"),
    [limits, setLimits] = useState<NegativeLimitsView | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void api
      .limits(scope, personId, disciplineId)
      .then((result) => {
        if (
          result.person_id !== personId ||
          result.center_id !== scope.centerId ||
          result.discipline_id !== disciplineId ||
          !Number.isSafeInteger(result.version) ||
          result.version < 1
        )
          throw Error("invalidRights");
        if (active) setLimits(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiFailure ? errorKey(cause.failure.error.code) : "limitsError",
          );
      });
    return () => {
      active = false;
    };
  }, [scope, personId, disciplineId, api, attempt]);
  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <p role="alert">{t.has(error) ? t(error) : errors(error)}</p>
      ) : !limits ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                "override",
                "default_limit",
                "upper_limit",
                "effective_limit",
                "reserved_deficit",
                "consumed_deficit",
              ] as const
            ).map((key) => (
              <div key={key}>
                <dt>{t(`limits.${key}`)}</dt>
                <dd>{limits[key] ?? t("notConfigured")}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">{t("limitHint")}</p>
          <RightsForm
            scope={scope}
            personId={personId}
            target={{ kind: "negative_limit", limits }}
            api={api}
            command={command}
          />
        </>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={command.busy || !!command.pending}
        onClick={() => {
          setLimits(null);
          setError("");
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
    </div>
  );
}
