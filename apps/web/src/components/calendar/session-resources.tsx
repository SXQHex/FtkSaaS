"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { getProgramCatalog } from "../../lib/program";
import type { ResourceDraft } from "../../lib/session-resources";
import type { SetupScope } from "../../lib/studio-setup";
import type { ProgramCatalog } from "../programs/program-form";
export function SessionResources({
  scope,
  value,
  onChange,
}: {
  scope: SetupScope;
  value: ResourceDraft;
  onChange: (value: ResourceDraft) => void;
}) {
  const t = useTranslations("sessionChange"),
    id = useId();
  const [result, setResult] = useState<{
    key: string;
    catalog?: ProgramCatalog;
    failed?: boolean;
  } | null>(null);
  const enabled = value.roomId !== undefined || value.instructorId !== undefined;
  const key = `${scope.actorId}:${scope.orgId}:${scope.centerId}`;
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
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("resourcesTitle")}>
      <h3 className="font-medium">{t("resourcesTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("resourcesHint")}</p>
      {(["roomId", "instructorId"] as const).map((field) => (
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
      {enabled && !current && <output aria-live="polite">{t("catalogLoading")}</output>}
      {enabled && current?.failed && <p role="alert">{t("catalogFailed")}</p>}
    </section>
  );
}
