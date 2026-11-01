import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { listPersonAccess, changePersonAccess, accessTarget } from "../src/lib/person-access";
import { sampleStudentScope as scope } from "../src/components/admin/student-fixtures";
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
const base = "https://project.example.invalid/functions/v1/backend-v1";
const id = "019a2b3c-4d5e-7000-8000-000000000080";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable");
});
test("person selectors retain explicit tenant/center and scoped cursor without leaking actor identity", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${base}/management_state_get_v1`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-02T00:00:00Z" },
        trace_id: id,
      });
    }),
  );
  await listPersonAccess(scope, id, "account_access_revoke_v1");
  await listPersonAccess(scope, id, "account_link_remove_v1", "scoped-cursor");
  expect(bodies[0]).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "account_access_revoke_v1",
    selector: { operation: "account_access_revoke_v1", key: { person_id: id } },
    page: { limit: 25 },
  });
  expect(bodies[1]).toMatchObject({
    operation: "account_link_remove_v1",
    selector: { operation: "account_link_remove_v1", key: { person_id: id } },
    page: { limit: 25, cursor: "scoped-cursor" },
  });
  expect(bodies[0]).not.toHaveProperty("actorId");
});
test("access replay preserves business payload and refreshes transport request ID", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${base}/account_link_remove_v1`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: true,
        data: { primary_id: id, operation_id: id, related: [], replayed: bodies.length > 1 },
        trace_id: id,
      });
    }),
  );
  const command = {
    operation: "account_link_remove_v1" as const,
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      link_id: id,
      operation_key: id,
      expected_version: 7,
      reason: "Synthetic correction",
    },
  };
  await changePersonAccess(command);
  await changePersonAccess(command);
  expect(bodies[0].request_id).not.toBe(bodies[1].request_id);
  expect(bodies.map(({ request_id: _request, ...body }) => body)).toEqual(
    [1, 2].map(() => ({ client_api_version: 1, ...command.input })),
  );
});
test("a projection without the matching entity version never offers a target", () => {
  expect(
    accessTarget(
      {
        operation: "account_link_remove_v1",
        entity: { type: "account_links", id },
        exists: true,
        state: "active",
        versions: [],
        as_of: "2026-11-02T00:00:00Z",
        current: {
          operation: "account_link_remove_v1",
          values: { person_id: id, link_id: id, actionable: true },
        },
      },
      "account_link_remove_v1",
    ),
  ).toBeNull();
});
