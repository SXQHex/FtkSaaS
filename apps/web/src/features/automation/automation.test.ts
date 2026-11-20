import { beforeEach, expect, it, vi } from "vitest";
import {
  automationIntent,
  readAutomations,
  readSegments,
  readAutomationResult,
  readAutomationReceipt,
  writeAutomation,
  resolveAutomationPreparation,
  type AutomationRecord,
} from "./automation";
import {
  automationDraft,
  automationDefinition,
  segmentDraft,
  segmentDefinition,
} from "./automation-form";
import type { AutomationDefinition, AutomationJobView } from "@ftksaas/api-contracts";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const definition: AutomationDefinition = {
  name: "Örnek",
  segment_id: null,
  trigger: { kind: "entitlement_expiring", offset_days: 3 },
  action: { kind: "create_followup", channel: "in_app", template_key: "Üyeyle görüş" },
  execution_center_ids: [scope.centerId],
  enabled: true,
};
const job: AutomationJobView = {
  id: id(6),
  version: 12,
  center_id: scope.centerId,
  person_id: id(7),
  state: "failed",
  attempts: 3,
  next_attempt_at: null,
  safe_error_code: "SERVICE_UNAVAILABLE",
  result_reference: null,
  retry_available: true,
};
const before: AutomationRecord = {
  id: id(4),
  version: 7,
  state: "active",
  definition,
  jobs: [job],
};
function page(value: AutomationRecord = before) {
  return {
    items: [
      {
        operation: "automation_save_v1",
        exists: true,
        entity: { type: "automations", id: value.id },
        state: value.state,
        versions: [{ entity: { type: "automations", id: value.id }, version: value.version }],
        current: {
          operation: "automation_save_v1",
          values: {
            automation_id: value.id,
            scope: { kind: "center", center_id: scope.centerId },
            definition: value.definition,
            ...(value.jobs ? { recent_jobs: value.jobs } : {}),
          },
        },
      },
    ],
    next_cursor: null,
  };
}
beforeEach(() => call.mockReset());
it("reads only the selected center configuration with native pagination", async () => {
  call.mockResolvedValue(page());
  expect((await readAutomations(scope, undefined, "next")).items[0]).toEqual(before);
  expect(call).toHaveBeenCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      selector: {
        operation: "automation_save_v1",
        key: { scope: { kind: "center", center_id: scope.centerId } },
      },
      page: { limit: 20, cursor: "next" },
    }),
  );
});
it("rejects foreign scope, duplicate identities and missing real versions", async () => {
  const foreign = page();
  foreign.items[0]!.current.values.scope.center_id = id(99);
  call.mockResolvedValueOnce(foreign);
  await expect(readAutomations(scope)).rejects.toThrow("AUTOMATION_SOURCE_UNAVAILABLE");
  const duplicate = page();
  duplicate.items.push(duplicate.items[0]!);
  call.mockResolvedValueOnce(duplicate);
  await expect(readAutomations(scope)).rejects.toThrow("AUTOMATION_SOURCE_UNAVAILABLE");
  const missing = page();
  missing.items[0]!.versions = [];
  call.mockResolvedValueOnce(missing);
  await expect(readAutomations(scope)).rejects.toThrow("AUTOMATION_SOURCE_UNAVAILABLE");
});
it("keeps unavailable recent jobs unknown and rejects foreign job centers", async () => {
  call.mockResolvedValueOnce(page({ ...before, jobs: undefined }));
  expect((await readAutomations(scope)).items[0]!.jobs).toBeUndefined();
  call.mockResolvedValueOnce(page({ ...before, jobs: [{ ...job, center_id: id(99) }] }));
  await expect(readAutomations(scope)).rejects.toThrow("AUTOMATION_JOBS_UNAVAILABLE");
});
it("requires review and preserves actual version and full definition for disable", async () => {
  await expect(automationIntent(scope, definition, false, before)).rejects.toThrow(
    "AUTOMATION_REVIEW_REQUIRED",
  );
  expect(call).not.toHaveBeenCalled();
  call.mockResolvedValue(page());
  const intent = await automationIntent(scope, { ...definition, enabled: false }, true, before);
  expect(intent.request).toMatchObject({
    automation_id: before.id,
    expected_version: 7,
    definition: { ...definition, enabled: false },
  });
  await writeAutomation(intent);
  expect(call).toHaveBeenLastCalledWith(
    "automation_save_v1",
    expect.objectContaining({ operation_key: intent.request.operation_key, expected_version: 7 }),
  );
});
it("stale preflight cannot create a write intent", async () => {
  call.mockResolvedValue(page({ ...before, version: 8 }));
  await expect(automationIntent(scope, definition, true, before)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  expect(call.mock.calls.every(([op]) => op === "management_state_get_v1")).toBe(true);
});
it("rejects other execution centers and unavailable outbound actions", async () => {
  await expect(
    automationIntent(
      scope,
      { ...definition, execution_center_ids: [scope.centerId, id(99)] },
      true,
    ),
  ).rejects.toThrow("AUTOMATION_INVALID");
  await expect(
    automationIntent(
      scope,
      { ...definition, action: { ...definition.action, channel: "email" } },
      true,
    ),
  ).rejects.toThrow("AUTOMATION_ACTION_UNAVAILABLE");
});
it("retry uses the original automation version and actual job version", async () => {
  call.mockResolvedValue(page());
  const intent = await automationIntent(scope, definition, true, before, job);
  expect(intent.request).toMatchObject({
    automation_id: before.id,
    expected_version: 7,
    retry_job: { id: job.id, version: 12 },
  });
  call.mockResolvedValueOnce(
    page({
      ...before,
      jobs: [{ ...job, version: 13, state: "pending", attempts: 0, retry_available: false }],
    }),
  );
  expect(await readAutomationResult(intent, before.id)).toMatchObject({
    version: 7,
    jobs: [{ version: 13, state: "pending" }],
  });
  await expect(readAutomationResult(intent, job.id)).rejects.toThrow("AUTOMATION_RESULT_UNREAD");
});
it("rejects retries with completed results or disabled configuration", async () => {
  call.mockResolvedValueOnce(
    page({
      ...before,
      jobs: [{ ...job, result_reference: { type: "crm_activities", id: id(9) } }],
    }),
  );
  await expect(automationIntent(scope, definition, true, before, job)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  call.mockResolvedValueOnce(
    page({ ...before, definition: { ...definition, enabled: false }, state: "disabled" }),
  );
  await expect(
    automationIntent(
      scope,
      { ...definition, enabled: false },
      true,
      { ...before, definition: { ...definition, enabled: false } },
      job,
    ),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
});
it("receipt must pin operation, key and automation primary identity", async () => {
  const intent = await automationIntent(scope, definition, true);
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: id(99),
    status: "succeeded",
    result_available: true,
    result_reference: { type: "automations", id: before.id },
  });
  await expect(readAutomationReceipt(intent)).rejects.toThrow("AUTOMATION_RECEIPT_UNAVAILABLE");
  call.mockResolvedValueOnce({
    operation: intent.operation,
    key: intent.request.operation_key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "automation_jobs", id: job.id },
  });
  await expect(readAutomationReceipt(intent)).rejects.toThrow("AUTOMATION_RECEIPT_UNAVAILABLE");
});
it("result reread must confirm a newer matching definition", async () => {
  call.mockResolvedValue(page());
  const intent = await automationIntent(scope, { ...definition, enabled: false }, true, before);
  await expect(readAutomationResult(intent, before.id)).rejects.toThrow("AUTOMATION_RESULT_UNREAD");
  call.mockResolvedValueOnce(
    page({ ...before, version: 8, definition: { ...definition, enabled: false } }),
  );
  expect(await readAutomationResult(intent, before.id)).toMatchObject({
    version: 8,
    definition: { enabled: false },
  });
});
it("new low-credit segments explicitly include active members and edits retain semantics", () => {
  const draft = {
    name: "Az hak",
    conditions: [{ id: id(8), kind: "remaining" as const, value: "2" }],
  };
  expect(segmentDefinition(draft).all).toEqual([
    { field: "active_student", operator: "eq", value: true },
    { field: "remaining_credits", operator: "lte", value: 2 },
  ]);
  const original = {
    id: id(8),
    version: 4,
    state: "active",
    name: "Az hak",
    definition: {
      all: [{ field: "remaining_credits" as const, operator: "lte" as const, value: 3 }],
    },
  };
  expect(segmentDefinition(draft, original).all).toHaveLength(1);
  expect(
    segmentDraft({
      ...original,
      definition: { any: [{ field: "active_student", operator: "eq", value: true }] },
    }),
  ).toBeUndefined();
  expect(() =>
    segmentDefinition(draft, {
      ...original,
      definition: { all: [{ field: "lead_source", operator: "eq", value: "form" }] },
    }),
  ).toThrow("AUTOMATION_CONDITION_UNAVAILABLE");
});
it("draft mapping cannot turn blank offsets into zero or fake a manager task", () => {
  const draft = automationDraft(before);
  expect(automationDefinition(scope, draft, before)).toEqual(definition);
  expect(() => automationDefinition(scope, { ...draft, offsetDays: "" }, before)).toThrow();
  expect(() => automationDefinition(scope, { ...draft, action: "task" }, before)).toThrow(
    "AUTOMATION_ACTION_UNAVAILABLE",
  );
});
it("inbox requires a real template source and work alerts require explicit unsegmented recipients", async () => {
  const draft = {
    ...automationDraft(before),
    action: "inbox" as const,
    template: "actual-key",
    trigger: "pending_request",
    recipients: [id(7)],
  };
  expect(() => automationDefinition(scope, draft)).toThrow("AUTOMATION_TEMPLATE_UNAVAILABLE");
  const value = automationDefinition(scope, draft, undefined, "actual-key");
  expect(value).toMatchObject({
    segment_id: null,
    trigger: { recipient_person_ids: [id(7)] },
    action: { template_key: "actual-key" },
  });
  await expect(automationIntent(scope, { ...value, segment_id: id(8) }, true)).rejects.toThrow(
    "AUTOMATION_INVALID",
  );
  await expect(
    automationIntent(
      scope,
      { ...value, trigger: { ...value.trigger, recipient_person_ids: undefined } },
      true,
    ),
  ).rejects.toThrow("AUTOMATION_INVALID");
});
it("preparation resolution rejects a changed immutable source version", async () => {
  const source = {
    scope: "center" as const,
    key: "actual-preparation",
    version: 4,
    center_id: scope.centerId,
  };
  call.mockResolvedValueOnce({
    kind: "automation",
    source: { ...source, version: 5 },
    defaults: {},
  });
  await expect(resolveAutomationPreparation(scope, source)).rejects.toThrow(
    "AUTOMATION_TEMPLATE_UNAVAILABLE",
  );
});
it("segment readers retain native definitions without losing unsupported conditions", async () => {
  const value = { all: [{ field: "lead_source", operator: "eq", value: "form" }] };
  call.mockResolvedValueOnce({
    items: [
      {
        operation: "segment_save_v1",
        exists: true,
        entity: { type: "segments", id: id(8) },
        state: "active",
        versions: [{ entity: { type: "segments", id: id(8) }, version: 4 }],
        current: {
          operation: "segment_save_v1",
          values: {
            segment_id: id(8),
            scope: { kind: "center", center_id: scope.centerId },
            name: "Kaynak",
            definition: value,
          },
        },
      },
    ],
    next_cursor: null,
  });
  expect((await readSegments(scope)).items[0]!.definition).toEqual(value);
});
