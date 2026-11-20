import { expect, it } from "vitest";
import { BackendError } from "../../lib/backend";
import { routeErrorState } from "./route-state";
const trace = "019a7b00-0000-7000-8000-000000000001";
it.each([
  ["FORBIDDEN", "forbidden"],
  ["NOT_FOUND", "notFound"],
  ["VERSION_CONFLICT", "conflict"],
  ["PREVIEW_STALE", "expired"],
  ["PLAN_FEATURE_UNAVAILABLE", "limit"],
  ["PLAN_LIMIT_REACHED", "limit"],
] as const)("keeps the native %s outcome distinct from an empty result", (code, kind) => {
  expect(routeErrorState(new BackendError({ code, retryable: false, trace_id: trace }))).toEqual({
    kind,
    retryable: false,
    traceId: trace,
  });
});
it("offers a read retry for transport errors without exposing their arbitrary message", () => {
  expect(routeErrorState(new TypeError("synthetic-private-diagnostic"))).toEqual({
    kind: "error",
    retryable: true,
  });
});
it("preserves a native nonretryable failure and rejects a non-UUID support reference", () => {
  expect(
    routeErrorState(
      new BackendError({
        code: "VALIDATION_FAILED",
        retryable: false,
        trace_id: "synthetic-private-diagnostic",
      }),
    ),
  ).toEqual({ kind: "error", retryable: false });
});
it("does not guess that a transport failure means the browser is offline", () => {
  expect(routeErrorState(new BackendError())).toEqual({ kind: "error", retryable: true });
});
