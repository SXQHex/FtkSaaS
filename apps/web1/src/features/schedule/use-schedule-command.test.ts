import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
import type { ScheduleIntent } from "./schedule-command";
const { write, receipt, result } = vi.hoisted(() => ({
  write: vi.fn(),
  receipt: vi.fn(),
  result: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("./schedule-command", () => ({
  writeSchedule: write,
  readScheduleReceipt: receipt,
  readScheduleResult: result,
}));
const value: ScheduleIntent = {
  scope: { accountId: "fixture-account", orgId: "fixture-org", centerId: "fixture-center" },
  operation: "session_cancel_apply_v1",
  expectedPrimaryId: "fixture-session",
  expectedSessions: [{ id: "fixture-session", version: 3, state: "cancelled" }],
  request: {
    client_api_version: 1,
    request_id: "fixture-request",
    org_id: "fixture-org",
    center_id: "fixture-center",
    operation_key: "fixture-key",
    preview: { id: "fixture-preview", token: "synthetic-capability" },
  },
};
import { useScheduleCommand } from "./use-schedule-command";
beforeEach(() => {
  vi.resetAllMocks();
  result.mockResolvedValue(undefined);
});

it("does not treat a failed receipt read as rejection of an unknown write or discard its key", async () => {
  write
    .mockRejectedValueOnce(new BackendError())
    .mockResolvedValue({ primary_id: "fixture-session" });
  receipt.mockRejectedValue(
    new BackendError({ code: "NOT_FOUND", retryable: false, trace_id: "synthetic-trace" }),
  );
  const refresh = vi.fn(async () => {});
  const hook = renderHook(() =>
    useScheduleCommand({ onAccessLost: () => false, onRefresh: refresh }),
  );
  await act(async () => {
    await hook.result.current.start(value);
  });
  expect(hook.result.current.state).toBe("unknown");
  await act(async () => {
    await hook.result.current.readReceipt();
  });
  expect(hook.result.current.state).toBe("unknown");
  expect(hook.result.current.locked).toBe(true);
  await act(async () => {
    await hook.result.current.retry();
  });
  expect(hook.result.current.state).toBe("saved");
  expect(write.mock.calls.map(([intent]) => intent.request.operation_key)).toEqual([
    "fixture-key",
    "fixture-key",
  ]);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => {
    await hook.result.current.retry();
  });
  expect(write).toHaveBeenCalledTimes(2);
});
