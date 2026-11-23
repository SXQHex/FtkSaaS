import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import { advancePrivateQueryRevision, capturePrivateReadback } from "../../lib/cache-invalidation";
import type { SafeError } from "@ftksaas/api-contracts";
import { accountQueryKeys } from "./account-query";
import { workspaceKeys, workspaceQuery } from "../workspace/workspace-query";
import type { readWorkspace } from "../workspace/workspace";
import {
  classifyAccessFailure,
  observeQueryAccessFailures,
  reconcileQueryAccessFailure,
  workspaceAuthority,
  workspaceAccessLost,
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
  queries.setQueryData(
    ["leads", accountId, orgId, centerId, "first-page"],
    [{ title: "Only managers should see this" }],
  );
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
  it("checks the scoped authority even when an earlier automatic projection had fewer privileges", async () => {
    const { queries, actions } = fixture();
    const scoped = workspaceKeys.projection(accountId, orgId);
    queries.removeQueries({ queryKey: scoped, exact: true });
    const reduced = view({ manager: false });
    queries.setQueryData(workspaceKeys.projection(accountId), reduced);
    queries.setQueryData(scoped, view());
    workspaceRead.mockResolvedValueOnce(reduced);
    const feature = ["leads", accountId, orgId, centerId, "first-page"];

    await reconcileQueryAccessFailure(queries, feature, error("FORBIDDEN"), actions);

    expect(workspaceRead).toHaveBeenCalledOnce();
    expect(queries.getQueryData(feature)).toBeUndefined();
    expect(queries.getQueryData(scoped)).toEqual(reduced);
    expect(actions.invalidateRoute).toHaveBeenCalledOnce();
  });

  it("rechecks a new permission denial after a previous operation-specific denial", async () => {
    const { queries, actions } = fixture();
    const feature = ["leads", accountId, orgId, centerId, "first-page"];
    workspaceRead.mockResolvedValueOnce(view()).mockResolvedValueOnce(view({ manager: false }));
    const stop = observeQueryAccessFailures(queries, actions);
    const deny = () =>
      queries.fetchQuery({
        queryKey: feature,
        staleTime: 0,
        queryFn: async () => {
          throw error("FORBIDDEN");
        },
      });
    try {
      await expect(deny()).rejects.toThrow("FORBIDDEN");
      await vi.waitFor(() => expect(actions.onChecking).toHaveBeenLastCalledWith(false));
      expect(queries.getQueryData(feature)).toBeDefined();
      expect(actions.invalidateRoute).not.toHaveBeenCalled();

      await expect(deny()).rejects.toThrow("FORBIDDEN");

      await vi.waitFor(() => expect(actions.invalidateRoute).toHaveBeenCalledOnce());
      expect(workspaceRead).toHaveBeenCalledTimes(2);
      expect(queries.getQueryData(feature)).toBeUndefined();
      expect(actions.showLogin).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

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
    expect(
      queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"]),
    ).toBeUndefined();
    expect(
      queries.getQueryData(["people", accountId, orgId, centerId, "old-cursor"]),
    ).toBeUndefined();
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

  it("does not mistake a newly added center, role or organization lifecycle for access loss", async () => {
    const original = view();
    const added = structuredClone(original);
    added.centers.push({
      ...added.centers[0]!,
      id: "center-b",
      name: "New center",
    });
    added.roles.push({ ...added.roles[0]!, role: "center_manager", scope_center_id: "center-b" });
    expect(workspaceAccessLost(original, added)).toBe(false);
    const closed = structuredClone(original);
    closed.selected!.access_mode = "closed";
    expect(workspaceAccessLost(original, closed)).toBe(false);
    const newOrganization = structuredClone(original);
    newOrganization.organizations.push(newOrganization.selected!);
    newOrganization.organizations.push({ ...newOrganization.selected!, id: "org-b" });
    newOrganization.selected = undefined;
    const previousAutomatic = structuredClone(original);
    previousAutomatic.organizations.push(previousAutomatic.selected!);
    expect(workspaceAccessLost(previousAutomatic, newOrganization)).toBe(false);

    const { queries, actions } = fixture();
    workspaceRead.mockResolvedValue(added);
    await reconcileQueryAccessFailure(
      queries,
      ["leads", accountId, orgId, centerId],
      error("FORBIDDEN"),
      actions,
    );
    expect(queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"])).toBeDefined();
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(actions.showLogin).not.toHaveBeenCalled();
  });

  it("only purges private queries for revocations of previously granted capabilities", () => {
    const original = view();
    expect(workspaceAccessLost(original, view())).toBe(false);
    expect(workspaceAccessLost(original, view({ manager: false }))).toBe(true);
    expect(workspaceAccessLost(original, view({ accessible: false }))).toBe(true);
    expect(workspaceAccessLost(original, view({ org: "org-b" }))).toBe(true);
    const oldOwn = structuredClone(original);
    oldOwn.selected!.self_management_scope = {
      owner: true,
      org_manager: false,
      managed_center_ids: [centerId],
    };
    const newOwn = structuredClone(oldOwn);
    newOwn.selected!.self_management_scope = {
      owner: false,
      org_manager: false,
      managed_center_ids: [],
    };
    expect(workspaceAccessLost(oldOwn, newOwn)).toBe(true);
  });

  it("leaves platform-only FORBIDDEN to its own permission UI instead of choosing an unrelated organization", async () => {
    const { queries, actions } = fixture();
    const key = ["platform-organizations", accountId, "cursor-a"];
    queries.setQueryData(key, ["previously visible platform rows"]);
    await reconcileQueryAccessFailure(queries, key, error("FORBIDDEN"), actions);
    expect(workspaceRead).not.toHaveBeenCalled();
    expect(queries.getQueryData(key)).toEqual(["previously visible platform rows"]);
    expect(queries.getQueryData(workspaceKeys.projection(accountId, orgId))).toBeDefined();
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(actions.showLogin).not.toHaveBeenCalled();
  });

  it("does not react to an authorized native center addition during an active write readback", async () => {
    const { queries, actions } = fixture();
    const stop = observeQueryAccessFailures(queries, actions);
    const added = structuredClone(view());
    added.centers.push({ ...added.centers[0]!, id: "center-b" });
    workspaceRead.mockResolvedValue(added);
    await queries.fetchQuery({ ...workspaceQuery(queries, accountId, orgId), staleTime: 0 });
    expect(queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"])).toBeDefined();
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(actions.onChecking).not.toHaveBeenCalled();
    stop();
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
    expect(workspaceAuthority(original)).not.toBe(workspaceAuthority(view({ manager: false })));
    expect(workspaceAuthority(original)).not.toBe(workspaceAuthority(view({ accessible: false })));
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
    expect(
      queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"]),
    ).toBeUndefined();
    expect(actions.showLogin).not.toHaveBeenCalled();
    expect(actions.onChecking).toHaveBeenNthCalledWith(1, true);
    await vi.waitFor(() => expect(actions.onChecking).toHaveBeenLastCalledWith(false));
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
    expect(
      queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"]),
    ).toBeUndefined();
    expect(actions.showLogin).not.toHaveBeenCalled();
    stop();
  });

  it("does not drop a concurrent revoked-session error behind a benign directory denial", async () => {
    const { queries, actions } = fixture();
    let release!: (view: Workspace) => void;
    workspaceRead.mockImplementationOnce(
      () =>
        new Promise<Workspace>((resolve) => {
          release = resolve;
        }),
    );
    const stop = observeQueryAccessFailures(queries, actions);
    const denied = queries
      .fetchQuery({
        queryKey: ["lead-applications", accountId, orgId, centerId],
        queryFn: async () => {
          throw error("FORBIDDEN");
        },
        retry: false,
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(workspaceRead).toHaveBeenCalledOnce());

    const expired = queries
      .fetchQuery({
        queryKey: ["people", accountId, orgId, centerId],
        queryFn: async () => {
          throw error("SESSION_REVOKED");
        },
        retry: false,
      })
      .catch(() => undefined);
    await Promise.all([denied, expired]);
    expect(actions.onChecking).toHaveBeenCalledWith(true);
    expect(actions.showLogin).not.toHaveBeenCalled();

    release(view());
    await vi.waitFor(() => expect(actions.showLogin).toHaveBeenCalledOnce());
    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(actions.onChecking.mock.calls.map(([value]) => value)).toEqual([true, false]);
    stop();
  });

  it("queues a real workspace revocation even while another permission check is in flight", async () => {
    const { queries, actions } = fixture();
    let release!: (view: Workspace) => void;
    workspaceRead.mockImplementationOnce(
      () =>
        new Promise<Workspace>((resolve) => {
          release = resolve;
        }),
    );
    const stop = observeQueryAccessFailures(queries, actions);
    const denied = queries
      .fetchQuery({
        queryKey: ["lead-applications", accountId, orgId, centerId],
        queryFn: async () => {
          throw error("FORBIDDEN");
        },
        retry: false,
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(workspaceRead).toHaveBeenCalledOnce());

    const revoked = view({ manager: false, accessible: false });
    workspaceRead.mockResolvedValueOnce(revoked);
    await queries.fetchQuery({ ...workspaceQuery(queries, accountId, orgId), staleTime: 0 });
    expect(actions.invalidateRoute).not.toHaveBeenCalled();

    release(view());
    await denied;
    await vi.waitFor(() => expect(actions.invalidateRoute).toHaveBeenCalledOnce());
    expect(queries.getQueryData(workspaceKeys.projection(accountId, orgId))).toEqual(revoked);
    expect(
      queries.getQueryData(["leads", accountId, orgId, centerId, "first-page"]),
    ).toBeUndefined();
    expect(actions.onChecking.mock.calls.map(([value]) => value)).toEqual([true, false]);
    stop();
  });

  it("cannot restore a queued old workspace after concurrent terminal session loss", async () => {
    const { queries, actions } = fixture();
    let release!: (view: Workspace) => void;
    workspaceRead.mockImplementationOnce(
      () =>
        new Promise<Workspace>((resolve) => {
          release = resolve;
        }),
    );
    const stop = observeQueryAccessFailures(queries, actions);
    const denied = queries
      .fetchQuery({
        queryKey: ["lead-applications", accountId, orgId, centerId],
        queryFn: async () => {
          throw error("FORBIDDEN");
        },
        retry: false,
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(workspaceRead).toHaveBeenCalledOnce());

    const expired = queries
      .fetchQuery({
        queryKey: ["people", accountId, orgId, centerId],
        queryFn: async () => {
          throw error("SESSION_REVOKED");
        },
        retry: false,
      })
      .catch(() => undefined);
    await expired;

    const revoked = view({ manager: false, accessible: false });
    workspaceRead.mockResolvedValueOnce(revoked);
    await queries.fetchQuery({ ...workspaceQuery(queries, accountId, orgId), staleTime: 0 });
    release(view());
    await denied;
    await vi.waitFor(() => expect(actions.showLogin).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(actions.onChecking).toHaveBeenLastCalledWith(false));

    expect(queries.getQueryCache().getAll()).toHaveLength(0);
    expect(actions.invalidateRoute).not.toHaveBeenCalled();
    expect(actions.onChecking.mock.calls.map(([value]) => value)).toEqual([true, false]);
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

  it.each(["denial", "success"] as const)(
    "ignores an old authority %s after a same-actor session handoff",
    async (response) => {
      const { queries, actions } = fixture();
      let release!: () => void;
      workspaceRead.mockImplementationOnce(
        () =>
          new Promise<Workspace>((resolve, reject) => {
            release = () =>
              response === "success"
                ? resolve(view({ manager: false, accessible: false }))
                : reject(error("SESSION_REVOKED"));
          }),
      );
      const stop = observeQueryAccessFailures(queries, actions);
      const key = workspaceKeys.projection(accountId, orgId);
      await expect(
        queries.fetchQuery({
          queryKey: ["lead-applications", accountId, orgId, centerId],
          queryFn: async () => {
            throw error("FORBIDDEN");
          },
        }),
      ).rejects.toThrow("FORBIDDEN");
      await vi.waitFor(() => expect(workspaceRead).toHaveBeenCalledOnce());
      advancePrivateQueryRevision(queries);
      queries.removeQueries();
      queries.setQueryData(accountQueryKeys.projection("native-a"), { id: accountId });
      queries.setQueryData(key, view());
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(queries.getQueryData(key)).toEqual(view());
      expect(actions.showLogin).not.toHaveBeenCalled();
      expect(actions.invalidateRoute).not.toHaveBeenCalled();
      stop();
    },
  );

  it("recovers a later permission loss after an account change with one native recheck", async () => {
    const { queries, actions } = fixture();
    const stop = observeQueryAccessFailures(queries, actions);
    const fail = (key: string, reason: Error) =>
      queries.fetchQuery({
        queryKey: [key, accountId, orgId, centerId],
        queryFn: async () => {
          throw reason;
        },
      });

    await expect(fail("people", new Error("ACCOUNT_CHANGED"))).rejects.toThrow("ACCOUNT_CHANGED");
    await vi.waitFor(() => expect(actions.onChecking).toHaveBeenLastCalledWith(false));
    queries.setQueryData(accountQueryKeys.projection("native-a"), { id: accountId });
    queries.setQueryData(workspaceKeys.projection(accountId, orgId), view());
    const assertReadback = capturePrivateReadback(queries);
    let release!: () => void;
    workspaceRead.mockImplementationOnce(
      () =>
        new Promise<Workspace>((resolve) => {
          release = () => resolve(view({ manager: false, accessible: false }));
        }),
    );
    await Promise.all([
      expect(fail("people", error("FORBIDDEN"))).rejects.toThrow("FORBIDDEN"),
      expect(fail("leads", error("FORBIDDEN"))).rejects.toThrow("FORBIDDEN"),
    ]);
    await vi.waitFor(() => expect(workspaceRead).toHaveBeenCalledOnce());
    release();
    await vi.waitFor(() => expect(actions.invalidateRoute).toHaveBeenCalledTimes(2));
    expect(workspaceRead).toHaveBeenCalledOnce();
    expect(assertReadback).toThrow("PRIVATE_QUERY_CHANGED");
    expect(actions.showLogin).not.toHaveBeenCalled();
    stop();
  });
});
