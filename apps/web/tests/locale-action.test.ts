import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ origin: "http://127.0.0.1:3000", set: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: mocks.origin }),
  cookies: async () => ({ set: mocks.set }),
}));
import { setLocale } from "../src/i18n/actions";
beforeEach(() => { mocks.set.mockClear(); });
test("HTTP loopback can persist a language without a Secure cookie", async () => {
  mocks.origin = "http://127.0.0.1:3000";
  await setLocale("en");
  expect(mocks.set).toHaveBeenCalledWith("ftksaas_locale", "en", expect.objectContaining({ secure: false, httpOnly: true, sameSite: "lax", path: "/" }));
});
test("hosted origins retain Secure even when HTTP is requested", async () => {
  for (const origin of ["https://example.com", "http://example.com", "http://localhost.example.com"]) {
    mocks.origin = origin;
    await setLocale("tr");
    expect(mocks.set).toHaveBeenLastCalledWith("ftksaas_locale", "tr", expect.objectContaining({ secure: true, httpOnly: true }));
  }
});
test("unsupported locales never write a cookie", async () => {
  await expect(setLocale("de")).rejects.toThrow("Unsupported locale");
  expect(mocks.set).not.toHaveBeenCalled();
});
