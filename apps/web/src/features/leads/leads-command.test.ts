import { afterEach, expect, it, vi } from "vitest";
const { call, detail, activities, applications, readPerson } = vi.hoisted(() => ({
  call: vi.fn(),
  detail: vi.fn(),
  activities: vi.fn(),
  applications: vi.fn(),
  readPerson: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
vi.mock("./leads-read", () => ({
  readLeadDetail: detail,
  readLeadActivities: activities,
  readApplicationsPage: applications,
}));
vi.mock("../people/people", () => ({ readPerson }));
import {
  personIntent,
  leadDraft,
  leadSaveIntent,
  leadActivityIntent,
  leadConvertIntent,
  readLeadReceipt,
  readLeadResult,
  writeLeadIntent,
} from "./leads-command";
import type { LeadDetail } from "./leads-read";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const before: LeadDetail = {
  id: id(4),
  personId: id(5),
  state: "open",
  version: 2,
  values: {
    person_id: id(5),
    source: "phone",
    interest: "Tango",
    assigned_to: id(6),
    pipeline: { stage_key: "new", tag_keys: [], loss_reason: null },
  },
};
const catalog = {
  stages: [
    { key: "new", name: "Yeni", kind: "open" as const },
    { key: "won", name: "Kazanıldı", kind: "won" as const },
    { key: "lost", name: "Kaybedildi", kind: "lost" as const },
  ] as const,
  tags: [],
  allow_center_tags: false,
  followup_days: null,
};
afterEach(() => vi.resetAllMocks());
it("creates a phone-only local person without an email, invitation or account writer", async () => {
  const intent = personIntent(scope, { name: "Örnek", email: "", phone: "+905550000000" });
  await writeLeadIntent(intent);
  expect(call).toHaveBeenCalledWith(
    "person_create_v1",
    expect.objectContaining({
      display_name: "Örnek",
      contacts: [{ kind: "phone", value: "+905550000000" }],
    }),
  );
  expect(call).toHaveBeenCalledTimes(1);
});
it("preserves the existing native assignee when no assignment catalog is available", async () => {
  detail.mockResolvedValue(before);
  const draft = { ...leadDraft(before), assignedTo: id(99), stageKey: "won" };
  const intent = await leadSaveIntent(
    scope,
    before.personId,
    draft,
    { ...catalog, stages: [...catalog.stages] },
    before,
  );
  await writeLeadIntent(intent);
  expect(call).toHaveBeenCalledWith(
    "lead_save_v1",
    expect.objectContaining({
      assigned_to: id(6),
      expected_version: 2,
      pipeline: { stage_key: "won", tag_keys: [], loss_reason: null },
    }),
  );
  expect(call).toHaveBeenCalledTimes(1);
});
it("requires an explicit loss reason and rejects removed catalog keys", async () => {
  detail.mockResolvedValue(before);
  await expect(
    leadSaveIntent(
      scope,
      before.personId,
      { ...leadDraft(before), stageKey: "lost" },
      { ...catalog, stages: [...catalog.stages] },
      before,
    ),
  ).rejects.toThrow();
  await expect(
    leadSaveIntent(
      scope,
      before.personId,
      { ...leadDraft(before), stageKey: "missing" },
      { ...catalog, stages: [...catalog.stages] },
      before,
    ),
  ).rejects.toThrow("LEAD_CATALOG_CHANGED");
  expect(call).not.toHaveBeenCalled();
});
it("rejects a stale review before any writer", async () => {
  detail.mockResolvedValue({ ...before, version: 3 });
  await expect(leadConvertIntent(scope, before, true)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  expect(call).not.toHaveBeenCalled();
});
it("uses the real IANA instant and rejects DST gaps or unresolved repeated hours", async () => {
  detail.mockResolvedValue(before);
  const draft = {
    ...leadDraft(before),
    kind: "followup" as const,
    due: "2027-03-28T02:30",
    reviewed: true,
  };
  await expect(leadActivityIntent(scope, before, draft, "Europe/Paris")).rejects.toMatchObject({
    message: "SCHEDULE_TIME_GAP",
  });
  await expect(
    leadActivityIntent(scope, before, { ...draft, due: "2027-10-31T02:30" }, "Europe/Paris"),
  ).rejects.toMatchObject({ message: "SCHEDULE_TIME_AMBIGUOUS" });
  const intent = await leadActivityIntent(
    scope,
    before,
    { ...draft, due: "2027-10-31T02:30", dueOffset: "+01:00" },
    "Europe/Paris",
  );
  expect(intent.request).toMatchObject({ due_at: "2027-10-31T01:30:00Z", lead_id: before.id });
});
it("updates a known followup with its exact activity version", async () => {
  detail.mockResolvedValue(before);
  const prior = {
    id: id(8),
    version: 4,
    state: "open" as const,
    values: {
      lead_id: before.id,
      kind: "followup" as const,
      note: "Ara",
      outcome: null,
      due_at: "2026-11-20T13:00:00Z",
    },
  };
  activities.mockResolvedValue({ items: [prior] });
  const intent = await leadActivityIntent(
    scope,
    before,
    { ...leadDraft(before), kind: "outcome", note: "Arandı", reviewed: true },
    "Europe/Istanbul",
    prior,
  );
  expect(intent.request).toMatchObject({
    activity_id: id(8),
    expected_version: 4,
    kind: "outcome",
    note: "Arandı",
  });
});
it("rejects another operation's receipt and mismatched entity references", async () => {
  const intent = personIntent(scope, { name: "Örnek", email: "", phone: "" });
  call.mockResolvedValue({ operation: "person_create_v1", key: id(99) });
  await expect(readLeadReceipt(intent)).rejects.toThrow("LEAD_RECEIPT_MISMATCH");
  call.mockResolvedValue({
    operation: "person_create_v1",
    key: intent.request.operation_key,
    result_reference: { type: "leads", id: id(20) },
  });
  await expect(readLeadReceipt(intent)).rejects.toThrow("LEAD_RECEIPT_MISMATCH");
});
it("requires the converted lead and actual student relationship in the same center", async () => {
  detail.mockResolvedValue(before);
  const intent = await leadConvertIntent(scope, before, true);
  detail.mockResolvedValue({ ...before, version: 3, state: "converted" });
  readPerson.mockResolvedValue({ relationships: [] });
  await expect(readLeadResult(intent, before.id)).rejects.toThrow("CONVERSION_RESULT_UNREAD");
  readPerson.mockResolvedValue({
    relationships: [{ center_id: scope.centerId, kind: "student", state: "active" }],
  });
  expect((await readLeadResult(intent, before.id)).kind).toBe("lead");
});
it("does not claim a reviewed application created a candidate without reading its actual relationship", async () => {
  const before = {
    id: id(10),
    version: 2,
    state: "pending" as const,
    asOf: "2026-11-16T12:00:00Z",
    values: { application_id: id(10) },
  };
  applications.mockResolvedValue({ items: [before] });
  const { applicationReviewIntent } = await import("./leads-command");
  const intent = await applicationReviewIntent(scope, before, "create_candidate", undefined, true);
  applications.mockResolvedValue({
    items: [{ ...before, version: 3, state: "reviewed", values: { person_id: id(11) } }],
  });
  readPerson.mockResolvedValue({ relationships: [] });
  await expect(readLeadResult(intent, before.id)).rejects.toThrow("APPLICATION_PERSON_UNREAD");
});

it("changes the assignee only when explicitly enabled and verifies the native resulting assignment", async () => {
  detail.mockResolvedValue(before);
  const intent = await leadSaveIntent(
    scope,
    before.personId,
    { ...leadDraft(before), assignedTo: id(99) },
    { ...catalog, stages: [...catalog.stages] },
    before,
    true,
  );
  await writeLeadIntent(intent);
  expect(call).toHaveBeenCalledWith(
    "lead_save_v1",
    expect.objectContaining({ assigned_to: id(99), expected_version: before.version }),
  );
  detail.mockResolvedValue({ ...before, version: before.version + 1 });
  await expect(readLeadResult(intent, before.id)).rejects.toThrow("LEAD_RESULT_UNREAD");
  detail.mockResolvedValue({
    ...before,
    version: before.version + 1,
    values: { ...before.values, assigned_to: id(99) },
  });
  await expect(readLeadResult(intent, before.id)).resolves.toMatchObject({
    kind: "lead",
    detail: { values: { assigned_to: id(99) } },
  });
});
