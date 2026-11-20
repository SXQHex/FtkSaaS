import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { server } from "../test/server";
import { checkSignup } from "./public-gateway";

it("sends only the typed anonymous signup precheck to the Worker", async () => {
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://gateway.invalid");
  const fetchRequest = vi.spyOn(globalThis, "fetch");
  server.use(
    http.post("https://gateway.invalid/api/auth/signup-check", async ({ request }) => {
      expect(request.headers.has("authorization")).toBe(false);
      expect(request.headers.has("apikey")).toBe(false);
      const body = await request.json();
      expect(body).toEqual({
        client_api_version: 1,
        request_id: expect.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-7/),
        email: "signup@example.invalid",
      });
      return HttpResponse.json({ ok: true, data: { status: "available" }, trace_id: "test-trace" });
    }),
  );
  try {
    expect(await checkSignup("signup@example.invalid")).toEqual({ status: "available" });
    // MSW 3 reconstructs handler Request metadata; assert credentials at the real fetch boundary.
    expect(fetchRequest).toHaveBeenCalledWith(
      "https://gateway.invalid/api/auth/signup-check",
      expect.objectContaining({ credentials: "omit", cache: "no-store" }),
    );
  } finally {
    vi.unstubAllEnvs();
  }
});
