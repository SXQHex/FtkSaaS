import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { ManagementStateView, ManagementStatePage } from "@ftksaas/api-contracts";
import type {
  AccessAccountRow,
  AccessInvitationRow,
  AccessSummary,
  AccountFilter,
  InvitationFilter,
} from "./access-view";

export async function readInvitationDirectory(
  scope: ClientScope,
  status: InvitationFilter,
  cursor?: string,
  context?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, context);
  return backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "account_access_revoke_v1",
    selector: { operation: "account_access_revoke_v1", key: { directory: "center", status } },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
export async function readAccountDirectory(
  scope: ClientScope,
  status: AccountFilter,
  query: string,
  cursor?: string,
  context?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, context);
  return backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "account_link_remove_v1",
    selector: {
      operation: "account_link_remove_v1",
      key: {
        directory: "center",
        view: "people",
        status,
        ...(query.trim() ? { query: query.trim() } : {}),
      },
    },
    page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
function currentVersion(
  item: ManagementStateView,
  type: "people" | "invitations" | "account_links",
  id: string,
) {
  const versions = item.versions.filter(
    (entry) => entry.entity.type === type && entry.entity.id === id,
  );
  if (
    !item.exists ||
    item.entity?.type !== type ||
    item.entity.id !== id ||
    versions.length !== 1 ||
    !versions[0]?.version
  )
    throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
}
function label(instant: string | null, timezone?: string) {
  if (!instant || !timezone) return null;
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(instant));
}
export function invitationDirectoryRows(
  page: ManagementStatePage,
  centerId: string,
  timezone?: string,
): AccessInvitationRow[] {
  return page.items.map((item) => {
    const detail = item.access_detail;
    const current = item.current;
    if (
      item.operation !== "account_access_revoke_v1" ||
      current?.operation !== "account_access_revoke_v1" ||
      detail?.kind !== "invitation" ||
      current.values.center_id !== centerId ||
      !current.values.person_id ||
      !current.values.invitation_id
    )
      throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
    const id = current.values.invitation_id;
    currentVersion(item, "invitations", id);
    const state = item.state;
    if (state !== "pending" && state !== "expired" && state !== "accepted" && state !== "revoked")
      throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
    return {
      id,
      personId: current.values.person_id,
      personName: detail.display_name,
      email: null,
      state,
      sentLabel: label(
        detail.delivery.visibility === "available" ? detail.delivery.sent_at : null,
        timezone,
      ),
      expiresLabel: label(detail.expires_at, timezone),
      canResend: detail.can_resend,
      canRevoke: current.values.actionable === true,
    };
  });
}
export function accountDirectoryRows(page: ManagementStatePage): AccessAccountRow[] {
  return page.items.map((item) => {
    const detail = item.access_detail;
    const current = item.current;
    if (
      item.operation !== "account_link_remove_v1" ||
      current?.operation !== "account_link_remove_v1" ||
      detail?.kind !== "person_account" ||
      current.values.person_id !== detail.person_id
    )
      throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
    const linkId = current.values.link_id;
    if (detail.linked) {
      if (!linkId || item.state !== "active") throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
      currentVersion(item, "account_links", linkId);
    } else {
      if (linkId || current.values.actionable === true)
        throw new Error("ACCESS_DIRECTORY_UNAVAILABLE");
      currentVersion(item, "people", detail.person_id);
    }
    return {
      id: detail.person_id,
      personId: detail.person_id,
      ...(linkId ? { linkId } : {}),
      name: detail.display_name,
      email: null,
      inactive: false,
      binding: detail.linked ? "linked" : "unlinked",
      // The directory creation date is the person date, never a link/login date.
      linkedLabel: null,
      lastSigninLabel: null,
      canRemove: detail.linked && current.values.actionable === true,
      canInvite: detail.can_send_invitation,
    };
  });
}
export function directorySummary(
  invitations?: ManagementStatePage,
  accounts?: ManagementStatePage,
): AccessSummary {
  const invitationSummary = invitations?.access_summary;
  const accountSummary = accounts?.access_summary;
  const count = (
    summary: ManagementStatePage["access_summary"],
    state: "pending" | "expired" | "linked" | "unlinked",
  ) => summary?.by_state.find((item) => item.state === state)?.count ?? 0;
  const format = new Intl.NumberFormat("tr-TR");
  const pending = count(invitationSummary, "pending");
  const expired = count(invitationSummary, "expired");
  const unlinked = count(accountSummary, "unlinked");
  return {
    linked: accountSummary ? format.format(count(accountSummary, "linked")) : null,
    unlinked: accountSummary ? format.format(unlinked) : null,
    totalMembers: accountSummary ? format.format(accountSummary.total) : null,
    pending: invitationSummary ? format.format(pending) : null,
    expired: invitationSummary ? format.format(expired) : null,
    invitationBadge: invitationSummary ? pending + expired : null,
    accountBadge: accountSummary ? unlinked : null,
  };
}
