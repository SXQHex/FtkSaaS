"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { crmApi, sourceVersion } from "../../lib/crm";
import { useRemote } from "../../lib/use-remote";
import { priceToMinor } from "../../lib/product-terms";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
import { CommandReview } from "./command-review";
import { Field, button } from "./fields";
type PublicationTarget =
  | { sessionId: string; eventId?: never }
  | { eventId: string; sessionId?: never };
export function Publication({
  scope,
  sessionId,
  eventId,
  onSaved,
}: { scope: SetupScope; onSaved: () => void } & PublicationTarget) {
  const t = useTranslations("crm"),
    [open, setOpen] = useState(false);
  return (
    <section className="space-y-3 border-t pt-4" aria-label={t("publication")}>
      <Button
        className={button}
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("publication")}
      </Button>
      {open && (
        <PublicationForm
          key={`${scope.orgId}:${scope.centerId}:${sessionId ?? eventId}`}
          scope={scope}
          {...(sessionId ? { sessionId } : { eventId: eventId! })}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
function PublicationForm({
  scope,
  sessionId,
  eventId,
  onSaved,
}: { scope: SetupScope; onSaved: () => void } & PublicationTarget) {
  const t = useTranslations("crm"),
    [revision, setRevision] = useState(0),
    [command, setCommand] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      crmApi.management(scope, {
        operation: "publication_set_v1",
        key: sessionId ? { session_id: sessionId } : { event_id: eventId },
      }),
    [scope, sessionId, eventId],
  );
  const result = useRemote(load, JSON.stringify([scope, sessionId, eventId, revision]));
  const row = result?.data?.items[0],
    details =
      row?.current?.operation === "publication_set_v1"
        ? row.current.values.public_details
        : undefined;
  return (
    <div className="space-y-3">
      <p>{t("publicationHint")}</p>
      <a
        className="underline underline-offset-4"
        href={`/p/${scope.orgId}${scope.centerId ? `?center=${scope.centerId}` : ""}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("publicCalendarLink")}
      </a>
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setCommand(null);
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />} {error && <FlowError code={error} />}{" "}
      {result?.data && (
        <>
          <p>{row?.state === "published" ? t("published") : t("unpublished")}</p>
          <form
            key={revision}
            className="space-y-3"
            onChange={() => setCommand(null)}
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const d = new FormData(e.currentTarget),
                  currency = String(d.get("currency")).trim().toUpperCase();
                setCommand({
                  operation: "publication_set_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    ...(sessionId ? { session_id: sessionId } : { event_id: eventId }),
                    published: true,
                    ...(row ? { expected_version: sourceVersion(row) } : {}),
                    public_details: {
                      title: String(d.get("title")).trim(),
                      venue_public_label: String(d.get("venue")).trim(),
                      currency,
                      fee_minor: priceToMinor(String(d.get("fee")), currency),
                      public_conditions: String(d.get("conditions")).trim(),
                    },
                  },
                });
                setError("");
              } catch (e) {
                setError(flowError(e));
              }
            }}
          >
            <Field name="title" label={t("publicTitle")} value={details?.title} required />
            <Field name="venue" label={t("venue")} value={details?.venue_public_label} required />
            <Field name="currency" label={t("currency")} value={details?.currency} required />
            <Field name="fee" label={t("fee")} required />
            <Field
              name="conditions"
              label={t("conditions")}
              value={details?.public_conditions}
              required
            />
            <Button className={button}>{t("publish")}</Button>
          </form>
          {row?.state === "published" && (
            <Button
              variant="outline"
              className={button}
              onClick={() =>
                setCommand({
                  operation: "publication_set_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    ...(sessionId ? { session_id: sessionId } : { event_id: eventId }),
                    expected_version: sourceVersion(row),
                    published: false,
                  },
                })
              }
            >
              {t("unpublish")}
            </Button>
          )}
          <CommandReview
            scope={scope}
            slot={`publication:${sessionId ?? eventId}`}
            command={command}
            onBack={() => setCommand(null)}
            onDone={() => {
              setCommand(null);
              setRevision((n) => n + 1);
              onSaved();
            }}
          >
            <p>{t("publicationHint")}</p>
            {command?.operation === "publication_set_v1" && (
              <p>
                {command.input.public_details?.title} ·{" "}
                {command.input.public_details?.venue_public_label} ·{" "}
                {t(command.input.published ? "publish" : "unpublish")}
              </p>
            )}
          </CommandReview>
        </>
      )}
    </div>
  );
}
