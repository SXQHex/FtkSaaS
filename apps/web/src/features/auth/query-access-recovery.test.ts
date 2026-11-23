import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import type { SafeError } from "@ftksaas/api-contracts";
import { accountQueryKeys } from "./account-query";
import { workspaceKeys, workspaceQuery } from "../workspace/workspace-query";
import type { readWorkspace } from "../workspace/workspace";
import {
  classifyAccessFailure,
  observeQueryAccessFailures,
  reconcileQueryAccessFailure,
  workspaceAuthority,
} from "./query-access-recovery";

const { workspaceRead } = vi.hoisted(() => ({ workspaceRead: vi.fn() }));
vi.mock("../workspace/workspace", () => ({ readWorkspace: workspaceRead }));

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;
const orgId = "org-a";
const accountId = "account-a";
const centerId = "center-a";
const role = (name: "owner" | "student", center = centerId) => ({
  person_id: "person-a",
  role: name,
  scope_center_id: name === "owner" ? null : center,
  state: "active",
  account_access_granted: true,
  version: 1,
});
const view = (options: { manager?: boolean; accessible?: boolean; org?: string } = {}) =>
  ({
    organizations: [],
    selected: {
      id: options.org ?? orgId,
      access_mode: "normal",
      self_context: { person_id: "person-a", centers: [] },
    },
    centers:
      options.accessible === false
        ? []
        : [
            {
              id: centerId,
              accessible: true,
              state: "active",
              name: "Fixture center",
              timezone: "Europe/Istanbul",
              version: 1,
            },
          ],
    roles: options.manager === false ? [role("student")] : [role("owner")],
  }) as unknown as Workspace;

function fixture() {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queries.setQueryData(accountQueryKeys.projection("native-a"), { id: accountId });
  queries.setQueryData(workspaceKeys.projection(accountId, orgId), view());
  queries.setQueryData(["leads", accountId, orgId, centerId, "first-page"], [
    { title: "Only managers should see this" },
  ]);
  queries.setQueryData(["leads", "account-b", "org-b", "center-b"], ["another actor"]);
  const actions = {
    onChecking: vi.fn(),
    invalidateRoute: vi.fn(async () => undefined),
    showLogin: vi.fn(async () => undefined),
  };
  return { queries, actions };
}
const error = (code: SafeError["code"]) =>
  new BackendError({ code, retryable: false, trace_id: "test" });

beforeEach(() => workspaceRead.mockReset());

describe("M06: cross-feature access reconciliation", () => {
  it("separates invalid sessions, switched actors, permission and plan denials", () => {
    expect(classifyAccessFailure(error("AUTH_REQUIRED"))).toBe("session");
    expect(classifyAccessFailure(error("SESSION_REVOKED"))).toBe("session");
    expect(classifyAccessFailure(new Error("ACCOUNT_CHANGED"))).toBe("actor");
    expect(classifyAccessFailure(error("FORBIDDEN"))).toBe("permission");
    expect(classifyAccessFailure(error("PLAN_FEATURE_UNAVAILABLE"))).toBeUndefined();
    expect(classifyAccessFailure(error("PLAN_LIMIT_REACHED"))).toBeUndefined();
    expect(classifyAccessFailure(new Error("TRANSPORT_ERROR"))).toBeUndefined();
  });

  it("clears private actors on revoked session and navigates to login", async () => {
    const { queries, actions } = fixture();
    await reconcileQueryAccessFailure(
      queries,
      ["leads", accountId, orgId, centerId],
      error("SESSION_REVOKED"),
      actions,
    );
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(actions.showLogin).toHaveBeenCalledOnce();
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(workspaceRead).not.toHaveBeenCalled();
  });

  it("clears a changed actor before Router reassesses the native session", async () => {
    const { queries, actions } = fixture();
    await reconcileQueryAccessFailure(
      queries,
      ["leads", accountId, orgId],
      new Error("ACCOUNT_CHANGED"),
      actions,
    );
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(actions.invalidateRoute).toHaveBeenCalledOnce();
    expect(actions.showLogin).not.toHaveBeenCalled();
  });

  it("keeps an independently denied directory and other tenants when native roles are unchanged", async () => {
    const { queries, actions } = fixture();
    workspaceRead.mockResolvedValue(view());
    await reconcileQueryAccessFailure(
      queries,
      ["lead-applications", accountId, orgId, centerId],
      error("FORBIDDEN"),
      actions,
    );
    expect(workspaceRead).toHaveBeenCalledOnce();
    expect(queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"])).toBeDefined();
    expect(queries.getQueryData(["leads", "account-b", "org-b", "center-b"])).toEqual([
      "another actor",
    ]);
    expect(actions.showLogin).not.toHaveBeenCalled();
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
  });

  it("evicts all cached pages and cross-feature reads after external role and center loss", async () => {
    const { queries, actions } = fixture();
    const deniedView = view({ manager: false, accessible: false });
    workspaceRead.mockResolvedValue(deniedView);
    const stale = queries.fetchQuery({
      queryKey: ["people", accountId, orgId, centerId, "old-cursor"],
      queryFn: async () =>
        await new Promise<string[]>((resolve) => {
          setTimeout(() => resolve(["secret late person"]), 10);
        }),
    });
    await reconcileQueryAccessFailure(
      queries,
      ["leads", accountId, orgId, centerId],
      error("FORBIDDEN"),
      actions,
    );
    await stale.catch(() => undefined);
    expect(queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"])).toBeUndefined();
    expect(queries.getQueryData(["people", accountId, orgId, centerId, "old-cursor"])).toBeUndefined();
    expect(queries.getQueryData(["leads", "account-b", "org-b", "center-b"])).toBeUndefined();
    expect(queries.getQueryData(workspaceKeys.projection(accountId, orgId))).toEqual(deniedView);
    expect(actions.invalidateRoute).toHaveBeenCalledOnce();
    expect(actions.showLogin).not.toHaveBeenCalled();
  });

  it("does not treat a paid-plan denial as a revoked native identity", async () => {
    const { queries, actions } = fixture();
    await reconcileQueryAccessFailure(
      queries,
      ["lead-applications", accountId, orgId],
      error("PLAN_FEATURE_UNAVAILABLE"),
      actions,
    );
    expect(workspaceRead).not.toHaveBeenCalled();
    expect(queries.getQueryData(workspaceKeys.projection(accountId, orgId))).toBeDefined();
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(actions.showLogin).not.toHaveBeenCalled();
  });

  it("fails closed if native workspace cannot be revalidated", async () => {
    const { queries, actions } = fixture();
    workspaceRead.mockImplementationOnce(() => {
      throw error("SESSION_REVOKED");
    });
    await reconcileQueryAccessFailure(
      queries,
      ["leads", accountId, orgId],
      error("FORBIDDEN"),
      actions,
    );
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(actions.showLogin).toHaveBeenCalledOnce();
  });

  it("detects a changed authority even when role and center lists reorder", () => {
    const original = view();
    const same = structuredClone(original);
    expect(workspaceAuthority(original)).toBe(workspaceAuthority(same));
    expect(workspaceAuthority(original)).not.toBe(
      workspaceAuthority(view({ manager: false })),
    );
    expect(workspaceAuthority(original)).not.toBe(
      workspaceAuthority(view({ accessible: false })),
    );
  });

  it("observes a remote workspace role loss and never treats a manual Query projection as a remote revocation", async () => {
    const { queries, actions } = fixture();
    const stop = observeQueryAccessFailures(queries, actions);
    const manual = view({ manager: false });
    queries.setQueryData(workspaceKeys.projection(accountId, orgId), manual);
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    workspaceRead.mockResolvedValue(view({ manager: false, accessible: false }));
    await queries.fetchQuery({
      ...workspaceQuery(queries, accountId, orgId),
      staleTime: 0,
    });
    await vi.waitFor(() => expect(actions.invalidateRoute).toHaveBeenCalledOnce());
    expect(queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"])).toBeUndefined();
    expect(actions.showLogin).not.toHaveBeenCalled();
    expect(actions.onChecking).toHaveBeenNthCalledWith(1, true);
    expect(actions.onChecking).toHaveBeenLastCalledWith(false);
    stop();
  });

  it("detects revocation when a selected Query was first seeded from automatic workspace data", async () => {
    const { queries, actions } = fixture();
    queries.removeQueries({ queryKey: workspaceKeys.projection(accountId, orgId), exact: true });
    queries.setQueryData(workspaceKeys.projection(accountId), view());
    const stop = observeQueryAccessFailures(queries, actions);
    workspaceRead.mockResolvedValue(view({ manager: false, accessible: false }));
    await queries.fetchQuery({
      ...workspaceQuery(queries, accountId, orgId),
      staleTime: 0,
    });
    await vi.waitFor(() => expect(actions.invalidateRoute).toHaveBeenCalledOnce());
    expect(queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"])).toBeUndefined();
    expect(actions.showLogin).not.toHaveBeenCalled();
    stop();
  });

  it("observes an expired native session from any feature query and removes old private data", async () => {
    const { queries, actions } = fixture();
    const stop = observeQueryAccessFailures(queries, actions);
    await expect(
      queries.fetchQuery({
        queryKey: ["people", accountId, orgId, centerId],
        queryFn: async () => {
          throw error("AUTH_REQUIRED");
        },
        retry: false,
      }),
    ).rejects.toThrow("AUTH_REQUIRED");
    await vi.waitFor(() => expect(actions.showLogin).toHaveBeenCalledOnce());
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    stop();
  });
});
