import { afterEach, expect, test, vi } from "vitest";
import { checkSignup } from "../src/lib/signup-check";
import { POST } from "../src/app/api/auth/signup-check/route";
const trace = "019a2b3c-4d5e-7000-8000-000000000001";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test.each(["available", "account_exists"] as const)(
  "signup check sends only the typed email request and returns %s",
  async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true, data: { status }, trace_id: trace }));
    vi.stubGlobal("fetch", fetcher);
    expect(await checkSignup("test@example.invalid")).toMatchObject({ ok: true, data: { status } });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("/api/auth/signup-check");
    expect(JSON.parse(String(options?.body))).toEqual({
      client_api_version: 1,
      request_id: expect.any(String),
      email: "test@example.invalid",
    });
    expect(options?.headers).toEqual({ "content-type": "application/json" });
  },
);
test.each([
  Response.json({ ok: true, data: { status: "unknown" } }),
  Response.json({ ok: true, data: { status: "available" } }, { status: 503 }),
  new Response("invalid"),
])("malformed or failed check never returns availability", async (response) => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
  await expect(checkSignup("test@example.invalid")).rejects.toThrow("signupCheckUnavailable");
});
function gatewayEnv() {
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key");
  vi.stubEnv("FTK_PUBLIC_INGRESS_SECRET", "synthetic-ingress-secret-at-least-32-bytes");
}
function signupRequest(origin = "https://app.example.invalid") {
  return new Request("https://app.example.invalid/api/auth/signup-check", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-vercel-forwarded-for": "192.0.2.1",
      "x-forwarded-for": "198.51.100.1",
    },
    body: JSON.stringify({
      client_api_version: 1,
      request_id: trace,
      email: "test@example.invalid",
    }),
  });
}
test("server route delegates to the backend transport with platform IP and server-only signing", async () => {
  gatewayEnv();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ok: true, data: { status: "available" }, trace_id: trace }));
  vi.stubGlobal("fetch", fetcher);
  const response = await POST(signupRequest());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe(
    "https://project.example.invalid/functions/v1/backend-v1/account_signup_check_v1",
  );
  expect(options?.headers).toMatchObject({
    apikey: "synthetic-publishable-key",
    "x-ftk-client-ip": "192.0.2.1",
    "x-ftk-ingress-signature": expect.stringMatching(/^[0-9a-f]{64}$/),
  });
  expect(await response.json()).toEqual({
    ok: true,
    data: { status: "available" },
    trace_id: trace,
  });
});
test("gateway rejects a foreign origin without making an upstream request", async () => {
  gatewayEnv();
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetcher);
  expect((await POST(signupRequest("https://foreign.example.invalid"))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([
  "NEXT_PUBLIC_APP_ORIGIN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "FTK_PUBLIC_INGRESS_SECRET",
])("missing %s fails closed without an upstream request", async (name) => {
  gatewayEnv();
  vi.stubEnv(name, "");
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetcher);
  expect((await POST(signupRequest())).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});

test.each(["not-a-url", "http://app.example.invalid", "javascript:alert(1)"])(
  "invalid app origin %s fails closed without using the request host",
  async (origin) => {
    gatewayEnv();
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", origin);
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    expect((await POST(signupRequest())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
