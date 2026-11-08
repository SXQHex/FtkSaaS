"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { OrganizationView } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import { NotificationPreferences } from "./notification-preferences";
import { EmailPreferences } from "../automation/email-preferences";
import { InboxFeed } from "./inbox-feed";

export function InboxWorkspace({
  actorId,
  organizations,
}: {
  actorId: string;
  organizations: OrganizationView[];
}) {
  const t = useTranslations("inbox");
  const selectId = useId();
  const [selected, setSelected] = useState("");
  const orgs = organizations.filter((org) => ["normal", "grace"].includes(org.access_mode));
  const org = orgs.find((org) => org.id === selected) ?? orgs[0];
  const orgId = org?.id ?? "";
  const scope = { actorId, orgId };
  if (!org) return <p className="rounded-xl border border-dashed p-6">{t("noOrganization")}</p>;
  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-2">
        <Label htmlFor={selectId}>{t("organization")}</Label>
        <select
          id={selectId}
          className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={org.id}
          onChange={(event) => setSelected(event.target.value)}
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      <NotificationPreferences scope={scope} />
      <EmailPreferences scope={scope} />
      <InboxFeed key={`${actorId}:${org.id}`} scope={scope} />
    </div>
  );
}
