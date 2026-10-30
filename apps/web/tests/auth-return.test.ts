import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  saved: undefined as string | undefined,
  set: vi.fn<
    (...args: Parameters<Awaited<ReturnType<typeof import("next/headers").cookies>>["set"]>) => void
  >(),
  exchange: vi.fn<(code: string) => Promise<{ error: Error | null }>>(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.saved ? { value: mocks.saved } : undefined),
    set: mocks.set,
  }),
}));
vi.mock("../src/lib/supabase/server", () => ({
  serverClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }),
}));
import { rememberAuthReturn } from "../src/lib/auth-return";
import { GET } from "../src/app/auth/callback/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.example.invalid");
  mocks.saved = "/organizasyon/org/seans/session";
  mocks.exchange.mockResolvedValue({ error: null });
});
test("provider destination is a short-lived, HTTP-only local path", async () => {
  await rememberAuthReturn("//attacker.invalid");
  expect(mocks.set).toHaveBeenCalledWith("ftksaas_auth_return", "/", {
    path: "/auth/callback",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
  });
});
test("successful callback consumes the local destination and clears the correctly scoped cookie", async () => {
  const result = await GET(new Request("https://app.example.invalid/auth/callback?code=synthetic"));
  expect(result.headers.get("location")).toBe(`https://app.example.invalid${mocks.saved}`);
  expect(mocks.set).toHaveBeenCalledWith(
    "ftksaas_auth_return",
    "",
    expect.objectContaining({ maxAge: 0, path: "/auth/callback" }),
  );
});
test("password recovery overrides a saved destination, and untrusted redirects are rejected", async () => {
  const recovery = await GET(
    new Request("https://app.example.invalid/auth/callback?code=synthetic&next=/reset-password"),
  );
  expect(recovery.headers.get("location")).toBe("https://app.example.invalid/reset-password");
  mocks.saved = "//attacker.invalid";
  const result = await GET(new Request("https://app.example.invalid/auth/callback?code=synthetic"));
  expect(result.headers.get("location")).toBe("https://app.example.invalid/");
});
test("failed exchange keeps the destination on the login error without reporting success", async () => {
  mocks.exchange.mockResolvedValue({ error: new Error("expired") });
  const result = await GET(new Request("https://app.example.invalid/auth/callback?code=synthetic"));
  const url = new URL(result.headers.get("location")!);
  expect(url.pathname).toBe("/login");
  expect(url.searchParams.get("error")).toBe("callback");
  expect(url.searchParams.get("next")).toBe(mocks.saved);
});
