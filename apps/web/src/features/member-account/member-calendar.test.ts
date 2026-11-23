import { expect, it, vi, afterEach } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  calendarCredential,
  readCalendarLinks,
  readMemberCalendars,
  selectMemberCalendars,
  writeMemberCalendar,
} from "./member-calendar";
import {
  readMemberPreferences,
  writeMemberPreference,
  readMemberPreferenceReceipt,
} from "./member-preferences";
const scope = { accountId: "account", orgId: "org", centerId: "center" };
afterEach(() => vi.resetAllMocks());
it("accepts HTTPS and isolated loopback credentials, rejects external cleartext and embedded credentials", () => {
  expect(calendarCredential("https://calendar.example.invalid/calendar/synthetic.ics")).toContain(
    "synthetic",
  );
  expect(calendarCredential("http://127.0.0.1:4000/calendar/synthetic.ics")).toContain("127.0.0.1");
  for (const url of [
    "http://calendar.example.invalid/a",
    "https://user:pass@example.invalid/a",
    "javascript:alert(1)",
    "https://example.invalid/a#secret",
  ])
    expect(() => calendarCredential(url)).toThrow();
});
it("follows own metadata cursors while showing only selected organization links", async () => {
  call
    .mockResolvedValueOnce({
      items: [{ id: "other", org_id: "other", version: 1, kinds: ["lessons"] }],
      next_cursor: "second",
      service_ready: true,
      supported_kinds: ["lessons"],
    })
    .mockResolvedValueOnce({
      items: [{ id: "own", org_id: "org", version: 2, kinds: ["lessons"] }],
      next_cursor: null,
      service_ready: true,
      supported_kinds: ["lessons"],
    });
  const snapshot = await readCalendarLinks(scope);
  const result = selectMemberCalendars(scope, snapshot);
  expect(
    selectMemberCalendars({ ...scope, orgId: "other" }, snapshot).links.map((row) => row.id),
  ).toEqual(["other"]);
  expect(call).toHaveBeenCalledTimes(2);
  expect(result.links.map((row) => row.id)).toEqual(["own"]);
  expect(result.ready).toBe(true);
  expect(call.mock.calls[1][1].page.cursor).toBe("second");
  expect(call.mock.calls.every(([, req]) => !("org_id" in req) && !("center_id" in req))).toBe(
    true,
  );
});
it("rejects repeated cursor metadata instead of looping or silently truncating", async () => {
  call.mockResolvedValue({
    items: [],
    next_cursor: "repeat",
    service_ready: true,
    supported_kinds: [],
  });
  await expect(readMemberCalendars(scope)).rejects.toThrow("CALENDAR_CURSOR_REPEATED");
  expect(call).toHaveBeenCalledTimes(2);
});
it("creates only explicit own lesson links with the frozen operation key", async () => {
  call.mockResolvedValue({});
  await writeMemberCalendar(scope, { action: "create", key: "frozen", kind: "lessons" });
  expect(call).toHaveBeenCalledWith(
    "calendar_link_create_v1",
    expect.objectContaining({
      operation_key: "frozen",
      organization_scope: { org_id: "org" },
      kinds: ["lessons"],
    }),
  );
});
it("requires the exact studio center in metadata and write scopes", async () => {
  const studioScope = { ...scope, studioCenterId: scope.centerId };
  const link = {
    id: "studio",
    org_id: scope.orgId,
    center_id: scope.centerId,
    kinds: ["studio_program"] as ["studio_program"],
    state: "active" as const,
    created_at: "2026-11-18T09:00:00Z",
    version: 2,
  };
  const page = { items: [link], next_cursor: null, service_ready: true, supported_kinds: [] };
  call.mockResolvedValueOnce(page);
  await expect(readMemberCalendars(studioScope)).resolves.toMatchObject({
    links: [link],
    supportedKinds: ["studio_program"],
  });
  const selector = { org_id: "org", center_id: "center" };
  expect(call).toHaveBeenLastCalledWith(
    "calendar_links_get_v1",
    expect.objectContaining({ studio_program_scope: selector }),
  );
  call.mockResolvedValueOnce({ ...page, items: [{ ...link, center_id: "other" }] });
  await expect(readMemberCalendars(studioScope)).rejects.toThrow("CALENDAR_METADATA_UNAVAILABLE");
  const rotate = { action: "rotate" as const, key: "rotate", link };
  await expect(writeMemberCalendar(scope, rotate)).rejects.toThrow("CALENDAR_SCOPE_CHANGED");
  await writeMemberCalendar(studioScope, rotate);
  expect(call).toHaveBeenLastCalledWith(
    "calendar_link_rotate_v1",
    expect.objectContaining({ organization_scope: selector, expected_version: 2 }),
  );
});
it("writes member preferences separately from global reminder email opt-in", async () => {
  await writeMemberPreference({ scope, id: "package", enabled: false, version: 3, key: "member" });
  expect(call).toHaveBeenLastCalledWith(
    "settings_update_v1",
    expect.objectContaining({
      scope: "member",
      org_id: "org",
      patch: { package_reminders_enabled: false },
      expected_version: 3,
      operation_key: "member",
    }),
  );
  await writeMemberPreference({ scope, id: "email", enabled: true, version: 6, key: "email" });
  expect(call).toHaveBeenLastCalledWith(
    "notification_preferences_set_v1",
    expect.objectContaining({
      channel: "email",
      purpose: "reminder",
      enabled: true,
      expected_version: 6,
      operation_key: "email",
    }),
  );
});
it("does not invent missing preference defaults or enable unavailable marketing", async () => {
  call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? { scope: "member", fields: [{ key: "in_app_marketing", writable: true }] }
      : op === "settings_get_v1"
        ? { scope: "member", version: 0, values: { in_app_marketing: false } }
        : { items: [] },
  );
  const result = await readMemberPreferences(scope);
  expect(result.rows.find((row) => row.id === "inApp")?.selected).toBeUndefined();
  expect(result.rows.find((row) => row.id === "mandatory")?.selected).toBeUndefined();
  expect(result.rows.find((row) => row.id === "marketing")?.writable).toBe(false);
});
it("rejects receipts for another operation key", async () => {
  call.mockResolvedValue({ operation: "settings_update_v1", key: "another" });
  await expect(
    readMemberPreferenceReceipt({ scope, id: "inApp", enabled: true, version: 2, key: "own" }),
  ).rejects.toThrow("PREFERENCE_RECEIPT_MISMATCH");
});
