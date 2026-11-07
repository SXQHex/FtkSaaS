"use client";
import { useState, useId } from "react";
import { useTranslations } from "next-intl";
import type { Studios } from "./center-workspace";
import { Applications } from "./applications";
import { control } from "./fields";
export function OrganizationApplications({
  actorId,
  studios,
}: {
  actorId: string;
  studios: Studios;
}) {
  const t = useTranslations("crm"),
    id = useId(),
    [orgId, setOrgId] = useState("");
  const orgs = studios.filter((s) => ["normal", "grace"].includes(s.organization.access_mode)),
    selected = orgs.find((s) => s.organization.id === orgId);
  return (
    <section className="space-y-4">
      <label htmlFor={id}>{t("organizationInbox")}</label>
      <select id={id} className={control} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
        <option value="">{t("choose")}</option>
        {orgs.map((s) => (
          <option key={s.organization.id} value={s.organization.id}>
            {s.organization.name}
          </option>
        ))}
      </select>
      {selected && (
        <Applications
          key={`${actorId}:${orgId}`}
          scope={{ actorId, orgId }}
          timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
          destinations={selected.centers
            .filter((c) => c.accessible && c.state === "active")
            .map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </section>
  );
}
