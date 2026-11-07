"use client";
import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { v7 } from "uuid";
import type { EventView, PersonSummary, Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { readEntitlements } from "../../lib/products";
import { useRemote } from "../../lib/use-remote";
import { bookingApi } from "../../lib/bookings";
import { eventPreviewMatches } from "../../lib/event-command";
import { effectMoney } from "../../lib/effect-money";
import { PersonChooser } from "../bookings/person-chooser";
import { SelfDocuments } from "../documents/self-documents";
import { ContextDocuments } from "../documents/context-documents";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { FinancePreviewReview } from "../finance/finance-preview-review";
import { PersonFinance } from "../finance/person-finance";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
import { button, control } from "./event-editor";
export function EventRegistration({
  scope,
  event,
  onSaved,
  selfPersonId,
}: {
  scope: SetupScope;
  event: EventView;
  onSaved: () => void;
  selfPersonId?: string;
}) {
  const t = useTranslations("events"),
    [person, setPerson] = useState<PersonSummary | null>(null);
  return (
    <section className="space-y-4">
      <h3>{t("registration")}</h3>
      <PersonChooser scope={scope} disabled={false} read={bookingApi.people} onSelect={setPerson} />
      {person && (
        <Registration
          key={`${event.id}:${person.id}:${event.version}`}
          scope={scope}
          event={event}
          person={person}
          onSaved={onSaved}
          isSelf={person.id === selfPersonId}
        />
      )}
    </section>
  );
}
function Registration({
  scope,
  event,
  person,
  onSaved,
  isSelf,
}: {
  scope: SetupScope;
  event: EventView;
  person: PersonSummary;
  onSaved: () => void;
  isSelf: boolean;
}) {
  const t = useTranslations("events"),
    [sale, setSale] = useState(""),
    [preparation, setPreparation] = useState<string>(),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rightsLoad = useCallback(
      () =>
        readEntitlements(scope, person.id).then((rows) => {
          if (rows.some((r) => r.person_id !== person.id)) throw Error("invalidEvent");
          return rows;
        }),
      [scope, person.id],
    ),
    rights = useRemote(rightsLoad, JSON.stringify([scope, person.id]));
  const command = useSetupCommand(scope, `event-register:${event.id}:${person.id}`, onSaved, () => {
    setPreview(null);
  });
  const eligibleIds =
    rights?.data?.filter((r) => r.sale_state === "active").map((r) => r.sale_id) ?? [];
  const disabled = busy || command.busy || !!command.pending;
  return (
    <section className="space-y-4">
      <p>
        {person.display_name}
        {person.subscriber_number ? ` · ${person.subscriber_number}` : ""}
      </p>
      <SetupFeedback command={command} />
      {rights?.error && <FlowError code={rights.error} />}
      <label className="block">
        {t("sale")}
        <select
          className={control}
          disabled={disabled || !!preparation}
          value={sale}
          onChange={(e) => {
            setSale(e.target.value);
            setPreview(null);
          }}
        >
          <option value="">{t("withoutPackage")}</option>
          {rights?.data
            ?.filter((r) => eligibleIds.includes(r.sale_id))
            .map((r, i) => (
              <option key={r.sale_id} value={r.sale_id}>
                {t("package", { number: i + 1 })} · {r.start_date}–{r.end_date}
              </option>
            ))}
        </select>
      </label>
      {event.terms.package_usage === "eligibility_only" && <p>{t("practiceHint")}</p>}
      {!sale &&
        event.terms.fee_minor !== "0" &&
        event.terms.package_usage !== "eligibility_only" && (
          <EventPayment
            scope={scope}
            event={event}
            person={person}
            onPrepared={(id) => {
              setPreparation(id);
              setPreview(null);
            }}
          />
        )}
      {error && <FlowError code={error} />}
      <Button
        className={button}
        disabled={disabled || (!!sale && !eligibleIds.includes(sale))}
        onClick={async () => {
          setBusy(true);
          setError("");
          setPreview(null);
          try {
            const p = await setupCall("event_registration_preview_v1", {
              org_id: scope.orgId,
              center_id: scope.centerId,
              event_id: event.id,
              person_id: person.id,
              ...(sale ? { sale_id: sale } : {}),
              ...(preparation ? { preparation_id: preparation } : {}),
            });
            if (!eventPreviewMatches(p, event.id, event.version)) throw Error("invalidEvent");
            setPreview(p);
          } catch (e) {
            setError(flowError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("reviewRegistration")}
      </Button>
      {isSelf && (
        <SelfDocuments
          scope={scope}
          context={{ gate: "event_registration", subject: { type: "events", id: event.id } }}
        />
      )}
      <ContextDocuments
        actorId={scope.actorId}
        query={{
          org_id: scope.orgId,
          center_id: scope.centerId,
          person_id: person.id,
          context: { gate: "event_registration", subject: { type: "events", id: event.id } },
        }}
      />
      {preview && (
        <FinancePreviewReview
          key={preview.id}
          timeZone={event.timezone}
          preview={preview}
          disabled={disabled}
          onBack={() => setPreview(null)}
          onApply={() => {
            if (!eventPreviewMatches(preview, event.id, event.version))
              return setError("PREVIEW_STALE");
            void command.run({
              operation: "event_register_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                event_id: event.id,
                person_id: person.id,
                preview: { id: preview.id, token: preview.token },
                ...(sale ? { sale_id: sale } : {}),
                ...(preparation ? { preparation_id: preparation } : {}),
              },
            });
          }}
        >
          <p>
            {event.name} · {person.display_name}
          </p>
          <p>{t("registrationHint")}</p>
        </FinancePreviewReview>
      )}
    </section>
  );
}
function EventPayment({
  scope,
  event,
  person,
  onPrepared,
}: {
  scope: SetupScope;
  event: EventView;
  person: PersonSummary;
  onPrepared: (id: string) => void;
}) {
  const t = useTranslations("events"),
    locale = useLocale(),
    [id, setId] = useState<string>(),
    [review, setReview] = useState(false),
    [revision, setRevision] = useState(0),
    command = useSetupCommand(scope, `event-payment:${event.id}:${person.id}`, (next) => {
      if (next) {
        setId(next);
        onPrepared(next);
      }
      setReview(false);
    });
  const load = useCallback(async () => {
      if (!id) return null;
      const p = await setupCall("event_payment_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        preparation_id: id,
      });
      if (
        p.id !== id ||
        p.person_id !== person.id ||
        p.event_id !== event.id ||
        p.center_id !== scope.centerId
      )
        throw Error("invalidEvent");
      return p;
    }, [id, scope, person.id, event.id]),
    result = useRemote(load, JSON.stringify([scope, id, revision]));
  return (
    <section className="space-y-3">
      <p>{t("paymentHint")}</p>
      <SetupFeedback command={command} />
      {!id && (
        <Button
          className={button}
          variant="outline"
          disabled={command.busy || !!command.pending}
          onClick={() => setReview(true)}
        >
          {t("preparePayment")}
        </Button>
      )}
      {review && !command.pending && (
        <ConfirmWrite
          controller={command}
          command={{
            operation: "event_payment_prepare_v1",
            input: {
              org_id: scope.orgId,
              center_id: scope.centerId,
              operation_key: v7(),
              event_id: event.id,
              person_id: person.id,
            },
          }}
          onBack={() => setReview(false)}
        >
          <p>
            {event.name} · {person.display_name}
          </p>
          <p>{t("paymentHint")}</p>
        </ConfirmWrite>
      )}
      {result?.error && <FlowError code={result.error} />}{" "}
      {id && (
        <Button className={button} variant="outline" onClick={() => setRevision((n) => n + 1)}>
          {t("reloadPayment")}
        </Button>
      )}
      {result?.data && (
        <>
          <p>
            {t(`paymentStates.${result.data.state}`)} · {t("remainingPayment")}:{" "}
            {effectMoney(result.data.remaining_minor, result.data.currency, locale)}
          </p>
          <p>
            {t("credit")}:{" "}
            {effectMoney(result.data.student_credit_available_minor, result.data.currency, locale)}
          </p>
          <PersonFinance scope={scope} personId={person.id} timeZone={event.timezone} management />
        </>
      )}
    </section>
  );
}
