import { BackendError } from "../../lib/backend";
import type { StateKind } from "./state-view";
export function routeErrorState(error: unknown): {
  kind: StateKind;
  retryable: boolean;
  traceId?: string;
} {
  if (!(error instanceof BackendError)) return { kind: "error", retryable: true };
  const kind: StateKind =
    error.code === "FORBIDDEN"
      ? "forbidden"
      : error.code === "NOT_FOUND"
        ? "notFound"
        : error.code === "VERSION_CONFLICT"
          ? "conflict"
          : error.code === "PREVIEW_STALE"
            ? "expired"
            : error.code === "PLAN_FEATURE_UNAVAILABLE" || error.code === "PLAN_LIMIT_REACHED"
              ? "limit"
              : "error";
  const traceId =
    error.traceId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(error.traceId)
      ? error.traceId
      : undefined;
  return { kind, retryable: kind === "error" && error.retryable, ...(traceId ? { traceId } : {}) };
}
