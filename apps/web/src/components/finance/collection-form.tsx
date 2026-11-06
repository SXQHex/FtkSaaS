"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { collectionCommand } from "../../lib/collection-command";
import { effectMoney } from "../../lib/effect-money";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import type { useSetupCommand } from "../setup/setup-command";
import { LocalTimeField } from "../programs/local-time-field";
import { ConfirmWrite } from "../bookings/flow-controls";
export function CollectionForm({
  scope,
  view,
  timeZone,
  command,
}: {
  scope: SetupScope;
  view: FinanceView;
  timeZone: string;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("finance"),
    locale = useLocale(),
    id = useId();
  const [localTime, setLocalTime] = useState(""),
    [offset, setOffset] = useState(""),
    [method, setMethod] = useState(""),
    [allocation, setAllocation] = useState("");
  const [draft, setDraft] = useState<SetupCommand | null>(null),
    [invalid, setInvalid] = useState(false);
  const disabled = command.busy || !!command.pending;
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("collection")}>
      <h4 className="font-semibold">{t("collection")}</h4>
      <p className="text-sm text-muted-foreground">{t("collectionHint", { timeZone })}</p>
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
              collectionCommand(scope, view, {
                amount: String(data.get("amount") ?? ""),
                method,
                reference: String(data.get("reference") ?? ""),
                localTime,
                timeZone,
                offset,
                allocation,
                debtIds: data.getAll("debt").map(String),
                note: String(data.get("note") ?? ""),
              }),
            );
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>{t("amount")}</Label>
            <Input id={`${id}-amount`} name="amount" inputMode="decimal" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-method`}>{t("method")}</Label>
            <select
              className="min-h-11 w-full rounded-md border bg-background px-3"
              id={`${id}-method`}
              value={method}
              required
              onChange={(event) => setMethod(event.target.value)}
            >
              <option value="">{t("choose")}</option>
              {(["cash", "bank_transfer", "card_pos"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`methods.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-reference`}>{t("reference")}</Label>
            <Input
              id={`${id}-reference`}
              name="reference"
              required={!!method && method !== "cash"}
            />
          </div>
          <LocalTimeField
            label={t("occurredAt")}
            value={localTime}
            onChange={setLocalTime}
            choice={offset}
            onChoice={setOffset}
            timeZone={timeZone}
          />
          <div className="space-y-2">
            <Label htmlFor={`${id}-allocation`}>{t("allocation")}</Label>
            <select
              className="min-h-11 w-full rounded-md border bg-background px-3"
              id={`${id}-allocation`}
              value={allocation}
              required
              onChange={(event) => setAllocation(event.target.value)}
            >
              <option value="">{t("choose")}</option>
              <option value="automatic">{t("automatic")}</option>
              <option value="selected">{t("selected")}</option>
            </select>
          </div>
          {allocation === "selected" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("chooseDebts")}</legend>
              {view.debts.map((row, index) =>
                BigInt(row.remaining_minor) > 0n ? (
                  <label key={row.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" name="debt" value={row.id} />
                    {t("debtNumber", { number: index + 1 })} ·{" "}
                    {effectMoney(row.remaining_minor, view.currency, locale)}
                  </label>
                ) : null,
              )}
            </fieldset>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${id}-note`}>{t("note")}</Label>
            <Input id={`${id}-note`} name="note" />
          </div>
          <Button className="h-auto min-h-11 max-w-full whitespace-normal">
            {t("reviewCollection")}
          </Button>
        </fieldset>
      </form>
      {invalid && <p role="alert">{t("invalidCollection")}</p>}
      {draft?.operation === "collection_record_v1" && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={() => setDraft(null)}
        >
          <p className="font-semibold">
            {effectMoney(draft.input.amount_minor, draft.input.currency, locale)}
          </p>
          <p>
            {t(`methods.${draft.input.payment!.method}`)}
            {draft.input.payment?.reference && (
              <span className="block break-words">{draft.input.payment.reference}</span>
            )}
          </p>
          <p>
            {localTime} · {timeZone}
          </p>
          <p>
            {draft.input.debt_ids
              ? t("selectedCount", { count: draft.input.debt_ids.length })
              : t("automatic")}
          </p>
          <p>{t("allocationHint")}</p>
          {draft.input.note && <p className="break-words">{draft.input.note}</p>}
        </ConfirmWrite>
      )}
    </section>
  );
}
