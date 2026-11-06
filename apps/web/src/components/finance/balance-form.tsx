"use client";
import { useId, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  balanceCommand,
  financeActionSlot,
  type BalanceOperation,
} from "../../lib/finance-actions";
import { effectMoney } from "../../lib/effect-money";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite } from "../bookings/flow-controls";
import { LocalTimeField } from "../programs/local-time-field";
export function BalanceForm({
  scope,
  view,
  debtId,
  timeZone,
  operation,
  onSaved,
}: {
  scope: SetupScope;
  view: FinanceView;
  debtId: string;
  timeZone: string;
  operation: BalanceOperation;
  onSaved: () => void;
}) {
  const t = useTranslations("finance"),
    flow = useTranslations("flows"),
    locale = useLocale(),
    format = useFormatter(),
    id = useId();
  const [localTime, setLocalTime] = useState(""),
    [offset, setOffset] = useState(""),
    [draft, setDraft] = useState<SetupCommand | null>(null),
    [invalid, setInvalid] = useState(false);
  const command = useSetupCommand(
    scope,
    financeActionSlot(operation, view.person_id, debtId),
    onSaved,
    onSaved,
  );
  const disabled = command.busy || !!command.pending;
  const debtIndex = view.debts.findIndex((row) => row.id === debtId);
  return (
    <div className="min-w-0 space-y-4">
      <SetupFeedback command={command} />
      <p className="text-sm text-muted-foreground">{t(`balanceHints.${operation}`)}</p>
      <form
        className="space-y-3"
        onChange={() => {
          setDraft(null);
          setInvalid(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          const data = new FormData(event.currentTarget);
          try {
            setDraft(
              balanceCommand(operation, scope, view, {
                amount: String(data.get("amount") ?? ""),
                debtId,
                direction: String(data.get("direction") ?? ""),
                reason: String(data.get("reason") ?? ""),
                localTime,
                timeZone,
                offset,
              }),
            );
            setInvalid(false);
          } catch {
            setDraft(null);
            setInvalid(true);
          }
        }}
      >
        <fieldset disabled={disabled} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>{t("actionAmount")}</Label>
            <Input id={`${id}-amount`} name="amount" inputMode="decimal" required />
          </div>
          {operation === "debt_adjust_v1" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-direction`}>{t("debtDirection")}</Label>
              <select
                id={`${id}-direction`}
                name="direction"
                required
                defaultValue=""
                className="min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">{t("choose")}</option>
                <option value="increase">{t("debtIncrease")}</option>
                <option value="decrease">{t("debtDecrease")}</option>
              </select>
            </div>
          )}
          {operation === "student_credit_refund_v1" && (
            <LocalTimeField
              label={t("refundTime")}
              value={localTime}
              choice={offset}
              timeZone={timeZone}
              onChange={setLocalTime}
              onChoice={setOffset}
            />
          )}
          {operation !== "student_credit_offset_v1" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-reason`}>{t("correctionReason")}</Label>
              <Input id={`${id}-reason`} name="reason" required maxLength={10000} />
            </div>
          )}
          <Button className="h-auto min-h-11 max-w-full whitespace-normal">{flow("review")}</Button>
        </fieldset>
      </form>
      {invalid && <p role="alert">{t("invalidBalanceAction")}</p>}
      {draft &&
        (draft.operation === "student_credit_refund_v1" ||
          draft.operation === "student_credit_offset_v1" ||
          draft.operation === "debt_adjust_v1") && (
          <ConfirmWrite command={draft} controller={command} onBack={() => setDraft(null)}>
            <p>{t(`balanceKinds.${draft.operation}`)}</p>
            <p>{effectMoney(draft.input.amount_minor, view.currency, locale)}</p>
            {debtIndex >= 0 && draft.operation !== "student_credit_refund_v1" && (
              <p>{t("debtNumber", { number: debtIndex + 1 })}</p>
            )}
            {draft.operation === "student_credit_offset_v1" ? (
              <p>{t("offsetVersion", { version: draft.input.expected_version })}</p>
            ) : (
              <p>{draft.input.reason}</p>
            )}
            {draft.operation === "student_credit_refund_v1" && (
              <p>
                {format.dateTime(new Date(draft.input.occurred_at), {
                  timeZone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {timeZone}
              </p>
            )}
            {draft.operation === "debt_adjust_v1" && (
              <p>{t(draft.input.direction === "increase" ? "debtIncrease" : "debtDecrease")}</p>
            )}
            <p className="text-sm">{t(`balanceHints.${draft.operation}`)}</p>
          </ConfirmWrite>
        )}
    </div>
  );
}
