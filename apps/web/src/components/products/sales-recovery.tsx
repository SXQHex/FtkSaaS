"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { validate } from "uuid";
import { recoverSetup, setupStorageKey, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";

function pendingSales(scope: SetupScope, personId?: string) {
  try {
    const prefix = setupStorageKey(scope, "sale-renew:");
    const slots: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const target = key.slice(prefix.length);
      if (!validate(target) || (personId && target !== personId)) continue;
      const slot = `sale-renew:${target}`;
      const record = recoverSetup(scope, slot);
      if (
        record &&
        (record === "invalid" ||
          ["sale_apply_v1", "sale_renew_apply_v1"].includes(record.command.operation))
      )
        slots.push(slot);
    }
    return slots.sort();
  } catch {
    return null;
  }
}

// A previous write does not depend on permission to read the student or catalog again.
export function SalesRecovery(props: {
  scope: SetupScope;
  personId?: string;
  onSaved: () => void;
}) {
  return <RecoveryList key={JSON.stringify([props.scope, props.personId])} {...props} />;
}
function RecoveryList({
  scope,
  personId,
  onSaved,
}: {
  scope: SetupScope;
  personId?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("flows");
  const setup = useTranslations("setup");
  const [slots] = useState(() => pendingSales(scope, personId));
  const Heading = personId ? "h3" : "h2";
  if (slots?.length === 0) return null;
  return (
    <section
      className="min-w-0 space-y-3 rounded-lg border p-4 wrap-anywhere"
      aria-label={t("salesRecovery")}
    >
      <Heading className="font-semibold">{t("salesRecovery")}</Heading>
      <p className="text-sm text-muted-foreground">{t("salesRecoveryHint")}</p>
      {slots ? (
        slots.map((slot, index) => (
          <RecoveryItem key={slot} scope={scope} slot={slot} number={index + 1} onSaved={onSaved} />
        ))
      ) : (
        <p role="alert">{setup("storageFailed")}</p>
      )}
    </section>
  );
}
function RecoveryItem({
  scope,
  slot,
  number,
  onSaved,
}: {
  scope: SetupScope;
  slot: string;
  number: number;
  onSaved: () => void;
}) {
  const t = useTranslations("flows");
  const heading = useRef<HTMLParagraphElement>(null);
  const command = useSetupCommand(scope, slot, onSaved);
  useEffect(() => {
    if (command.message === "saved" || command.message === "failed") heading.current?.focus();
  }, [command.message]);
  return (
    <div className="min-w-0 space-y-2 border-t pt-3">
      <p ref={heading} tabIndex={-1} className="text-sm font-medium outline-none">
        {t("recoveryNumber", { number })}
      </p>
      <SetupFeedback command={command} />
    </div>
  );
}
