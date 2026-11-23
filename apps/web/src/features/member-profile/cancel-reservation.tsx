import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { capturePrivateReadback, invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { invalidateMemberReservationViews } from "../member-reservations/member-reservations-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { MemberStateDialog } from "./member-action-sheet";
import {
  cancellationIntent,
  readCancellation,
  readCancellationReceipt,
  readCancellationResult,
  writeCancellation,
  type CancellationBase,
  type CancellationIntent,
  type CancellationResult,
} from "./cancellation";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";

type State =
  | "reading"
  | "ready"
  | "writing"
  | "unknown"
  | "pending"
  | "saved-unread"
  | "saved"
  | "stale"
  | "rejected";
export function CancelReservation({
  scope,
  personId,
  reservationId,
  sessionId,
  label,
  sourceAvailable,
  recoveryOnly = false,
  onClose,
  onRefresh,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  personId: string;
  reservationId: string;
  sessionId: string;
  label: string;
  sourceAvailable: boolean;
  recoveryOnly?: boolean;
  onClose: (saved: boolean) => void;
  onRefresh: (result: CancellationResult, assertCurrent: () => void) => Promise<void>;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    [state, setState] = useState<State>("reading"),
    [base, setBase] = useState<CancellationBase>(),
    [reason, setReason] = useState(""),
    [reasonError, setReasonError] = useState<string>(),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false);
  const intent = useRef<CancellationIntent | undefined>(undefined),
    primary = useRef<string | undefined>(undefined),
    ack = useRef(false),
    executing = useRef(false),
    mounted = useRef(true),
    terminal = useRef(false);
  const locked = ["writing", "unknown", "pending", "saved-unread"].includes(state);
  useBlocker({
    shouldBlockFn: () => !terminal.current && (executing.current || locked),
    enableBeforeUnload: locked,
    disabled: !locked,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const { accountId, orgId, centerId } = scope;
  const load = useCallback(async () => {
    if (recoveryOnly || terminal.current || executing.current) return;
    try {
      const next = await readCancellation(
        { accountId, orgId, centerId },
        personId,
        reservationId,
        sessionId,
      );
      if (mounted.current) {
        setBase(next);
        setState("ready");
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof BackendError && failure.code === "FORBIDDEN")
        setError(t(($) => $.memberProfile.cancelUnavailable));
      else if (onAccessLost(failure)) {
        terminal.current = true;
        intent.current = undefined;
      } else setError(t(($) => $.memberProfile.cancelUnavailable));
      setState("rejected");
    }
  }, [
    accountId,
    orgId,
    centerId,
    personId,
    reservationId,
    sessionId,
    onAccessLost,
    t,
    recoveryOnly,
  ]);
  useEffect(() => {
    if (recoveryOnly || intent.current) return;
    let active = true;
    void readCancellation({ accountId, orgId, centerId }, personId, reservationId, sessionId)
      .then((next) => {
        if (active) {
          setBase(next);
          setState("ready");
        }
      })
      .catch((failure) => {
        if (!active) return;
        if (failure instanceof BackendError && failure.code === "FORBIDDEN")
          setError(t(($) => $.memberProfile.cancelUnavailable));
        else if (onAccessLost(failure)) {
          terminal.current = true;
          intent.current = undefined;
        } else setError(t(($) => $.memberProfile.cancelUnavailable));
        setState("rejected");
      });
    return () => {
      active = false;
    };
  }, [
    accountId,
    orgId,
    centerId,
    personId,
    reservationId,
    sessionId,
    onAccessLost,
    t,
    recoveryOnly,
  ]);
  async function reread() {
    if (!intent.current || !ack.current) return;
    const assertCurrent = capturePrivateReadback(queries);
    const result = await readCancellationResult(intent.current, primary.current);
    assertCurrent();
    if (!mounted.current || terminal.current) return;
    const subject = [accountId, orgId, centerId, personId] as const;
    await Promise.all([
      invalidateMemberReservationViews(queries, scope, personId),
      invalidateCachedFamilies(queries, [
        ["profile-ledger", ...subject],
        ["profile-rights", ...subject],
      ]),
    ]);
    assertCurrent();
    await onRefresh(result, assertCurrent);
    assertCurrent();
    if (mounted.current && !terminal.current) setState("saved");
  }
  function failed(failure: unknown) {
    if (!mounted.current || terminal.current) return;
    if (onAccessLost(failure)) {
      terminal.current = true;
      intent.current = undefined;
      setState("rejected");
      return;
    }
    if (ack.current) setState("saved-unread");
    else if (
      failure instanceof BackendError &&
      [
        "OPERATION_IN_PROGRESS",
        "IDEMPOTENCY_PAYLOAD_MISMATCH",
        "OPERATION_RESULT_EXPIRED",
      ].includes(failure.code)
    )
      setState("pending");
    else if (failure instanceof BackendError && failure.code === "VERSION_CONFLICT") {
      intent.current = undefined;
      setBase(undefined);
      setState("stale");
    } else if (
      failure instanceof BackendError &&
      failure.code !== "TRANSPORT_ERROR" &&
      !failure.retryable
    ) {
      intent.current = undefined;
      setBase(undefined);
      setState("rejected");
    } else setState("unknown");
  }
  async function execute() {
    if (executing.current || terminal.current || !intent.current) return;
    executing.current = true;
    setBusy(true);
    setState("writing");
    try {
      if (!ack.current) {
        const result = await writeCancellation(intent.current);
        ack.current = true;
        primary.current = result.primary_id;
      }
      if (!mounted.current || terminal.current) return;
      setState("saved-unread");
      await reread();
    } catch (failure) {
      failed(failure);
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function confirm() {
    if (!base || !sourceAvailable || state !== "ready" || executing.current || terminal.current)
      return;
    try {
      intent.current = cancellationIntent(base, reason);
      setReasonError(undefined);
      void execute();
    } catch (failure) {
      if (failure instanceof z.ZodError)
        setReasonError(t(($) => $.memberProfile.cancelReasonError));
      else {
        setError(t(($) => $.memberProfile.cancelUnavailable));
        setState("rejected");
      }
    }
  }
  async function receipt() {
    if (executing.current || terminal.current || !intent.current) return;
    executing.current = true;
    setBusy(true);
    try {
      if (!ack.current) {
        const result = await readCancellationReceipt(intent.current);
        if (result.status === "succeeded" || result.status === "result_expired") {
          ack.current = true;
          primary.current = result.result_reference?.id;
        } else if (result.status === "failed_final") {
          intent.current = undefined;
          setBase(undefined);
          setState("rejected");
          return;
        } else {
          setState("pending");
          return;
        }
      }
      setState("saved-unread");
      await reread();
    } catch (failure) {
      if (!mounted.current || terminal.current) return;
      if (onAccessLost(failure)) {
        terminal.current = true;
        intent.current = undefined;
        setState("rejected");
      } else if (ack.current) setState("saved-unread");
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const message =
    state === "reading"
      ? t(($) => $.memberProfile.cancelReading)
      : state === "writing"
        ? t(($) => $.memberProfile.cancelWriting)
        : state === "saved"
          ? t(($) => $.memberProfile.cancelSaved)
          : state === "saved-unread"
            ? t(($) => $.memberProfile.cancelUnread)
            : state === "unknown"
              ? t(($) => $.finance.unknownWrite)
              : state === "pending"
                ? t(($) => $.finance.pending)
                : state === "stale"
                  ? t(($) => $.memberProfile.cancelStale)
                  : state === "rejected"
                    ? t(($) => $.memberProfile.cancelRejected)
                    : undefined;
  return (
    <MemberStateDialog
      action="cancelReservation"
      name={recoveryOnly ? "" : label}
      reason={recoveryOnly ? "" : reason}
      reasonError={recoveryOnly ? undefined : reasonError}
      pending={locked}
      readOnly={recoveryOnly || state === "saved"}
      completed={state === "saved"}
      onReason={(value) => {
        if (!recoveryOnly && !locked && state !== "saved") {
          setReason(value);
          setReasonError(undefined);
        }
      }}
      onClose={() => {
        if (!locked) onClose(state === "saved");
      }}
      onConfirm={!recoveryOnly && state === "ready" && sourceAvailable ? confirm : undefined}
      notice={
        <>
          <p className="text-sm text-muted-foreground">
            {t(($) => $.memberProfile.cancelPolicyHint)}
          </p>
          {(message || error) && (
            <Alert variant={error ? "destructive" : "default"}>
              <AlertDescription>{error ?? message}</AlertDescription>
            </Alert>
          )}
          {["unknown", "pending", "saved-unread"].includes(state) && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  void receipt();
                }}
              >
                {t(($) => $.finance.readResult)}
              </Button>
              {state === "unknown" && (
                <Button
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => {
                    void execute();
                  }}
                >
                  {t(($) => $.finance.retrySame)}
                </Button>
              )}
            </div>
          )}
          {!recoveryOnly && ["stale", "rejected"].includes(state) && (
            <Button
              variant="outline"
              isDisabled={!sourceAvailable}
              onPress={() => {
                setState("reading");
                setError(undefined);
                setBase(undefined);
                setReasonError(undefined);
                void load();
              }}
            >
              {t(($) => $.memberProfile.cancelReload)}
            </Button>
          )}
        </>
      }
    />
  );
}
