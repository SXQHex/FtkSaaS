"use client";
import type { LeadRecord } from "../../lib/crm";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { PersonSummary } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { type SetupScope, type SetupCommand } from "../../lib/studio-setup";
import { CommandReview } from "./command-review";
import { Field, control, button } from "./fields";
import { PersonPicker } from "./person-picker";
export function LeadForm({
  scope,
  lead,
  onSaved,
}: {
  scope: SetupScope;
  lead?: LeadRecord;
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    [person, setPerson] = useState<PersonSummary>(),
    [assigned, setAssigned] = useState<string | null>(lead?.assigned_to ?? null),
    [assignOpen, setAssignOpen] = useState(false),
    [command, setCommand] = useState<SetupCommand | null>(null);
  const personId = lead?.person_id ?? person?.id;
  return (
    <section
      className="space-y-4 rounded-md border p-4"
      aria-label={t(lead ? "editLead" : "newLead")}
    >
      <h3 className="font-semibold">{t(lead ? "editLead" : "newLead")}</h3>
      {!lead && (
        <PersonPicker
          scope={scope}
          create
          onSelect={(p) => {
            setPerson(p);
            setCommand(null);
          }}
        />
      )}
      {person && <p>{person.display_name}</p>}
      {personId && (
        <>
          <form
            className="space-y-3"
            onChange={() => setCommand(null)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setCommand({
                operation: "lead_save_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  person_id: personId,
                  source: String(f.get("source")),
                  interest: String(f.get("interest")).trim(),
                  assigned_to: assigned,
                  ...(lead ? { lead_id: lead.id, expected_version: lead.version } : {}),
                },
              });
            }}
          >
            <label className="block space-y-2">
              {t("source")}
              <select name="source" className={control} defaultValue={lead?.source ?? "manual"}>
                {!["manual", "phone", "whatsapp"].includes(lead?.source ?? "manual") && (
                  <option value={lead!.source}>{lead!.source}</option>
                )}
                {["manual", "phone", "whatsapp"].map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </label>
            <Field name="interest" label={t("interest")} value={lead?.interest} required />
            <Button
              className={button}
              variant="outline"
              type="button"
              onClick={() => setAssignOpen((v) => !v)}
            >
              {t("assign")}
            </Button>
            {assigned && (
              <Button
                type="button"
                className={button}
                variant="outline"
                onClick={() => {
                  setAssigned(null);
                  setCommand(null);
                }}
              >
                {t("clearAssignee")}
              </Button>
            )}
            <Button className={button}>{t("review")}</Button>
          </form>
          {assignOpen && (
            <PersonPicker
              scope={scope}
              label={t("assignee")}
              onSelect={(p) => {
                setAssigned(p.id);
                setCommand(null);
                setAssignOpen(false);
              }}
            />
          )}
          <CommandReview
            scope={scope}
            slot={`crm-person:${personId}`}
            command={command}
            onBack={() => setCommand(null)}
            onDone={() => {
              setCommand(null);
              onSaved();
            }}
          >
            <p>{t("leadWarning")}</p>
            {command?.operation === "lead_save_v1" && (
              <p>
                {command.input.source} · {command.input.interest}
              </p>
            )}
          </CommandReview>
        </>
      )}
    </section>
  );
}
