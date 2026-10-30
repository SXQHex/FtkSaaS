"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { ApiFailure } from "../../lib/api";
import {
  isUncertainSetup,
  recoverSetup,
  sendSetupCommand,
  setupCall,
  setupStorageKey,
  type SetupCommand,
  type SetupScope,
} from "../../lib/studio-setup";

export function useSetupCommand(scope: SetupScope, slot: string, onSaved: () => void) {
  const [pending, setPending] = useState(() => recoverSetup(scope, slot));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const key = setupStorageKey(scope, slot);
  function clear() {
    sessionStorage.removeItem(key);
    setPending(null);
  }
  async function run(command?: SetupCommand) {
    if (lock.current || pending === "invalid") return;
    const record = pending || (command ? { command } : null);
    if (!record || record.blocked) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    let sent = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(record));
      setPending(record);
      sent = true;
      await sendSetupCommand(record.command);
      clear();
      setMessage("saved");
      onSaved();
    } catch (cause) {
      if (sent && !pending && !isUncertainSetup(cause) && cause instanceof ApiFailure) {
        try {
          clear();
        } catch {
          setPending("invalid");
        }
        setMessage(errorKey(cause.failure.error.code));
      } else {
        if (
          cause instanceof ApiFailure &&
          ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(
            cause.failure.error.code,
          )
        ) {
          record.blocked = true;
          try {
            sessionStorage.setItem(key, JSON.stringify(record));
            setPending({ ...record });
          } catch {
            setPending("invalid");
          }
        }
        setMessage(sent ? "uncertain" : "storageFailed");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (lock.current || !pending || pending === "invalid") return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await setupCall("operation_status_get_v1", {
        org_id: scope.orgId,
        operation: pending.command.operation,
        key: pending.command.input.operation_key,
      });
      if (result.status === "succeeded") {
        clear();
        setMessage("saved");
        onSaved();
      } else if (result.status === "failed_final") {
        clear();
        setMessage("failed");
      } else if (result.status === "result_expired") {
        const blocked = { ...pending, blocked: true };
        sessionStorage.setItem(key, JSON.stringify(blocked));
        setPending(blocked);
        setMessage("uncertain");
      } else setMessage("uncertain");
    } catch {
      setMessage("uncertain");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { pending, busy, message, run, check };
}
export function errorKey(code: string) {
  return [
    "FORBIDDEN",
    "NOT_FOUND",
    "VERSION_CONFLICT",
    "PLAN_LIMIT_REACHED",
    "PLAN_FEATURE_UNAVAILABLE",
    "SUBSCRIPTION_NOT_STARTED",
    "BILLING_OPERATION_RESTRICTED",
    "POLICY_NOT_CONFIGURED",
    "OPEN_OPERATIONS_EXIST",
    "RESERVATION_EXISTS",
    "VALIDATION_FAILED",
    "AUTH_REQUIRED",
    "SESSION_REVOKED",
    "RESOURCE_CONFLICT",
  ].includes(code)
    ? code
    : "failed";
}
export function SetupFeedback({ command }: { command: ReturnType<typeof useSetupCommand> }) {
  const t = useTranslations("setup");
  return (
    <div className="space-y-3 text-sm">
      {command.message &&
        (command.message === "saved" ? (
          <output className="block" aria-live="polite">
            {t("saved")}
          </output>
        ) : (
          <p role="alert">{t(command.message)}</p>
        ))}
      {command.pending && (
        <div className="space-y-3 rounded-lg border p-4">
          <p>{t(command.pending === "invalid" ? "storageFailed" : "pending")}</p>
          {command.pending !== "invalid" && (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={command.busy}
                onClick={() => void command.check()}
              >
                {t("check")}
              </Button>
              {!command.pending.blocked && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={command.busy}
                  onClick={() => void command.run()}
                >
                  {t("retrySame")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
