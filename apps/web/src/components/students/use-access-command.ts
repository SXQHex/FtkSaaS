"use client";
import { useEffect, useRef, useState } from "react";
import { ApiFailure } from "../../lib/api";
import { studentError, uncertainStudentChange, type StudentScope } from "../../lib/students";
import {
  accessStorageKey,
  recoverAccess,
  type AccessActions,
  type AccessOperation,
  type PendingAccess,
} from "../../lib/person-access";
export function useAccessCommand(
  scope: StudentScope,
  personId: string,
  operation: AccessOperation,
  actions: AccessActions,
  onSaved: () => void,
  onRejected: () => void,
) {
  const key = accessStorageKey(scope, personId, operation);
  const [pending, setPending] = useState(() => recoverAccess(key, scope, operation));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replayReady, setReplayReady] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function persist(value: PendingAccess) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      setPending(value);
    } catch (cause) {
      setPending("invalid");
      setError("storageInvalid");
      throw cause;
    }
  }
  function clear() {
    try {
      sessionStorage.removeItem(key);
      setPending(null);
      return true;
    } catch {
      setPending("invalid");
      setError("storageInvalid");
      return false;
    }
  }
  function committed() {
    if (clear()) {
      setError("");
      setReplayReady(false);
      onSaved();
    }
  }
  async function save(value: PendingAccess, replay = false) {
    if (locked.current || value.blocked || pending === "invalid") return;
    locked.current = true;
    setBusy(true);
    setError("");
    let sent = false;
    try {
      persist(value);
      sent = true;
      setReplayReady(true);
      await actions.save(value.command);
      if (mounted.current) committed();
    } catch (cause) {
      if (!mounted.current) return;
      const code = studentError(cause);
      if (!sent) {
        setPending("invalid");
        setError("storageInvalid");
      } else if (replay || uncertainStudentChange(cause)) {
        try {
          persist({
            ...value,
            blocked:
              value.blocked ||
              ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code),
          });
        } catch {
          setPending("invalid");
          setError("storageInvalid");
          return;
        }
        setError(code);
      } else if (clear()) {
        setError(code);
        onRejected();
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function check(value: PendingAccess) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setReplayReady(false);
    setError("");
    try {
      const result = await actions.status(
        scope.orgId,
        operation,
        value.command.input.operation_key,
      );
      if (!mounted.current) return;
      if (result.operation !== operation || result.key !== value.command.input.operation_key)
        throw new Error("Unexpected access receipt");
      if (result.status === "succeeded") committed();
      else if (result.status === "failed_final") {
        if (clear()) {
          setError("failedFinal");
          onRejected();
        }
      } else {
        if (result.status === "result_expired") persist({ ...value, blocked: true });
        else if (!value.blocked && ["in_progress", "failed_retryable"].includes(result.status))
          setReplayReady(true);
        setError(result.status);
      }
    } catch (cause) {
      if (mounted.current) {
        if (
          cause instanceof ApiFailure &&
          cause.failure.error.code === "NOT_FOUND" &&
          !value.blocked
        )
          setReplayReady(true);
        setError(studentError(cause));
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { pending, error, busy, replayReady, save, check };
}
