"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { discoverPendingOperations, type PendingOperation } from "../../lib/pending-operations";
import { SetupFeedback, useSetupCommand } from "./setup-command";
export function PendingOperations(props: { actorId: string; onSaved: () => void }) {
  return <PendingOperationsList key={props.actorId} {...props} />;
}
function PendingOperationsList({ actorId, onSaved }: { actorId: string; onSaved: () => void }) {
  const t = useTranslations("pendingOperations");
  const setup = useTranslations("setup");
  const [items] = useState(() => discoverPendingOperations(actorId));
  return (
    <section
      aria-label={t("title")}
      className="mb-6 min-w-0 space-y-4 border-t py-4 wrap-anywhere sm:rounded-xl sm:border sm:p-5"
    >
      <h2 className="font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {items === null ? (
        <p role="alert">{setup("storageFailed")}</p>
      ) : items.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        items.map((item, index) => (
          <PendingOperationItem
            key={`${item.scope.orgId}:${item.scope.centerId}:${item.slot}`}
            item={item}
            number={index + 1}
            onSaved={onSaved}
          />
        ))
      )}
    </section>
  );
}
function PendingOperationItem({
  item,
  number,
  onSaved,
}: {
  item: PendingOperation;
  number: number;
  onSaved: () => void;
}) {
  const t = useTranslations("pendingOperations");
  const heading = useRef<HTMLHeadingElement>(null);
  const command = useSetupCommand(item.scope, item.slot, onSaved);
  useEffect(() => {
    if (command.message === "saved" || command.message === "failed") heading.current?.focus();
  }, [command.message]);
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 ref={heading} tabIndex={-1} className="text-sm font-medium outline-none">
        {t("item", { number, kind: t(item.kind) })}
      </h3>
      <SetupFeedback command={command} />
    </div>
  );
}
