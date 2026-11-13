import { afterEach, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
import { readTheme, saveTheme } from "./appearance";
afterEach(() => vi.resetAllMocks());
function reads() {
  call.mockImplementation((operation: string) =>
    Promise.resolve(
      operation === "settings_catalog_get_v1"
        ? { scope: "user", fields: [{ key: "theme", consumer: "frontend", writable: true }] }
        : { scope: "user", version: 0, values: { theme: "system" } },
    ),
  );
}
it("reads the authoritative user catalog and resolved theme with version zero", async () => {
  reads();
  expect(await readTheme()).toEqual({ theme: "system", version: 0, writable: true });
  for (const [, request] of call.mock.calls) {
    expect(request).toMatchObject({ client_api_version: 1, scope: "user" });
    expect(request).not.toHaveProperty("account_id");
    expect(request).not.toHaveProperty("org_id");
  }
});
it("rejects an absent theme or a mismatched scope instead of inventing a default", async () => {
  call.mockResolvedValue({ scope: "member", version: 0, values: {} });
  await expect(readTheme()).rejects.toThrow("THEME_UNAVAILABLE");
  reads();
  call.mockImplementation((operation: string) =>
    Promise.resolve(
      operation === "settings_catalog_get_v1"
        ? { scope: "user", fields: [] }
        : { scope: "user", version: 1, values: {} },
    ),
  );
  await expect(readTheme()).rejects.toThrow("THEME_UNAVAILABLE");
});
it("keeps the selected user version and intent key, patches only theme and preserves a read-only catalog", async () => {
  reads();
  call.mockImplementation((operation: string) =>
    Promise.resolve(
      operation === "settings_catalog_get_v1"
        ? { scope: "user", fields: [{ key: "theme", consumer: "frontend", writable: false }] }
        : { scope: "user", version: 8, values: { theme: "light" } },
    ),
  );
  expect(await readTheme()).toMatchObject({ writable: false });
  await saveTheme({ theme: "dark", version: 8, key: "same-intent" });
  expect(call).toHaveBeenLastCalledWith(
    "settings_update_v1",
    expect.objectContaining({
      scope: "user",
      expected_version: 8,
      operation_key: "same-intent",
      patch: { theme: "dark" },
    }),
  );
});
