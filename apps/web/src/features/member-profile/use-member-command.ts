import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import { capturePrivateReadback } from "../../lib/cache-invalidation";
import type { Mutation, OperationStatusView } from "@ftksaas/api-contracts";

export function useMemberCommand<Intent, Result>({
  write,
  readReceipt,
  readResult,
  onRefresh,
  onAccessLost,
}: {
  // Some native operations acknowledge with a typed domain view. Adapters only extract its real primary ID.
  write: (intent: Intent) => Promise<Pick<Mutation, "primary_id">>;
  readReceipt?: (intent: Intent) => Promise<OperationStatusView>;
  readResult: (intent: Intent, id?: string) => Promise<Result>;
  onRefresh?: (result: Result, assertCurrent: () => void) => Promise<void>;
  onAccessLost: (error: unknown) => boolean;
}) {
  const queries = useQueryClient();
  const [state, setState] = useState<
    "ready" | "writing" | "unknown" | "pending" | "saved-unread" | "saved" | "stale" | "rejected"
  >("ready");
  const [busy, setBusy] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const intent = useRef<Intent | undefined>(undefined),
    acknowledged = useRef(false),
    primary = useRef<string | undefined>(undefined),
    executing = useRef(false),
    mounted = useRef(true),
    terminal = useRef(false);
  const locked = !unavailable && (busy || ["unknown", "pending", "saved-unread"].includes(state));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useBlocker({
    shouldBlockFn: () =>
      !terminal.current &&
      (executing.current ||
        Boolean(intent.current && !["saved", "stale", "rejected"].includes(state))),
    enableBeforeUnload: locked,
    disabled: !locked,
  });
  function abandon() {
    terminal.current = true;
    intent.current = undefined;
    primary.current = undefined;
    acknowledged.current = false;
    setUnavailable(true);
    setState("rejected");
  }
  async function reread() {
    if (!intent.current || !acknowledged.current) return;
    const assertCurrent = capturePrivateReadback(queries);
    try {
      const result = await readResult(intent.current, primary.current);
      if (!mounted.current || terminal.current) return;
      assertCurrent();
      await onRefresh?.(result, assertCurrent);
      assertCurrent();
    } catch (error) {
      assertCurrent();
      throw error;
    }
    if (mounted.current && !terminal.current) setState("saved");
  }
  function failed(error: unknown) {
    if (!mounted.current || terminal.current) return;
    if (onAccessLost(error)) {
      abandon();
      return;
    }
    if (acknowledged.current) setState("saved-unread");
    else if (
      error instanceof BackendError &&
      [
        "OPERATION_IN_PROGRESS",
        "IDEMPOTENCY_PAYLOAD_MISMATCH",
        "OPERATION_RESULT_EXPIRED",
      ].includes(error.code)
    )
      setState("pending");
    else if (
      error instanceof BackendError &&
      ["VERSION_CONFLICT", "PREVIEW_STALE"].includes(error.code)
    ) {
      intent.current = undefined;
      setState("stale");
    } else if (
      error instanceof BackendError &&
      error.code !== "TRANSPORT_ERROR" &&
      !error.retryable
    ) {
      intent.current = undefined;
      setState("rejected");
    } else setState("unknown");
  }
  async function execute() {
    if (terminal.current || executing.current || !intent.current) return;
    executing.current = true;
    setBusy(true);
    setState("writing");
    try {
      if (!acknowledged.current) {
        const assertCurrent = capturePrivateReadback(queries);
        const result = await write(intent.current).catch((error: unknown) => {
          assertCurrent();
          throw error;
        });
        primary.current = result.primary_id;
        acknowledged.current = true;
      }
      if (!mounted.current || terminal.current) return;
      setState("saved-unread");
      await reread();
    } catch (error) {
      failed(error);
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function start(next: Intent) {
    if (!mounted.current || terminal.current || executing.current || intent.current) return;
    intent.current = structuredClone(next);
    acknowledged.current = false;
    primary.current = undefined;
    await execute();
  }
  async function recoverReceipt() {
    if (
      terminal.current ||
      executing.current ||
      !intent.current ||
      (!acknowledged.current && !readReceipt)
    )
      return;
    executing.current = true;
    setBusy(true);
    try {
      if (!acknowledged.current && readReceipt) {
        const assertCurrent = capturePrivateReadback(queries);
        const receipt = await readReceipt(intent.current).catch((error: unknown) => {
          assertCurrent();
          throw error;
        });
        assertCurrent();
        if (receipt.status === "succeeded" || receipt.status === "result_expired") {
          acknowledged.current = true;
          primary.current = receipt.result_reference?.id;
        } else if (receipt.status === "failed_final") {
          intent.current = undefined;
          setState("rejected");
          return;
        } else {
          setState("pending");
          return;
        }
      }
      setState("saved-unread");
      await reread();
    } catch (error) {
      // A failed status *read* never proves that an unknown writer was rejected.
      if (!mounted.current || terminal.current) return;
      if (onAccessLost(error)) abandon();
      else if (acknowledged.current) setState("saved-unread");
      else setState((previous) => (previous === "pending" ? "pending" : "unknown"));
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function reset() {
    if (terminal.current || executing.current || locked) return;
    intent.current = undefined;
    primary.current = undefined;
    acknowledged.current = false;
    setState("ready");
  }
  return {
    state,
    busy,
    locked,
    start,
    retry: execute,
    readReceipt: recoverReceipt,
    reset,
    unavailable,
  };
}
