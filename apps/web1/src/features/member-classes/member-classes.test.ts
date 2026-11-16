import { beforeEach, expect, it, vi } from "vitest";
import { readMemberClasses, memberClassWeek, type MemberClass } from "./member-classes-read";
import { memberClassIntent } from "./member-class-command";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  interval = { starts_at: "2026-11-16T00:00:00Z", ends_at: "2026-11-23T00:00:00Z" };
const row: MemberClass = {
  id: id(4),
  type: "session",
  center_id: scope.centerId,
  title: "Ders",
  starts_at: "2026-11-17T15:00:00Z",
  ends_at: "2026-11-17T16:00:00Z",
  capacity: {
    total: 10,
    held: 1,
    remaining: 9,
    category_held: null,
    category_remaining: null,
    room_capacity: 20,
  },
  member_lesson: {
    version: 7,
    format: "group",
    state: "planned",
    attendance_state: "open",
    instructor_labels: ["Eğitmen"],
    room_labels: ["Salon"],
    booking_window: {
      state: "open",
      policy_version_id: id(7),
      opens_at: "2026-11-01T00:00:00Z",
      closes_at: "2026-11-17T14:00:00Z",
    },
    cancellation: {
      status: "available",
      source: "current_policy",
      policy_version_id: id(8),
      terms: {
        cutoff_minutes: 60,
        before_cutoff: "release",
        after_cutoff: "consume",
        no_show: "consume",
      },
      cutoff_at: "2026-11-17T14:00:00Z",
    },
    own_reservation: null,
    waitlist_enabled: true,
    own_waitlist: null,
  },
};
const draft = {
  query: "",
  personId: id(5),
  saleId: id(6),
  mode: "priority" as const,
  category: "" as const,
  override: false,
  reason: "",
  reviewed: true,
};
beforeEach(() => call.mockReset());
it("discovers unbooked group/private lessons with opt-in scope and complete interval cursors", async () => {
  call
    .mockResolvedValueOnce({ items: [row], next_cursor: "next" })
    .mockResolvedValueOnce({
      items: [{ ...row, id: id(9), member_lesson: { ...row.member_lesson, format: "private" } }],
      next_cursor: null,
    });
  expect(await readMemberClasses(scope, interval)).toHaveLength(2);
  expect(call.mock.calls[0]![1]).toMatchObject({
    member_discovery: true,
    org_id: scope.orgId,
    center_id: scope.centerId,
    interval,
    page: { limit: 50, sort: "starts_at_asc" },
  });
  expect(call.mock.calls[0]![1]).not.toHaveProperty("resource");
  expect(call.mock.calls[1]![1].page.cursor).toBe("next");
});
it("refuses missing discovery metadata, foreign centers, duplicate IDs and cursor loops", async () => {
  for (const value of [
    { ...row, member_lesson: undefined },
    { ...row, center_id: id(99) },
    { ...row, starts_at: interval.ends_at },
    { ...row, capacity: { nominal: 10, maximum: 10 } },
  ]) {
    call.mockResolvedValueOnce({ items: [value], next_cursor: null });
    await expect(readMemberClasses(scope, interval)).rejects.toThrow();
  }
  call.mockResolvedValueOnce({ items: [row, row], next_cursor: null });
  await expect(readMemberClasses(scope, interval)).rejects.toThrow();
  call
    .mockResolvedValueOnce({ items: [], next_cursor: "repeat" })
    .mockResolvedValueOnce({ items: [], next_cursor: "repeat" });
  await expect(readMemberClasses(scope, interval)).rejects.toThrow();
});
it("constructs seven local days and correct UTC week bounds across DST", async () => {
  const week = await memberClassWeek("America/New_York", "2026-11-01T12:00:00Z");
  expect(week.days).toHaveLength(7);
  expect(week.interval).toEqual({
    starts_at: "2026-10-26T04:00:00Z",
    ends_at: "2026-11-02T05:00:00Z",
  });
});
it("requires explicit self review and never exposes a capacity override intent", async () => {
  await expect(
    memberClassIntent(scope, id(5), row, "book", { ...draft, reviewed: false }),
  ).rejects.toThrow("MEMBER_CLASS_REVIEW_REQUIRED");
  await expect(
    memberClassIntent(scope, id(5), row, "book", { ...draft, override: true }),
  ).rejects.toThrow("MEMBER_CLASS_REVIEW_REQUIRED");
  await expect(memberClassIntent(scope, id(99), row, "book", draft)).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
});
it("rereads the native session/version and selected entitlement before constructing booking", async () => {
  call
    .mockResolvedValueOnce({ items: [row], next_cursor: null })
    .mockResolvedValueOnce([
      { person_id: id(5), sale_id: id(6), state: "active", booking_mode: "priority" },
    ]);
  expect(await memberClassIntent(scope, id(5), row, "book", draft)).toMatchObject({
    kind: "booking",
    value: {
      operation: "reservation_create_v1",
      request: { person_id: id(5), session_id: row.id, source_sale_id: id(6), mode: "priority" },
    },
  });
  expect(
    call.mock.calls.every(([op]) => ["calendar_get_v1", "entitlements_get_v1"].includes(op)),
  ).toBe(true);
});
it("rejects stale versions and changed cancellation policy before any writer", async () => {
  for (const member_lesson of [
    { ...row.member_lesson, version: 8 },
    {
      ...row.member_lesson,
      cancellation: { ...row.member_lesson.cancellation, policy_version_id: id(99) },
    },
    {
      ...row.member_lesson,
      booking_window: { ...row.member_lesson.booking_window, state: "closed" },
    },
  ]) {
    call.mockResolvedValueOnce({ items: [{ ...row, member_lesson }], next_cursor: null });
    await expect(memberClassIntent(scope, id(5), row, "book", draft)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
  }
});
it("uses only actual full capacity and native waitlist feature for join", async () => {
  const full = { ...row, capacity: { ...row.capacity, remaining: 0 } };
  call.mockResolvedValueOnce({ items: [full], next_cursor: null });
  expect(await memberClassIntent(scope, id(5), full, "join", draft)).toMatchObject({
    kind: "waitlist",
    value: { operation: "waitlist_join_v1", personId: id(5) },
  });
  call.mockResolvedValueOnce({ items: [row], next_cursor: null });
  await expect(memberClassIntent(scope, id(5), row, "join", draft)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  const off = { ...full, member_lesson: { ...full.member_lesson, waitlist_enabled: false } };
  call.mockResolvedValueOnce({ items: [off], next_cursor: null });
  await expect(memberClassIntent(scope, id(5), off, "join", draft)).rejects.toThrow(
    "MEMBER_CLASS_WAITLIST_UNAVAILABLE",
  );
});
it("allows category waitlist only for its actually full native category", async () => {
  const category = {
    ...row,
    capacity: {
      ...row.capacity,
      categories: { male: 3, female: 7 },
      category_remaining: { male: 0, female: 5 },
      category_held: { male: 3, female: 2 },
    },
  };
  call.mockResolvedValueOnce({ items: [category], next_cursor: null });
  expect(
    await memberClassIntent(scope, id(5), category, "join", { ...draft, category: "male" }),
  ).toMatchObject({ value: { category: "male" } });
});
