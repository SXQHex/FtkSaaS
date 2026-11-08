"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { SettingsFieldKey } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import type { SetupScope, SetupCommand, SetupInput } from "../../lib/studio-setup";
import { editorQuery } from "../../lib/settings-editor";
import type { DeliveryTarget } from "../../lib/delivery-settings";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
import { ConfirmWrite } from "../bookings/flow-controls";
export function HistoryRestore({
  scope,
  target,
  version,
  historyId,
  field,
  onSaved,
}: {
  scope: SetupScope;
  target: DeliveryTarget;
  version: number;
  historyId: string;
  field: SettingsFieldKey;
  onSaved: () => void;
}) {
  const t = useTranslations("settingsEditor"),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<SetupCommand | null>(null),
    command = useSetupCommand(scope, `settings-editor:${target}`, onSaved);
  return (
    <section className="space-y-3">
      <SetupFeedback command={command} />
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (command.busy || command.pending || !reason.trim()) return;
          setReview({
            operation: "settings_update_v1",
            input: {
              ...editorQuery(scope, target),
              operation_key: v7(),
              expected_version: version,
              patch: {},
              history_source: { id: historyId, fields: [field] },
              reason: reason.trim(),
            } as SetupInput<"settings_update_v1">,
          });
        }}
      >
        <label className="block">
          {t("reason")}
          <Input
            required
            maxLength={1000}
            disabled={command.busy || !!command.pending}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReview(null);
            }}
          />
        </label>
        <Button variant="outline" disabled={command.busy || !!command.pending}>
          {t("restore")}
        </Button>
      </form>
      {review && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          <p>{t("restoreHint")}</p>
          <p>{t.has(`labels.${field}`) ? t(`labels.${field}`) : t("value")}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
