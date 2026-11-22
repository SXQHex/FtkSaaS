import { afterEach, expect, it, vi } from "vitest";
const { call, account, scope } = vi.hoisted(() => ({
  call: vi.fn(),
  account: vi.fn(),
  scope: vi.fn(),
}));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
vi.mock("../../lib/account", () => ({ readAccount: account }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: scope }));
import { profileChange, readProfile, saveProfile } from "./profile";
afterEach(() => vi.resetAllMocks());
const entity = { type: "accounts", id: "fixture-account" };
function page(version = 7) {
  return {
    items: [
      {
        operation: "account_profile_update_v1",
        entity,
        exists: true,
        versions: [{ entity, version }],
        current: {
          operation: "account_profile_update_v1",
          values: {
            display_name: "Fixture",
            given_name: null,
            family_name: null,
            unverified_phone: null,
            photo: null,
          },
        },
      },
    ],
    next_cursor: null,
  };
}
it("takes the profile write version only from the matching account management entity", async () => {
  account.mockResolvedValue({ id: entity.id, display_name: "Fixture" });
  call.mockResolvedValue(page());
  const result = await readProfile(entity.id);
  expect(result.version).toBe(7);
  expect(result.values).toEqual({
    displayName: "Fixture",
    givenName: "",
    familyName: "",
    phone: "",
  });
  expect(call).toHaveBeenCalledWith("management_state_get_v1", {
    client_api_version: 1,
    request_id: expect.any(String),
    operation: "account_profile_update_v1",
    selector: { operation: "account_profile_update_v1", key: {} },
  });
});
it("uses a verified Query account without a second standalone account read", async () => {
  const verified = vi.fn().mockResolvedValue({ id: entity.id, display_name: "Verified" });
  call.mockResolvedValue(page());
  const result = await readProfile(entity.id, verified);
  expect(result.account.display_name).toBe("Verified");
  expect(verified).toHaveBeenCalledOnce();
  expect(account).not.toHaveBeenCalled();
  verified.mockResolvedValue({ id: "other-account" });
  await expect(readProfile(entity.id, verified)).rejects.toThrow("PROFILE_UNAVAILABLE");
});

it("rejects absent/mismatched management versions instead of fabricating an initial one", async () => {
  account.mockResolvedValue({ id: entity.id });
  const data = page();
  data.items[0].versions = [];
  call.mockResolvedValue(data);
  await expect(readProfile(entity.id)).rejects.toThrow("PROFILE_UNAVAILABLE");
  call.mockResolvedValue(page());
  await expect(readProfile("different-account")).rejects.toThrow("PROFILE_UNAVAILABLE");
});
it("writes only the explicit profile fields and clears optional names/phone with null", async () => {
  scope.mockResolvedValue({ call });
  await saveProfile(
    entity.id,
    profileChange(
      { displayName: " Fixture ", givenName: " ", familyName: " Name ", phone: "" },
      "account",
    ),
    7,
    "same-intent",
  );
  expect(scope).toHaveBeenCalledExactlyOnceWith({ accountId: entity.id });
  expect(call).toHaveBeenCalledWith("account_profile_update_v1", {
    client_api_version: 1,
    request_id: expect.any(String),
    operation_key: "same-intent",
    expected_version: 7,
    display_name: "Fixture",
    given_name: null,
    family_name: "Name",
    unverified_phone: null,
  });
  expect(call.mock.calls[0][1]).not.toHaveProperty("photo");
  expect(call.mock.calls[0][1]).not.toHaveProperty("email");
});

it("includes photo only for an explicit upload or removal", async () => {
  scope.mockResolvedValue({ call });
  const values = { displayName: "Fixture", givenName: "", familyName: "", phone: "" };
  await saveProfile(entity.id, profileChange(values, "account", null), 7, "remove-photo");
  expect(call.mock.calls[0][1].photo).toBeNull();
  const photo = { mime: "image/png" as const, data_base64: "YWJj", checksum: "fixture-checksum" };
  await saveProfile(entity.id, profileChange(values, "account", photo), 7, "upload-photo");
  expect(call.mock.calls[1][1].photo).toEqual(photo);
});

it("does not submit the previous account's profile after a session change", async () => {
  scope.mockRejectedValue(new Error("ACCOUNT_CHANGED"));
  await expect(
    saveProfile(entity.id, { display_name: "Fixture" }, 7, "same-intent"),
  ).rejects.toThrow("ACCOUNT_CHANGED");
  expect(call).not.toHaveBeenCalled();
});

it("uses photo metadata from the same management snapshot as its write version", async () => {
  const old = { id: "old-photo", mime: "image/png", bytes: 3, checksum: "old" };
  const current = { ...old, id: "current-photo", checksum: "current" };
  account.mockResolvedValue({ id: entity.id, photo: old });
  const data = page(8);
  call.mockResolvedValue({
    ...data,
    items: data.items.map((item) => ({
      ...item,
      current: { ...item.current, values: { ...item.current.values, photo: current } },
    })),
  });
  const result = await readProfile(entity.id);
  expect(result.version).toBe(8);
  expect(result.photo).toEqual(current);
  expect(result.photo).not.toEqual(result.account.photo);
});

it("does not assume no photo when the canonical projection omitted its metadata", async () => {
  account.mockResolvedValue({ id: entity.id });
  const data = page();
  const values: Partial<(typeof data.items)[0]["current"]["values"]> = {
    ...data.items[0].current.values,
  };
  delete values.photo;
  call.mockResolvedValue({
    ...data,
    items: data.items.map((item) => ({ ...item, current: { ...item.current, values } })),
  });
  await expect(readProfile(entity.id)).rejects.toThrow("PROFILE_UNAVAILABLE");
});
