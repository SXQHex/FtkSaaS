import { beforeEach, expect, it, vi } from "vitest";
import { readInbox } from "./inbox";
import {
  notificationSetIntent,
  markAllNotificationsIntent,
  readNotificationSelection,
  setNotificationsRead,
  readNotificationSetReceipt,
  readNotificationSetResult,
} from "./inbox-batch";
import { readInboxSource } from "./inbox-source";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const operation = "notifications_read_set_v1";
const notifications = [
  { id: id(4), expected_version: 7 },
  { id: id(5), expected_version: 9 },
];
const states = (advance = 0, read = false) => ({
  items: notifications
    .map((n) => ({
      operation,
      entity: { type: "notifications", id: n.id },
      exists: true,
      state: read ? "read" : "unread",
      versions: [
        { entity: { type: "notifications", id: n.id }, version: n.expected_version + advance },
      ],
      current: null,
    }))
    .reverse(),
  next_cursor: null,
});
const intent = {
  scope,
  notifications: [notifications[0]!, notifications[1]!] as [
    (typeof notifications)[number],
    (typeof notifications)[number],
  ],
  read: true,
  key: id(6),
  changedIds: [id(4), id(5)],
};
beforeEach(() => call.mockReset());
it("uses native search/work/options and accepts authoritative counts beyond the page, omitting empty query", async () => {
  const page = {
    items: [],
    as_of: "2026-11-17T12:00:00Z",
    summary: {
      total: 90,
      unread: 20,
      pending: 10,
      completed: 30,
      informational: 40,
      unavailable: 10,
    },
  };
  call.mockResolvedValue(page);
  await readInbox(scope, false, "cursor", { query: "% literal", workState: "pending" });
  expect(call).toHaveBeenLastCalledWith(
    "notifications_list_v1",
    expect.objectContaining({
      query: "% literal",
      work_state: "pending",
      include_work: true,
      include_summary: true,
      page: { limit: 20, sort: "created_at_asc", cursor: "cursor" },
    }),
  );
  await readInbox(scope, false, undefined, { query: "", workState: "all" });
  expect(call.mock.calls.at(-1)![1]).not.toHaveProperty("query");
  call.mockResolvedValue({ ...page, summary: undefined });
  await expect(readInbox(scope, false, undefined, { query: "", workState: "all" })).rejects.toThrow(
    "INBOX_SUMMARY_UNAVAILABLE",
  );
});
it("reads each selected version with current:null and restores request order from native sort", async () => {
  call.mockResolvedValue(states());
  const selected = await readNotificationSelection(
    scope,
    notifications.map((n) => n.id),
  );
  expect(selected.map((n) => n.version)).toEqual([7, 9]);
  expect(call).toHaveBeenCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      operation,
      selector: { operation, key: { notification_ids: notifications.map((n) => n.id) } },
      page: { limit: 2 },
    }),
  );
  const value = await notificationSetIntent(scope, notifications, false);
  await setNotificationsRead(value);
  expect(call).toHaveBeenLastCalledWith(
    operation,
    expect.objectContaining({ read: false, notifications, operation_key: value.key }),
  );
});
it("refuses empty/duplicate selection and missing or foreign native records", async () => {
  await expect(notificationSetIntent(scope, [], true)).rejects.toThrow();
  await expect(readNotificationSelection(scope, [id(4), id(4)])).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
  call.mockResolvedValue({ ...states(), items: states().items.slice(1) });
  await expect(notificationSetIntent(scope, notifications, true)).rejects.toThrow(
    "INBOX_SELECTION_UNAVAILABLE",
  );
  const foreign = states();
  foreign.items[0]!.entity.id = id(99);
  call.mockResolvedValue(foreign);
  await expect(notificationSetIntent(scope, notifications, true)).rejects.toThrow(
    "INBOX_SELECTION_UNAVAILABLE",
  );
});
it("rejects one stale version before the whole atomic writer", async () => {
  call.mockResolvedValue(states(1));
  await expect(notificationSetIntent(scope, notifications, true)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  expect(call.mock.calls.some(([op]) => op === operation)).toBe(false);
});
it("keeps an organization-wide read command bound to its recipient and key", async () => {
  const personId = id(10);
  const intent = markAllNotificationsIntent(scope, personId);
  call.mockResolvedValue({ primary_id: personId, related: [] });
  await setNotificationsRead(intent);
  await setNotificationsRead(intent);
  for (const [name, request] of call.mock.calls) {
    expect(name).toBe(operation);
    expect(request).toEqual({
      client_api_version: 1,
      org_id: scope.orgId,
      request_id: expect.any(String),
      operation_key: intent.key,
      read: true,
      all_unread: true,
    });
  }
  call.mockResolvedValue({
    operation,
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "people", id: id(11) },
  });
  await expect(readNotificationSetReceipt(intent)).rejects.toThrow("INBOX_RECEIPT_UNAVAILABLE");
  await expect(readNotificationSetResult(intent, personId)).resolves.toEqual([]);
});
it("requires all selected outcomes to advance with the requested state and first request ID", async () => {
  call.mockResolvedValue(states(1, true));
  await expect(readNotificationSetResult(intent, id(4))).resolves.toHaveLength(2);
  await expect(readNotificationSetResult(intent, id(5))).rejects.toThrow(
    "INBOX_RESULT_UNAVAILABLE",
  );
  call.mockResolvedValue(states(0, true));
  await expect(readNotificationSetResult(intent, id(4))).rejects.toThrow(
    "INBOX_RESULT_UNAVAILABLE",
  );
  const partial = states(1, true);
  partial.items[0]!.state = "unread";
  call.mockResolvedValue(partial);
  await expect(readNotificationSetResult(intent, id(4))).rejects.toThrow(
    "INBOX_RESULT_UNAVAILABLE",
  );
  call.mockResolvedValue(states(1, false));
  await expect(readNotificationSetResult({ ...intent, read: false }, id(4))).resolves.toHaveLength(
    2,
  );
});
it("does not accept a receipt for another operation/key/primary notification", async () => {
  for (const change of [
    { operation: "notification_mark_read_v1" },
    { key: id(99) },
    { result_reference: { type: "notifications", id: id(5) } },
  ]) {
    call.mockResolvedValue({
      operation,
      key: intent.key,
      result_reference: { type: "notifications", id: id(4) },
      ...change,
    });
    await expect(readNotificationSetReceipt(intent)).rejects.toThrow("INBOX_RECEIPT_UNAVAILABLE");
  }
});
it("opens only the returned exact selector in its actual center, without a writer", async () => {
  const selector = {
    operation: "crm_activity_save_v1" as const,
    key: { person_id: id(8), activity_id: id(7) },
  };
  const row = {
    operation: selector.operation,
    exists: true,
    entity: { type: "crm_activities", id: id(7) },
    state: "completed",
    versions: [{ entity: { type: "crm_activities", id: id(7) }, version: 11 }],
    current: {
      operation: selector.operation,
      values: {
        activity_id: id(7),
        person_id: id(8),
        kind: "followup",
        note: "<img> safe text",
        due_at: null,
      },
    },
  };
  call.mockResolvedValue({ items: [row], next_cursor: null });
  const source = await readInboxSource(scope, { state: "pending", center_id: id(9), selector });
  expect(call).toHaveBeenCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      center_id: id(9),
      operation: selector.operation,
      selector,
      page: { limit: 1 },
    }),
  );
  expect(source).toMatchObject({
    workState: "completed",
    note: "<img> safe text",
    href: `/o/${scope.orgId}/c/${id(9)}/people/${id(8)}`,
  });
  call.mockResolvedValue({ items: [{ ...row, entity: { type: "crm_activities", id: id(99) } }] });
  await expect(
    readInboxSource(scope, { state: "pending", center_id: id(9), selector }),
  ).rejects.toThrow("INBOX_SOURCE_UNAVAILABLE");
});
it("does not request an unavailable or selector-free source", async () => {
  await expect(
    readInboxSource(scope, { state: "unavailable", center_id: null, selector: null }),
  ).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});

it("reads an exact lesson request with its read-only selector before linking self or management flows", async () => {
  const operation = "lesson_request_create_v1" as const;
  const detail = {
    id: id(4),
    center_id: id(9),
    person_id: id(8),
    discipline_id: id(10),
    version: 3,
    state: "pending",
    requested_start: "2026-11-20T12:00:00Z",
    created_at: "2026-11-17T12:00:00Z",
    duration_minutes: 45,
    format: "private",
    alternatives: [],
  };
  call.mockResolvedValue({
    items: [
      {
        operation,
        entity: { type: "lesson_requests", id: detail.id },
        exists: true,
        state: detail.state,
        versions: [{ entity: { type: "lesson_requests", id: detail.id }, version: 3 }],
        request_detail: detail,
      },
    ],
    next_cursor: null,
  });
  const selector = { operation, key: { lesson_request_id: detail.id } };
  const result = await readInboxSource(scope, { state: "pending", center_id: id(9), selector });
  expect(call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({ operation, selector, center_id: id(9) }),
  );
  expect(result).toMatchObject({
    workState: "pending",
    href: `/o/${scope.orgId}/c/${id(9)}/requests?request=${detail.id}`,
    ownHref: `/member/private-lessons?org=${scope.orgId}&center=${id(9)}&request=${detail.id}`,
  });
  expect(call.mock.calls.every(([op]) => op === "management_state_get_v1")).toBe(true);
});
it("validates the exact native seat offer without treating its read selector as accept permission", async () => {
  const operation = "seat_offer_accept_v1" as const;
  const offer = {
    id: id(4),
    entry_id: id(5),
    person_id: id(8),
    session_id: id(10),
    state: "active",
    expires_at: "2099-11-20T12:00:00Z",
    version: 4,
  };
  const row = {
    operation,
    entity: { type: "seat_offers", id: offer.id },
    exists: true,
    state: "active",
    versions: [{ entity: { type: "seat_offers", id: offer.id }, version: 4 }],
    waitlist_detail: {
      id: id(5),
      center_id: id(9),
      person_id: id(8),
      session_id: id(10),
      offers: [offer],
    },
  };
  const source = {
    state: "pending" as const,
    center_id: id(9),
    selector: { operation, key: { offer_id: offer.id } },
  };
  call.mockResolvedValue({ items: [row], next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
  await expect(readInboxSource(scope, source, id(7))).rejects.toThrow(
    "MEMBER_WAITLIST_UNAVAILABLE",
  );
  expect(await readInboxSource(scope, source)).toMatchObject({
    kind: "offer",
    workState: "pending",
    href: `/member/reservations?org=${scope.orgId}&center=${id(9)}&offer=${offer.id}`,
  });
  call.mockResolvedValue({
    items: [{ ...row, waitlist_detail: { ...row.waitlist_detail, center_id: id(99) } }],
  });
  await expect(readInboxSource(scope, source)).rejects.toThrow("MEMBER_WAITLIST_UNAVAILABLE");
  expect(call.mock.calls.every(([op]) => op === "management_state_get_v1")).toBe(true);
});
