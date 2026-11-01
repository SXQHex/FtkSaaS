import { expect, test, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import {
  ApiFailure,
  getCalendar,
  getOrganizations,
  getSession,
  applySessionChange,
  getStudents,
  getPerson,
  changeStudent,
  getStudentChangeStatus,
} from "../src/lib/api";
import { listStudentDisciplines, searchMergePeople } from "../src/lib/student-management";
import type { FailureEnvelope, Operations } from "@ftksaas/api-contracts";
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
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable");
});

test("student reads preserve center scope, supported sort and cursor; detail is a separate request", async () => {
  const calls: Operations["people_list_v1"]["request"][] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/people_list_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["people_list_v1"]["request"];
        calls.push(body);
        expect(request.headers.get("authorization")).toBe("Bearer synthetic-session");
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: "scoped-cursor", as_of: "2030-10-29T00:00:00Z" },
          trace_id: body.request_id,
        } satisfies Operations["people_list_v1"]["response"]);
      },
    ),
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/person_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["person_get_v1"]["request"];
        expect(body).toMatchObject({ org_id: "org", center_id: "center", person_id: "person" });
        return HttpResponse.json(
          {
            ok: false,
            error: { code: "FORBIDDEN", retryable: false, trace_id: body.request_id },
          } satisfies FailureEnvelope,
          { status: 403 },
        );
      },
    ),
  );
  const query = { orgId: "org", centerId: "center", query: "Deniz" };
  const first = await getStudents(query);
  await getStudents({ ...query, cursor: first.next_cursor! });
  expect(calls.map(({ request_id: _id, ...rest }) => rest)).toEqual(
    [undefined, "scoped-cursor"].map((cursor) => ({
      client_api_version: 1,
      org_id: "org",
      center_id: "center",
      relationship: "student",
      query: "Deniz",
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    })),
  );
  expect(calls[0].request_id).not.toBe(calls[1].request_id);
  await expect(getPerson("org", "center", "person")).rejects.toBeInstanceOf(ApiFailure);
});

test("student mutation replay keeps the entire command, renews request IDs and checks the exact operation", async () => {
  const calls: Operations["student_deactivate_v1"]["request"][] = [];
  const command = {
    operation: "student_deactivate_v1" as const,
    input: {
      org_id: "org",
      center_id: "center",
      person_id: "person",
      operation_key: "019a2b3c-4d5e-7000-8000-000000000021",
      reason: "Ara verdi",
    },
  };
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/student_deactivate_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["student_deactivate_v1"]["request"];
        calls.push(body);
        return HttpResponse.json({
          ok: true,
          data: {
            operation_id: "operation",
            primary_id: "relationship",
            related: [],
            replayed: calls.length > 1,
          },
          trace_id: body.request_id,
        } satisfies Operations["student_deactivate_v1"]["response"]);
      },
    ),
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/operation_status_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["operation_status_get_v1"]["request"];
        expect(body).toMatchObject({
          org_id: "org",
          operation: command.operation,
          key: command.input.operation_key,
        });
        return HttpResponse.json({
          ok: true,
          data: {
            operation: command.operation,
            key: command.input.operation_key,
            status: "succeeded",
            result_available: true,
            result_reference: { type: "center_relationships", id: "relationship" },
          },
          trace_id: body.request_id,
        } satisfies Operations["operation_status_get_v1"]["response"]);
      },
    ),
  );
  await changeStudent(command);
  expect((await changeStudent(command)).replayed).toBe(true);
  expect(calls.map(({ request_id: _id, ...rest }) => rest)).toEqual(
    [1, 2].map(() => ({ client_api_version: 1, ...command.input })),
  );
  expect(calls[0].request_id).not.toBe(calls[1].request_id);
  expect(
    (await getStudentChangeStatus("org", command.operation, command.input.operation_key)).status,
  ).toBe("succeeded");
});

test("direct session lookup preserves org and session and lets the backend resolve center scope", async () => {
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/session_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["session_get_v1"]["request"];
        expect(body.org_id).toBe("org-a");
        expect(body.session_id).toBe("session-a");
        expect(body).not.toHaveProperty("center_id");
        return HttpResponse.json(
          {
            ok: false,
            error: { code: "FORBIDDEN", retryable: false, trace_id: body.request_id },
          } satisfies FailureEnvelope,
          { status: 403 },
        );
      },
    ),
  );
  await expect(getSession("org-a", undefined, "session-a")).rejects.toBeInstanceOf(ApiFailure);
});
test("shared transport follows typed cursor pages with native authorization and UUIDv7 request IDs", async () => {
  let calls = 0;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/organizations_list_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["organizations_list_v1"]["request"];
        expect(body.request_id).toMatch(
          /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
        );
        expect(request.headers.get("authorization")).toBe("Bearer synthetic-session");
        expect(request.headers.get("apikey")).toBe("synthetic-publishable");
        calls++;
        expect(body.page.cursor).toBe(calls === 1 ? undefined : "next-page");
        const response = {
          ok: true,
          data: {
            items: [],
            as_of: "2026-10-28T00:00:00Z",
            next_cursor: calls === 1 ? "next-page" : null,
          },
          trace_id: body.request_id,
        } satisfies Operations["organizations_list_v1"]["response"];
        return HttpResponse.json(response);
      },
    ),
  );
  expect(await getOrganizations()).toEqual([]);
  expect(calls).toBe(2);
});
test("API failure and invalid transport never become successful empty data", async () => {
  server.use(
    http.post("https://project.example.invalid/functions/v1/backend-v1/organizations_list_v1", () =>
      HttpResponse.json(
        {
          ok: false,
          error: {
            code: "AUTH_REQUIRED",
            retryable: false,
            trace_id: "019a2b3c-4d5e-7000-8000-000000000001",
          },
        } satisfies FailureEnvelope,
        { status: 401 },
      ),
    ),
  );
  await expect(getOrganizations()).rejects.toBeInstanceOf(ApiFailure);
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/organizations_list_v1",
      () => new HttpResponse("bad gateway", { status: 502 }),
    ),
  );
  await expect(getOrganizations()).rejects.toThrow("valid API envelope");
});

test("calendar pagination preserves tenant, center and interval and discards partial data on failure", async () => {
  const interval = { starts_at: "2026-10-28T21:00:00Z", ends_at: "2026-10-29T21:00:00Z" };
  let calls = 0;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/calendar_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["calendar_get_v1"]["request"];
        expect(body.org_id).toBe("org-a");
        expect(body.center_id).toBe("center-a");
        expect(body.interval).toEqual(interval);
        expect(body.page.sort).toBe("starts_at_asc");
        expect(body.page.cursor).toBe(calls === 0 ? undefined : "page-2");
        calls++;
        if (calls === 2)
          return HttpResponse.json(
            {
              ok: false,
              error: { code: "FORBIDDEN", retryable: false, trace_id: body.request_id },
            } satisfies FailureEnvelope,
            { status: 403 },
          );
        return HttpResponse.json({
          ok: true,
          data: {
            items: [
              {
                id: "session-a",
                type: "session",
                center_id: "center-a",
                title: "First page",
                ...interval,
              },
            ],
            next_cursor: "page-2",
            as_of: interval.starts_at,
          },
          trace_id: body.request_id,
        } satisfies Operations["calendar_get_v1"]["response"]);
      },
    ),
  );
  await expect(
    getCalendar({ org_id: "org-a", center_id: "center-a", interval }),
  ).rejects.toBeInstanceOf(ApiFailure);
  expect(calls).toBe(2);
});

test("session apply replay keeps its operation key and token while each transport request gets a new ID", async () => {
  const calls: Operations["session_change_apply_v1"]["request"][] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/session_change_apply_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["session_change_apply_v1"]["request"];
        calls.push(body);
        expect(request.headers.get("authorization")).toBe("Bearer synthetic-session");
        return HttpResponse.json({
          ok: true,
          data: {
            operation_id: "operation",
            primary_id: "session-a",
            related: [],
            replayed: calls.length > 1,
          },
          trace_id: body.request_id,
        } satisfies Operations["session_change_apply_v1"]["response"]);
      },
    ),
  );
  const command = {
    org_id: "org-a",
    operation_key: "019a2b3c-4d5e-7000-8000-000000000016",
    preview: { id: "019a2b3c-4d5e-7000-8000-000000000013", token: "synthetic-preview-token" },
  };
  await applySessionChange(command);
  expect((await applySessionChange(command)).replayed).toBe(true);
  expect(calls.map(({ request_id: _request, ...body }) => body)).toEqual([
    { client_api_version: 1, ...command },
    { client_api_version: 1, ...command },
  ]);
  expect(calls[0].request_id).not.toBe(calls[1].request_id);
});

test("discipline catalogue follows all cursors and merge target search does not restrict people to students", async () => {
  const pages: Operations["disciplines_list_v1"]["request"][] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/disciplines_list_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["disciplines_list_v1"]["request"];
        pages.push(body);
        return HttpResponse.json({
          ok: true,
          data: {
            items: [
              {
                id: body.page.cursor ? "second" : "first",
                name: "Tango",
                state: "active",
                version: 1,
              },
            ],
            next_cursor: body.page.cursor ? null : "catalogue-page-2",
          },
          trace_id: body.request_id,
        } satisfies Operations["disciplines_list_v1"]["response"]);
      },
    ),
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/people_list_v1",
      async ({ request }) => {
        const body = (await request.json()) as Operations["people_list_v1"]["request"];
        expect(body).toMatchObject({
          org_id: "org",
          center_id: "center",
          query: "Selin",
          page: { limit: 25, sort: "created_at_asc", cursor: "people-page-2" },
        });
        expect(body).not.toHaveProperty("relationship");
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null, as_of: "2030-01-01T00:00:00Z" },
          trace_id: body.request_id,
        } satisfies Operations["people_list_v1"]["response"]);
      },
    ),
  );
  expect((await listStudentDisciplines("org")).map((d) => d.id)).toEqual(["first", "second"]);
  expect(pages.map((p) => p.page.cursor)).toEqual([undefined, "catalogue-page-2"]);
  expect(pages.every((p) => p.org_id === "org")).toBe(true);
  expect(pages[0].request_id).not.toBe(pages[1].request_id);
  await searchMergePeople("org", "center", "Selin", "people-page-2");
});
