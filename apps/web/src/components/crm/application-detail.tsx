"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { ManagementStateView, PersonSummary } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { sourceVersion } from "../../lib/crm";

import type { SetupScope, SetupCommand } from "../../lib/studio-setup";

import { PersonPicker } from "./person-picker";
import { CommandReview } from "./command-review";
import { control, button } from "./fields";
export function ApplicationDetail({
  row,
  scope,
  timeZone,
  onSaved,
  destinations = [],
}: {
  row: ManagementStateView;
  scope: SetupScope;
  timeZone: string;
  destinations?: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    f = useFormatter(),
    [person, setPerson] = useState<PersonSummary>(),
    [targetCenter, setTargetCenter] = useState(""),
    [command, setCommand] = useState<SetupCommand | null>(null);
  const v =
    row.current?.operation === "public_application_review_v1" ? row.current.values : undefined;
  if (!v) return null;
  const source = v.source,
    channel = source && "channel" in source ? source.channel : "unknown";
  function review(action: "match_existing" | "create_candidate" | "close") {
    setCommand({
      operation: "public_application_review_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: v7(),
        application_id: row.entity!.id,
        expected_version: sourceVersion(row),
        action,
        ...(action === "match_existing" ? { person_id: person?.id } : {}),
      },
    });
  }
  return (
    <section className="space-y-3 rounded-md border p-4" aria-label={t("applicationDetails")}>
      <h4 className="font-semibold">{v.intake?.display_name ?? t("applicationDetails")}</h4>
      <p>{t.has(channel) ? t(channel) : t("unknown")}</p>
      <p>{v.intake?.phone ?? v.contact}</p>
      <p>{v.intake?.email}</p>
      <p>{v.intake?.interest}</p>
      <p className="whitespace-pre-wrap">{v.intake?.message}</p>
      {source && "external_form_id" in source && (
        <p>
          {t("providerForm")} {source.external_form_id} · {t("providerLead")}{" "}
          {source.external_lead_id}
        </p>
      )}
      {source && "form_key" in source && (
        <p>
          {t("form")} {source.form_key}
        </p>
      )}
      {source && "submitted_at" in source && source.submitted_at && (
        <p>
          {f.dateTime(new Date(source.submitted_at), {
            timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      <h5 className="font-semibold">{t("consents")}</h5>
      <ul>
        {v.intake?.consents.map((c, i) => (
          <li key={`${c.purpose}:${i}`}>
            {c.purpose} · {c.version} · {t(c.accepted ? "yes" : "no")} ·{" "}
            {f.dateTime(new Date(c.occurred_at), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </li>
        ))}
      </ul>
      {v.phone_matches && (
        <>
          <p>{t("matchHint")}</p>
          <ul>
            {v.phone_matches.map((m) => (
              <li key={m.person_id}>{m.display_name}</li>
            ))}
          </ul>
          {v.phone_matches_truncated && <p>{t("matchesTruncated")}</p>}
        </>
      )}
      {row.state === "pending" && scope.centerId && (
        <>
          <PersonPicker
            scope={scope}
            onSelect={(p) => {
              setPerson(p);
              setCommand(null);
            }}
          />
          {person && (
            <p>
              {person.display_name} ·{" "}
              {person.subscriber_number
                ? t("subscriber", { number: person.subscriber_number })
                : t("noSubscriber")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className={button} disabled={!person} onClick={() => review("match_existing")}>
              {t("matchExisting")}
            </Button>
            <Button className={button} variant="outline" onClick={() => review("create_candidate")}>
              {t("createCandidate")}
            </Button>
            <Button className={button} variant="outline" onClick={() => review("close")}>
              {t("closeApplication")}
            </Button>
          </div>
        </>
      )}
      {row.state === "pending" && !scope.centerId && (
        <div className="space-y-3">
          <p>{t("routingHint")}</p>
          <label>
            {t("targetCenter")}
            <select
              className={control}
              value={targetCenter}
              onChange={(e) => {
                setTargetCenter(e.target.value);
                setCommand(null);
              }}
            >
              <option value="">{t("choose")}</option>
              {destinations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            className={button}
            disabled={!destinations.some((c) => c.id === targetCenter)}
            onClick={() =>
              setCommand({
                operation: "public_application_review_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: null,
                  operation_key: v7(),
                  application_id: row.entity!.id,
                  expected_version: sourceVersion(row),
                  action: "assign_center",
                  target_center_id: targetCenter,
                },
              })
            }
          >
            {t("assignCenter")}
          </Button>
        </div>
      )}
      {v.routing_history && (
        <ul aria-label={t("routingHistory")}>
          {v.routing_history.map((h, i) => (
            <li key={i}>
              {destinations.find((c) => c.id === h.to_center_id)?.name ?? t("routedCenter")} ·{" "}
              {f.dateTime(new Date(h.occurred_at), {
                timeZone,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </li>
          ))}
        </ul>
      )}
      <CommandReview
        scope={scope}
        slot={`crm-application:${row.entity!.id}`}
        command={command}
        onBack={() => setCommand(null)}
        onDone={onSaved}
      >
        <p>{t("applicationHint")}</p>
        <p>{person?.display_name}</p>
      </CommandReview>
    </section>
  );
}
