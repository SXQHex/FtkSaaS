"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { CashSummary, Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  correctionInput,
  correctionCommand,
  type CorrectionApi,
} from "../../lib/collection-correction";
import type { SetupInput, SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
import { LocalTimeField } from "../programs/local-time-field";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { CorrectionReview } from "./correction-review";
export function CorrectionForm({
  scope,
  movement,
  timeZone,
  onSaved,
  api,
}: {
  scope: SetupScope;
  movement: CashSummary;
  timeZone: string;
  onSaved: () => void;
  api: CorrectionApi;
}) {
  const t = useTranslations("finance"),
    id = useId();
  const [localTime, setLocalTime] = useState(""),
    [offset, setOffset] = useState("");
  const [request, setRequest] = useState<SetupInput<"collection_correct_preview_v1"> | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const command = useSetupCommand(scope, `collection-correct:${movement.id}`, onSaved, onSaved);
  const disabled = command.busy || !!command.pending;
  function reset() {
    setRequest(null);
    setPreview(null);
    setError("");
    setLoading(false);
  }
  useEffect(() => {
    if (!request) return;
    let active = true;
    void api
      .preview(request)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, request]);
  return (
    <div className="min-w-0 space-y-4">
      <SetupFeedback command={command} />
      <p className="text-sm text-muted-foreground">{t("correctionHint", { timeZone })}</p>
      <form
        className="space-y-3"
        onChange={reset}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || loading) return;
          const data = new FormData(event.currentTarget);
          reset();
          try {
            setRequest(
              correctionInput(scope, movement, {
                amount: String(data.get("amount") ?? ""),
                direction: String(data.get("direction") ?? ""),
                reason: String(data.get("reason") ?? ""),
                localTime,
                timeZone,
                offset,
              }),
            );
            setLoading(true);
          } catch {
            setError("invalidFinance");
          }
        }}
      >
        <fieldset disabled={disabled} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>{t("correctionAmount")}</Label>
            <Input id={`${id}-amount`} name="amount" inputMode="decimal" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-direction`}>{t("correctionDirection")}</Label>
            <select
              id={`${id}-direction`}
              name="direction"
              className="min-h-11 w-full rounded-md border bg-background px-3"
              required
              defaultValue=""
            >
              <option value="">{t("choose")}</option>
              <option value="increase">{t("increase")}</option>
              <option value="decrease">{t("decrease")}</option>
            </select>
          </div>
          <LocalTimeField
            label={t("correctionTime")}
            value={localTime}
            choice={offset}
            timeZone={timeZone}
            onChange={setLocalTime}
            onChoice={setOffset}
          />
          <div className="space-y-2">
            <Label htmlFor={`${id}-reason`}>{t("correctionReason")}</Label>
            <Input id={`${id}-reason`} name="reason" maxLength={10000} required />
          </div>
          <Button disabled={loading} className="h-auto min-h-11 whitespace-normal">
            {t("reviewCorrection")}
          </Button>
        </fieldset>
      </form>
      {loading && <output aria-live="polite">{t("loading")}</output>}
      {error &&
        (error === "invalidFinance" ? (
          <p role="alert">{t("invalidFinance")}</p>
        ) : (
          <FlowError code={error} />
        ))}
      {preview && request && (
        <CorrectionReview
          key={preview.id}
          timeZone={timeZone}
          preview={preview}
          request={request}
          disabled={disabled}
          onBack={reset}
          onApply={() => {
            const write = correctionCommand(scope, preview);
            reset();
            void command.run(write);
          }}
        />
      )}
    </div>
  );
}
