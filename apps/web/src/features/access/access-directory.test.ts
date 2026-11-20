import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagementStatePage, ManagementStateView } from "@ftksaas/api-contracts";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  accountDirectoryRows,
  directorySummary,
  invitationDirectoryRows,
  readAccountDirectory,
  readInvitationDirectory,
} from "./access-directory";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const personId = "019a7b00-0000-7000-8000-000000000006";
const recordId = "019a7b00-0000-7000-8000-000000000007";
const instant = "2026-12-01T22:30:00Z";
const page = (item?: ManagementStateView): ManagementStatePage => ({
  items: item ? [item] : [],
  next_cursor: null,
  as_of: instant,
});
function invitation(): ManagementStateView {
  return {
    operation: "account_access_revoke_v1",
    exists: true,
    state: "pending",
    as_of: instant,
    entity: { type: "invitations", id: recordId },
    versions: [{ entity: { type: "invitations", id: recordId }, version: 2 }],
    current: {
      operation: "account_access_revoke_v1",
      values: {
        invitation_id: recordId,
        person_id: personId,
        center_id: scope.centerId,
        actionable: true,
      },
    },
    access_detail: {
      kind: "invitation",
      display_name: "Fixture",
      created_at: instant,
      expires_at: instant,
      can_resend: false,
      delivery: { visibility: "restricted" },
    },
  };
}
function account(linked: boolean): ManagementStateView {
  const entity = linked
    ? { type: "account_links" as const, id: recordId }
    : { type: "people" as const, id: personId };
  return {
    operation: "account_link_remove_v1",
    exists: true,
    state: "active",
    as_of: instant,
    entity,
    versions: [{ entity, version: 3 }],
    current: {
      operation: "account_link_remove_v1",
      values: { person_id: personId, ...(linked ? { link_id: recordId } : {}), actionable: linked },
    },
    access_detail: {
      kind: "person_account",
      person_id: personId,
      display_name: "Fixture",
      created_at: instant,
      linked,
      can_send_invitation: !linked,
    },
  };
}
beforeEach(() => {
  call.mockReset();
});
describe("scoped access directory", () => {
  it.each(["open", "closed", "all"] as const)(
    "uses server %s grouping and one bounded cursor page",
    async (status) => {
      call.mockResolvedValue(page());
      await readInvitationDirectory(scope, status, "synthetic-cursor");
      expect(call).toHaveBeenCalledExactlyOnceWith(
        "management_state_get_v1",
        expect.objectContaining({
          org_id: scope.orgId,
          center_id: scope.centerId,
          selector: { operation: "account_access_revoke_v1", key: { directory: "center", status } },
          page: { limit: 20, sort: "created_at_asc", cursor: "synthetic-cursor" },
        }),
      );
    },
  );
  it("discovers unlinked people without a link ID or per-person history scan", async () => {
    call.mockResolvedValue(page());
    await readAccountDirectory(scope, "unlinked", "  Fixture  ");
    expect(call).toHaveBeenCalledExactlyOnceWith(
      "management_state_get_v1",
      expect.objectContaining({
        selector: {
          operation: "account_link_remove_v1",
          key: { directory: "center", view: "people", status: "unlinked", query: "Fixture" },
        },
      }),
    );
  });
  it("does not present creation as delivery, or invent recipient/expiry rules", () => {
    const result = invitationDirectoryRows(
      page(invitation()),
      scope.centerId,
      "Europe/Istanbul",
    )[0]!;
    expect(result).toMatchObject({
      sentLabel: null,
      email: null,
      canResend: false,
      canRevoke: true,
    });
    expect(result.expiresLabel).toContain("01:30");
    expect(result).not.toHaveProperty("resendCount");
    expect(invitationDirectoryRows(page(invitation()), scope.centerId)[0]?.expiresLabel).toBeNull();
  });
  it("rejects wrong-center and missing-version targets rather than exposing an actionable row", () => {
    expect(() => invitationDirectoryRows(page(invitation()), recordId)).toThrow(
      "ACCESS_DIRECTORY_UNAVAILABLE",
    );
    expect(() =>
      invitationDirectoryRows(page({ ...invitation(), versions: [] }), scope.centerId),
    ).toThrow("ACCESS_DIRECTORY_UNAVAILABLE");
  });
  it("distinguishes an unlinked person from a removable live link, with unknown native timestamps", () => {
    expect(accountDirectoryRows(page(account(false)))[0]).toMatchObject({
      id: personId,
      binding: "unlinked",
      canInvite: true,
      canRemove: false,
      linkedLabel: null,
      lastSigninLabel: null,
    });
    expect(accountDirectoryRows(page(account(false)))[0]).not.toHaveProperty("linkId");
    expect(accountDirectoryRows(page(account(true)))[0]).toMatchObject({
      linkId: recordId,
      binding: "linked",
      canRemove: true,
      canInvite: false,
    });
  });
  it("rejects a forged unlinked row with a live link capability", () => {
    const item = account(false);
    item.current = {
      operation: "account_link_remove_v1",
      values: { person_id: personId, link_id: recordId, actionable: true },
    };
    expect(() => accountDirectoryRows(page(item))).toThrow("ACCESS_DIRECTORY_UNAVAILABLE");
  });
  it("uses server-wide counts, distinguishes missing summary from known zero", () => {
    const result = directorySummary(
      {
        ...page(invitation()),
        access_summary: {
          total: 200,
          filtered: 103,
          by_state: [
            { state: "pending", count: 100 },
            { state: "expired", count: 3 },
            { state: "accepted", count: 97 },
          ],
        },
      },
      {
        ...page(account(true)),
        access_summary: {
          total: 1000,
          filtered: 1,
          by_state: [
            { state: "linked", count: 980 },
            { state: "unlinked", count: 20 },
          ],
        },
      },
    );
    expect(result).toMatchObject({
      linked: "980",
      unlinked: "20",
      pending: "100",
      expired: "3",
      totalMembers: "1.000",
      invitationBadge: 103,
      accountBadge: 20,
    });
    expect(directorySummary()).toMatchObject({
      linked: null,
      pending: null,
      expired: null,
      unlinked: null,
    });
  });
});
