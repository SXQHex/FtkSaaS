import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
import type { CollectionIntent } from "./finance";
const { write, receipt, result } = vi.hoisted(() => ({
  write: vi.fn(),
  receipt: vi.fn(),
  result: vi.fn(),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const { QueryClient } = await importOriginal<typeof import("@tanstack/react-query")>();
  const client = new QueryClient();
  return { useQueryClient: () => client };
});
vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("./finance-command", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./finance-command")>()),
  writeFinance: write,
  readFinanceReceipt: receipt,
  readFinanceResult: result,
}));
const value: CollectionIntent = {
  scope: { accountId: "fixture-account", orgId: "fixture-org", centerId: "fixture-center" },
  operation: "collection_record_v1",
  selection: { personId: "fixture-person", currency: "TRY" },
  request: {
    client_api_version: 1,
    org_id: "fixture-org",
    center_id: "fixture-center",
    operation_key: "fixture-key",
    person_id: "fixture-person",
    amount_minor: "40000",
    currency: "TRY",
    occurred_at: "2026-11-15T11:30:00Z",
    payment: { method: "cash" },
  },
};
import { useFinanceCommand } from "./use-finance-command";
beforeEach(() => {
  vi.resetAllMocks();
  result.mockResolvedValue({ version: 1 });
});

it("does not treat a failed receipt read as rejection of an unknown write or discard its key", async () => {
  write
    .mockRejectedValueOnce(new BackendError())
    .mockResolvedValue({ primary_id: "fixture-discipline" });
  receipt.mockRejectedValue(
    new BackendError({ code: "NOT_FOUND", retryable: false, trace_id: "synthetic-trace" }),
  );
  const refresh = vi.fn(async () => {});
  const hook = renderHook(() =>
    useFinanceCommand({ onAccessLost: () => false, onRefresh: refresh }),
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

it("rereads an acknowledged result without executing its writer again", async () => {
  write.mockResolvedValue({ primary_id: "fixture-discipline" });
  result.mockRejectedValueOnce(new BackendError()).mockResolvedValue({ version: 1 });
  const refresh = vi.fn(async () => {});
  const hook = renderHook(() =>
    useFinanceCommand({ onAccessLost: () => false, onRefresh: refresh }),
  );
  await act(async () => {
    await hook.result.current.start(value);
  });
  expect(hook.result.current.state).toBe("saved-unread");
  await act(async () => {
    await hook.result.current.readReceipt();
  });
  expect(hook.result.current.state).toBe("saved");
  expect(write).toHaveBeenCalledTimes(1);
  expect(receipt).not.toHaveBeenCalled();
});
