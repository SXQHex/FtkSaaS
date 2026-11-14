import { afterEach, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
import { readAppearance, saveAppearance } from "./appearance";
afterEach(() => vi.resetAllMocks());
function reads() {
  call.mockImplementation((operation: string) =>
    Promise.resolve(
      operation === "settings_catalog_get_v1"
        ? { scope: "user", fields: [{ key: "theme", consumer: "frontend", writable: true }] }
        : { scope: "user", version: 0, values: { theme: "system", font_scale: null } },
    ),
  );
}
it("reads the authoritative user catalog and resolved theme with version zero", async () => {
  reads();
  expect(await readAppearance()).toEqual({
    values: { theme: "system", font_scale: null },
    version: 0,
    writable: { theme: true, font_scale: false },
  });
  for (const [, request] of call.mock.calls) {
    expect(request).toMatchObject({ client_api_version: 1, scope: "user" });
    expect(request).not.toHaveProperty("account_id");
    expect(request).not.toHaveProperty("org_id");
  }
});
it("rejects an absent theme or a mismatched scope instead of inventing a default", async () => {
  call.mockResolvedValue({ scope: "member", version: 0, values: {} });
  await expect(readAppearance()).rejects.toThrow("APPEARANCE_UNAVAILABLE");
  reads();
  call.mockImplementation((operation: string) =>
    Promise.resolve(
      operation === "settings_catalog_get_v1"
        ? { scope: "user", fields: [] }
        : { scope: "user", version: 1, values: {} },
    ),
  );
  await expect(readAppearance()).rejects.toThrow("APPEARANCE_UNAVAILABLE");
});
it("keeps the selected user version and intent key, patches only theme and preserves a read-only catalog", async () => {
  reads();
  call.mockImplementation((operation: string) =>
    Promise.resolve(
      operation === "settings_catalog_get_v1"
        ? { scope: "user", fields: [{ key: "theme", consumer: "frontend", writable: false }] }
        : { scope: "user", version: 8, values: { theme: "light", font_scale: null } },
    ),
  );
  expect(await readAppearance()).toMatchObject({ writable: { theme: false } });
  await saveAppearance({
    change: { field: "theme", value: "dark" },
    version: 8,
    key: "same-intent",
  });
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

it.each([null, 0.75, 1.1, 1.37, 2])(
  "preserves the canonical font scale without coercing it to a preset: %s",
  async (fontScale) => {
    call.mockImplementation((operation: string) =>
      Promise.resolve(
        operation === "settings_catalog_get_v1"
          ? {
              scope: "user",
              fields: [
                { key: "theme", consumer: "frontend", writable: true },
                { key: "font_scale", consumer: "frontend", writable: false },
              ],
            }
          : { scope: "user", version: 3, values: { theme: "light", font_scale: fontScale } },
      ),
    );
    const { readAppearance } = await import("./appearance");
    expect(await readAppearance()).toMatchObject({
      values: { theme: "light", font_scale: fontScale },
      writable: { theme: true, font_scale: false },
    });
  },
);
it.each([undefined, 0.74, 2.01, Number.NaN])(
  "rejects missing or out-of-contract scale: %s",
  async (fontScale) => {
    call.mockImplementation((operation: string) =>
      Promise.resolve(
        operation === "settings_catalog_get_v1"
          ? { scope: "user", fields: [] }
          : { scope: "user", version: 0, values: { theme: "system", font_scale: fontScale } },
      ),
    );
    const { readAppearance } = await import("./appearance");
    await expect(readAppearance()).rejects.toThrow("APPEARANCE_UNAVAILABLE");
  },
);

it("writes an explicit null only to font_scale and retains the exact operation key and version", async () => {
  await saveAppearance({
    change: { field: "font_scale", value: null },
    version: 5,
    key: "scale-intent",
  });
  expect(call).toHaveBeenCalledExactlyOnceWith(
    "settings_update_v1",
    expect.objectContaining({
      scope: "user",
      expected_version: 5,
      operation_key: "scale-intent",
      patch: { font_scale: null },
    }),
  );
});
