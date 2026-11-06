import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { balanceApi, refundApi } from "../src/lib/finance-management";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  debt = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: debt, orgId: person, centerId: debt };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test.each([
  "student_credit_refund_v1",
  "student_credit_offset_v1",
  "debt_adjust_v1",
  "sale_refund_preview_v1",
] as const)("%s checks its exact normal selector and projection target", async (operation) => {
  const key =
    operation === "sale_refund_preview_v1"
      ? { sale_id: debt }
      : operation === "debt_adjust_v1"
        ? { debt_id: debt }
        : operation === "student_credit_offset_v1"
          ? { person_id: person, debt_id: debt }
          : { person_id: person };
  let wrong = false;
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", async ({ request }) => {
      expect(await request.json()).toMatchObject({
        org_id: person,
        center_id: debt,
        operation,
        selector: { operation, key },
      });
      return HttpResponse.json({
        ok: true,
        trace_id: person,
        data: {
          items: [
            {
              operation,
              exists: true,
              entity: { type: "sales", id: debt },
              state: "active",
              versions: [],
              as_of: "2026-11-06T10:00:00Z",
              current: {
                operation,
                values: wrong
                  ? Object.fromEntries(
                      Object.keys(key).map((name) => [
                        name,
                        "019a2b3c-4d5e-7000-8000-000000000003",
                      ]),
                    )
                  : key,
              },
            },
          ],
          as_of: "2026-11-06T10:00:00Z",
        },
      });
    }),
  );
  const read = () =>
    operation === "sale_refund_preview_v1"
      ? refundApi.access(scope, debt)
      : balanceApi.access(scope, operation, person, debt);
  await expect(read()).resolves.toBe(true);
  wrong = true;
  await expect(read()).resolves.toBe(false);
});
test.each(["FORBIDDEN", "NOT_FOUND"])(
  "%s is not replaced with role or finance-read permission",
  async (code) => {
    server.use(
      http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
        HttpResponse.json({
          ok: false,
          trace_id: person,
          error: { code, retryable: false, trace_id: person },
        }),
      ),
    );
    const read = balanceApi.access(scope, "student_credit_refund_v1", person, debt);
    await expect(read).resolves.toBe(false);
  },
);

test("configuration failure remains an error rather than an inferred permission", async () => {
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: person,
        error: { code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: person },
      }),
    ),
  );
  await expect(balanceApi.access(scope, "student_credit_refund_v1", person, debt)).rejects.toThrow(
    "POLICY_NOT_CONFIGURED",
  );
});
