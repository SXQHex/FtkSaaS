"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { OrganizationView, CenterView } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import { ProductManager } from "./product-manager";
export function ProductsWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("products"),
    id = useId(),
    [selected, setSelected] = useState("");
  const options = studios
    .filter((s) => ["normal", "grace"].includes(s.organization.access_mode))
    .flatMap(({ organization, centers }) =>
      centers
        .filter((c) => c.accessible && c.state === "active")
        .map((center) => ({
          orgId: organization.id,
          centerId: center.id,
          label: `${organization.name} · ${center.name}`,
        })),
    );
  const current = options.find((row) => `${row.orgId}:${row.centerId}` === selected) ?? options[0];
  if (!current) return <p>{t("noCenter")}</p>;
  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-2">
        <Label htmlFor={id}>{t("center")}</Label>
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={`${current.orgId}:${current.centerId}`}
          onChange={(event) => setSelected(event.target.value)}
        >
          {options.map((row) => (
            <option key={`${row.orgId}:${row.centerId}`} value={`${row.orgId}:${row.centerId}`}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      <ProductManager scope={{ actorId, orgId: current.orgId, centerId: current.centerId }} />
    </div>
  );
}
