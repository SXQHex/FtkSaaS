"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ResolvedWorkTemplate, WorkTemplateReference } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { useRemote } from "../../lib/use-remote";
import { FlowError, flowError } from "../bookings/flow-controls";
export function WorkTemplatePicker({
  scope,
  kind,
  onResolved,
  contextKey = "",
}: {
  scope: SetupScope;
  kind: "report" | "import";
  onResolved: (v: ResolvedWorkTemplate) => void;
  contextKey?: string;
}) {
  const t = useTranslations("reports"),
    id = useId(),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [pendingRequest, setPendingRequest] = useState<{ context: string } | null>(null);
  const busy = pendingRequest?.context === contextKey;
  const load = useCallback(
      () =>
        setupCall("settings_catalog_get_v1", {
          scope: "member",
          org_id: scope.orgId,
          template_center_id: scope.centerId,
        }),
      [scope],
    ),
    state = useRemote(load, String(revision));
  const templates =
    kind === "report" ? state?.data?.work_templates?.reports : state?.data?.work_templates?.imports;
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
  }, [contextKey]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function resolve(source: WorkTemplateReference) {
    const ticket = ++generation.current;
    setPendingRequest({ context: contextKey });
    setError("");
    try {
      const result =
        kind === "report"
          ? await setupCall("settings_template_resolve_v1", {
              org_id: scope.orgId,
              center_id: scope.centerId,
              kind: "report",
              template: source,
            })
          : await setupCall("settings_template_resolve_v1", {
              org_id: scope.orgId,
              center_id: scope.centerId,
              kind: "import",
              template: source,
            });
      if (ticket !== generation.current) return;
      if (
        result.kind !== kind ||
        result.source.scope !== source.scope ||
        result.source.key !== source.key ||
        result.source.version !== source.version ||
        (result.source.center_id ?? null) !== (source.center_id ?? null)
      )
        throw Error("VERSION_CONFLICT");
      onResolved(result);
    } catch (e) {
      if (ticket === generation.current) setError(flowError(e));
    } finally {
      if (ticket === generation.current) setPendingRequest(null);
    }
  }
  return (
    <section className="space-y-3">
      <Label htmlFor={id}>{t("template")}</Label>
      <select
        id={id}
        disabled={busy}
        className="min-h-11 w-full rounded-md border bg-background px-3"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">{t("chooseTemplate")}</option>
        {templates?.map((row, i) => (
          <option key={`${row.source.scope}:${row.source.key}`} value={String(i)}>
            {row.template.name} · {t(`templateScopes.${row.source.scope}`)} · {row.source.version}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || selected === "" || !templates?.[Number(selected)]}
          onClick={() => void resolve(templates![Number(selected)]!.source)}
        >
          {t("prepareTemplate")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            generation.current++;
            setPendingRequest(null);
            setSelected("");
            setRevision((v) => v + 1);
          }}
        >
          {t("refresh")}
        </Button>
      </div>
      {state?.error && <FlowError code={state.error} />}
      {error && <FlowError code={error} />}
    </section>
  );
}
