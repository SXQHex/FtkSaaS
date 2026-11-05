import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { bookingApi } from "../src/lib/bookings";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "synthetic" } },
        error: null,
      }),
    },
  }),
}));
const actor = "019a2b3c-4d5e-7000-8000-000000000080",
  person = "019a2b3c-4d5e-7000-8000-000000000081",
  scope = { actorId: actor, orgId: actor, centerId: actor },
  endpoint = "https://project.example.invalid/functions/v1/backend-v1/management_state_get_v1";
function choice(kind: string, id: string, name: string) {
  return {
    operation: "lesson_request_create_v1",
    entity: { type: kind === "disciplines" ? "disciplines" : "people", id },
    exists: true,
    state: "active",
    versions: [],
    as_of: "2026-11-05T00:00:00Z",
    current: {
      operation: "lesson_request_create_v1",
      values: {
        [kind === "disciplines" ? "discipline_id" : "preferred_instructor_id"]: id,
        display_name: name,
      },
    },
  };
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("request choices use the selected person and narrow paginated reader without role management", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      const body = (await request.json()) as {
        selector: { key: { catalog: string } };
        page: { cursor?: string };
      };
      bodies.push(body);
      const kind = body.selector.key.catalog,
        second = !!body.page.cursor;
      return HttpResponse.json({
        ok: true,
        trace_id: actor,
        data: {
          items: [choice(kind, second ? person : actor, second ? "İkinci" : "İlk")],
          next_cursor: kind === "disciplines" && !second ? "discipline-page-2" : null,
          as_of: "2026-11-05T00:00:00Z",
        },
      });
    }),
  );
  await expect(bookingApi.catalog(scope, person)).resolves.toEqual({
    disciplines: [
      { id: actor, name: "İlk" },
      { id: person, name: "İkinci" },
    ],
    instructors: [{ id: actor, name: "İlk" }],
  });
  expect(bodies).toHaveLength(3);
  for (const body of bodies)
    expect(body).toMatchObject({
      org_id: actor,
      center_id: actor,
      operation: "lesson_request_create_v1",
      selector: { operation: "lesson_request_create_v1", key: { person_id: person } },
      page: { sort: "created_at_asc", limit: 200 },
    });
  expect(bodies).toContainEqual(
    expect.objectContaining({
      page: {
        sort: "created_at_asc",
        limit: 200,
        cursor: "discipline-page-2",
      },
    }),
  );
});
test.each(["identity", "operation", "inactive", "cursor"])(
  "invalid %s catalog fails closed",
  async (fault) => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        const body = (await request.json()) as { selector: { key: { catalog: string } } };
        const item = choice(body.selector.key.catalog, actor, "Sentetik");
        if (fault === "identity") item.entity.id = person;
        if (fault === "operation") item.current.operation = "lesson_request_withdraw_v1";
        if (fault === "inactive") item.state = "inactive";
        return HttpResponse.json({
          ok: true,
          trace_id: actor,
          data: {
            items: fault === "cursor" ? [] : [item],
            next_cursor: fault === "cursor" ? "repeated" : null,
            as_of: item.as_of,
          },
        });
      }),
    );
    await expect(bookingApi.catalog(scope, person)).rejects.toThrow("invalidForm");
  },
);
test("catalog access denial remains a denial instead of an empty successful catalog", async () => {
  server.use(
    http.post(endpoint, () =>
      HttpResponse.json(
        { ok: false, trace_id: actor, error: { code: "FORBIDDEN", message: "Not allowed" } },
        { status: 403 },
      ),
    ),
  );
  await expect(bookingApi.catalog(scope, person)).rejects.toThrow("FORBIDDEN");
});
