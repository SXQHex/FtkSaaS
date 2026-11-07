"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { DisciplineView, ProductTerms, UsageTarget } from "@ftksaas/api-contracts";
import { Input } from "@ftksaas/ui/components/input";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import type { ProductDraft } from "../../lib/product-terms";
import { FlowError, flowError } from "../bookings/flow-controls";
export function ProProductFields({
  scope,
  draft,
  disciplines,
  disabled,
  onChange,
  onReady,
}: {
  scope: SetupScope;
  draft: ProductDraft;
  disciplines: DisciplineView[];
  disabled: boolean;
  onChange: (draft: ProductDraft) => void;
  onReady: (ready: boolean) => void;
}) {
  const t = useTranslations("productPro"),
    id = useId();
  const [result, setResult] = useState<{ allowed?: boolean; error?: string } | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    onReady(false);
    void setupCall("subscription_get_v1", { org_id: scope.orgId })
      .then((plan) => {
        if (active) {
          const allowed = ["pro", "business"].includes(plan.plan);
          setResult({ allowed });
          onReady(allowed);
        }
      })
      .catch((cause) => {
        if (active) setResult({ error: flowError(cause) });
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, attempt, onReady]);
  const scopes: ProductTerms["scopes"] = draft.scopes ?? [
    {
      scope_kind: "center_discipline",
      center_id: scope.centerId!,
      discipline_id: draft.disciplineId,
      usage_targets: ["lesson"],
    },
  ];
  const targets = scopes[0].usage_targets;
  const all = scopes[0].scope_kind === "center_all_disciplines";
  const protectedScopes =
    scopes.some(
      (s) =>
        s.scope_kind !== scopes[0].scope_kind ||
        !!s.class_id ||
        !!s.event_id ||
        [...s.usage_targets].sort().join() !== [...targets].sort().join(),
    ) || new Set(scopes.map((s) => s.discipline_id)).size !== scopes.length;
  const freeze = draft.freeze ?? { enabled: false, extends_validity: false };
  function updateScopes(next: ProductTerms["scopes"]) {
    onChange({ ...draft, scopes: next });
  }
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t("title")}>
      <h4 className="font-semibold">{t("title")}</h4>
      {!result && <output aria-live="polite">{t("loading")}</output>}
      {result?.error && (
        <>
          <FlowError code={result.error} />
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            type="button"
            variant="outline"
            onClick={() => {
              setResult(null);
              setAttempt((n) => n + 1);
            }}
          >
            {t("reload")}
          </Button>
        </>
      )}
      {result?.allowed === false && <p role="alert">{t("unavailable")}</p>}
      {result?.allowed && (
        <fieldset disabled={disabled} className="space-y-4">
          <legend className="sr-only">{t("title")}</legend>
          <p className="text-sm text-muted-foreground">{t("centerOnly")}</p>
          {protectedScopes ? (
            <p className="text-sm">{t("retainedRestrictions")}</p>
          ) : (
            <>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) =>
                    updateScopes(
                      e.target.checked
                        ? [
                            {
                              scope_kind: "center_all_disciplines",
                              center_id: scope.centerId!,
                              discipline_id: null,
                              usage_targets: targets,
                            },
                          ]
                        : [
                            {
                              scope_kind: "center_discipline",
                              center_id: scope.centerId!,
                              discipline_id: draft.disciplineId,
                              usage_targets: targets,
                            },
                          ],
                    )
                  }
                />
                {t("allDisciplines")}
              </label>
              {!all && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{t("disciplines")}</legend>
                  {disciplines.map((d) => (
                    <label key={d.id} className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={scopes.some((s) => s.discipline_id === d.id)}
                        disabled={scopes.length === 1 && scopes[0].discipline_id === d.id}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [
                                ...scopes.filter(
                                  (s) => s.scope_kind !== "center_discipline" || !!s.discipline_id,
                                ),
                                {
                                  scope_kind: "center_discipline" as const,
                                  center_id: scope.centerId!,
                                  discipline_id: d.id,
                                  usage_targets: targets,
                                },
                              ]
                            : scopes.filter((s) => s.discipline_id !== d.id);
                          if (next.length) updateScopes([next[0], ...next.slice(1)]);
                        }}
                      />
                      {d.name}
                    </label>
                  ))}
                </fieldset>
              )}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t("usage")}</legend>
                {(["lesson", "event"] as UsageTarget[]).map((target) => (
                  <label key={target} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={targets.includes(target)}
                      disabled={targets.length === 1 && targets[0] === target}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...targets, target]
                          : targets.filter((v) => v !== target);
                        if (next.length)
                          updateScopes(
                            scopes.map((s) => ({
                              ...s,
                              usage_targets: [next[0], ...next.slice(1)],
                            })) as ProductTerms["scopes"],
                          );
                      }}
                    />
                    {t(target)}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={freeze.enabled}
              onChange={(e) =>
                onChange({
                  ...draft,
                  scopes,
                  freeze: e.target.checked
                    ? { enabled: true, extends_validity: false }
                    : { enabled: false, extends_validity: false },
                })
              }
            />
            {t("freezeEnabled")}
          </label>
          {freeze.enabled && (
            <div className="space-y-3">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={freeze.extends_validity}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      scopes,
                      freeze: { ...freeze, extends_validity: e.target.checked },
                    })
                  }
                />
                {t("extendsValidity")}
              </label>
              <label htmlFor={`${id}-max`} className="block space-y-2 text-sm">
                <span>{t("maxDays")}</span>
                <Input
                  id={`${id}-max`}
                  type="number"
                  min="1"
                  step="1"
                  value={freeze.max_days ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      scopes,
                      freeze: {
                        ...freeze,
                        max_days: e.target.value === "" ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
          )}
        </fieldset>
      )}
    </section>
  );
}
