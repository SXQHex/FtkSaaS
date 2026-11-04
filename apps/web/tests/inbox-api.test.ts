import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { server } from "./mocks/server";
import { inboxTarget, listInbox, notificationVersion, listAudit } from "../src/lib/inbox";
import { recoverSetup, sendSetupCommand, setupStorageKey } from "../src/lib/studio-setup";
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
const scope = { actorId: id, orgId: "019a2b3c-4d5e-7000-8000-000000000081" };
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable");
});
test("inbox and audit retain tenant, ascending cursor and the exact authorized subject", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    ...["notifications_list_v1", "audit_list_v1"].map((op) =>
      http.post(`${base}/${op}`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null, as_of: "2026-11-04T00:00:00Z" },
          trace_id: id,
        });
      }),
    ),
  );
  await listInbox(scope, true, "next");
  await listAudit(
    scope,
    { type: "sessions", id },
    { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-05T00:00:00Z" },
    "audit-next",
  );
  expect(bodies[0]).toMatchObject({
    org_id: scope.orgId,
    unread_only: true,
    page: { limit: 25, sort: "created_at_asc", cursor: "next" },
  });
  expect(bodies[1]).toMatchObject({
    org_id: scope.orgId,
    subject: { type: "sessions", id },
    interval: { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-05T00:00:00Z" },
    page: { limit: 25, sort: "created_at_asc", cursor: "audit-next" },
  });
  expect(bodies[0]).not.toHaveProperty("actorId");
  expect(bodies[0]).not.toHaveProperty("center_id");
});
const projection: ManagementStateView = {
  operation: "notification_mark_read_v1",
  entity: { type: "notifications", id },
  exists: true,
  state: "unread",
  versions: [{ entity: { type: "notifications", id }, version: 7 }],
  current: { operation: "notification_mark_read_v1", values: { notification_id: id } },
  as_of: "2026-11-04T00:00:00Z",
};
test("mark-read uses only the matching notification's management version", () => {
  expect(notificationVersion(projection, id)).toBe(7);
  expect(notificationVersion({ ...projection, exists: false }, id)).toBeNull();
  expect(notificationVersion({ ...projection, versions: [] }, id)).toBeNull();
  expect(notificationVersion({ ...projection, entity: { type: "sessions", id } }, id)).toBeNull();
  expect(notificationVersion(projection, scope.orgId)).toBeNull();
});
test("untrusted subjects cannot become external, injected or unsupported links", () => {
  expect(inboxTarget(scope.orgId, { type: "sessions", id })).toBe(
    `/organizasyon/${scope.orgId}/seans/${id}`,
  );
  expect(inboxTarget(scope.orgId, { type: "people", id })).toBeNull();
  expect(inboxTarget(scope.orgId, { type: "sessions", id: "//evil.invalid" })).toBeNull();
  expect(inboxTarget("../evil", { type: "sessions", id })).toBeNull();
});
test("read mutation survives reload with its approved version/key and gets a fresh request ID", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${base}/notification_mark_read_v1`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: true,
        data: { primary_id: id, operation_id: id, replayed: bodies.length > 1, related: [] },
        trace_id: id,
      });
    }),
  );
  const command = {
    operation: "notification_mark_read_v1" as const,
    input: { org_id: scope.orgId, notification_id: id, expected_version: 7, operation_key: id },
  };
  const key = setupStorageKey(scope, `notification:${id}`);
  sessionStorage.setItem(key, JSON.stringify({ command }));
  const recovered = recoverSetup(scope, `notification:${id}`);
  expect(recovered).toEqual({ command });
  if (!recovered || recovered === "invalid") throw new Error("Missing recovery");
  await sendSetupCommand(command);
  await sendSetupCommand(recovered.command);
  expect(bodies[0].request_id).not.toBe(bodies[1].request_id);
  expect(bodies.map(({ request_id: _id, ...body }) => body)).toEqual(
    [1, 2].map(() => ({ client_api_version: 1, ...command.input })),
  );
});
