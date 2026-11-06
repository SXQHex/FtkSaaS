"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { ApiFailure } from "../../lib/api";
import {
  isUncertainSetup,
  recoverSetup,
  sendSetupCommand,
  setupCall,
  setupStorageKey,
  type PendingSetup,
  type SetupCommand,
  type SetupScope,
} from "../../lib/studio-setup";

export function useSetupCommand(
  scope: SetupScope,
  slot: string,
  onSaved: (primaryId?: string) => void,
  onRejected?: (code: string) => void,
) {
  const [pending, setPending] = useState(() => recoverSetup(scope, slot));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const key = setupStorageKey(scope, slot);
  function ownsRecord(expected: PendingSetup | null) {
    let current: unknown;
    try {
      const raw = sessionStorage.getItem(key);
      current = raw === null ? null : JSON.parse(raw);
    } catch {
      setPending("invalid");
      setMessage("storageFailed");
      return false;
    }
    if (JSON.stringify(current) !== JSON.stringify(expected)) {
      setPending("invalid");
      setMessage("storageChanged");
      return false;
    }
    return true;
  }
  function clear(expected: PendingSetup) {
    if (!ownsRecord(expected)) return false;
    sessionStorage.removeItem(key);
    setPending(null);
    return true;
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
      if (!ownsRecord(pending)) return;
      sessionStorage.setItem(key, JSON.stringify(record));
      setPending(record);
      sent = true;
      const result = await sendSetupCommand(record.command);
      if (!mounted.current) return;
      if (!clear(record)) return;
      setMessage("saved");
      onSaved(result?.primary_id);
    } catch (cause) {
      if (!mounted.current) return;
      if (sent && !ownsRecord(record)) return;
      if (sent && !pending && !isUncertainSetup(cause) && cause instanceof ApiFailure) {
        try {
          if (!clear(record)) return;
        } catch {
          setPending("invalid");
        }
        setMessage(errorKey(cause.failure.error.code));
        onRejected?.(cause.failure.error.code);
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
      if (mounted.current) setBusy(false);
    }
  }
  async function check() {
    if (lock.current || !pending || pending === "invalid") return;
    lock.current = true;
    setBusy(true);
    try {
      if (!ownsRecord(pending)) return;
      const result = await setupCall("operation_status_get_v1", {
        org_id: scope.orgId,
        operation: pending.command.operation,
        key: pending.command.input.operation_key,
      });
      if (!mounted.current || !ownsRecord(pending)) return;
      if (
        result.operation !== pending.command.operation ||
        result.key !== pending.command.input.operation_key
      ) {
        setMessage("uncertain");
        return;
      }
      if (result.status === "succeeded") {
        if (!clear(pending)) return;
        setMessage("saved");
        onSaved(result.result_reference?.id);
      } else if (result.status === "failed_final") {
        if (!clear(pending)) return;
        setMessage("failed");
      } else if (result.status === "result_expired") {
        const blocked = { ...pending, blocked: true };
        setPending(blocked);
        sessionStorage.setItem(key, JSON.stringify(blocked));
        setMessage("uncertain");
      } else setMessage("uncertain");
    } catch {
      if (mounted.current && ownsRecord(pending)) setMessage("uncertain");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { pending, busy, message, run, check };
}
export function errorKey(code: string) {
  return [
    "CAPACITY_FULL",
    "DOCUMENT_REQUIRED",
    "ENTITLEMENT_UNAVAILABLE",
    "CREDIT_LIMIT_EXCEEDED",
    "QUOTA_EXCEEDED",
    "CLASS_ACCESS_DENIED",
    "PARTICIPATION_BLOCKED",
    "INVALID_STATE_TRANSITION",
    "FORBIDDEN",
    "NOT_FOUND",
    "VERSION_CONFLICT",
    "PREVIEW_STALE",
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
        <div className="space-y-3 rounded-lg border p-3 sm:p-4">
          <p>
            {t(
              command.pending === "invalid"
                ? "storageFailed"
                : command.busy
                  ? "processing"
                  : "pending",
            )}
          </p>
          {command.pending !== "invalid" && (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="h-auto min-h-11 max-w-full whitespace-normal"
                variant="outline"
                disabled={command.busy}
                onClick={() => void command.check()}
              >
                {t("check")}
              </Button>
              {!command.pending.blocked && (
                <Button
                  type="button"
                  className="h-auto min-h-11 max-w-full whitespace-normal"
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
