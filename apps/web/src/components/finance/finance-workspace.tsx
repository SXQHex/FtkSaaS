"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { CenterView, OrganizationView, PersonSummary } from "@ftksaas/api-contracts";
import { Label } from "@ftksaas/ui/components/label";
import { PersonChooser } from "../bookings/person-chooser";
import { PersonFinance } from "./person-finance";
import type { SetupScope } from "../../lib/studio-setup";
export function FinanceWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("finance"),
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
    <div className="space-y-6">
      <div className="max-w-xl space-y-2">
        <Label htmlFor={id}>{t("center")}</Label>
        <select
          id={id}
          className="min-h-11 w-full rounded-md border bg-background px-3"
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
      <FinanceDirectory
        key={`${actorId}:${current.orgId}:${current.centerId}`}
        scope={{ actorId, orgId: current.orgId, centerId: current.centerId }}
        timeZone={current.timeZone}
      />
    </div>
  );
}
function FinanceDirectory({ scope, timeZone }: { scope: SetupScope; timeZone: string }) {
  const t = useTranslations("finance"),
    [person, setPerson] = useState<PersonSummary | null>(null);
  return (
    <section className="space-y-5">
      <h2 className="font-semibold">{t("choosePerson")}</h2>
      <PersonChooser scope={scope} disabled={false} onSelect={setPerson} />
      {person && (
        <>
          <p className="font-medium break-words">
            {person.display_name}
            {person.subscriber_number ? ` · ${person.subscriber_number}` : ""}
          </p>
          <PersonFinance scope={scope} personId={person.id} timeZone={timeZone} />
        </>
      )}
    </section>
  );
}
