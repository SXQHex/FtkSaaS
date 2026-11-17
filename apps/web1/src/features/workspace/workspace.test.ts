import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
const { native } = vi.hoisted(() => ({ native: { getSession: vi.fn() } }));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
import { readWorkspace } from "./workspace";
const accountId = "019a7b00-0000-7000-8000-000000000001";
const orgId = "019a7b00-0000-7000-8000-000000000002";
const personId = "019a7b00-0000-7000-8000-000000000003";
const centerId = "019a7b00-0000-7000-8000-000000000004";
let empty: boolean, multiple: boolean, scopeChanged: boolean, instructorOnly: boolean;
const requests: { operation: string; bearer: string | null; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  empty = false;
  multiple = false;
  scopeChanged = false;
  instructorOnly = false;
  requests.length = 0;
  vi.stubEnv("VITE_SUPABASE_URL", "https://backend.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "native-fixture" } },
    error: null,
  });
  server.use(
    http.post(
      "https://backend.invalid/functions/v1/backend-v1/:operation",
      async ({ request, params }) => {
        const operation = String(params.operation);
        const body = (await request.json()) as Record<string, unknown>;
        requests.push({ operation, bearer: request.headers.get("authorization"), body });
        let data: unknown;
        if (operation === "account_get_v1")
          data = { id: scopeChanged ? orgId : accountId, state: "active", display_name: "Fixture" };
        else if (operation === "organizations_list_v1")
          data = {
            items: empty
              ? []
              : [
                  {
                    id: orgId,
                    name: "Owned fixture",
                    state: "active",
                    access_mode: "normal",
                    version: 1,
                    self_context: {
                      person_id: personId,
                      subscriber_number: null,
                      centers: instructorOnly
                        ? [
                            {
                              center_id: centerId,
                              instructor: true,
                              student: false,
                              assistant: false,
                            },
                          ]
                        : [],
                    },
                  },
                  ...(multiple
                    ? [
                        {
                          id: centerId,
                          name: "Other fixture",
                          state: "active",
                          access_mode: "normal",
                          version: 1,
                          self_context: null,
                        },
                      ]
                    : []),
                ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          };
        else if (operation === "centers_list_v1")
          data = {
            items: [
              {
                id: centerId,
                name: "Available",
                timezone: "Europe/Istanbul",
                state: "active",
                accessible: true,
                version: 1,
              },
              {
                id: personId,
                name: "Unavailable",
                timezone: "Europe/Istanbul",
                state: "active",
                accessible: false,
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          };
        else if (instructorOnly)
          return HttpResponse.json(
            { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: accountId } },
            { status: 403 },
          );
        else
          data = {
            items: [
              {
                id: accountId,
                person_id: personId,
                role: "owner",
                scope_center_id: null,
                state: "active",
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          };
        return HttpResponse.json({ ok: true, data, trace_id: accountId });
      },
    ),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("reads only the actor's organizations and exposes only accessible centers and own roles", async () => {
  const result = await readWorkspace(accountId);
  expect(result.selected?.id).toBe(orgId);
  expect(result.centers.map((c) => c.id)).toEqual([centerId]);
  expect(result.roles.map((r) => r.role)).toEqual(["owner"]);
  expect(requests.find((r) => r.operation === "roles_list_v1")?.body).toMatchObject({
    org_id: orgId,
    person_id: personId,
  });
  expect(requests.every((r) => r.bearer === "Bearer native-fixture")).toBe(true);
  expect(native.getSession).toHaveBeenCalledTimes(1);
});
it("requires explicit organization selection when there are several and invents no default scope", async () => {
  multiple = true;
  const result = await readWorkspace(accountId);
  expect(result.selected).toBeUndefined();
  expect(result.centers).toEqual([]);
  expect(result.roles).toEqual([]);
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1", "organizations_list_v1"]);
});
it("returns a real empty account context and clears an unavailable organization selection", async () => {
  empty = true;
  expect((await readWorkspace(accountId)).organizations).toEqual([]);
  const result = await readWorkspace(accountId, orgId);
  expect(result.selected).toBeUndefined();
  expect(result.centers).toEqual([]);
  expect(result.organizations).toEqual([]);
});
it("retains instructor self scope when the management role registry is forbidden", async () => {
  instructorOnly = true;
  const result = await readWorkspace(accountId);
  expect(result.selected?.id).toBe(orgId);
  expect(result.selected?.self_context?.centers).toEqual([
    { center_id: centerId, instructor: true, student: false, assistant: false },
  ]);
  expect(result.centers.map((c) => c.id)).toEqual([centerId]);
  expect(result.roles).toEqual([]);
});
it("preserves available organizations when the selected organization loses access", async () => {
  const result = await readWorkspace(accountId, personId);
  expect(result.selected).toBeUndefined();
  expect(result.organizations.map((o) => o.id)).toEqual([orgId]);
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1", "organizations_list_v1"]);
});
it("blocks a changed actor before any organization discovery", async () => {
  scopeChanged = true;
  await expect(readWorkspace(accountId)).rejects.toThrow("ACCOUNT_CHANGED");
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1"]);
});
