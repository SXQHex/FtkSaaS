"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  PreparationSourceReference,
  ResourceRef,
  ResolvedDomainPreparation,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { preparationKey } from "../../lib/agreement-preparations";
import { useRemote } from "../../lib/use-remote";
import { FlowError, flowError } from "../bookings/flow-controls";
type PreparationPickerProps = {
  scope: SetupScope;
  kind: "availability" | "package" | "permission";
  resource?: ResourceRef;
  onResolved: (p: ResolvedDomainPreparation) => void;
  disabled?: boolean;
  contextKey?: string;
};
export function PreparationPicker(props: PreparationPickerProps) {
  const t = useTranslations("settingsEditor"),
    [open, setOpen] = useState(false);
  return (
    <section className="space-y-3">
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        type="button"
        variant="outline"
        disabled={props.disabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("prepare")}
      </Button>
      {open && (
        <PreparationConnection
          key={JSON.stringify([props.scope, props.kind, props.resource, props.contextKey])}
          {...props}
        />
      )}
    </section>
  );
}
function PreparationConnection({
  scope,
  kind,
  resource,
  onResolved,
  disabled = false,
}: PreparationPickerProps) {
  const t = useTranslations("settingsEditor"),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [rule, setRule] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    generation = useRef(0),
    alive = useRef(true);
  const load = useCallback(
    () =>
      setupCall("settings_catalog_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        scope: "center",
      }),
    [scope],
  );
  const source = useRemote(load, JSON.stringify([scope, revision]));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const catalog = source?.data?.preparation_templates;
  const rows =
    kind === "availability"
      ? catalog?.availability
      : kind === "package"
        ? catalog?.packages
        : catalog?.permissions;
  const row = rows?.find((r) => preparationKey(r.source) === selected);
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label={t("prepare")}>
      <h4>{t("prepare")}</h4>
      <p>{t("hint")}</p>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          generation.current++;
          setSelected("");
          setRule("");
          setBusy(false);
          setRevision((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {!source ? (
        <output>{t("loading")}</output>
      ) : source.error ? (
        <FlowError code={source.error} />
      ) : (
        <>
          <label className="block">
            {t("template")}
            <select
              className="min-h-11 w-full rounded-md border bg-background px-3"
              disabled={disabled || busy}
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setRule("");
              }}
            >
              <option value="">{t("choose")}</option>
              {rows?.map((r) => (
                <option key={preparationKey(r.source)} value={preparationKey(r.source)}>
                  {r.template.name}
                </option>
              ))}
            </select>
          </label>
          {row && kind === "availability" && "rules" in row.template && (
            <label className="block">
              {t("labels.rules")}
              <select
                className="min-h-11 w-full rounded-md border bg-background px-3"
                disabled={disabled || busy}
                value={rule}
                onChange={(e) => setRule(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {row.template.rules.map((r, i) => (
                  <option key={i} value={i}>
                    {r.weekdays.join(", ")} · {r.local_start}–{r.local_end}
                  </option>
                ))}
              </select>
            </label>
          )}
          {row && (
            <p>
              {t("version", { version: row.source.version })} ·{" "}
              {t(row.source.scope === "center" ? "center_local" : "organization_copy")}
            </p>
          )}
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            type="button"
            disabled={disabled || busy || !row || (kind === "availability" && rule === "")}
            onClick={async () => {
              if (!row || !scope.centerId) return;
              if (kind === "availability" && !resource) {
                setError("invalidSettings");
                return;
              }
              const token = ++generation.current;
              setBusy(true);
              setError("");
              try {
                const reference: PreparationSourceReference = row.source;
                if (reference.scope === "center" && reference.center_id !== scope.centerId)
                  throw Error("invalidSettings");
                const p =
                  kind === "availability"
                    ? await setupCall("settings_preparation_resolve_v1", {
                        org_id: scope.orgId,
                        center_id: scope.centerId,
                        kind,
                        source: reference,
                        resource: resource!,
                        rule_index: Number(rule),
                      })
                    : await setupCall("settings_preparation_resolve_v1", {
                        org_id: scope.orgId,
                        center_id: scope.centerId,
                        kind,
                        source: reference,
                      });
                if (p.kind !== kind || preparationKey(p.source) !== preparationKey(reference))
                  throw Error("VERSION_CONFLICT");
                if (
                  kind === "availability" &&
                  p.kind === "availability" &&
                  JSON.stringify(p.request.resource) !== JSON.stringify(resource)
                )
                  throw Error("invalidSettings");
                if (alive.current && token === generation.current) onResolved(p);
              } catch (e) {
                if (alive.current && token === generation.current) setError(flowError(e));
              } finally {
                if (alive.current && token === generation.current) setBusy(false);
              }
            }}
          >
            {t("prepare")}
          </Button>
        </>
      )}
      {error && <FlowError code={error} />}
    </section>
  );
}
