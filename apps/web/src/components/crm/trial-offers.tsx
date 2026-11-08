"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import type { LeadRecord } from "../../lib/crm";
import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";

import { crmApi } from "../../lib/crm";
import { useRemote } from "../../lib/use-remote";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { FlowError } from "../bookings/flow-controls";
import { CommandReview } from "./command-review";

import { button } from "./fields";
export function TrialOffers({
  scope,
  lead,
  productId,
  sessionId,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  lead: LeadRecord;
  productId: string;
  sessionId?: string;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0);
  const load = useCallback(
    () =>
      crmApi.management(
        scope,
        {
          operation: "trial_offer_create_v1",
          key: {
            lead_id: lead.id,
            product_version_id: productId,
            ...(sessionId ? { session_id: sessionId } : {}),
          },
        },
        cursor,
      ),
    [scope, lead.id, productId, sessionId, cursor],
  );
  const result = useRemote(
    load,
    JSON.stringify([scope, lead.id, productId, sessionId, cursor, revision]),
  );
  return (
    <section className="space-y-3" aria-label={t("offers")}>
      <h5>{t("offers")}</h5>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <>
          <ul>
            {result.data.items.map((r, i) => (
              <li key={r.entity!.id}>
                <p>
                  {t("offer", { number: i + 1 })} ·{" "}
                  {r.state && t.has(r.state) ? t(r.state) : t("unknown")}
                </p>
                {r.current?.operation === "trial_offer_create_v1" &&
                  r.current.values.expires_at && (
                    <p>
                      {f.dateTime(new Date(r.current.values.expires_at), {
                        timeZone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                <ConfirmTrial
                  row={r}
                  scope={scope}
                  onSaved={() => {
                    setRevision((n) => n + 1);
                    onSaved();
                  }}
                />
              </li>
            ))}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              variant="outline"
              className={button}
              onClick={() => setCursor(result.data!.next_cursor!)}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
function ConfirmTrial({
  row,
  scope,
  onSaved,
}: {
  row: ManagementStateView;
  scope: SetupScope;
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    [command, setCommand] = useState<SetupCommand | null>(null);
  const v = row.current?.operation === "trial_offer_create_v1" ? row.current.values : undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const active = row.state === "active" && !!v?.expires_at && Date.parse(v.expires_at) > now;
  return (
    <>
      <Button
        variant="outline"
        className={button}
        disabled={!active}
        onClick={() =>
          setCommand({
            operation: "trial_registration_confirm_v1",
            input: {
              org_id: scope.orgId,
              center_id: scope.centerId,
              operation_key: v7(),
              offer_id: row.entity!.id,
            },
          })
        }
      >
        {t("confirmTrial")}
      </Button>
      <CommandReview
        scope={scope}
        slot={`crm-offer:${row.entity!.id}`}
        command={active ? command : null}
        onBack={() => setCommand(null)}
        onDone={onSaved}
      >
        <p>{t("trialHint")}</p>
      </CommandReview>
    </>
  );
}
