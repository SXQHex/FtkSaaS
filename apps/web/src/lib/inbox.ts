import type { EntityRef, Interval, ManagementStateView } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";

export function listInbox(scope: SetupScope, unreadOnly: boolean, cursor?: string) {
  return setupCall("notifications_list_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    unread_only: unreadOnly,
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
export function listAudit(
  scope: SetupScope,
  subject: EntityRef,
  interval: Interval,
  cursor?: string,
) {
  return setupCall("audit_list_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    subject,
    interval,
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
}
export function notificationVersion(item: ManagementStateView, id: string) {
  if (
    !item.exists ||
    item.operation !== "notification_mark_read_v1" ||
    item.entity?.type !== "notifications" ||
    item.entity.id !== id ||
    item.current?.operation !== "notification_mark_read_v1" ||
    item.current.values.notification_id !== id
  )
    return null;
  const version = item.versions.find(
    (v) => v.entity.type === "notifications" && v.entity.id === id,
  )?.version;
  return version && Number.isSafeInteger(version) && version > 0 ? version : null;
}
export async function getNotificationVersion(scope: SetupScope, id: string) {
  const result = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    operation: "notification_mark_read_v1",
    selector: { operation: "notification_mark_read_v1", key: { notification_id: id } },
    page: { limit: 1 },
  });
  const item = result.items.find((item) => notificationVersion(item, id) !== null);
  return item ? notificationVersion(item, id) : null;
}
// Only the existing authorized session route is supported; payload text is never a URL.
export function inboxTarget(orgId: string, subject: EntityRef) {
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  return subject.type === "sessions" && uuid.test(orgId) && uuid.test(subject.id)
    ? `/organizasyon/${orgId}/seans/${subject.id}`
    : null;
}
