import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { createBackend, BackendError } from "./backend";

const url = "https://backend.invalid/functions/v1/backend-v1";
const backend = createBackend({
  functionsUrl: url,
  publishableKey: "public-test-key",
  getAccessToken: async () => "test-token",
});
const request = {
  client_api_version: 1,
  request_id: "019a7b00-0000-7000-8000-000000000001",
} as const;

describe("backend transport", () => {
  it("reads the typed account through Edge using the native session", async () => {
    server.use(
      http.post(`${url}/account_get_v1`, async ({ request: incoming }) => {
        expect(incoming.headers.get("authorization")).toBe("Bearer test-token");
        expect(incoming.headers.get("apikey")).toBe("public-test-key");
        expect(await incoming.json()).toEqual(request);
        return HttpResponse.json({
          ok: true,
          data: { account_id: "test-account" },
          trace_id: request.request_id,
        });
      }),
    );
    expect(await backend.call("account_get_v1", request)).toMatchObject({
      account_id: "test-account",
    });
  });
  it("rejects HTTP 200 SafeError without fabricating success", async () => {
    server.use(
      http.post(`${url}/account_get_v1`, () =>
        HttpResponse.json({
          ok: false,
          error: { code: "FORBIDDEN", retryable: false, trace_id: request.request_id },
        }),
      ),
    );
    await expect(backend.call("account_get_v1", request)).rejects.toMatchObject({
      code: "FORBIDDEN",
      retryable: false,
    });
  });
  it.each([
    [502, "not-json"],
    [200, { ok: true }],
    [503, { ok: true, data: {} }],
    [200, { ok: false, error: "unsafe-provider-detail" }],
  ])("rejects malformed or failed transport %s", async (status, body) => {
    server.use(
      http.post(`${url}/account_get_v1`, () =>
        typeof body === "string"
          ? new HttpResponse(body, { status })
          : HttpResponse.json(body, { status }),
      ),
    );
    await expect(backend.call("account_get_v1", request)).rejects.toBeInstanceOf(BackendError);
  });
  it("does not send an unauthenticated request", async () => {
    const anonymous = createBackend({
      functionsUrl: url,
      publishableKey: "public-test-key",
      getAccessToken: async () => null,
    });
    await expect(anonymous.call("account_get_v1", request)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });
});
