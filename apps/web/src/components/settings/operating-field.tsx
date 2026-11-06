"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { validate, v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import {
  operatingCommand,
  operatingFields,
  operatingSlot,
  operatingValue,
  settingsQuery,
  type OperatingApi,
  type OperatingKey,
  type OperatingTarget,
} from "../../lib/operating-settings";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
export function OperatingField({
  scope,
  target,
  field,
  source,
  api,
  onSaved,
  onRejected,
}: {
  scope: SetupScope;
  target: OperatingTarget;
  field: { key: OperatingKey; writable: boolean };
  source: Awaited<ReturnType<OperatingApi["read"]>>;
  api: OperatingApi;
  onSaved: () => void;
  onRejected: (code: string) => void;
}) {
  const t = useTranslations("operatingSettings"),
    id = useId(),
    current = operatingValue(source.view.values, field.key);
  const [text, setText] = useState(current == null ? "" : String(current)),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<SetupCommand | null>(null),
    [reset, setReset] = useState<Awaited<ReturnType<OperatingApi["reset"]>> | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!reset) return;
    const delay = Date.parse(reset.expires_at) - Date.now();
    const timer = setTimeout(
      () => {
        setReview(null);
        setError("PREVIEW_STALE");
      },
      Math.max(0, Math.min(delay, 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [reset]);
  const command = useSetupCommand(scope, operatingSlot(target), onSaved, onRejected),
    disabled = command.busy || !!command.pending || loading;
  function invalidate() {
    setReview(null);
    setReset(null);
    setError("");
  }
  return (
    <div className="space-y-4">
      <h4 className="font-semibold">{t(`fields.${field.key}`)}</h4>
      <p>
        {t(source.view.overridden_fields.some((key) => key === field.key) ? "local" : "default")}:{" "}
        {current == null ? t("unset") : String(current)}
      </p>
      {field.key === "program_duration_minutes" && (
        <p>
          {t("durationHint")}
          {source.view.scope === "center" &&
            source.view.program_duration_source &&
            ` · ${t(source.view.program_duration_source.kind)}`}
        </p>
      )}
      <SetupFeedback command={command} />
      {!field.writable ? (
        <p>{t("readonly")}</p>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (disabled) return;
              try {
                setReview(operatingCommand(scope, target, field.key, text, source, reason));
                setReset(null);
                setError("");
              } catch {
                setError("invalidSettings");
              }
            }}
            className="space-y-3"
          >
            <fieldset className="space-y-3" disabled={disabled}>
              <Label htmlFor={id}>{t("newValue")}</Label>
              <Input
                id={id}
                required={field.key === "program_duration_minutes"}
                type={
                  field.key === "program_duration_minutes"
                    ? "number"
                    : field.key.endsWith("email")
                      ? "email"
                      : "text"
                }
                min={field.key === "program_duration_minutes" ? 1 : undefined}
                max={field.key === "program_duration_minutes" ? 2147483647 : undefined}
                maxLength={
                  field.key === "program_duration_minutes" ? undefined : operatingFields[field.key]
                }
                value={text}
                onChange={(event) => {
                  invalidate();
                  setText(event.target.value);
                }}
              />
              <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
              <Input
                id={`${id}-reason`}
                required
                maxLength={10000}
                value={reason}
                onChange={(event) => {
                  invalidate();
                  setReason(event.target.value);
                }}
              />
              <Button type="submit">{t("review")}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!reason.trim()) {
                    setError("invalidSettings");
                    return;
                  }
                  invalidate();
                  setLoading(true);
                  try {
                    const preview = await api.reset(scope, target, field.key);
                    if (
                      preview.scope !== target ||
                      preview.version !== source.view.version ||
                      preview.fields.length !== 1 ||
                      preview.fields[0] !== field.key ||
                      !validate(preview.id) ||
                      !preview.token ||
                      !Number.isFinite(Date.parse(preview.expires_at)) ||
                      Date.parse(preview.expires_at) <= Date.now()
                    )
                      throw Error("invalidSettings");
                    setReset(preview);
                    setReview({
                      operation: "settings_reset_apply_v1",
                      input: {
                        ...settingsQuery(scope, target),
                        expected_version: preview.version,
                        operation_key: v7(),
                        reason,
                        preview: { id: preview.id, token: preview.token },
                      },
                    });
                  } catch (cause) {
                    setError(flowError(cause));
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {t("previewReset")}
              </Button>
            </fieldset>
          </form>
        </>
      )}
      {error &&
        (error === "invalidSettings" ? (
          <p role="alert">{t("invalidSettings")}</p>
        ) : (
          <FlowError code={error} />
        ))}
      {review && (
        <ConfirmWrite
          key={review.input.operation_key}
          command={review}
          controller={command}
          onBack={() => setReview(null)}
        >
          <p>{t(`fields.${field.key}`)}</p>
          <p>
            {t("before")}:{" "}
            {String((reset ? operatingValue(reset.before, field.key) : current) ?? t("unset"))}
          </p>
          <p>
            {t("after")}:{" "}
            {String(
              reset
                ? (operatingValue(reset.after, field.key) ?? t("unset"))
                : (operatingValue(
                    review.operation === "settings_update_v1" ? review.input.patch : {},
                    field.key,
                  ) ?? t("unset")),
            )}
          </p>
          <p>{reason}</p>
        </ConfirmWrite>
      )}
    </div>
  );
}
