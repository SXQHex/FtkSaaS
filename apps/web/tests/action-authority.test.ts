import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { bookingApi } from "../src/lib/bookings";
import { financeApi } from "../src/lib/finance";
import { balanceApi, refundApi } from "../src/lib/finance-management";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: id, centerId: other };
const cases = [
  {
    operation: "reservation_capacity_override_v1",
    key: { person_id: id, session_id: other },
    entity: { type: "sessions", id: other },
    read: () => bookingApi.capacity(scope, id, other),
  },
  {
    operation: "collection_record_v1",
    key: { person_id: id },
    entity: { type: "people", id },
    read: () => financeApi.canCollect(scope, id),
  },
  {
    operation: "student_credit_refund_v1",
    key: { person_id: id },
    entity: { type: "people", id },
    read: () => balanceApi.access(scope, "student_credit_refund_v1", id, other),
  },
  {
    operation: "student_credit_offset_v1",
    key: { person_id: id, debt_id: other },
    entity: { type: "debts", id: other },
    read: () => balanceApi.access(scope, "student_credit_offset_v1", id, other),
  },
  {
    operation: "debt_adjust_v1",
    key: { debt_id: other },
    entity: { type: "debts", id: other },
    read: () => balanceApi.access(scope, "debt_adjust_v1", id, other),
  },
  {
    operation: "sale_refund_preview_v1",
    key: { sale_id: other },
    entity: { type: "sales", id: other },
    read: () => refundApi.access(scope, other),
  },
];
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
function install(data: unknown) {
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
      HttpResponse.json({ ok: true, trace_id: id, data }),
    ),
  );
}
function item(c: (typeof cases)[number]) {
  return {
    operation: c.operation,
    exists: true,
    entity: c.entity,
    state: "active",
    versions: [{ entity: c.entity, version: 9 }],
    as_of: "2026-11-06T10:00:00Z",
    current: { operation: c.operation, values: c.key },
  };
}
test.each(cases)("$operation: empty discovery never grants authority", async (c) => {
  install({ items: [], next_cursor: null, as_of: "2026-11-06T10:00:00Z" });
  await expect(c.read()).resolves.toBe(false);
});
test.each(cases)(
  "$operation: native source identity/version grants discovery without any command",
  async (c) => {
    let reads = 0;
    server.use(
      http.post("*/functions/v1/backend-v1/management_state_get_v1", async ({ request }) => {
        reads++;
        expect(await request.json()).toMatchObject({
          org_id: id,
          center_id: other,
          operation: c.operation,
          selector: { operation: c.operation, key: c.key },
        });
        return HttpResponse.json({
          ok: true,
          trace_id: id,
          data: { items: [item(c)], next_cursor: null, as_of: "2026-11-06T10:00:00Z" },
        });
      }),
    );
    await expect(c.read()).resolves.toBe(true);
    expect(reads).toBe(1);
  },
);
test.each(cases)(
  "$operation: missing source or version cannot be mistaken for writer permission",
  async (c) => {
    for (const patch of [
      { exists: false },
      { versions: [] },
      { versions: [{ entity: c.entity, version: 0 }] },
      { entity: { ...c.entity, id: c.entity.id === id ? other : id } },
    ]) {
      install({ items: [{ ...item(c), ...patch }], as_of: "2026-11-06T10:00:00Z" });
      await expect(c.read()).rejects.toThrow("invalidActionAuthority");
    }
  },
);
test.each(cases)("$operation: ambiguous or wrong source projection is rejected", async (c) => {
  for (const items of [
    [item(c), item(c)],
    [{ ...item(c), entity: { type: "receipts", id: c.entity.id } }],
  ]) {
    install({ items, as_of: "2026-11-06T10:00:00Z" });
    await expect(c.read()).rejects.toThrow("invalidActionAuthority");
  }
});

test("capacity discovery preserves optional cross-center sale scope without a client center assumption", async () => {
  const { actionAuthority } = await import("../src/lib/action-authority");
  const key = { person_id: id, session_id: other, source_sale_id: id };
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", async ({ request }) => {
      expect(await request.json()).toMatchObject({ center_id: other, selector: { key } });
      return HttpResponse.json({
        ok: true,
        trace_id: id,
        data: {
          items: [{ ...item(cases[0]!), current: { operation: cases[0]!.operation, values: key } }],
          as_of: "2026-11-06T10:00:00Z",
        },
      });
    }),
  );
  await expect(
    actionAuthority(scope, { operation: "reservation_capacity_override_v1", key }),
  ).resolves.toBe(true);
});
function deny(code: string) {
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: id,
        error: { code, retryable: false, trace_id: id },
      }),
    ),
  );
}
test.each(["FORBIDDEN", "NOT_FOUND"])("%s never grants collection authority", async (code) => {
  deny(code);
  await expect(financeApi.canCollect(scope, id)).resolves.toBe(false);
});
test.each(["PLAN_FEATURE_UNAVAILABLE", "POLICY_NOT_CONFIGURED", "SESSION_REVOKED"])(
  "%s remains diagnosable rather than becoming an inferred permission",
  async (code) => {
    const { ApiFailure } = await import("../src/lib/api");
    deny(code);
    await expect(financeApi.canCollect(scope, id)).rejects.toBeInstanceOf(ApiFailure);
  },
);

test.each(cases)(
  "$operation: another selector target is unavailable without changing the old denial contract",
  async (c) => {
    install({
      items: [
        { ...item(c), current: { operation: c.operation, values: { ...c.key, person_id: other } } },
      ],
      as_of: "2026-11-06T10:00:00Z",
    });
    await expect(c.read()).resolves.toBe(false);
  },
);
