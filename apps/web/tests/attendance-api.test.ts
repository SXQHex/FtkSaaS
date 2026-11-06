import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { attendanceApi } from "../src/lib/attendance";
import { id, reservation, scope, session, view } from "./attendance-fixtures";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test.each([
  "attendance_start_v1",
  "attendance_mark_v1",
  "attendance_block_v1",
  "attendance_close_v1",
  "attendance_correct_preview_v1",
] as const)("%s validates the independent selector and exact projection", async (operation) => {
  const key =
    operation === "attendance_mark_v1" || operation === "attendance_block_v1"
      ? { reservation_id: reservation }
      : { session_id: reservation };
  let wrong = false;
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", async ({ request }) => {
      expect(await request.json()).toMatchObject({
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation,
        selector: { operation, key },
      });
      return HttpResponse.json({
        ok: true,
        trace_id: id,
        data: {
          items: [
            {
              operation,
              current: {
                operation,
                values: wrong ? Object.fromEntries(Object.keys(key).map((k) => [k, id])) : key,
              },
              exists: true,
              entity: { type: "sessions", id: reservation },
              state: "planned",
              versions: [],
              as_of: "2026-01-01T10:00:00Z",
            },
          ],
          as_of: "2026-01-01T10:00:00Z",
        },
      });
    }),
  );
  await expect(attendanceApi.access(scope, operation, reservation)).resolves.toBe(true);
  wrong = true;
  await expect(attendanceApi.access(scope, operation, reservation)).resolves.toBe(false);
});
test.each(["FORBIDDEN", "NOT_FOUND"])("%s is not a writer permission", async (code) => {
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: id,
        error: { code, trace_id: id, retryable: false },
      }),
    ),
  );
  await expect(attendanceApi.access(scope, "attendance_close_v1", id)).resolves.toBe(false);
});
test("configuration failure remains visible rather than a role fallback", async () => {
  server.use(
    http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: id,
        error: { code: "POLICY_NOT_CONFIGURED", trace_id: id, retryable: false },
      }),
    ),
  );
  await expect(attendanceApi.access(scope, "attendance_start_v1", id)).rejects.toThrow(
    "POLICY_NOT_CONFIGURED",
  );
});
test("parallel read rejects a foreign sheet and a mismatched session version", async () => {
  let current = { ...view, session_id: reservation };
  server.use(
    http.post("*/functions/v1/backend-v1/session_get_v1", () =>
      HttpResponse.json({ ok: true, trace_id: id, data: session }),
    ),
    http.post("*/functions/v1/backend-v1/attendance_get_v1", () =>
      HttpResponse.json({ ok: true, trace_id: id, data: current }),
    ),
  );
  await expect(attendanceApi.read(scope, id)).rejects.toThrow("invalidAttendance");
  current = { ...view, session_version: 7 };
  await expect(attendanceApi.read(scope, id)).rejects.toThrow("VERSION_CONFLICT");
  current = view;
  await expect(attendanceApi.read(scope, id)).resolves.toEqual({ session, view });
});
