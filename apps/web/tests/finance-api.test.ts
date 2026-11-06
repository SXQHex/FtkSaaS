import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("collection reaches the native typed transport with its explicit payment snapshot", async () => {
  server.use(
    http.post("*/functions/v1/backend-v1/collection_record_v1", async ({ request }) => {
      expect(await request.json()).toMatchObject({
        amount_minor: "160050",
        payment: { method: "bank_transfer", reference: "BANKA-TEST" },
      });
      return HttpResponse.json({
        ok: true,
        data: { primary_id: id, operation_id: id, version: 1, related: [], replayed: false },
        trace_id: id,
      });
    }),
  );
  await expect(
    setupCall("collection_record_v1", {
      org_id: id,
      center_id: id,
      operation_key: id,
      person_id: id,
      amount_minor: "160050",
      currency: "TRY",
      occurred_at: "2026-11-06T10:00:00.000Z",
      payment: { method: "bank_transfer", reference: "BANKA-TEST" },
    }),
  ).resolves.toMatchObject({ primary_id: id });
});
