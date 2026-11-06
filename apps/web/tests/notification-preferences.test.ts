import { beforeEach, expect, test, vi } from "vitest";
import { readNotificationPreferences } from "../src/lib/notification-preferences";
import { setupCall, recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", async (original) => ({
  ...(await original<typeof import("../src/lib/studio-setup")>()),
  setupCall: vi.fn<typeof setupCall>(),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080";
const scope = { actorId: id, orgId: id };
const catalog = {
  scope: "member" as const,
  catalog_version: 12 as const,
  fields: [
    {
      key: "in_app_marketing" as const,
      group: "U",
      consumer: "p05_optional_allowed" as const,
      writable: true,
    },
  ],
  defaults: { in_app_marketing: false },
  brand_packages: [] as [],
  limitations: [],
  notification_delivery: { channels: { in_app: true, email: false, push: false } },
};
const view = {
  scope: "member" as const,
  version: 0,
  values: { in_app_marketing: false },
  as_of: "2026-11-04T00:00:00Z",
  overridden_fields: [] as [],
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
test("actual member settings supply opaque zero version and delivery support", async () => {
  vi.mocked(setupCall)
    .mockResolvedValueOnce(catalog as never)
    .mockResolvedValueOnce(view);
  expect(await readNotificationPreferences(scope)).toEqual({
    version: 0,
    enabled: false,
    writable: true,
  });
  expect(setupCall).toHaveBeenNthCalledWith(1, "settings_catalog_get_v1", {
    scope: "member",
    org_id: id,
  });
  expect(setupCall).toHaveBeenNthCalledWith(2, "settings_get_v1", { scope: "member", org_id: id });
});
test("missing value, wrong scope and read denial cannot become opt-in defaults", async () => {
  for (const bad of [
    { ...view, values: {} },
    { ...view, scope: "user" },
    { ...view, version: -1 },
  ]) {
    vi.mocked(setupCall)
      .mockResolvedValueOnce(catalog as never)
      .mockResolvedValueOnce(bad as never);
    await expect(readNotificationPreferences(scope)).rejects.toThrow("invalidPreferences");
  }
  vi.mocked(setupCall).mockRejectedValueOnce(new Error("denied"));
  await expect(readNotificationPreferences(scope)).rejects.toThrow("denied");
});
test("unsupported in-app channel or nonwritable field is read only", async () => {
  vi.mocked(setupCall)
    .mockResolvedValueOnce({
      ...catalog,
      notification_delivery: { channels: { in_app: false, email: true, push: false } },
    } as never)
    .mockResolvedValueOnce(view);
  expect((await readNotificationPreferences(scope)).writable).toBe(false);
});
test("recovery accepts only exact member marketing boolean, including initial zero version", () => {
  const command = {
    operation: "settings_update_v1",
    input: {
      scope: "member",
      org_id: id,
      operation_key: id,
      expected_version: 0,
      patch: { in_app_marketing: true },
    },
  };
  const key = setupStorageKey(scope, "notification-preferences");
  sessionStorage.setItem(key, JSON.stringify({ command }));
  expect(recoverSetup(scope, "notification-preferences")).toEqual({ command });
  for (const patch of [
    { in_app_marketing: "yes" },
    { in_app_marketing: true, in_app_reminders: true },
    { theme: "dark" },
  ]) {
    sessionStorage.setItem(
      key,
      JSON.stringify({ command: { ...command, input: { ...command.input, patch } } }),
    );
    expect(recoverSetup(scope, "notification-preferences")).toBe("invalid");
  }
  sessionStorage.setItem(
    key,
    JSON.stringify({ command: { ...command, input: { ...command.input, scope: "user" } } }),
  );
  expect(recoverSetup(scope, "notification-preferences")).toBe("invalid");
});

test("zero-version exception cannot escape member notification settings", () => {
  const key = setupStorageKey(scope, "notification-preferences");
  for (const command of [
    {
      operation: "organization_update_v1",
      input: { org_id: id, operation_key: id, expected_version: 0, name: "Synthetic" },
    },
    {
      operation: "organization_update_v1",
      input: { org_id: id, operation_key: id, expected_version: -1, name: "Synthetic" },
    },
    {
      operation: "settings_update_v1",
      input: {
        org_id: id,
        operation_key: id,
        scope: "member",
        center_id: id,
        expected_version: 0,
        patch: { in_app_marketing: true },
      },
    },
    {
      operation: "settings_update_v1",
      input: {
        org_id: id,
        operation_key: id,
        scope: "member",
        expected_version: -1,
        patch: { in_app_marketing: true },
      },
    },
  ]) {
    sessionStorage.setItem(key, JSON.stringify({ command }));
    expect(recoverSetup(scope, "notification-preferences")).toBe("invalid");
  }
});
