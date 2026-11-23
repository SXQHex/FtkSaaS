import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
import { productDraft, productIntent } from "./products";
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
vi.mock("./products", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./products")>()),
  writeProduct: write,
  readProductReceipt: receipt,
  readProductResult: result,
}));
const draft = productDraft();
Object.assign(draft, {
  name: "Synthetic",
  bookingMode: "flexible",
  refundMethod: "none",
  credits: "8",
  price: "120000",
  currency: "TRY",
  scopeKind: "center_all_disciplines",
  scopes: ["lesson"],
});
const value = productIntent(
  { accountId: "fixture-account", orgId: "fixture-org", centerId: "fixture-center" },
  draft,
);
value.request.operation_key = "fixture-key";
import { useProductCommand } from "./use-product-command";
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
    useProductCommand({ onAccessLost: () => false, onRefresh: refresh }),
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
    useProductCommand({ onAccessLost: () => false, onRefresh: refresh }),
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
