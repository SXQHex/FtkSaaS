import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import type { OrganizationView } from "@ftksaas/api-contracts";
const { native } = vi.hoisted(() => ({ native: { getSession: vi.fn() } }));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
import { hasWorkspaceManagementScope, readWorkspace, workspaceRoles } from "./workspace";
import { workspaceQuery } from "./workspace-query";
import { accountQuery } from "../auth/account-query";
const accountId = "019a7b00-0000-7000-8000-000000000001";
const orgId = "019a7b00-0000-7000-8000-000000000002";
const personId = "019a7b00-0000-7000-8000-000000000003";
const centerId = "019a7b00-0000-7000-8000-000000000004";
let empty: boolean, multiple: boolean, scopeChanged: boolean;
let selfRole: "instructor" | "student" | undefined;
let roleReadError: string | undefined;
let selfManagement: OrganizationView["self_management_scope"];
let organizationAccess: OrganizationView["access_mode"];
const requests: { operation: string; bearer: string | null; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  empty = false;
  multiple = false;
  scopeChanged = false;
  selfRole = undefined;
  roleReadError = undefined;
  selfManagement = undefined;
  organizationAccess = "normal";
  requests.length = 0;
  vi.stubEnv("VITE_SUPABASE_URL", "https://backend.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "native-fixture" } },
    error: null,
  });
  server.use(
    http.post(
      "https://backend.invalid/functions/v1/backend-v1/:operation",
      async ({ request, params }) => {
        const operation = String(params.operation);
        const body = (await request.json()) as Record<string, unknown>;
        requests.push({ operation, bearer: request.headers.get("authorization"), body });
        let data: unknown;
        if (operation === "account_get_v1")
          data = { id: scopeChanged ? orgId : accountId, state: "active", display_name: "Fixture" };
        else if (operation === "organizations_list_v1")
          data = {
            items: empty
              ? []
              : [
                  {
                    id: orgId,
                    name: "Owned fixture",
                    state: "active",
                    access_mode: organizationAccess,
                    version: 1,
                    ...(selfManagement !== undefined
                      ? { self_management_scope: selfManagement }
                      : {}),
                    self_context: {
                      person_id: personId,
                      subscriber_number: null,
                      centers: selfRole
                        ? [
                            {
                              center_id: centerId,
                              instructor: selfRole === "instructor",
                              student: selfRole === "student",
                              assistant: false,
                            },
                          ]
                        : [],
                    },
                  },
                  ...(multiple
                    ? [
                        {
                          id: centerId,
                          name: "Other fixture",
                          state: "active",
                          access_mode: "normal",
                          version: 1,
                          self_context: null,
                        },
                      ]
                    : []),
                ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          };
        else if (operation === "centers_list_v1")
          data = {
            items: [
              {
                id: centerId,
                name: "Available",
                timezone: "Europe/Istanbul",
                state: "active",
                accessible: true,
                version: 1,
              },
              {
                id: personId,
                name: "Unavailable",
                timezone: "Europe/Istanbul",
                state: "active",
                accessible: false,
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          };
        else if (roleReadError)
          return HttpResponse.json(
            { ok: false, error: { code: roleReadError, retryable: false, trace_id: accountId } },
            { status: roleReadError === "FORBIDDEN" ? 403 : 200 },
          );
        else
          data = {
            items: [
              {
                id: accountId,
                person_id: personId,
                role: "owner",
                scope_center_id: null,
                state: "active",
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-14T06:00:00Z",
          };
        return HttpResponse.json({ ok: true, data, trace_id: accountId });
      },
    ),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("reads only the actor's organizations and exposes only accessible centers and own roles", async () => {
  const result = await readWorkspace(accountId);
  expect(result.selected?.id).toBe(orgId);
  expect(result.centers.map((c) => c.id)).toEqual([centerId]);
  expect(result.roles.map((r) => r.role)).toEqual(["owner"]);
  expect(requests.find((r) => r.operation === "roles_list_v1")?.body).toMatchObject({
    org_id: orgId,
    person_id: personId,
  });
  expect(requests.every((r) => r.bearer === "Bearer native-fixture")).toBe(true);
  expect(native.getSession).toHaveBeenCalledTimes(1);
});
it("requires explicit organization selection when there are several and invents no default scope", async () => {
  multiple = true;
  const result = await readWorkspace(accountId);
  expect(result.selected).toBeUndefined();
  expect(result.centers).toEqual([]);
  expect(result.roles).toEqual([]);
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1", "organizations_list_v1"]);
});
it("returns a real empty account context and clears an unavailable organization selection", async () => {
  empty = true;
  expect((await readWorkspace(accountId)).organizations).toEqual([]);
  const result = await readWorkspace(accountId, orgId);
  expect(result.selected).toBeUndefined();
  expect(result.centers).toEqual([]);
  expect(result.organizations).toEqual([]);
});
it("retains instructor self scope when the management role registry is forbidden", async () => {
  selfRole = "instructor";
  roleReadError = "FORBIDDEN";
  const result = await readWorkspace(accountId);
  expect(result.selected?.id).toBe(orgId);
  expect(result.selected?.self_context?.centers).toEqual([
    { center_id: centerId, instructor: true, student: false, assistant: false },
  ]);
  expect(result.centers.map((c) => c.id)).toEqual([centerId]);
  expect(result.roles).toEqual([]);
});
it.each(["instructor", "student"] as const)(
  "retains verified %s scope without deriving management access from a Starter plan denial",
  async (role) => {
    selfRole = role;
    roleReadError = "PLAN_FEATURE_UNAVAILABLE";
    const result = await readWorkspace(accountId, orgId);
    expect(result.selected?.self_context?.centers).toEqual([
      {
        center_id: centerId,
        instructor: role === "instructor",
        student: role === "student",
        assistant: false,
      },
    ]);
    expect(result.centers.map((center) => center.id)).toEqual([centerId]);
    expect(result.roles).toEqual([]);
  },
);
it("requests native self management and keeps a Starter owner scope when F05 role rows are denied", async () => {
  roleReadError = "PLAN_FEATURE_UNAVAILABLE";
  selfManagement = { owner: true, org_manager: false, managed_center_ids: [centerId] };
  const result = await readWorkspace(accountId, orgId);
  expect(requests.find((row) => row.operation === "organizations_list_v1")?.body).toMatchObject({
    include_self_management_scope: true,
  });
  expect(result.selected?.self_management_scope).toEqual(selfManagement);
  expect(workspaceRoles(result, centerId)).toEqual(["owner", "center_manager"]);
  expect(hasWorkspaceManagementScope(result, centerId)).toBe(true);
  expect(hasWorkspaceManagementScope(result, personId)).toBe(false);
  expect(result.roles).toEqual([]);
});

it("treats explicit null and center-specific scope as authoritative over old role rows", async () => {
  selfManagement = null;
  const revoked = await readWorkspace(accountId, orgId);
  expect(revoked.roles.map((row) => row.role)).toEqual(["owner"]);
  expect(workspaceRoles(revoked, centerId)).toEqual([]);

  selfManagement = { owner: false, org_manager: false, managed_center_ids: [centerId] };
  const scoped = await readWorkspace(accountId, orgId);
  expect(workspaceRoles(scoped, centerId)).toEqual(["center_manager"]);
  expect(workspaceRoles(scoped)).toEqual([]);
});
it("surfaces a management plan denial when there is no verified personal scope", async () => {
  roleReadError = "PLAN_FEATURE_UNAVAILABLE";
  await expect(readWorkspace(accountId, orgId)).rejects.toMatchObject({ code: roleReadError });
});
it("keeps verified setup centers readable while a subscription has yet to start", async () => {
  organizationAccess = "bootstrap";
  selfManagement = null;
  roleReadError = "SUBSCRIPTION_NOT_STARTED";
  const result = await readWorkspace(accountId, orgId);
  expect(result.selected?.access_mode).toBe("bootstrap");
  expect(result.centers.map(({ id }) => id)).toEqual([centerId]);
  expect(result.roles).toEqual([]);
  expect(hasWorkspaceManagementScope(result, centerId)).toBe(false);
});
it("surfaces a subscription denial outside organization setup", async () => {
  roleReadError = "SUBSCRIPTION_NOT_STARTED";
  await expect(readWorkspace(accountId, orgId)).rejects.toMatchObject({ code: roleReadError });
});
it("surfaces a temporary role read failure even when the actor has personal scope", async () => {
  selfRole = "instructor";
  roleReadError = "TEMPORARY_FAILURE";
  await expect(readWorkspace(accountId, orgId)).rejects.toMatchObject({ code: roleReadError });
});
it("preserves available organizations when the selected organization loses access", async () => {
  const result = await readWorkspace(accountId, personId);
  expect(result.selected).toBeUndefined();
  expect(result.organizations.map((o) => o.id)).toEqual([orgId]);
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1", "organizations_list_v1"]);
});
it("blocks a changed actor before any organization discovery", async () => {
  scopeChanged = true;
  await expect(readWorkspace(accountId)).rejects.toThrow("ACCOUNT_CHANGED");
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1"]);
});

it("reuses the route identity read while preserving tenant discovery", async () => {
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "native-fixture", user: { id: "native-fixture-user" } } },
    error: null,
  });
  const queries = new QueryClient();
  await queries.query(accountQuery("native-fixture-user"));
  expect(requests.filter((row) => row.operation === "account_get_v1")).toHaveLength(1);
  const view = await queries.query(workspaceQuery(queries, accountId, orgId));
  expect(view.selected?.id).toBe(orgId);
  expect(requests.filter((row) => row.operation === "account_get_v1")).toHaveLength(1);
  expect(requests.some((row) => row.operation === "organizations_list_v1")).toBe(true);
  expect(requests.every((row) => row.bearer === "Bearer native-fixture")).toBe(true);
});

it("rejects another backend account before listing organizations through Query", async () => {
  scopeChanged = true;
  native.getSession.mockResolvedValue({
    data: { session: { access_token: "native-fixture", user: { id: "native-fixture-user" } } },
    error: null,
  });
  const queries = new QueryClient();
  await expect(queries.query(workspaceQuery(queries, accountId, orgId))).rejects.toThrow(
    "ACCOUNT_CHANGED",
  );
  expect(requests.map((row) => row.operation)).toEqual(["account_get_v1"]);
});

it("refuses a previous session's late workspace authority even for the same user", async () => {
  const userId = "native-fixture-user";
  const token = (sessionId: string, suffix: string) => {
    const payload = btoa(JSON.stringify({ sub: userId, session_id: sessionId }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    return `fixture.${payload}.${suffix}`;
  };
  const previous = token("019a7b00-0000-7000-8000-000000000101", "previous");
  const current = token("019a7b00-0000-7000-8000-000000000102", "current");
  native.getSession
    .mockResolvedValueOnce({
      data: { session: { user: { id: userId }, access_token: previous } },
      error: null,
    })
    .mockResolvedValue({
      data: { session: { user: { id: userId }, access_token: current } },
      error: null,
    });
  await expect(readWorkspace(accountId, orgId, async () => ({ id: accountId }))).rejects.toThrow(
    "ACCOUNT_CHANGED",
  );
  expect(requests.some((row) => row.operation === "organizations_list_v1")).toBe(true);
  expect(requests.every((row) => row.bearer === `Bearer ${previous}`)).toBe(true);
});
