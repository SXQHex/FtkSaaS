"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import type { LeadRecord } from "../../lib/crm";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { crmApi } from "../../lib/crm";
import { useRemote } from "../../lib/use-remote";

import type { SetupScope } from "../../lib/studio-setup";

import { FlowError } from "../bookings/flow-controls";

import { button } from "./fields";
import { ActivityForm } from "./activity-form";
export function Activities({
  scope,
  lead,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  lead: LeadRecord;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    [revision, setRevision] = useState(0),
    [cursor, setCursor] = useState<string>(),
    [selected, setSelected] = useState<ManagementStateView>();
  const load = useCallback(
    () =>
      crmApi.management(
        scope,
        { operation: "crm_activity_save_v1", key: { lead_id: lead.id } },
        cursor,
      ),
    [scope, lead.id, cursor],
  );
  const result = useRemote(load, JSON.stringify([scope, lead.id, cursor, revision]));
  function saved() {
    setSelected(undefined);
    setCursor(undefined);
    setRevision((n) => n + 1);
    onSaved();
  }
  return (
    <section className="space-y-4" aria-label={t("activities")}>
      <h4 className="font-semibold">{t("activities")}</h4>
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <>
          <ul className="space-y-3">
            {result.data.items.map((row) => {
              const v = row.current;
              if (v?.operation !== "crm_activity_save_v1") return null;
              return (
                <li key={row.entity!.id} className="rounded-md border p-3">
                  <p>
                    {v.values.kind && t(v.values.kind)} · {row.state && t(row.state)}
                  </p>
                  <p className="whitespace-pre-wrap">{v.values.note}</p>
                  <p>{v.values.outcome}</p>
                  {v.values.due_at && (
                    <p>
                      {f.dateTime(new Date(v.values.due_at), {
                        timeZone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {timeZone}
                    </p>
                  )}
                  <Button className={button} variant="outline" onClick={() => setSelected(row)}>
                    {t("editActivity")}
                  </Button>
                </li>
              );
            })}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => {
                setCursor(result.data!.next_cursor!);
                setSelected(undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      <ActivityForm
        key={`${selected?.entity?.id ?? "new"}:${revision}`}
        scope={scope}
        lead={lead}
        timeZone={timeZone}
        row={selected}
        onSaved={saved}
      />
    </section>
  );
}
