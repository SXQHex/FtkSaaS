"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { recoverSetup, setupStorageKey, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
const operations = [
  "class_save_v1",
  "class_assignment_set_v1",
  "program_apply_v1",
  "session_create_v1",
  "session_cancel_apply_v1",
  "replacement_session_create_v1",
];
// Reads only this actor/organization/center journal, independently of catalog permissions.
function slots(scope: SetupScope) {
  const prefix = setupStorageKey(scope, "");
  try {
    const matches: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const slot = key.slice(prefix.length);
      const pending = recoverSetup(scope, slot);
      if (pending && (pending === "invalid" || operations.includes(pending.command.operation)))
        matches.push(slot);
    }
    return matches;
  } catch {
    return null;
  }
}
export function ProgramRecovery({
  scope,
  onSaved,
  onReplacementCreated,
}: {
  scope: SetupScope;
  onSaved: () => void;
  onReplacementCreated?: (id: string) => void;
}) {
  const t = useTranslations("program");
  const [pendingSlots] = useState(() => slots(scope));
  if (pendingSlots?.length === 0) return null;
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label={t("recovery")}>
      <h3 className="font-semibold">{t("recovery")}</h3>
      <p className="text-sm text-muted-foreground">{t("recoveryHint")}</p>
      {pendingSlots ? (
        pendingSlots.map((slot) => (
          <RecoveryItem
            key={slot}
            scope={scope}
            slot={slot}
            onSaved={onSaved}
            onReplacementCreated={onReplacementCreated}
          />
        ))
      ) : (
        <p role="alert">{t("recoveryUnavailable")}</p>
      )}
    </section>
  );
}
function RecoveryItem({
  scope,
  slot,
  onSaved,
  onReplacementCreated,
}: {
  scope: SetupScope;
  slot: string;
  onSaved: () => void;
  onReplacementCreated?: (id: string) => void;
}) {
  const pending = recoverSetup(scope, slot);
  const command = useSetupCommand(scope, slot, (id) => {
    if (
      id &&
      pending &&
      pending !== "invalid" &&
      pending.command.operation === "replacement_session_create_v1"
    )
      onReplacementCreated?.(id);
    onSaved();
  });
  return <SetupFeedback command={command} />;
}
