import { beforeEach, expect, it, vi } from "vitest";
import { readOwnWaitlist, ownWaitlistIntent } from "./member-waitlist";
const { call, target, intent } = vi.hoisted(() => ({
  call: vi.fn(),
  target: vi.fn(),
  intent: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
vi.mock("../session-detail/session-waitlist", () => ({
  readWaitlistTarget: target,
  waitlistIntent: intent,
}));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const session = {
  id: id(4),
  title: "Sentetik bekleme dersi",
  interval: { starts_at: "2026-11-20T15:00:00Z", ends_at: "2026-11-20T16:00:00Z" },
  timezone: "Europe/Istanbul",
  state: "planned" as const,
  version: 2,
};
const entry = {
  id: id(5),
  person_id: id(6),
  session_id: id(4),
  center_id: id(3),
  state: "waiting" as const,
  version: 3,
  created_at: "2026-11-17T12:00:00Z",
  joined_at: "2026-11-17T12:00:00Z",
  offers: [],
};
const row = () => ({
  operation: "waitlist_join_v1",
  entity: { type: "waitlist_entries", id: id(5) },
  exists: true,
  state: "waiting",
  waitlist_detail: entry,
  waitlist_session: session,
  versions: [{ entity: { type: "waitlist_entries", id: id(5) }, version: 3 }],
});
beforeEach(() => {
  call.mockReset();
  target.mockReset();
  intent.mockReset();
});
it("discovers self waiting entries with native filters and untouched cursors, without person/session selectors", async () => {
  call.mockResolvedValue({ items: [row()], next_cursor: "next", as_of: "2026-11-17T12:00:00Z" });
  const result = await readOwnWaitlist(scope, "entries", "prior");
  expect(result.items[0]?.session.title).toBe(session.title);
  expect(result.nextCursor).toBe("next");
  expect(call.mock.calls[0]![1]).toMatchObject({
    center_id: scope.centerId,
    selector: { key: { directory: "self", view: "entries", status: "waiting" } },
    page: { cursor: "prior", sort: "created_at_asc" },
  });
  expect(call.mock.calls[0]![1]).not.toHaveProperty("person_id");
});
it("rejects mismatched scope, session and missing native version evidence", async () => {
  for (const broken of [
    { ...row(), waitlist_detail: { ...entry, center_id: id(9) } },
    { ...row(), waitlist_session: { ...session, id: id(8) } },
    { ...row(), versions: [] },
    { ...row(), waitlist_session: { ...session, timezone: "Invalid/Zone" } },
  ]) {
    call.mockResolvedValue({ items: [broken] });
    await expect(readOwnWaitlist(scope, "entries")).rejects.toThrow();
  }
});
it("rejects duplicate entries instead of inventing a rank or total", async () => {
  call.mockResolvedValue({ items: [row(), row()] });
  await expect(readOwnWaitlist(scope, "entries")).rejects.toThrow("MEMBER_WAITLIST_UNAVAILABLE");
});
it("reads active offers independently and binds them to exact entry, person and version", async () => {
  const offer = {
    id: id(7),
    entry_id: entry.id,
    session_id: session.id,
    person_id: entry.person_id,
    state: "active",
    version: 2,
    created_at: entry.created_at,
    expires_at: "2099-01-01T00:00:00Z",
  };
  const source = {
    ...row(),
    entity: { type: "seat_offers", id: offer.id },
    waitlist_detail: { ...entry, state: "offered", offers: [offer] },
    versions: [...row().versions, { entity: { type: "seat_offers", id: offer.id }, version: 2 }],
  };
  call.mockResolvedValue({ items: [source] });
  expect((await readOwnWaitlist(scope, "offers")).items[0]?.offer?.id).toBe(offer.id);
  expect(call.mock.calls[0]![1].selector.key).toEqual({
    directory: "self",
    view: "offers",
    status: "active",
  });
  source.versions.pop();
  await expect(readOwnWaitlist(scope, "offers")).rejects.toThrow();
});
it("requires explicit review and fresh exact entry before reusing native writer", async () => {
  const before = { id: entry.id, entry, session };
  target.mockResolvedValue(entry);
  await expect(ownWaitlistIntent(scope, before, "leave", false)).rejects.toThrow();
  await ownWaitlistIntent(scope, before, "leave", true);
  expect(intent).toHaveBeenCalledWith(
    scope,
    session.id,
    entry.person_id,
    "leave",
    undefined,
    entry,
    undefined,
    entry.person_id,
  );
  target.mockResolvedValue({ ...entry, version: 4 });
  await expect(ownWaitlistIntent(scope, before, "leave", true)).rejects.toThrow(
    "MEMBER_WAITLIST_STALE",
  );
});
