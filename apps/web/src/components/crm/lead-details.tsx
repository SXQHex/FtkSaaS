"use client";
import type { LeadRecord } from "../../lib/crm";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";

import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { LeadForm } from "./lead-form";
import { Activities } from "./activities";
import { CommandReview } from "./command-review";
import { button } from "./fields";
const Trials = dynamic(() => import("./trials").then((m) => m.Trials));
export function LeadDetails({
  scope,
  lead,
  timeZone,
  onSaved,
  personName,
}: {
  scope: SetupScope;
  lead: LeadRecord;
  timeZone: string;
  onSaved: () => void;
  personName: string;
}) {
  const t = useTranslations("crm"),
    [tab, setTab] = useState("activities"),
    [command, setCommand] = useState<SetupCommand | null>(null);
  return (
    <section className="min-w-0 space-y-4 border-t pt-5" aria-label={t("details")}>
      <h3 className="font-semibold">{personName}</h3>
      <p>
        {lead.interest} · {lead.source} · {t(lead.state)}
      </p>
      <div className="flex flex-wrap gap-2">
        {["activities", "editLead", "trials"].map((k) => (
          <Button
            className={button}
            variant={tab === k ? "default" : "outline"}
            onClick={() => setTab(k)}
            key={k}
          >
            {t(k)}
          </Button>
        ))}
      </div>
      {tab === "activities" && (
        <Activities scope={scope} lead={lead} timeZone={timeZone} onSaved={onSaved} />
      )}{" "}
      {tab === "editLead" && (
        <LeadForm key={`${lead.id}:${lead.version}`} scope={scope} lead={lead} onSaved={onSaved} />
      )}{" "}
      {tab === "trials" && (
        <Trials scope={scope} lead={lead} timeZone={timeZone} onSaved={onSaved} />
      )}{" "}
      {lead.state === "open" && (
        <>
          <p>{t("convertHint")}</p>
          <Button
            className={button}
            onClick={() =>
              setCommand({
                operation: "lead_convert_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  lead_id: lead.id,
                },
              })
            }
          >
            {t("convert")}
          </Button>
          <CommandReview
            scope={scope}
            slot={`crm-lead:${lead.id}`}
            command={command}
            onBack={() => setCommand(null)}
            onDone={onSaved}
          >
            <p>{t("convertHint")}</p>
          </CommandReview>
        </>
      )}
    </section>
  );
}
