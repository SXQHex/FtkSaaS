"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useCallback, useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { readSubscription } from "../../lib/plan-downgrade";
import { subscriptionProof } from "../../lib/subscription-actions";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { useRemote } from "../../lib/use-remote";
import { priceToMinor } from "../../lib/product-terms";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
const control = "min-h-11 w-full rounded-md border bg-background px-3";
export function SubscriptionBilling({ scope }: { scope: SetupScope }) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("subscription"),
    locale = useLocale(),
    f = useFormatter();
  const [revision, setRevision] = useState(0),
    [target, setTarget] = useState("");
  const load = useCallback(() => readSubscription(scope), [scope]),
    source = useRemote(load, JSON.stringify([scope, revision]));
  const refresh = () => {
    setTarget("");
    setRevision((n) => n + 1);
  };
  const selected = source?.data?.billing?.period_change_options.find((p) => p.id === target);
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("title")}>
      <h3 className="font-semibold">{t("title")}</h3>
      <Button variant="outline" onClick={refresh}>
        {t("refresh")}
      </Button>
      {!source ? (
        <output>{t("loading")}</output>
      ) : source.error ? (
        <FlowError code={source.error} />
      ) : (
        source.data && (
          <>
            <p>
              {t("renewal")}: {t(source.data.cancel_at_period_end ? "stopped" : "enabled")}
            </p>
            {source.data.period_end && (
              <p>
                {t("periodEnd")}:{" "}
                {f.dateTime(new Date(source.data.period_end), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
            {source.data.billing && (
              <p>
                {t("current")}:{" "}
                {effectMoney(
                  source.data.billing.current.amount_minor,
                  source.data.billing.current.currency,
                  locale,
                )}
              </p>
            )}
            <SubscriptionAction
              key={`renewal:${revision}`}
              scope={scope}
              slot="subscription-renewal"
              onSaved={refresh}
              label={t("changeRenewal")}
              prepare={async () => {
                const p = await subscriptionProof(scope, "subscription_renewal_set_v1");
                if (p.version !== source.data!.subscription_version || typeof p.renew !== "boolean")
                  throw Error("VERSION_CONFLICT");
                return {
                  operation: "subscription_renewal_set_v1",
                  input: {
                    org_id: scope.orgId,
                    operation_key: v7(),
                    expected_version: p.version,
                    renew: !p.renew,
                  },
                };
              }}
            />
            <label className="block space-y-2">
              {t("period")}
              <select
                className={control}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {source.data.billing?.period_change_options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.period)} · {effectMoney(p.amount_minor, p.currency, locale)}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <SubscriptionAction
                key={`${target}:${revision}`}
                scope={scope}
                slot={`subscription-period:${target}`}
                onSaved={refresh}
                label={t("review")}
                prepare={async () => {
                  const p = await subscriptionProof(
                    scope,
                    "subscription_period_change_request_v1",
                    selected,
                  );
                  if (p.version !== source.data!.subscription_version || !p.period)
                    throw Error("VERSION_CONFLICT");
                  return {
                    operation: "subscription_period_change_request_v1",
                    input: {
                      org_id: scope.orgId,
                      operation_key: v7(),
                      ...p.period,
                      expected_version: p.version,
                    },
                  };
                }}
              />
            )}
            <p>{t("periodHint")}</p>
            <PaymentNotice
              key={revision}
              scope={scope}
              currency={source.data.billing?.current.currency}
            />
          </>
        )
      )}
    </section>
  );
}
function SubscriptionAction({
  scope,
  slot,
  onSaved,
  label,
  prepare,
}: {
  scope: SetupScope;
  slot: string;
  onSaved: () => void;
  label: string;
  prepare: () => Promise<SetupCommand>;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("subscription"),
    locale = useLocale(),
    f = useFormatter(),
    live = useRef(true);
  const [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    command = useSetupCommand(scope, slot, onSaved);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return (
    <div className="space-y-3">
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={busy || command.busy || !!command.pending}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setReview(null);
          setError("");
          try {
            const c = await prepare();
            if (live.current) setReview(c);
          } catch (e) {
            if (live.current) setError(flowError(e));
          } finally {
            if (live.current) setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {review && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          {review.operation === "subscription_period_change_request_v1" ? (
            <p>
              {effectMoney(review.input.amount_minor, review.input.currency, locale)} ·{" "}
              {f.dateTime(new Date(review.input.effective_at), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : (
            review.operation === "subscription_renewal_set_v1" && (
              <p>{t(review.input.renew ? "enabled" : "stopped")}</p>
            )
          )}
        </ConfirmWrite>
      )}
    </div>
  );
}
function PaymentNotice({ scope, currency }: { scope: SetupScope; currency?: string }) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("subscription"),
    locale = useLocale(),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const command = useSetupCommand(scope, "subscription-payment", () => setReview(null));
  return (
    <section className="space-y-3 border-t pt-4">
      <h4>{t("payment")}</h4>
      <p>{t("paymentHint")}</p>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (command.busy || command.pending) return;
          try {
            const d = new FormData(e.currentTarget),
              amount = String(d.get("amount")),
              reference = String(d.get("reference")).trim(),
              date = new Date(String(d.get("date")));
            if (
              !currency ||
              !/^\d+(?:[.,]\d+)?$/.test(amount) ||
              !reference ||
              !Number.isFinite(date.getTime())
            )
              throw Error("invalidPlanChange");
            setReview({
              operation: "saas_payment_submit_v1",
              input: {
                org_id: scope.orgId,
                operation_key: v7(),
                amount_minor: (() => {
                  const minor = priceToMinor(amount, currency);
                  if (BigInt(minor) <= 0n) throw Error("invalidPlanChange");
                  return minor;
                })(),
                currency,
                reference,
                occurred_at: date.toISOString(),
              },
            });
            setError("");
          } catch (e) {
            setError(flowError(e));
          }
        }}
        onChange={() => setReview(null)}
      >
        <fieldset className="space-y-3" disabled={command.busy || !!command.pending || !currency}>
          <label className="block">
            {t("minorAmount", { currency: currency ?? "" })}
            <Input name="amount" inputMode="decimal" required pattern="[0-9]+([.,][0-9]+)?" />
          </label>
          <label className="block">
            {t("reference")}
            <Input name="reference" required />
          </label>
          <label className="block">
            {t("date")}
            <Input name="date" type="datetime-local" required />
          </label>
          <Button className="h-auto min-h-11 max-w-full whitespace-normal">{t("review")}</Button>
        </fieldset>
      </form>
      {review?.operation === "saas_payment_submit_v1" && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          <p>
            {effectMoney(review.input.amount_minor, review.input.currency, locale)} ·{" "}
            {review.input.reference}
          </p>
          <p>{t("paymentHint")}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
