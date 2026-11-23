import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import { capturePrivateReadback } from "../../lib/cache-invalidation";
import { readMergeOperation, readMergeResult, writeMerge, type MergeIntent } from "./merge";

export type MergeCommandState =
  | "ready"
  | "writing"
  | "unknown"
  | "saved-unread"
  | "saved"
  | "stale"
  | "rejected"
  | "pending";
export function useMergeCommand({
  onAccessLost,
  onRefresh,
}: {
  onAccessLost: (error: unknown) => boolean;
  onRefresh: (intent: MergeIntent, assertCurrent: () => void) => Promise<void>;
}) {
  const queries = useQueryClient();
  const [state, setState] = useState<MergeCommandState>("ready");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const terminal = useRef(false);
  const intent = useRef<MergeIntent | undefined>(undefined);
  const acknowledged = useRef(false);
  const executing = useRef(false);
  const mounted = useRef(true);
  const locked = !unavailable && (busy || ["unknown", "saved-unread", "pending"].includes(state));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useBlocker({
    shouldBlockFn: () =>
      executing.current ||
      Boolean(intent.current && !["saved", "stale", "rejected"].includes(state)),
    enableBeforeUnload: locked,
    disabled: !locked,
  });
  function abandon() {
    terminal.current = true;
    intent.current = undefined;
    acknowledged.current = false;
    setUnavailable(true);
    setState("rejected");
  }
  async function reread() {
    const activeIntent = intent.current;
    if (!activeIntent || !acknowledged.current) return;
    const assertCurrent = capturePrivateReadback(queries);
    await readMergeResult(activeIntent);
    assertCurrent();
    if (!mounted.current || terminal.current) return;
    await onRefresh(activeIntent, assertCurrent);
    assertCurrent();
    if (mounted.current && !terminal.current) setState("saved");
  }
  async function execute() {
    if (terminal.current || executing.current || !intent.current) return;
    executing.current = true;
    setBusy(true);
    setState("writing");
    try {
      if (!acknowledged.current) {
        await writeMerge(intent.current);
        acknowledged.current = true;
      }
      if (!mounted.current || terminal.current) return;
      setState("saved-unread");
      await reread();
    } catch (error) {
      if (!mounted.current || terminal.current) return;
      if (onAccessLost(error)) {
        abandon();
        return;
      }
      if (acknowledged.current) setState("saved-unread");
      else if (
        error instanceof BackendError &&
        ["VERSION_CONFLICT", "PREVIEW_STALE", "PREVIEW_EXPIRED"].includes(error.code)
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
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function start(value: MergeIntent) {
    if (terminal.current || executing.current || intent.current) return;
    intent.current = value;
    acknowledged.current = false;
    await execute();
  }
  async function readReceipt() {
    if (terminal.current || executing.current || !intent.current) return;
    executing.current = true;
    setBusy(true);
    try {
      if (!acknowledged.current) {
        const receipt = await readMergeOperation(intent.current);
        if (receipt.status === "succeeded") {
          // A succeeded receipt is already an acknowledgement, even when its
          // cached result has expired. Recover through domain reads only.
          acknowledged.current = true;
        } else if (receipt.status === "failed_final") {
          intent.current = undefined;
          setState("rejected");
          return;
        } else if (receipt.status === "result_expired") {
          acknowledged.current = true;
        } else {
          setState("pending");
          return;
        }
      }
      setState("saved-unread");
      await reread();
    } catch (error) {
      if (mounted.current && !terminal.current) {
        if (onAccessLost(error)) abandon();
        else setState(acknowledged.current ? "saved-unread" : "unknown");
      }
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function reset() {
    if (terminal.current || locked || executing.current) return;
    intent.current = undefined;
    acknowledged.current = false;
    setState("ready");
  }
  return { state, busy, locked, start, retry: execute, readReceipt, reset, abandon };
}
