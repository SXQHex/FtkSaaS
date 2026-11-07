"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { DutyInput } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { AdditionalDuties } from "../programs/additional-duties";
import { getProgramCatalog } from "../../lib/program";
import type { ResourceDraft } from "../../lib/session-resources";
import type { SetupScope } from "../../lib/studio-setup";
import type { ProgramCatalog } from "../programs/program-form";
export function SessionResources({
  scope,
  value,
  onChange,
  assignments = [],
}: {
  scope: SetupScope;
  value: ResourceDraft;
  assignments?: DutyInput[];
  onChange: (value: ResourceDraft) => void;
}) {
  const t = useTranslations("sessionChange"),
    id = useId();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    catalog?: ProgramCatalog;
    failed?: boolean;
  } | null>(null);
  const enabled =
    value.roomId !== undefined ||
    value.instructorId !== undefined ||
    value.assignments !== undefined;
  const key = `${scope.actorId}:${scope.orgId}:${scope.centerId}:${attempt}`;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getProgramCatalog({ actorId: scope.actorId, orgId: scope.orgId, centerId: scope.centerId })
      .then((catalog) => {
        if (active) setResult({ key, catalog });
      })
      .catch(() => {
        if (active) setResult({ key, failed: true });
      });
    return () => {
      active = false;
    };
  }, [scope.actorId, scope.orgId, scope.centerId, key, enabled]);
  const current = result?.key === key ? result : null;
  const dutyOptions =
    current?.catalog?.duties ??
    current?.catalog?.instructors.map((p) => ({ ...p, duty: "instructor" as const })) ??
    [];
  const selectableDuties = [
    ...dutyOptions,
    ...assignments
      .filter((a) => !dutyOptions.some((p) => p.id === a.person_id && p.duty === a.duty))
      .map((a) => ({ id: a.person_id, name: a.person_id, duty: a.duty })),
  ];
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("resourcesTitle")}>
      <h3 className="font-medium">{t("resourcesTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("resourcesHint")}</p>
      {(["roomId", "instructorId"] as const)
        .filter((field) => field !== "instructorId" || value.assignments === undefined)
        .map((field) => (
          <div key={field} className="space-y-2">
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={value[field] !== undefined}
                onChange={(e) => onChange({ ...value, [field]: e.target.checked ? "" : undefined })}
              />
              {t(field === "roomId" ? "replaceRoom" : "replaceInstructor")}
            </label>
            {value[field] !== undefined && (
              <>
                <label htmlFor={`${id}-${field}`} className="block text-sm">
                  {t(field === "roomId" ? "newRoom" : "newInstructor")}
                </label>
                <select
                  id={`${id}-${field}`}
                  required
                  disabled={!current?.catalog}
                  value={value[field]}
                  onChange={(e) => {
                    const options =
                      field === "roomId" ? current?.catalog?.rooms : current?.catalog?.instructors;
                    const name = options?.find((o) => o.id === e.target.value)?.name;
                    onChange({
                      ...value,
                      [field]: e.target.value,
                      [field === "roomId" ? "roomName" : "instructorName"]: name,
                    });
                  }}
                  className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{t("chooseResource")}</option>
                  {(field === "roomId"
                    ? current?.catalog?.rooms
                    : current?.catalog?.instructors
                  )?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ))}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={value.assignments !== undefined}
          onChange={(e) =>
            onChange({
              ...value,
              instructorId: undefined,
              instructorName: undefined,
              assignments: e.target.checked ? assignments : undefined,
            })
          }
        />
        {t("replaceDuties")}
      </label>
      {value.assignments !== undefined && current?.catalog && (
        <>
          <p className="text-sm text-muted-foreground">{t("replaceDutiesHint")}</p>
          <AdditionalDuties
            primaryId=""
            people={selectableDuties}
            value={value.assignments}
            onChange={(selected) =>
              onChange({
                ...value,
                dutyNames: Object.fromEntries(
                  selectableDuties.map((p) => [`${p.id}:${p.duty}`, p.name]),
                ),
                assignments: selected.map(
                  (a) =>
                    value.assignments?.find(
                      (current) => current.person_id === a.person_id && current.duty === a.duty,
                    ) ??
                    assignments.find(
                      (original) => original.person_id === a.person_id && original.duty === a.duty,
                    ) ??
                    a,
                ),
              })
            }
          />
        </>
      )}
      {enabled && !current && <output aria-live="polite">{t("catalogLoading")}</output>}
      {enabled && current?.failed && (
        <div className="space-y-3">
          <p role="alert">{t("catalogFailed")}</p>
          <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t("retryResources")}
          </Button>
        </div>
      )}
    </section>
  );
}
