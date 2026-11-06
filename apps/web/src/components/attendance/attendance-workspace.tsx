"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import { AttendanceTasks } from "./attendance-tasks";
export function AttendanceWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("attendance"),
    id = useId(),
    [selected, setSelected] = useState("");
  const options = studios
    .filter((row) => ["normal", "grace"].includes(row.organization.access_mode))
    .flatMap(({ organization, centers }) =>
      centers
        .filter((center) => center.accessible && center.state === "active")
        .map((center) => ({
          orgId: organization.id,
          centerId: center.id,
          timeZone: center.timezone,
          label: `${organization.name} · ${center.name}`,
        })),
    );
  const current = options.find((row) => `${row.orgId}:${row.centerId}` === selected) ?? options[0];
  if (!current) return <p>{t("noCenter")}</p>;
  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-muted-foreground">{t("tasksHint")}</p>
      <div className="max-w-xl space-y-2">
        <Label htmlFor={id}>{t("center")}</Label>
        <select
          id={id}
          value={`${current.orgId}:${current.centerId}`}
          className="min-h-11 w-full rounded-md border bg-background px-3"
          onChange={(event) => setSelected(event.target.value)}
        >
          {options.map((row) => (
            <option key={`${row.orgId}:${row.centerId}`} value={`${row.orgId}:${row.centerId}`}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      <AttendanceTasks
        key={`${actorId}:${current.orgId}:${current.centerId}:${current.timeZone}`}
        scope={{ actorId, orgId: current.orgId, centerId: current.centerId }}
        timeZone={current.timeZone}
      />
    </div>
  );
}
