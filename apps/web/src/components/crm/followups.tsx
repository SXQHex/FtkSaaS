"use client";
import Link from "next/link";
import { personPath } from "../../lib/person-route";
import { leadPath } from "../../lib/lead-route";
import { useCallback, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import type { FollowupKind } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupScope } from "../../lib/studio-setup";
import { crmApi } from "../../lib/crm";
import { useRemote } from "../../lib/use-remote";
import { FlowError } from "../bookings/flow-controls";
import { control, button } from "./fields";
export function Followups({ scope, timeZone }: { scope: SetupScope; timeZone: string }) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    [kind, setKind] = useState<FollowupKind>("renewal_due"),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0);
  const load = useCallback(() => crmApi.followups(scope, kind, cursor), [scope, kind, cursor]);
  const result = useRemote(load, JSON.stringify([scope, kind, cursor, revision]));
  return (
    <section className="space-y-3" aria-label={t("followups")}>
      <h3>{t("followups")}</h3>
      <label>
        {t("kind")}
        <select
          className={control}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as FollowupKind);
            setCursor(undefined);
          }}
        >
          {["renewal_due", "inactive_student", "automation_followup"].map((k) => (
            <option value={k} key={k}>
              {t(k)}
            </option>
          ))}
        </select>
      </label>
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
          <ul>
            {result.data.items

              .map((r, i) => (
                <li className="rounded-md border p-3" key={r.id}>
                  <p>
                    <Link
                      className="inline-flex min-h-11 items-center underline"
                      href={
                        r.lead_id
                          ? leadPath(scope.orgId, scope.centerId!, r.person_id, r.lead_id)
                          : personPath(scope.orgId, scope.centerId!, r.person_id)
                      }
                    >
                      {r.subscriber_number
                        ? t("subscriber", { number: r.subscriber_number })
                        : t("candidate", { number: i + 1 })}{" "}
                      · {t(r.kind)}
                    </Link>
                  </p>
                  <p>
                    {f.dateTime(new Date(r.due_at), {
                      timeZone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {timeZone}
                  </p>
                </li>
              ))}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
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
