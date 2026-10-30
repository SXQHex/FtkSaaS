import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import {
  getAvailability,
  recoverSetup,
  sendSetupCommand,
  setupStorageKey,
  weeklyRule,
} from "../src/lib/studio-setup";
import type { SetupCommand } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({
        error: null,
        data: { session: { access_token: "synthetic-session" } },
      }),
    },
  }),
}));
const org = "019a2b3c-4d5e-7000-8000-000000000002";
const base = "https://setup.example.invalid/functions/v1/backend-v1";
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://setup.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-key");
});
test("setup retry keeps payload/key and obtains a new UUIDv7 transport ID", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${base}/room_save_v1`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ok: true, data: { primary_id: org } });
    }),
  );
  const command: SetupCommand = {
    operation: "room_save_v1",
    input: { org_id: org, center_id: org, operation_key: org, name: "Room", capacity: 40 },
  };
  await sendSetupCommand(command);
  await sendSetupCommand(command);
  expect(bodies[0].request_id).not.toBe(bodies[1].request_id);
  expect(bodies.map(({ request_id: _id, ...rest }) => rest)).toEqual(
    [1, 2].map(() => ({ ...command.input, client_api_version: 1 })),
  );
});
test("availability reads use only the implemented selector with resource-scoped pagination", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${base}/management_state_get_v1`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: true,
        data: {
          items: [],
          next_cursor: bodies.length === 1 ? "next" : null,
          as_of: "2030-01-01T00:00:00Z",
        },
      });
    }),
  );
  await getAvailability(org, org, { kind: "person", id: org });
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toMatchObject({
    org_id: org,
    center_id: org,
    operation: "availability_save_v1",
    selector: { operation: "availability_save_v1", key: { resource: { kind: "person", id: org } } },
    page: { cursor: "next", sort: "created_at_asc" },
  });
});
test("weekly forms reject overnight shifts and accept explicit midnight split boundaries", () => {
  const data = new FormData();
  data.append("weekdays", "1");
  data.set("start", "23:00");
  data.set("end", "01:00");
  data.set("from", "2030-01-01");
  expect(() => weeklyRule(data)).toThrow("invalidWeeklyRule");
  data.set("end", "24:00");
  expect(weeklyRule(data)).toEqual({
    weekdays: [1],
    local_start: "23:00:00",
    local_end: "24:00:00",
    valid_from: "2030-01-01",
    valid_until: null,
  });
  data.set("end", "24:01");
  expect(() => weeklyRule(data)).toThrow("invalidWeeklyRule");
});
test("recovery rejects foreign scopes and unknown fields and keeps expiry tombstones", () => {
  const scope = { actorId: "actor", orgId: org, centerId: org };
  const slot = "room:new";
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: {
        operation: "room_save_v1",
        input: { org_id: org, center_id: org, operation_key: org, capacity: 40, name: "Room" },
      },
      blocked: true,
    }),
  );
  expect(recoverSetup(scope, slot)).toMatchObject({ blocked: true });
  expect(recoverSetup({ ...scope, actorId: "other" }, slot)).toBeNull();
  const bad = JSON.parse(sessionStorage.getItem(setupStorageKey(scope, slot))!);
  bad.command.input.actor_id = "injected";
  sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify(bad));
  expect(recoverSetup(scope, slot)).toBe("invalid");
});
