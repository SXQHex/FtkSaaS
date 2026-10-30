"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Operations } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { browserClient } from "../../lib/supabase/client";
import { ApiFailure } from "../../lib/api";
import { accountCall, accountError, type AccountInput } from "../../lib/account";

type ProfileCommand = {
  operation: "account_profile_update_v1";
  input: AccountInput<"account_profile_update_v1">;
};
type LabelCommand = {
  operation: "account_session_label_v1";
  input: AccountInput<"account_session_label_v1">;
};
type RevokeCommand = {
  operation: "account_sessions_revoke_v1";
  input:
    | { operation_key: string; mode: "selected"; session_id: string }
    | { operation_key: string; mode: "current" | "others" };
};
type DeleteCommand = {
  operation: "account_delete_apply_v1";
  input: Omit<AccountInput<"account_delete_apply_v1">, "reauth">;
};
export type AccountCommand = ProfileCommand | LabelCommand | RevokeCommand | DeleteCommand;
type Pending = { command: AccountCommand; blocked?: boolean };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const accountStorageKey = (actor: string, slot: string) =>
  `ftksaas:account:${actor}:${slot}`;
export function recoverAccountCommand(actor: string, slot: string): Pending | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(accountStorageKey(actor, slot));
    if (!raw) return null;
    const value = JSON.parse(raw);
    const command = value?.command;
    const input = command?.input;
    if (
      !input ||
      !uuid.test(input.operation_key) ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean")
    )
      return "invalid";
    let allowed: string[];
    switch (command.operation) {
      case "account_profile_update_v1":
        allowed = [
          "operation_key",
          "expected_version",
          "display_name",
          "given_name",
          "family_name",
          "unverified_phone",
          "photo",
        ];
        if (
          !Number.isSafeInteger(input.expected_version) ||
          input.expected_version < 1 ||
          typeof input.display_name !== "string" ||
          !input.display_name.trim()
        )
          return "invalid";
        for (const name of ["given_name", "family_name", "unverified_phone"])
          if (input[name] !== undefined && input[name] !== null && typeof input[name] !== "string")
            return "invalid";
        if (
          input.photo !== undefined &&
          input.photo !== null &&
          (typeof input.photo.data_base64 !== "string" ||
            !["image/png", "image/jpeg", "image/webp"].includes(input.photo.mime) ||
            !/^[a-f0-9]{64}$/.test(input.photo.checksum))
        )
          return "invalid";
        break;
      case "account_session_label_v1":
        allowed = ["operation_key", "session_id", "expected_version", "label"];
        if (
          typeof input.session_id !== "string" ||
          !Number.isSafeInteger(input.expected_version) ||
          input.expected_version < 0 ||
          !(input.label === null || typeof input.label === "string")
        )
          return "invalid";
        break;
      case "account_sessions_revoke_v1":
        allowed = ["operation_key", "mode", ...(input.mode === "selected" ? ["session_id"] : [])];
        if (
          !["current", "others", "selected"].includes(input.mode) ||
          (input.mode === "selected" && typeof input.session_id !== "string")
        )
          return "invalid";
        break;
      case "account_delete_apply_v1":
        allowed = ["operation_key", "preview"];
        if (
          !uuid.test(input.preview?.id) ||
          typeof input.preview?.token !== "string" ||
          !input.preview.token
        )
          return "invalid";
        break;
      default:
        return "invalid";
    }
    if (Object.keys(input).some((key) => !allowed.includes(key))) return "invalid";
    return value;
  } catch {
    return "invalid";
  }
}
export function useAccountCommand(
  actor: string,
  slot: string,
  onCommitted: () => void,
  nativeUserId?: string,
) {
  const [pending, setPending] = useState(() => recoverAccountCommand(actor, slot));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const key = accountStorageKey(actor, slot);
  function clear() {
    sessionStorage.removeItem(key);
    setPending(null);
  }
  async function run(command?: AccountCommand, reauth?: string) {
    if (lock.current || pending === "invalid") return;
    const saved = pending || (command ? { command } : null);
    if (!saved || saved.blocked) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    let submitted = false;
    let currentRevoked = false;
    try {
      // Save before sending. Proofs/passwords never enter the recovery record.
      if (saved.command.operation === "account_delete_apply_v1") {
        if (!nativeUserId) throw new Error("missingNativeIdentity");
        sessionStorage.setItem(`ftksaas:account-deletion-recovery:${nativeUserId}`, actor);
      }
      sessionStorage.setItem(key, JSON.stringify(saved));
      setPending(saved);
      const cmd = saved.command;
      if (
        (cmd.operation === "account_delete_apply_v1" ||
          (cmd.operation === "account_sessions_revoke_v1" && cmd.input.mode === "others")) &&
        !reauth
      ) {
        setMessage("reauthNeeded");
        return;
      }
      submitted = true;
      switch (cmd.operation) {
        case "account_profile_update_v1":
          await accountCall(cmd.operation, cmd.input);
          break;
        case "account_session_label_v1":
          await accountCall(cmd.operation, cmd.input);
          break;
        case "account_sessions_revoke_v1": {
          const result = await accountCall(cmd.operation, {
            ...cmd.input,
            ...(cmd.input.mode === "others" ? { reauth } : {}),
          } as AccountInput<"account_sessions_revoke_v1">);
          currentRevoked = result.current_revoked;
          break;
        }
        case "account_delete_apply_v1": {
          const result = await accountCall(cmd.operation, { ...cmd.input, reauth: reauth! });
          if (!nativeUserId) throw new Error("missingNativeIdentity");
          sessionStorage.setItem(`ftksaas:account-deletion-job:${nativeUserId}`, result.job_id);
          break;
        }
      }
      clear();
      setMessage("saved");
      onCommitted();
      if (currentRevoked) {
        try {
          const result = await browserClient().auth.signOut({ scope: "local" });
          if (result.error) setMessage("SESSION_REVOKED");
        } catch {
          setMessage("SESSION_REVOKED");
        }
      }
    } catch (cause) {
      const definite =
        cause instanceof ApiFailure &&
        !cause.failure.error.retryable &&
        ![
          "OPERATION_IN_PROGRESS",
          "OPERATION_RESULT_EXPIRED",
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
          "RESULT_NOT_CONFIRMED",
          "SERVICE_UNAVAILABLE",
          "TEMPORARY_FAILURE",
        ].includes(cause.failure.error.code);
      if (submitted && definite && !pending) {
        try {
          clear();
        } catch {
          setPending("invalid");
        }
        setMessage(accountError(cause));
      } else {
        if (
          cause instanceof ApiFailure &&
          ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(
            cause.failure.error.code,
          )
        ) {
          saved.blocked = true;
          try {
            sessionStorage.setItem(key, JSON.stringify(saved));
            setPending({ ...saved });
          } catch {
            setPending("invalid");
          }
        }
        setMessage(submitted ? "uncertain" : "storageFailed");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function check() {
    if (!pending || pending === "invalid" || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await accountCall("operation_status_get_v1", {
        operation: pending.command.operation,
        key: pending.command.input.operation_key,
      });
      if (result.status === "succeeded") {
        if (
          pending.command.operation === "account_delete_apply_v1" &&
          nativeUserId &&
          result.result_reference
        )
          sessionStorage.setItem(
            `ftksaas:account-deletion-job:${nativeUserId}`,
            result.result_reference.id,
          );
        clear();
        setMessage("saved");
        onCommitted();
        if (
          pending.command.operation === "account_sessions_revoke_v1" &&
          pending.command.input.mode === "current"
        ) {
          try {
            const signedOut = await browserClient().auth.signOut({ scope: "local" });
            if (signedOut.error) setMessage("SESSION_REVOKED");
          } catch {
            setMessage("SESSION_REVOKED");
          }
        }
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
export function CommandFeedback({
  command,
  sensitive = false,
}: {
  command: ReturnType<typeof useAccountCommand>;
  sensitive?: boolean;
}) {
  const t = useTranslations("account");
  return (
    <div className="space-y-3">
      {command.message && (
        <p role={command.message === "saved" ? "status" : "alert"}>{t(command.message)}</p>
      )}
      {command.pending && (
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <p>{t(command.pending === "invalid" ? "storageFailed" : "pendingCommand")}</p>
          {command.pending !== "invalid" && (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={command.busy}
                onClick={() => void command.check()}
              >
                {t("checkResult")}
              </Button>
              {!sensitive && !command.pending.blocked && (
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
export type SessionPage = Operations["account_sessions_list_v1"]["response"]["data"];
