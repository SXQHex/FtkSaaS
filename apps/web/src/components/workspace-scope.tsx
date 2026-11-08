"use client";
import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { OrganizationView, CenterView } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../lib/studio-setup";
export type WorkspaceStudios = { organization: OrganizationView; centers: CenterView[] }[];
export function WorkspaceScope({
  actorId,
  studios,
  children,
}: {
  actorId: string;
  studios: WorkspaceStudios;
  children: (scope: SetupScope, timeZone: string) => ReactNode;
}) {
  const t = useTranslations("finance"),
    id = useId(),
    [selected, setSelected] = useState("");
  const options = studios
    .filter((s) => ["normal", "grace"].includes(s.organization.access_mode))
    .flatMap((s) =>
      s.centers
        .filter((c) => c.accessible && c.state === "active")
        .map((c) => ({ org: s.organization, center: c })),
    );
  const current = options.find((o) => `${o.org.id}:${o.center.id}` === selected) ?? options[0];
  if (!current) return <p>{t("noCenter")}</p>;
  return (
    <div className="min-w-0 space-y-5">
      <Label htmlFor={id}>{t("center")}</Label>
      <select
        id={id}
        className="min-h-11 w-full rounded-md border bg-background px-3"
        value={`${current.org.id}:${current.center.id}`}
        onChange={(e) => setSelected(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.center.id} value={`${o.org.id}:${o.center.id}`}>
            {o.org.name} · {o.center.name}
          </option>
        ))}
      </select>
      <div key={`${actorId}:${current.org.id}:${current.center.id}`}>
        {children(
          { actorId, orgId: current.org.id, centerId: current.center.id },
          current.center.timezone,
        )}
      </div>
    </div>
  );
}
