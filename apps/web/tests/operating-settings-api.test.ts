import { beforeEach, expect, test, vi } from "vitest";
import { operatingApi } from "../src/lib/operating-settings";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
}));
const scope = { actorId: "actor", orgId: "org", centerId: "center" };
beforeEach(() => vi.resetAllMocks());
test.each(["organization", "center"] as const)(
  "%s reads native catalogue and values in the exact scope",
  async (target) => {
    mocks.call.mockImplementation(async (operation) =>
      operation === "settings_catalog_get_v1"
        ? { scope: target, fields: [{ key: "address", writable: false }] }
        : { scope: target, version: 0, values: { address: "" } },
    );
    const result = await operatingApi.read(scope, target);
    expect(result.view.version).toBe(0);
    expect(mocks.call.mock.calls.map(([, input]) => input)).toEqual([
      { scope: target, org_id: "org", ...(target === "center" ? { center_id: "center" } : {}) },
      { scope: target, org_id: "org", ...(target === "center" ? { center_id: "center" } : {}) },
    ]);
  },
);
test("wrong scope or duplicate catalogue fields cannot enable an editor", async () => {
  mocks.call.mockResolvedValue({ scope: "member", version: 1, fields: [] });
  await expect(operatingApi.read(scope, "organization")).rejects.toThrow("invalidSettings");
  mocks.call.mockImplementation(async (operation) =>
    operation === "settings_catalog_get_v1"
      ? { scope: "organization", fields: [{ key: "address" }, { key: "address" }] }
      : { scope: "organization", version: 1 },
  );
  await expect(operatingApi.read(scope, "organization")).rejects.toThrow("invalidSettings");
});
test("reset selects one explicit field and history preserves native cursor without a center on org requests", async () => {
  mocks.call.mockResolvedValue({});
  await operatingApi.reset(scope, "organization", "address");
  await operatingApi.history(scope, "organization", "native-next");
  expect(mocks.call).toHaveBeenNthCalledWith(1, "settings_reset_preview_v1", {
    scope: "organization",
    org_id: "org",
    fields: ["address"],
  });
  expect(mocks.call).toHaveBeenNthCalledWith(2, "settings_history_get_v1", {
    scope: "organization",
    org_id: "org",
    cursor: "native-next",
  });
});
