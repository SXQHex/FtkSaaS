"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "./setup-command";
import { ConfirmWrite } from "../bookings/flow-controls";
export function NativeCommandReview({
  scope,
  slot,
  command,
  children,
  expiresAt,
  onSaved,
  onBack,
}: {
  scope: SetupScope;
  slot: string;
  command: SetupCommand;
  children: ReactNode;
  expiresAt?: string;
  onSaved: (code?: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("flows"),
    [now, setNow] = useState(Date.now);
  const controller = useSetupCommand(
    scope,
    slot,
    () => onSaved(),
    (code) => onSaved(code),
  );
  const failed = useRef(false);
  useEffect(() => {
    if (controller.message === "failed" && !controller.pending && !failed.current) {
      failed.current = true;
      onSaved("OPERATION_FAILED");
    }
  }, [controller.message, controller.pending, onSaved]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  const expired = !!expiresAt && Date.parse(expiresAt) <= now;
  return (
    <div className="min-w-0 space-y-3 wrap-anywhere">
      <SetupFeedback command={controller} />
      {expired && !controller.pending ? (
        <>
          <p role="alert">{t("errors.OFFER_UNAVAILABLE")}</p>
          <Button
            variant="outline"
            className="h-auto min-h-11 max-w-full whitespace-normal"
            onClick={onBack}
          >
            {t("back")}
          </Button>
        </>
      ) : (
        !controller.pending &&
        controller.message !== "failed" && (
          <ConfirmWrite command={command} controller={controller} onBack={onBack}>
            {children}
          </ConfirmWrite>
        )
      )}
    </div>
  );
}
