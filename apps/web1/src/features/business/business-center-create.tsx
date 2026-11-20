import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { settingsSubscriptionQuery } from "../settings/settings-subscription";
import {
  centerCreateIntent,
  centerCreateReceipt,
  centerDraftSchema,
  readCreatedCenter,
  writeCenter,
} from "../workspace/center-create";

export function BusinessCenterCreate({
  scope,
  quotaReached,
  onLockChange,
}: {
  scope: ClientScope;
  quotaReached: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const id = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const timezoneInput = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [invalid, setInvalid] = useState<"name" | "timezone">();
  const [intent, setIntent] = useState<ReturnType<typeof centerCreateIntent>>();
  const [accepted, setAccepted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quotaRejected, setQuotaRejected] = useState(false);
  const command = useMemberCommand({
    write: async (intent: Parameters<typeof writeCenter>[0]) => {
      try {
        return await writeCenter(intent);
      } catch (error) {
        if (error instanceof BackendError && error.code === "PLAN_LIMIT_REACHED")
          setQuotaRejected(true);
        throw error;
      }
    },
    readReceipt: centerCreateReceipt,
    readResult: readCreatedCenter,
    onAccessLost: () => false,
    onRefresh: async () => {
      setSaved(true);
      await client.invalidateQueries({ queryKey: ["workspace", scope.accountId] });
      // The live quota is refreshed when the confirmation closes, after the command lock clears.
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  const title = t(($) => $.businessCenters.add);
  const quotaMessage = t(($) => $.businessCenters.quotaReached);
  function close() {
    if (command.locked) return;
    command.reset();
    setIntent(undefined);
    setAccepted(false);
    setQuotaRejected(false);
    if (quotaRejected) void client.invalidateQueries({ queryKey: ["workspace", scope.accountId] });
    if (saved || quotaRejected)
      void client.invalidateQueries({ queryKey: settingsSubscriptionQuery(scope).queryKey });
    if (saved) {
      setOpen(false);
      setSaved(false);
      setName("");
      setTimezone("");
    }
  }
  function prepare() {
    const parsed = centerDraftSchema.safeParse({ name, timezone });
    if (!parsed.success) {
      const missing = parsed.error.issues.some((issue) => issue.path[0] === "name")
        ? "name"
        : "timezone";
      setInvalid(missing);
      (missing === "name" ? nameInput : timezoneInput).current?.focus();
      return;
    }
    setIntent(centerCreateIntent(scope, parsed.data));
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3">
        <Button
          onPress={() => {
            if (!quotaReached) setOpen(!open);
          }}
          aria-expanded={open && !quotaReached}
          aria-disabled={quotaReached || undefined}
          aria-describedby={quotaReached ? id + "-quota" : undefined}
          isDisabled={command.locked}
          variant={quotaReached ? "outline" : "default"}
        >
          {title}
        </Button>
        <p id={id + "-quota"} role="status" className="min-w-0 text-sm text-muted-foreground">
          {quotaReached ? quotaMessage : null}
        </p>
      </div>
      {open && !quotaReached && (
        <form
          className="max-w-xl space-y-3 rounded-lg border p-4"
          method="post"
          noValidate
          aria-label={title}
          onSubmit={(event) => {
            event.preventDefault();
            prepare();
          }}
        >
          <Field>
            <FieldLabel htmlFor={id + "-name"}>{t(($) => $.businessCenters.center)}</FieldLabel>
            <Input
              id={id + "-name"}
              ref={nameInput}
              required
              value={name}
              maxLength={200}
              aria-invalid={invalid === "name"}
              aria-describedby={invalid === "name" ? id + "-name-error" : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setInvalid(undefined);
              }}
            />
            {invalid === "name" && (
              <FieldError id={id + "-name-error"}>
                {t(($) => $.businessCenters.required)}
              </FieldError>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor={id + "-tz"}>{t(($) => $.businessCenters.timezone)}</FieldLabel>
            <NativeSelect
              id={id + "-tz"}
              ref={timezoneInput}
              required
              value={timezone}
              aria-invalid={invalid === "timezone"}
              aria-describedby={invalid === "timezone" ? id + "-tz-error" : undefined}
              onChange={(event) => {
                setTimezone(event.target.value);
                setInvalid(undefined);
              }}
            >
              <NativeSelectOption value="">
                {t(($) => $.businessCenters.chooseTimezone)}
              </NativeSelectOption>
              {["UTC", ...Intl.supportedValuesOf("timeZone")].map((zone) => (
                <NativeSelectOption key={zone}>{zone}</NativeSelectOption>
              ))}
            </NativeSelect>
            {invalid === "timezone" && (
              <FieldError id={id + "-tz-error"}>{t(($) => $.businessCenters.required)}</FieldError>
            )}
          </Field>
          <Button type="submit" isDisabled={command.locked}>
            {t(($) => $.businessCenters.review)}
          </Button>
        </form>
      )}
      {intent && (
        <SettingsReviewDialog
          open
          title={title}
          description={t(($) => $.businessCenters.addEffect)}
          rows={[{ id: "center", title: intent.name, detail: intent.timezone }]}
          accepted={accepted}
          onAccepted={setAccepted}
          locked={command.locked}
          onClose={close}
          onApply={command.state === "ready" ? () => void command.start(intent) : undefined}
          recoveryActions={
            quotaRejected ? (
              <p role="status" className="text-sm text-destructive">
                {quotaMessage}
              </p>
            ) : (
              <EventCommandNotice command={command} onReload={close} />
            )
          }
        />
      )}
    </div>
  );
}
