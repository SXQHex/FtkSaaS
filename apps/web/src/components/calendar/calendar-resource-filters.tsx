"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { getProgramCatalog } from "../../lib/program";
import type { SetupScope } from "../../lib/studio-setup";
import type { CalendarFilters } from "../../lib/schedule";
import { FlowError, flowError } from "../bookings/flow-controls";
export function CalendarResourceFilters({
  scope,
  value,
  onChange,
}: {
  scope: SetupScope;
  value: CalendarFilters;
  onChange: (value: CalendarFilters) => void;
}) {
  const t = useTranslations("calendar"),
    id = useId();
  const [result, setResult] = useState<{
      catalog?: Awaited<ReturnType<typeof getProgramCatalog>>;
      error?: string;
    } | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const life = new AbortController();
    void getProgramCatalog({ actorId: scope.actorId, orgId: scope.orgId, centerId: scope.centerId })
      .then((catalog) => {
        if (!life.signal.aborted) setResult({ catalog });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [scope.actorId, scope.orgId, scope.centerId, attempt]);
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={t("resourceFilters")}>
      <p className="text-sm text-muted-foreground">{t("resourceFilterHint")}</p>
      {!result && <output>{t("loading")}</output>}
      {result?.error && (
        <>
          <FlowError code={result.error} />
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              onChange({});
              setAttempt((v) => v + 1);
            }}
          >
            {t("resourceRetry")}
          </Button>
        </>
      )}
      {result?.catalog && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          {(
            [
              ["roomId", "roomFilter", result.catalog.rooms],
              ["instructorId", "instructorFilter", result.catalog.instructors],
              ["disciplineId", "disciplineFilter", result.catalog.disciplines],
            ] as const
          ).map(([key, label, options]) => (
            <div key={key} className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-${key}`}>{t(label)}</Label>
              <select
                id={`${id}-${key}`}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={value[key] ?? ""}
                onChange={(event) => onChange({ ...value, [key]: event.target.value || undefined })}
              >
                <option value="">{t("allResources")}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="outline"
        disabled={!value.roomId && !value.instructorId && !value.disciplineId}
        onClick={() => onChange({})}
      >
        {t("clearFilters")}
      </Button>
    </section>
  );
}
