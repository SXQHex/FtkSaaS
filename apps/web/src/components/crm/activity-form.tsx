"use client";
import type { LeadRecord } from "../../lib/crm";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { sourceVersion } from "../../lib/crm";

import { localTimeChoices } from "../../lib/session-change";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { LocalTimeField } from "../programs/local-time-field";
import { FlowError, flowError } from "../bookings/flow-controls";
import { CommandReview } from "./command-review";
import { Field, control, button } from "./fields";
export function ActivityForm({
  scope,
  lead,
  timeZone,
  row,
  onSaved,
}: {
  scope: SetupScope;
  lead: LeadRecord;
  timeZone: string;
  row?: ManagementStateView;
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    formatter = useFormatter(),
    v = row?.current?.operation === "crm_activity_save_v1" ? row.current.values : undefined;
  const [kind, setKind] = useState(v?.kind ?? "contact"),
    [local, setLocal] = useState(""),
    [offset, setOffset] = useState(""),
    [error, setError] = useState(""),
    [command, setCommand] = useState<SetupCommand | null>(null);
  const target = row?.entity?.id;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <h5 className="font-semibold">{t(row ? "editActivity" : "newActivity")}</h5>
      <p>{t("activityHint")}</p>
      <form
        className="space-y-3"
        onChange={() => setCommand(null)}
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const f = new FormData(e.currentTarget),
              choices = kind === "followup" ? localTimeChoices(local, timeZone) : [],
              due =
                choices.length === 1
                  ? choices[0]?.instant
                  : choices.find((c) => c.instant === offset)?.instant;
            if (kind === "followup" && !due) throw Error("invalidCrm");
            setCommand({
              operation: "crm_activity_save_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                lead_id: lead.id,
                kind,
                ...(due ? { due_at: due } : {}),
                note: String(f.get("note")).trim() || undefined,
                outcome: String(f.get("outcome")).trim() || undefined,
                ...(row ? { activity_id: target, expected_version: sourceVersion(row) } : {}),
              },
            });
            setError("");
          } catch (e) {
            setError(flowError(e));
          }
        }}
      >
        <label className="block space-y-2">
          {t("kind")}
          <select
            className={control}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {["contact", "followup", "outcome"].map((k) => (
              <option value={k} key={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
        <Field name="note" label={t("note")} value={v?.note ?? ""} required />
        <Field name="outcome" label={t("outcome")} value={v?.outcome ?? ""} />
        {kind === "followup" && (
          <LocalTimeField
            label={t("due")}
            value={local}
            choice={offset}
            timeZone={timeZone}
            onChange={setLocal}
            onChoice={setOffset}
          />
        )}
        <Button className={button}>{t("review")}</Button>
      </form>
      {error && <FlowError code={error} />}
      <CommandReview
        scope={scope}
        slot={target ? `crm-activity:${target}` : `crm-lead:${lead.id}`}
        command={command}
        onBack={() => setCommand(null)}
        onDone={() => {
          setCommand(null);
          onSaved();
        }}
      >
        {command?.operation === "crm_activity_save_v1" && (
          <>
            <p>
              {t(command.input.kind)} · {command.input.note}
            </p>
            <p>{command.input.outcome}</p>
            {command.input.due_at && (
              <p>
                {formatter.dateTime(new Date(command.input.due_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone,
                })}{" "}
                · {timeZone}
              </p>
            )}
          </>
        )}
      </CommandReview>
    </div>
  );
}
