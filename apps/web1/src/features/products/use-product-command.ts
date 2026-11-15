import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { BackendError } from "../../lib/backend";
import {
  writeProduct,
  readProductReceipt,
  readProductResult,
  type ProductIntent,
} from "./products";
import type { ProductView } from "../../lib/api-contracts/generated";

export function useProductCommand({
  onRefresh,
  onAccessLost,
}: {
  onRefresh: (result: ProductView) => Promise<void>;
  onAccessLost: (error: unknown) => boolean;
}) {
  const [state, setState] = useState<
    "ready" | "writing" | "unknown" | "pending" | "saved-unread" | "saved" | "stale" | "rejected"
  >("ready");
  const [busy, setBusy] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const intent = useRef<ProductIntent | undefined>(undefined),
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
    const result = await readProductResult(intent.current, primary.current);
    if (!mounted.current || terminal.current) return;
    await onRefresh(result);
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
        const result = await writeProduct(intent.current);
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
  async function start(next: ProductIntent) {
    if (!mounted.current || terminal.current || executing.current || intent.current) return;
    intent.current = structuredClone(next);
    acknowledged.current = false;
    primary.current = undefined;
    await execute();
  }
  async function readReceipt() {
    if (terminal.current || executing.current || !intent.current) return;
    executing.current = true;
    setBusy(true);
    try {
      if (!acknowledged.current) {
        const receipt = await readProductReceipt(intent.current);
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
  return { state, busy, locked, start, retry: execute, readReceipt, reset, unavailable };
}
