"use client";
import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import type { SetupScope } from "../../lib/studio-setup";
import { Label } from "@ftksaas/ui/components/label";
export type Studios = { organization: OrganizationView; centers: CenterView[] }[];
export function CenterWorkspace({
  actorId,
  studios,
  children,
}: {
  actorId: string;
  studios: Studios;
  children: (scope: SetupScope, timeZone: string) => ReactNode;
}) {
  const t = useTranslations("attendance"),
    id = useId(),
    [selected, setSelected] = useState("");
  const options = studios
    .filter((s) => ["normal", "grace"].includes(s.organization.access_mode))
    .flatMap((s) =>
      s.centers
        .filter((c) => c.accessible && c.state === "active")
        .map((c) => ({
          orgId: s.organization.id,
          centerId: c.id,
          timeZone: c.timezone,
          label: `${s.organization.name} · ${c.name}`,
        })),
    );
  const current = options.find((o) => `${o.orgId}:${o.centerId}` === selected) ?? options[0];
  if (!current) return <p>{t("noCenter")}</p>;
  return (
    <div className="min-w-0 space-y-5">
      <Label htmlFor={id}>{t("center")}</Label>
      <select
        id={id}
        value={`${current.orgId}:${current.centerId}`}
        onChange={(e) => setSelected(e.target.value)}
        className="min-h-11 w-full rounded-md border bg-background px-3"
      >
        {options.map((o) => (
          <option key={`${o.orgId}:${o.centerId}`} value={`${o.orgId}:${o.centerId}`}>
            {o.label}
          </option>
        ))}
      </select>
      <div key={`${actorId}:${current.orgId}:${current.centerId}`}>
        {children({ actorId, orgId: current.orgId, centerId: current.centerId }, current.timeZone)}
      </div>
    </div>
  );
}
