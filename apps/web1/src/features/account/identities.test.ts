import { afterEach, expect, it, vi } from "vitest";
const { read, link, unlink } = vi.hoisted(() => ({
  read: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: { getUserIdentities: read, linkIdentity: link, unlinkIdentity: unlink },
  }),
}));
import { readIdentities, linkGoogle, unlinkGoogle } from "./identities";
const identity = {
  identity_id: "native-identity",
  id: "provider-id",
  user_id: "fixture",
  provider: "google",
};
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("reads native identities through the SDK without equating provider IDs with domain account IDs", async () => {
  read.mockResolvedValue({ data: { identities: [identity] }, error: null });
  expect(await readIdentities()).toEqual([identity]);
  expect(read).toHaveBeenCalledWith();
  const error = new Error("native auth required");
  read.mockResolvedValue({ data: null, error });
  await expect(readIdentities()).rejects.toBe(error);
});
it("links through native PKCE with the configured callback and no preparation endpoint", async () => {
  vi.stubEnv("VITE_APP_ORIGIN", "https://app.example.invalid");
  link.mockResolvedValue({ data: { url: "https://provider.example.invalid" }, error: null });
  await linkGoogle();
  expect(link).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "https://app.example.invalid/auth/callback" },
  });
});
it("unlinks only the selected native Google identity and preserves provider failures", async () => {
  unlink.mockResolvedValue({ error: null });
  await unlinkGoogle(identity);
  expect(unlink).toHaveBeenCalledExactlyOnceWith(identity);
  await expect(unlinkGoogle({ ...identity, provider: "email" })).rejects.toThrow(
    "IDENTITY_UNAVAILABLE",
  );
  const error = new Error("native provider");
  unlink.mockResolvedValue({ error });
  await expect(unlinkGoogle(identity)).rejects.toBe(error);
});
