import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  inboxKey,
  organizationInboxReadKeys,
  readInbox,
  readNotificationState,
  notificationReadIntent,
  markNotificationRead,
  readNotificationReceipt,
  readNotificationResult,
} from "./inbox";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
it("marks cached inbox state and lists across the member's organization only", () => {
  const queries = new QueryClient();
  const ownList = [...inboxKey(scope), "list", "", "all"];
  const otherCenterState = [...inboxKey({ ...scope, centerId: id(5) }), "state", id(7)];
  const source = [...inboxKey(scope), "work", id(7)];
  const otherOrg = [...inboxKey({ ...scope, orgId: id(8) }), "list"];
  const otherActor = [...inboxKey({ ...scope, accountId: id(9) }), "state", id(7)];
  for (const key of [ownList, otherCenterState, source, otherOrg, otherActor])
    queries.setQueryData(key, { cached: true });

  expect(organizationInboxReadKeys(queries, scope)).toEqual([ownList, otherCenterState]);
  queries.clear();
});
it("marks every organization list and only the selected notification states", () => {
  const queries = new QueryClient();
  const otherCenter = inboxKey({ ...scope, centerId: id(5) });
  const first = [...inboxKey(scope), "list", "", "all", undefined];
  const continuation = [...otherCenter, "list", "", "unread", "next"];
  const selected = [...otherCenter, "state", id(7)];
  const unrelated = [...otherCenter, "state", id(8)];
  for (const key of [first, continuation, selected, unrelated]) queries.setQueryData(key, true);

  expect(organizationInboxReadKeys(queries, scope, [id(7)])).toEqual([
    first,
    continuation,
    selected,
  ]);
  queries.clear();
});
const notification = {
  id: id(4),
  kind: "synthetic",
  created_at: "2026-11-16T12:00:00Z",
  read_at: null,
  payload: {
    template_key: "synthetic",
    subject: { type: "notifications", id: id(4) },
    title: "Bildirim",
    body: "Metin",
  },
};
const page = { items: [notification], next_cursor: "native-cursor", as_of: "2026-11-16T12:01:00Z" };
function state(version = 7, read = false) {
  return {
    items: [
      {
        operation: "notification_mark_read_v1",
        exists: true,
        entity: { type: "notifications", id: id(4) },
        state: read ? "read" : "unread",
        versions: [{ entity: { type: "notifications", id: id(4) }, version }],
        current: { operation: "notification_mark_read_v1", values: { notification_id: id(4) } },
      },
    ],
    next_cursor: null,
  };
}
beforeEach(() => {
  call.mockReset();
});
it("uses the native own inbox scope/filter/cursor without inventing a recipient", async () => {
  call.mockResolvedValue(page);
  await readInbox(scope, true, "second");
  expect(call).toHaveBeenCalledWith(
    "notifications_list_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      unread_only: true,
      page: { limit: 20, sort: "created_at_asc", cursor: "second" },
    }),
  );
  expect(call.mock.calls[0]![1]).not.toHaveProperty("person_id");
});
it("rejects duplicate IDs, malformed timestamps and a read row in the unread-only source", async () => {
  call.mockResolvedValueOnce({ ...page, items: [notification, notification] });
  await expect(readInbox(scope, false)).rejects.toThrow("INBOX_SOURCE_UNAVAILABLE");
  call.mockResolvedValueOnce({ ...page, items: [{ ...notification, created_at: "bad" }] });
  await expect(readInbox(scope, false)).rejects.toThrow();
  call.mockResolvedValueOnce({
    ...page,
    items: [{ ...notification, read_at: "2026-11-16T12:01:00Z" }],
  });
  await expect(readInbox(scope, true)).rejects.toThrow("INBOX_SOURCE_UNAVAILABLE");
});
it("reads the real original-writer version instead of assuming version one", async () => {
  call.mockResolvedValue(state(7));
  const before = await readNotificationState(scope, id(4));
  const intent = await notificationReadIntent(scope, before);
  expect(intent.version).toBe(7);
  call.mockResolvedValueOnce({ primary_id: id(4) });
  await markNotificationRead(intent);
  expect(call).toHaveBeenLastCalledWith(
    "notification_mark_read_v1",
    expect.objectContaining({
      notification_id: id(4),
      expected_version: 7,
      operation_key: intent.key,
    }),
  );
});
it("refuses foreign entities, missing version evidence and unsupported states", async () => {
  const foreign = state();
  foreign.items[0]!.entity.id = id(99);
  call.mockResolvedValueOnce(foreign);
  await expect(readNotificationState(scope, id(4))).rejects.toThrow("INBOX_STATE_UNAVAILABLE");
  const missing = state();
  missing.items[0]!.versions = [];
  call.mockResolvedValueOnce(missing);
  await expect(readNotificationState(scope, id(4))).rejects.toThrow("INBOX_STATE_UNAVAILABLE");
  const invalid = state();
  invalid.items[0]!.state = "active";
  call.mockResolvedValueOnce(invalid);
  await expect(readNotificationState(scope, id(4))).rejects.toThrow("INBOX_STATE_UNAVAILABLE");
});
it("requires a fresh unread source before creating a new write intent", async () => {
  call.mockResolvedValueOnce(state(8));
  await expect(
    notificationReadIntent(scope, { id: id(4), version: 7, state: "unread" }),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  call.mockResolvedValueOnce(state(7, true));
  await expect(
    notificationReadIntent(scope, { id: id(4), version: 7, state: "unread" }),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  expect(call.mock.calls.some(([op]) => op === "notification_mark_read_v1")).toBe(false);
});
it("confirms only the exact acknowledged ID with an advanced read state", async () => {
  const intent = { scope, id: id(4), version: 7, key: id(5) };
  call.mockResolvedValueOnce(state(7, true));
  await expect(readNotificationResult(intent, id(4))).rejects.toThrow("INBOX_RESULT_UNAVAILABLE");
  call.mockResolvedValueOnce(state(8, false));
  await expect(readNotificationResult(intent, id(4))).rejects.toThrow("INBOX_RESULT_UNAVAILABLE");
  call.mockResolvedValueOnce(state(8, true));
  await expect(readNotificationResult(intent, id(4))).resolves.toEqual({
    id: id(4),
    version: 8,
    state: "read",
  });
  await expect(readNotificationResult(intent, id(99))).rejects.toThrow("INBOX_RESULT_UNAVAILABLE");
});
it("rejects a receipt for another key or notification while retaining the original write key", async () => {
  const intent = { scope, id: id(4), version: 7, key: id(5) };
  call.mockResolvedValueOnce({
    operation: "notification_mark_read_v1",
    key: id(99),
    result_reference: { type: "notifications", id: id(4) },
  });
  await expect(readNotificationReceipt(intent)).rejects.toThrow("INBOX_RECEIPT_UNAVAILABLE");
  call.mockResolvedValueOnce({
    operation: "notification_mark_read_v1",
    key: intent.key,
    result_reference: { type: "notifications", id: id(99) },
  });
  await expect(readNotificationReceipt(intent)).rejects.toThrow("INBOX_RECEIPT_UNAVAILABLE");
});
