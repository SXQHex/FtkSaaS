import { beforeEach, expect, it, vi } from "vitest";
import type { AvailabilityRule } from "../../lib/api-contracts/generated";
import type { AvailabilityBase } from "./availability-edit";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
import {
  availabilityIntent,
  availabilityDraft,
  availabilityPeriod,
  loadAvailability,
  saveAvailabilityStep,
} from "./availability-edit";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const room = { kind: "room" as const, id: "019a7b00-0000-7000-8000-000000000007" };
const ruleId = "019a7b00-0000-7000-8000-000000000011";
const rule: AvailabilityRule = {
  weekdays: [1],
  local_start: "11:00:00",
  local_end: "12:00:00",
  valid_from: "2026-11-16",
  valid_until: "2026-11-30",
};
function source(): AvailabilityBase {
  return {
    scope,
    resource: { ...room },
    records: [{ id: ruleId, version: 5, rule: structuredClone(rule) }],
  };
}
beforeEach(() => {
  call.mockReset();
});

it("reads room rules with their native resource identity and rejects another resource projection", async () => {
  const projection = {
    operation: "availability_save_v1",
    exists: true,
    state: "active",
    entity: { type: "availability_rules", id: ruleId },
    versions: [{ entity: { type: "availability_rules", id: ruleId }, version: 5 }],
    current: {
      operation: "availability_save_v1",
      values: { resource: { ...room }, rule_id: ruleId, rule },
    },
  };
  call.mockResolvedValue({ items: [projection], next_cursor: null });
  const result = await loadAvailability(scope, room);
  expect(call.mock.calls[0]![1].selector.key.resource).toEqual(room);
  expect(result.resource).toEqual(room);
  expect(result.records[0]).toMatchObject({ id: ruleId, version: 5 });
  call.mockResolvedValue({
    items: [
      {
        ...projection,
        current: {
          ...projection.current,
          values: { ...projection.current.values, resource: { kind: "person", id: room.id } },
        },
      },
    ],
    next_cursor: null,
  });
  await expect(loadAvailability(scope, room)).rejects.toThrow("STUDIO_UNAVAILABLE");
});

it("freezes the room identity and retries one new-rule key without a person or aggregate version", async () => {
  const base = source();
  const draft = availabilityDraft(base.records);
  const intent = availabilityIntent({ ...base, records: [] }, "new", {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      intervals: day.intervals.map((x) => ({ ...x, id: 1 })),
    })),
  });
  base.resource.id = "019a7b00-0000-7000-8000-000000000099";
  call.mockResolvedValue({ primary_id: ruleId });
  await saveAvailabilityStep(intent, 0);
  await saveAvailabilityStep(intent, 0);
  const first = call.mock.calls[0]![1],
    retry = call.mock.calls[1]![1];
  expect(first.resource).toEqual(room);
  expect(first).not.toHaveProperty("expected_version");
  expect(first).not.toHaveProperty("rule_id");
  expect(first.operation_key).toBe(retry.operation_key);
  expect(first.request_id).not.toBe(retry.request_id);
  expect(first.rule).toEqual(rule);
});

it("uses an existing room rule version without changing its source rule", async () => {
  const base = source(),
    draft = availabilityDraft(base.records);
  draft.days[0]!.intervals[0]!.from = "11:15:00";
  const intent = availabilityIntent(base, availabilityPeriod(base.records[0]!), draft);
  call.mockResolvedValue({ primary_id: ruleId });
  await saveAvailabilityStep(intent, 0);
  expect(call.mock.calls[0]![1]).toMatchObject({
    resource: room,
    rule_id: ruleId,
    expected_version: 5,
    rule: { weekdays: [1], local_start: "11:15:00", local_end: "12:00:00" },
  });
  expect(base.records[0]!.rule).toEqual(rule);
});
