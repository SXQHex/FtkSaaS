import { z } from "zod";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";
import { BackendError, queryBackendRead } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { Page_NotificationView, RequestNotificationsList } from "@ftksaas/api-contracts";
export type InboxVisibility = NonNullable<RequestNotificationsList["visibility"]>;
export type InboxFilter = "all" | "unread" | "todo" | "archived" | "deleted";
export const inboxKey = (scope: ClientScope) =>
  ["inbox", scope.accountId, scope.orgId, scope.centerId] as const;

export function organizationInboxReadKeys(queries: QueryClient, scope: ClientScope) {
  return queries
    .getQueryCache()
    .findAll({
      queryKey: ["inbox", scope.accountId, scope.orgId],
      predicate: ({ queryKey }) => queryKey[4] === "list" || queryKey[4] === "state",
    })
    .map(({ queryKey }) => queryKey);
}

export function inboxListQuery(
  scope: ClientScope,
  query = "",
  filter: InboxFilter = "all",
  cursor?: string,
  visited: (string | undefined)[] = [],
) {
  return queryOptions({
    queryKey: [...inboxKey(scope), "list", query, filter, cursor],
    queryFn: async (context) => {
      const page = await readInbox(
        scope,
        filter === "unread",
        cursor,
        {
          query,
          workState: filter === "todo" ? "pending" : "all",
          visibility: filter === "archived" || filter === "deleted" ? filter : undefined,
        },
        context,
      );
      if (page.next_cursor && (page.next_cursor === cursor || visited.includes(page.next_cursor)))
        throw new Error("INBOX_CURSOR_UNAVAILABLE");
      return page;
    },
    retry: false,
    staleTime: 15_000,
    // New notifications can arrive without a local mutation.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
const common = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export async function readInbox(
  scope: ClientScope,
  unreadOnly: boolean,
  cursor?: string,
  options?: { query: string; workState: "all" | "pending"; visibility?: InboxVisibility },
  context?: AccountReadContext,
  signal = context?.signal,
): Promise<Page_NotificationView> {
  const backend = await scopedBackend(scope, signal, context);
  const page = await queryBackendRead(
    backend,
    "notifications_list_v1",
    {
      ...common(scope),
      request_id: uuidv7(),
      unread_only: unreadOnly,
      ...(options
        ? {
            ...(options.query ? { query: options.query } : {}),
            work_state: options.workState,
            include_work: true,
            include_summary: true,
            ...(options.visibility ? { visibility: options.visibility } : {}),
          }
        : {}),
      page: { limit: 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    },
    signal,
  );
  z.iso.datetime({ offset: true }).parse(page.as_of);
  const seen = new Set<string>();
  if (page.items.length > 20) throw new Error("INBOX_SOURCE_UNAVAILABLE");
  for (const item of page.items) {
    z.uuid().parse(item.id);
    z.iso.datetime({ offset: true }).parse(item.created_at);
    if (item.read_at !== null) z.iso.datetime({ offset: true }).parse(item.read_at);
    if (seen.has(item.id) || (unreadOnly && item.read_at !== null))
      throw new Error("INBOX_SOURCE_UNAVAILABLE");
    seen.add(item.id);
    z.uuid().parse(item.payload.subject.id);
    const reservationTarget = item.work?.reservation_target;
    if (reservationTarget) {
      if (
        item.kind !== "session_changed_for_participant" ||
        item.work?.state !== "informational" ||
        item.payload.subject.type !== "sessions" ||
        reservationTarget.operation !== "reservation_list_v1" ||
        reservationTarget.key.session_id !== item.payload.subject.id
      )
        throw new Error("INBOX_SOURCE_UNAVAILABLE");
      z.uuid().parse(reservationTarget.center_id);
    }
    if (item.payload.title !== undefined) z.string().parse(item.payload.title);
    if (item.payload.body !== undefined) z.string().parse(item.payload.body);
  }
  if (options) {
    if (!page.summary) throw new Error("INBOX_SUMMARY_UNAVAILABLE");
    for (const value of Object.values(page.summary))
      z.number().int().nonnegative().safe().parse(value);
    if (
      page.summary.unread > page.summary.total ||
      page.summary.pending +
        page.summary.completed +
        page.summary.informational +
        page.summary.unavailable !==
        page.summary.total
    )
      throw new Error("INBOX_SUMMARY_UNAVAILABLE");
    for (const item of page.items) {
      z.number().int().positive().safe().parse(item.version);
      if (!item.work) throw new Error("INBOX_SOURCE_UNAVAILABLE");
      if (options.visibility && item.visibility !== options.visibility)
        throw new Error("INBOX_SOURCE_UNAVAILABLE");
      z.enum(["pending", "completed", "informational", "unavailable"]).parse(item.work.state);
      if (options.workState === "pending" && item.work.state !== "pending")
        throw new Error("INBOX_SOURCE_UNAVAILABLE");
      if (item.work.center_id !== null) z.uuid().parse(item.work.center_id);
      if (
        item.work.state === "unavailable" &&
        (item.work.center_id !== null || item.work.selector !== null)
      )
        throw new Error("INBOX_SOURCE_UNAVAILABLE");
    }
  }
  return page;
}
export async function readNotificationState(
  scope: ClientScope,
  id: string,
  context?: AccountReadContext,
) {
  z.uuid().parse(id);
  const page = await (
    await scopedBackend(scope, undefined, context)
  ).call("management_state_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    operation: "notification_mark_read_v1",
    selector: { operation: "notification_mark_read_v1", key: { notification_id: id } },
    page: { limit: 2 },
  });
  const row = page.items[0],
    versions = row?.versions.filter(
      (version) => version.entity.type === "notifications" && version.entity.id === id,
    );
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== "notification_mark_read_v1" ||
    row.entity?.type !== "notifications" ||
    row.entity.id !== id ||
    !["read", "unread"].includes(row.state ?? "") ||
    versions?.length !== 1 ||
    row.current?.operation !== "notification_mark_read_v1" ||
    row.current.values.notification_id !== id
  )
    throw new Error("INBOX_STATE_UNAVAILABLE");
  return {
    id,
    state: row.state as "read" | "unread",
    version: z.number().int().positive().safe().parse(versions[0]!.version),
  };
}
export interface ReadNotificationIntent {
  scope: ClientScope;
  id: string;
  version: number;
  key: string;
}
export async function notificationReadIntent(
  scope: ClientScope,
  before: Awaited<ReturnType<typeof readNotificationState>>,
): Promise<ReadNotificationIntent> {
  const current = await readNotificationState(scope, before.id);
  if (current.version !== before.version || current.state !== "unread")
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return { scope: { ...scope }, id: current.id, version: current.version, key: uuidv7() };
}
export async function markNotificationRead(intent: ReadNotificationIntent) {
  return (await scopedBackend(intent.scope)).call("notification_mark_read_v1", {
    ...common(intent.scope),
    request_id: uuidv7(),
    notification_id: intent.id,
    expected_version: intent.version,
    operation_key: intent.key,
  });
}
export async function readNotificationReceipt(intent: ReadNotificationIntent) {
  const value = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    org_id: intent.scope.orgId,
    request_id: uuidv7(),
    operation: "notification_mark_read_v1",
    key: intent.key,
  });
  if (
    value.operation !== "notification_mark_read_v1" ||
    value.key !== intent.key ||
    (value.result_reference &&
      (value.result_reference.type !== "notifications" || value.result_reference.id !== intent.id))
  )
    throw new Error("INBOX_RECEIPT_UNAVAILABLE");
  return value;
}
export async function readNotificationResult(intent: ReadNotificationIntent, id?: string) {
  if (id !== intent.id) throw new Error("INBOX_RESULT_UNAVAILABLE");
  const value = await readNotificationState(intent.scope, intent.id);
  if (value.state !== "read" || value.version <= intent.version)
    throw new Error("INBOX_RESULT_UNAVAILABLE");
  return value;
}
