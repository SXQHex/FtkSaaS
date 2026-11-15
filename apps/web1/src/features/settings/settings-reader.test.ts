import { beforeEach, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import { readOrganizationSettingsCatalog } from "./settings-reader";
const scope = { accountId: "fixture-account", orgId: "fixture-org", centerId: "fixture-center" };
beforeEach(() => {
  vi.resetAllMocks();
});
it("uses native organization field access even when there is no owner assignment in the role roster", async () => {
  call.mockResolvedValue({ scope: "organization", fields: [{ key: "address", writable: true }] });
  const result = await readOrganizationSettingsCatalog(scope);
  expect(result.state).toBe("known");
  expect(call).toHaveBeenCalledWith(
    "settings_catalog_get_v1",
    expect.objectContaining({ scope: "organization", org_id: scope.orgId }),
  );
  expect(call.mock.calls[0]?.[1]).not.toHaveProperty("center_id");
});
it("distinguishes a denied organization scope from lost authentication and malformed metadata", async () => {
  call.mockRejectedValueOnce(
    new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: "synthetic-trace" }),
  );
  await expect(readOrganizationSettingsCatalog(scope)).resolves.toEqual({ state: "forbidden" });
  call.mockRejectedValueOnce(
    new BackendError({ code: "SESSION_REVOKED", retryable: false, trace_id: "synthetic-trace" }),
  );
  await expect(readOrganizationSettingsCatalog(scope)).rejects.toMatchObject({
    code: "SESSION_REVOKED",
  });
  call.mockResolvedValueOnce({ scope: "center", fields: [] });
  await expect(readOrganizationSettingsCatalog(scope)).rejects.toThrow(
    "SETTINGS_SOURCE_UNAVAILABLE",
  );
});
