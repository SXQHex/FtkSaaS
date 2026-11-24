import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../test/server";
import { createBackend, BackendError } from "./backend";
import { readAccount } from "./account";

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
const centersRequest = { ...request, org_id: request.request_id, page: {} };
const centersDataUrl = "https://backend.invalid/rest/v1/rpc/centers_list_v1";

describe("backend transport", () => {
  it("uses the Data API for the plain center list with the same native JWT", async () => {
    server.use(
      http.post(centersDataUrl, async ({ request: incoming }) => {
        expect(incoming.headers.get("content-profile")).toBe("api_read");
        expect(incoming.headers.get("authorization")).toBe("Bearer test-token");
        expect(incoming.headers.get("apikey")).toBe("public-test-key");
        expect(await incoming.json()).toEqual({ p_request: centersRequest });
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null },
          trace_id: request.request_id,
        });
      }),
    );
    await expect(backend.call("centers_list_v1", centersRequest)).resolves.toMatchObject({
      items: [],
    });
  });

  it("keeps the opt-in setup summary on the Edge transport", async () => {
    const setupRequest = { ...centersRequest, include_setup_status: true };
    server.use(
      http.post(`${url}/centers_list_v1`, async ({ request: incoming }) => {
        expect(await incoming.json()).toEqual(setupRequest);
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null },
          trace_id: request.request_id,
        });
      }),
    );
    await expect(backend.call("centers_list_v1", setupRequest)).resolves.toMatchObject({
      items: [],
    });
  });

  it("keeps requests near the body size limit on Edge", async () => {
    const boundaryRequest = { ...centersRequest, page: { cursor: "" } };
    boundaryRequest.page.cursor = "x".repeat(2_097_152 - JSON.stringify(boundaryRequest).length);
    server.use(
      http.post(`${url}/centers_list_v1`, async ({ request: incoming }) => {
        expect((await incoming.text()).length).toBe(2_097_152);
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null },
          trace_id: request.request_id,
        });
      }),
    );
    await expect(backend.call("centers_list_v1", boundaryRequest)).resolves.toMatchObject({
      items: [],
    });
  });

  it.each([
    [406, { code: "PGRST106" }],
    [404, { code: "PGRST202" }],
    [401, { code: "PGRST301" }],
    [403, { ok: false, error: { code: "FORBIDDEN" } }],
  ])("uses Edge to preserve the contract on Data API transport status %s", async (status, body) => {
    server.use(
      http.post(centersDataUrl, () => HttpResponse.json(body, { status })),
      http.post(`${url}/centers_list_v1`, async ({ request: incoming }) => {
        expect(await incoming.json()).toEqual(centersRequest);
        return HttpResponse.json({
          ok: false,
          error: { code: "NOT_FOUND", retryable: false, trace_id: request.request_id },
        });
      }),
    );
    await expect(backend.call("centers_list_v1", centersRequest)).rejects.toMatchObject({
      code: "NOT_FOUND",
      traceId: request.request_id,
    });
  });

  it("returns a Data API domain error without a second request", async () => {
    server.use(
      http.post(centersDataUrl, () =>
        HttpResponse.json({
          ok: false,
          error: { code: "FORBIDDEN", retryable: false, trace_id: request.request_id },
        }),
      ),
    );
    await expect(backend.call("centers_list_v1", centersRequest)).rejects.toMatchObject({
      code: "FORBIDDEN",
      retryable: false,
      traceId: request.request_id,
    });
  });

  it("uses Edge if the browser cannot reach the Data API transport", async () => {
    server.use(
      http.post(centersDataUrl, () => HttpResponse.error()),
      http.post(`${url}/centers_list_v1`, () =>
        HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null },
          trace_id: request.request_id,
        }),
      ),
    );
    await expect(backend.call("centers_list_v1", centersRequest)).resolves.toMatchObject({
      items: [],
    });
  });

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
    { id: 14, state: "active", display_name: "Fixture" },
    { id: request.request_id, state: "unknown", display_name: "Fixture" },
    {
      id: request.request_id,
      state: "active",
      display_name: "Fixture",
      identity: {
        given_name: null,
        family_name: null,
        email: "fixture@example.invalid",
        phone: null,
        pending_email: null,
        pending_phone: null,
        email_verified_at: true,
        phone_verified_at: null,
        unverified_phone: null,
      },
    },
    {
      id: request.request_id,
      state: "active",
      display_name: "Fixture",
      platform_scope: { owner_manage: "true" },
    },
  ])("rejects a malformed account projection before it can grant frontend access", async (data) => {
    vi.stubEnv("VITE_SUPABASE_URL", new URL(url).origin);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    server.use(
      http.post(`${url}/account_get_v1`, () =>
        HttpResponse.json({ ok: true, data, trace_id: request.request_id }),
      ),
    );
    try {
      await expect(readAccount(true, "test-token")).rejects.toThrow("ACCOUNT_PROJECTION_INVALID");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it.each([
    [502, "not-json"],
    [200, { ok: true }],
    [200, { ok: true, data: null, trace_id: request.request_id }],
    [200, { ok: true, data: false, trace_id: request.request_id }],
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
