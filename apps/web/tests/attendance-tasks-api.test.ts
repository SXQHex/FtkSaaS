import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { attendanceTasksApi } from "../src/lib/attendance-tasks";
import { id, reservation, scope } from "./attendance-fixtures";
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
const interval = { starts_at: "2026-11-06T00:00:00Z", ends_at: "2026-11-07T00:00:00Z" };
const row = {
  id,
  type: "session",
  center_id: reservation,
  title: "Tango",
  starts_at: "2026-11-06T10:00:00Z",
  ends_at: "2026-11-06T11:00:00Z",
  discipline_id: id,
};
test("task discovery keeps tenant/center/interval/cursor and never guesses an actor person filter", async () => {
  server.use(
    http.post("*/functions/v1/backend-v1/calendar_get_v1", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        org_id: scope.orgId,
        center_id: scope.centerId,
        interval,
        page: { limit: 25, sort: "starts_at_asc", cursor: "next" },
      });
      expect(body).not.toHaveProperty("resource");
      return HttpResponse.json({
        ok: true,
        trace_id: id,
        data: { items: [row], next_cursor: "following", as_of: interval.starts_at },
      });
    }),
  );
  await expect(attendanceTasksApi.list(scope, interval, "next")).resolves.toMatchObject({
    items: [row],
    next_cursor: "following",
  });
});
test.each(["foreign-center", "duplicate", "outside"])(
  "%s task projections are rejected",
  async (mode) => {
    const changed =
      mode === "foreign-center"
        ? [{ ...row, center_id: id }]
        : mode === "duplicate"
          ? [row, row]
          : [{ ...row, starts_at: "2026-11-08T10:00:00Z", ends_at: "2026-11-08T11:00:00Z" }];
    server.use(
      http.post("*/functions/v1/backend-v1/calendar_get_v1", () =>
        HttpResponse.json({
          ok: true,
          trace_id: id,
          data: { items: changed, next_cursor: null, as_of: interval.starts_at },
        }),
      ),
    );
    await expect(attendanceTasksApi.list(scope, interval)).rejects.toThrow("invalidAttendance");
  },
);

test("event rows are excluded while their page cursor is retained for later sessions", async () => {
  server.use(
    http.post("*/functions/v1/backend-v1/calendar_get_v1", () =>
      HttpResponse.json({
        ok: true,
        trace_id: id,
        data: {
          items: [{ ...row, type: "event", discipline_id: null, discipline_ids: [id] }],
          next_cursor: "more",
          as_of: interval.starts_at,
        },
      }),
    ),
  );
  await expect(attendanceTasksApi.list(scope, interval)).resolves.toMatchObject({
    items: [],
    next_cursor: "more",
  });
});
