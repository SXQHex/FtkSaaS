"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import { DocumentManager } from "./document-manager";
export function DocumentsWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("documents"),
    id = useId();
  const [selected, setSelected] = useState("");
  const options = studios
    .filter((s) => ["normal", "grace"].includes(s.organization.access_mode))
    .flatMap(({ organization, centers }) => [
      {
        key: organization.id,
        orgId: organization.id,
        label: `${organization.name} · ${t("organizationScope")}`,
        centerId: undefined,
      },
      ...centers
        .filter((c) => c.accessible && c.state === "active")
        .map((c) => ({
          key: `${organization.id}:${c.id}`,
          orgId: organization.id,
          centerId: c.id,
          label: `${organization.name} · ${c.name}`,
        })),
    ]);
  const current = options.find((o) => o.key === selected) ?? options[0];
  if (!current) return <p>{t("noOrganization")}</p>;
  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-2">
        <Label htmlFor={id}>{t("scope")}</Label>
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={current.key}
          onChange={(event) => setSelected(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t("scopeHint")}</p>
      </div>
      <DocumentManager
        key={`${actorId}:${current.key}`}
        scope={{
          actorId,
          orgId: current.orgId,
          ...(current.centerId ? { centerId: current.centerId } : {}),
        }}
      />
    </div>
  );
}
