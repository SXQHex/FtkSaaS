import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { NotificationReadSelection } from "../../lib/api-contracts/generated";
const operation = "notifications_read_set_v1" as const;
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
const selection = z
  .array(z.object({ id: z.uuid(), expected_version: z.number().int().positive().safe() }))
  .min(1)
  .max(100);
export async function readNotificationSelection(scope: ClientScope, ids: string[]) {
  z.array(z.uuid()).min(1).max(100).parse(ids);
  if (new Set(ids).size !== ids.length) throw new Error("INBOX_SELECTION_UNAVAILABLE");
  const page = await (
    await scopedBackend(scope)
  ).call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation,
    selector: { operation, key: { notification_ids: [ids[0]!, ...ids.slice(1)] } },
    page: { limit: ids.length },
  });
  if (page.next_cursor || page.items.length !== ids.length)
    throw new Error("INBOX_SELECTION_UNAVAILABLE");
  return ids.map((id) => {
    const matches = page.items.filter(
      (row) => row.entity?.type === "notifications" && row.entity.id === id,
    );
    const row = matches[0];
    const versions = row?.versions.filter(
      (v) => v.entity.type === "notifications" && v.entity.id === id,
    );
    if (
      matches.length !== 1 ||
      !row?.exists ||
      row.operation !== operation ||
      !["read", "unread"].includes(row.state ?? "") ||
      versions?.length !== 1
    )
      throw new Error("INBOX_SELECTION_UNAVAILABLE");
    return {
      id,
      version: z.number().int().positive().safe().parse(versions[0]!.version),
      state: row.state as "read" | "unread",
    };
  });
}
export interface NotificationSetIntent {
  scope: ClientScope;
  notifications: [NotificationReadSelection, ...NotificationReadSelection[]];
  read: boolean;
  key: string;
  changedIds: string[];
}
export async function notificationSetIntent(
  scope: ClientScope,
  notifications: NotificationReadSelection[],
  read: boolean,
): Promise<NotificationSetIntent> {
  selection.parse(notifications);
  const current = await readNotificationSelection(
    scope,
    notifications.map((n) => n.id),
  );
  if (current.some((row, i) => row.version !== notifications[i]!.expected_version))
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return {
    scope: { ...scope },
    notifications: [notifications[0]!, ...notifications.slice(1)],
    read,
    key: uuidv7(),
    changedIds: current
      .filter((row) => row.state !== (read ? "read" : "unread"))
      .map((row) => row.id),
  };
}
export async function setNotificationsRead(intent: NotificationSetIntent) {
  return (await scopedBackend(intent.scope)).call(operation, {
    ...common(intent.scope),
    request_id: uuidv7(),
    operation_key: intent.key,
    read: intent.read,
    notifications: intent.notifications,
  });
}
export async function readNotificationSetReceipt(intent: NotificationSetIntent) {
  const value = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    org_id: intent.scope.orgId,
    request_id: uuidv7(),
    operation,
    key: intent.key,
  });
  if (
    value.operation !== operation ||
    value.key !== intent.key ||
    (value.result_reference &&
      (value.result_reference.type !== "notifications" ||
        value.result_reference.id !== intent.notifications[0].id))
  )
    throw new Error("INBOX_RECEIPT_UNAVAILABLE");
  return value;
}
export async function readNotificationSetResult(intent: NotificationSetIntent, id?: string) {
  if (id !== intent.notifications[0].id) throw new Error("INBOX_RESULT_UNAVAILABLE");
  const rows = await readNotificationSelection(
    intent.scope,
    intent.notifications.map((n) => n.id),
  );
  if (
    rows.some(
      (row, i) =>
        row.state !== (intent.read ? "read" : "unread") ||
        row.version <= intent.notifications[i]!.expected_version,
    )
  )
    throw new Error("INBOX_RESULT_UNAVAILABLE");
  return rows;
}
