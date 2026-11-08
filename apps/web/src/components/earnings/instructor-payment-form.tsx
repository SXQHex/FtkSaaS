"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { EarningView, P03PaymentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
import { paymentCommand } from "../../lib/earnings";
import { localTimeChoices } from "../../lib/session-change";
import { NativeCommandReview } from "../setup/native-command-review";
import { FlowError, flowError } from "../bookings/flow-controls";
const button = "h-auto min-h-11 max-w-full whitespace-normal";
export function InstructorPaymentForm({
  scope,
  personId,
  timeZone,
  rows,
  payment,
  onSaved,
  onCancel,
}: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  rows: EarningView[];
  payment?: P03PaymentView;
  onSaved: (code?: string) => void;
  onCancel: () => void;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("earnings"),
    locale = useLocale(),
    format = useFormatter(),
    id = useId();
  const [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState(payment?.currency ?? ""),
    [localTime, setLocalTime] = useState(""),
    [offset, setOffset] = useState(""),
    [reason, setReason] = useState(""),
    [direction, setDirection] = useState<"increase" | "decrease">("increase"),
    [selected, setSelected] = useState<string[]>([]),
    [draft, setDraft] = useState<ReturnType<typeof paymentCommand> | null>(null),
    [error, setError] = useState("");
  let choices: ReturnType<typeof localTimeChoices> = [];
  try {
    if (localTime) choices = localTimeChoices(localTime, timeZone);
  } catch {
    choices = [];
  }
  return (
    <section
      aria-label={t(payment ? "correctPayment" : "recordPayment")}
      className="space-y-3 rounded-md border p-3"
    >
      <h4 className="font-semibold">{t(payment ? "correctPayment" : "recordPayment")}</h4>
      <p className="text-sm text-muted-foreground">{t("paymentHint")}</p>
      {error && <FlowError code={error} />}
      {!draft ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setDraft(
                paymentCommand(scope, personId, rows, {
                  amount,
                  currency,
                  localTime,
                  timeZone,
                  offset,
                  earningIds: selected,
                  payment,
                  direction,
                  reason,
                }),
              );
              setError("");
            } catch (cause) {
              setError(flowError(cause));
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>{t("amount")}</Label>
            <Input
              id={`${id}-amount`}
              value={amount}
              required
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-currency`}>{t("currency")}</Label>
            <Input
              id={`${id}-currency`}
              value={currency}
              required
              maxLength={3}
              readOnly={!!payment}
              onChange={(e) => {
                setCurrency(e.target.value.toUpperCase());
                setSelected([]);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-time`}>{t("occurredAt")}</Label>
            <Input
              id={`${id}-time`}
              type="datetime-local"
              value={localTime}
              required
              onChange={(e) => {
                setLocalTime(e.target.value);
                setOffset("");
              }}
            />
            <p className="text-sm">{timeZone}</p>
          </div>
          {choices.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-offset`}>{t("offset")}</Label>
              <select
                id={`${id}-offset`}
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                required
              >
                <option value="">{t("choose")}</option>
                {choices.map((choice) => (
                  <option key={choice.instant} value={choice.instant}>
                    {format.dateTime(new Date(choice.instant), {
                      timeZone,
                      timeZoneName: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </option>
                ))}
              </select>
            </div>
          )}
          {payment ? (
            <>
              <p className="text-sm wrap-anywhere">
                {t("paymentId")} {payment.id} · {t("version", { version: payment.version })}
              </p>
              <Label htmlFor={`${id}-direction`}>{t("direction")}</Label>
              <select
                id={`${id}-direction`}
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={direction}
                onChange={(e) => setDirection(e.target.value as typeof direction)}
              >
                <option value="increase">{t("increase")}</option>
                <option value="decrease">{t("decrease")}</option>
              </select>
              <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
              <Input
                id={`${id}-reason`}
                value={reason}
                required
                maxLength={10000}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          ) : (
            <fieldset className="space-y-2">
              <legend>{t("selectedEarnings")}</legend>
              {rows
                .filter(
                  (r) =>
                    r.previous_id === null &&
                    r.currency === currency &&
                    BigInt(r.remaining_minor) > 0n,
                )
                .map((row) => (
                  <label key={row.id} className="flex min-h-11 items-start gap-2 wrap-anywhere">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, row.id] : s.filter((x) => x !== row.id),
                        )
                      }
                    />
                    <span>
                      {row.id} · {effectMoney(row.remaining_minor, row.currency, locale)}
                    </span>
                  </label>
                ))}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className={button} type="submit">
              {t("review")}
            </Button>
            <Button className={button} type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <NativeCommandReview
          key={draft.command.input.operation_key}
          scope={scope}
          slot={draft.slot}
          command={draft.command}
          onSaved={onSaved}
          onBack={() => setDraft(null)}
        >
          <p>
            {t(payment ? "correctPayment" : "recordPayment")}:{" "}
            {effectMoney(
              draft.command.operation === "instructor_payment_record_v1"
                ? draft.command.input.amount_minor
                : draft.command.input.correction.amount_minor,
              currency,
              locale,
            )}
          </p>
          <p>
            {localTime} · {timeZone}
          </p>
          {draft.command.operation === "instructor_payment_correct_v1" ? (
            <>
              <p>{t(draft.command.input.correction.direction)}</p>
              <p>{draft.command.input.reason}</p>
            </>
          ) : (
            <ul>
              {draft.command.input.earning_ids.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          )}
        </NativeCommandReview>
      )}
    </section>
  );
}
