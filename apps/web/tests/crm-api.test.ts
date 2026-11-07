import { expect, test, vi } from "vitest";
import { crmApi } from "../src/lib/crm";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002",
  scope = { actorId: other, orgId: other, centerId: other };
const row = {
  operation: "crm_activity_save_v1",
  entity: { type: "crm_activities", id },
  exists: true,
  state: "open",
  versions: [{ entity: { type: "crm_activities", id }, version: 2 }],
  as_of: "2026-11-07T00:00:00Z",
  current: {
    operation: "crm_activity_save_v1",
    values: {
      activity_id: id,
      lead_id: other,
      kind: "followup",
      note: "Call back",
      due_at: "2026-11-08T12:00:00Z",
    },
  },
};
test("activity reader binds native operation, selector and cursor to the selected lead", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [row],
    next_cursor: "next",
    as_of: row.as_of,
  } as never);
  const p = await crmApi.management(scope, {
    operation: "crm_activity_save_v1",
    key: { lead_id: other },
  });
  expect(p.items[0].current).toEqual(row.current);
  expect(p.next_cursor).toBe("next");
  expect(setupCall).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "crm_activity_save_v1",
      selector: { operation: "crm_activity_save_v1", key: { lead_id: other } },
    }),
  );
});
test.each(["foreign-lead", "wrong-operation", "missing-version", "duplicate", "repeated-cursor"])(
  "activity reader rejects %s instead of displaying another target",
  async (kind) => {
    const r = structuredClone(row);
    if (kind === "foreign-lead") r.current.values.lead_id = id;
    if (kind === "wrong-operation") r.operation = "lead_save_v1";
    if (kind === "missing-version") r.versions = [];
    vi.mocked(setupCall).mockResolvedValueOnce({
      items: kind === "duplicate" ? [r, r] : [r],
      next_cursor: kind === "repeated-cursor" ? "same" : null,
      as_of: r.as_of,
    } as never);
    await expect(
      crmApi.management(
        scope,
        { operation: "crm_activity_save_v1", key: { lead_id: other } },
        kind === "repeated-cursor" ? "same" : undefined,
      ),
    ).rejects.toThrow("invalidCrm");
  },
);
test("person search delegates exact subscriber number to the normal authorized reader", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [],
    next_cursor: null,
    as_of: row.as_of,
  } as never);
  await crmApi.people(scope, "1061");
  expect(setupCall).toHaveBeenLastCalledWith(
    "people_list_v1",
    expect.objectContaining({
      query: "1061",
      page: { limit: 25, sort: "created_at_asc" },
      org_id: scope.orgId,
      center_id: scope.centerId,
    }),
  );
});
test("lead list preserves nullable subscriber numbers without generating identifiers", async () => {
  const lead = {
    id,
    person_id: other,
    source: "phone",
    interest: "Tango",
    assigned_to: null,
    state: "open",
    last_contact: null,
    due_followup: null,
    version: 1,
    subscriber_number: null,
  };
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [lead],
    next_cursor: null,
    as_of: row.as_of,
  } as never);
  expect((await crmApi.leads(scope, "Tango")).items[0].subscriber_number).toBeNull();
});
test("followup rejects foreign center rows rather than silently filtering a successful page", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [{ id, person_id: other, center_id: id, kind: "renewal_due", due_at: row.as_of }],
    next_cursor: null,
    as_of: row.as_of,
  } as never);
  await expect(crmApi.followups(scope, "renewal_due")).rejects.toThrow("invalidCrm");
});
