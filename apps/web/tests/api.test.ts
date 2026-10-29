import { expect, test, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { ApiFailure, getCalendar, getOrganizations, getSession } from "../src/lib/api";
import type { FailureEnvelope, Operations } from "@ftksaas/api-contracts";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "synthetic-session" } },
        error: null,
      }),
    },
  }),
}));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable");
});

test("direct session lookup preserves org and session and lets the backend resolve center scope", async () => {
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/session_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["session_get_v1"]["request"];
        expect(body.org_id).toBe("org-a");
        expect(body.session_id).toBe("session-a");
        expect(body).not.toHaveProperty("center_id");
        return HttpResponse.json(
          {
            ok: false,
            error: { code: "FORBIDDEN", retryable: false, trace_id: body.request_id },
          } satisfies FailureEnvelope,
          { status: 403 },
        );
      },
    ),
  );
  await expect(getSession("org-a", undefined, "session-a")).rejects.toBeInstanceOf(ApiFailure);
});
test("shared transport follows typed cursor pages with native authorization and UUIDv7 request IDs", async () => {
  let calls = 0;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/organizations_list_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["organizations_list_v1"]["request"];
        expect(body.request_id).toMatch(
          /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
        );
        expect(request.headers.get("authorization")).toBe("Bearer synthetic-session");
        expect(request.headers.get("apikey")).toBe("synthetic-publishable");
        calls++;
        expect(body.page.cursor).toBe(calls === 1 ? undefined : "next-page");
        const response = {
          ok: true,
          data: {
            items: [],
            as_of: "2026-10-28T00:00:00Z",
            next_cursor: calls === 1 ? "next-page" : null,
          },
          trace_id: body.request_id,
        } satisfies Operations["organizations_list_v1"]["response"];
        return HttpResponse.json(response);
      },
    ),
  );
  expect(await getOrganizations()).toEqual([]);
  expect(calls).toBe(2);
});
test("API failure and invalid transport never become successful empty data", async () => {
  server.use(
    http.post("https://project.example.invalid/functions/v1/backend-v1/organizations_list_v1", () =>
      HttpResponse.json(
        {
          ok: false,
          error: {
            code: "AUTH_REQUIRED",
            retryable: false,
            trace_id: "019a2b3c-4d5e-7000-8000-000000000001",
          },
        } satisfies FailureEnvelope,
        { status: 401 },
      ),
    ),
  );
  await expect(getOrganizations()).rejects.toBeInstanceOf(ApiFailure);
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/organizations_list_v1",
      () => new HttpResponse("bad gateway", { status: 502 }),
    ),
  );
  await expect(getOrganizations()).rejects.toThrow("valid API envelope");
});

test("calendar pagination preserves tenant, center and interval and discards partial data on failure", async () => {
  const interval = { starts_at: "2026-10-28T21:00:00Z", ends_at: "2026-10-29T21:00:00Z" };
  let calls = 0;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/calendar_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["calendar_get_v1"]["request"];
        expect(body.org_id).toBe("org-a");
        expect(body.center_id).toBe("center-a");
        expect(body.interval).toEqual(interval);
        expect(body.page.sort).toBe("starts_at_asc");
        expect(body.page.cursor).toBe(calls === 0 ? undefined : "page-2");
        calls++;
        if (calls === 2)
          return HttpResponse.json(
            {
              ok: false,
              error: { code: "FORBIDDEN", retryable: false, trace_id: body.request_id },
            } satisfies FailureEnvelope,
            { status: 403 },
          );
        return HttpResponse.json({
          ok: true,
          data: {
            items: [
              {
                id: "session-a",
                type: "session",
                center_id: "center-a",
                title: "First page",
                ...interval,
              },
            ],
            next_cursor: "page-2",
            as_of: interval.starts_at,
          },
          trace_id: body.request_id,
        } satisfies Operations["calendar_get_v1"]["response"]);
      },
    ),
  );
  await expect(
    getCalendar({ org_id: "org-a", center_id: "center-a", interval }),
  ).rejects.toBeInstanceOf(ApiFailure);
  expect(calls).toBe(2);
});
