import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { studioBackend, type StudioScope } from "./studio";
import { readStudioAvailability, type AvailabilityRecord } from "./studio-reads";
import type { AvailabilityRule } from "../../lib/api-contracts/generated";
import type { AvailabilityDraft } from "./availability-panel";

export interface AvailabilityBase {
  scope: StudioScope;
  personId: string;
  records: AvailabilityRecord[];
}
export interface AvailabilityIntent {
  scope: StudioScope;
  personId: string;
  steps: { key: string; id?: string; version?: number; rule: AvailabilityRule }[];
}

export async function loadAvailability(
  scope: StudioScope,
  personId: string,
): Promise<AvailabilityBase> {
  return {
    scope: { ...scope },
    personId,
    records: await readStudioAvailability(scope, { kind: "person", id: personId }),
  };
}

export function availabilityPeriod(record: AvailabilityRecord) {
  return JSON.stringify([record.rule.valid_from, record.rule.valid_until ?? null]);
}

export function availabilityDraft(records: AvailabilityRecord[]): AvailabilityDraft {
  return {
    validFrom: records[0]?.rule.valid_from ?? "",
    validUntil: records[0]?.rule.valid_until ?? "",
    days: Array.from({ length: 7 }, (_, index) => {
      const rules = records.filter((item) => item.rule.weekdays.includes(index + 1));
      return {
        enabled: rules.length > 0,
        intervals: rules.map((item) => ({
          id: item.id,
          from: item.rule.local_start,
          to: item.rule.local_end,
        })),
      };
    }),
  };
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);
const endTime = z.union([time, z.literal("24:00"), z.literal("24:00:00")]);
const canonicalTime = (value: string) => (value.length === 5 ? `${value}:00` : value);
const draftSchema = z.object({
  validFrom: z.iso.date(),
  validUntil: z.union([z.literal(""), z.iso.date()]),
  days: z
    .array(
      z.object({
        enabled: z.boolean(),
        intervals: z.array(
          z.object({ id: z.union([z.string(), z.number()]), from: time, to: endTime }),
        ),
      }),
    )
    .length(7),
});

export function availabilityIntent(
  base: AvailabilityBase,
  period: string,
  draft: AvailabilityDraft,
): AvailabilityIntent {
  // A disabled day may contain unfinished new draft fields; only active values
  // are submitted. Persisted rules may lose some weekdays, never their last one.
  const parsed = draftSchema.safeParse({
    ...draft,
    days: draft.days.map((day) => ({ ...day, intervals: day.enabled ? day.intervals : [] })),
  });
  if (!parsed.success || (draft.validUntil && draft.validUntil <= draft.validFrom))
    throw new Error("AVAILABILITY_INVALID");
  const selected = base.records.filter((item) => availabilityPeriod(item) === period);
  if (period !== "new" && !selected.length) throw new Error("AVAILABILITY_CHANGED");
  const existing = new Map(selected.map((item) => [item.id, item]));
  const groups = new Map<string, Map<string, number[]>>();
  for (const [index, day] of parsed.data.days.entries()) {
    if (!day.enabled) continue;
    if (!day.intervals.length) throw new Error("AVAILABILITY_INVALID");
    const dayIds = new Set<string>();
    for (const interval of day.intervals) {
      const id = typeof interval.id === "string" ? interval.id : `new:${interval.id}`;
      if ((typeof interval.id === "string" && !existing.has(id)) || dayIds.has(id))
        throw new Error("AVAILABILITY_CHANGED");
      dayIds.add(id);
      const from = canonicalTime(interval.from),
        to = canonicalTime(interval.to);
      if (from >= to) throw new Error("AVAILABILITY_INVALID");
      const pair = JSON.stringify([from, to]);
      const times = groups.get(id) ?? new Map<string, number[]>();
      times.set(pair, [...(times.get(pair) ?? []), index + 1]);
      groups.set(id, times);
    }
  }
  if (!groups.size)
    throw new Error(selected.length ? "AVAILABILITY_REMOVE_UNSUPPORTED" : "AVAILABILITY_INVALID");
  if (selected.some((item) => !groups.has(item.id)))
    throw new Error("AVAILABILITY_REMOVE_UNSUPPORTED");
  const steps: AvailabilityIntent["steps"] = [];
  for (const [id, times] of groups) {
    const original = existing.get(id);
    const originalPair = original
      ? JSON.stringify([
          canonicalTime(original.rule.local_start),
          canonicalTime(original.rule.local_end),
        ])
      : undefined;
    // Preserve the original ID for its unchanged time, and create separate
    // rules when only some weekdays have moved. Never overwrite another day.
    const entries = [...times.entries()].sort(
      ([left], [right]) => Number(right === originalPair) - Number(left === originalPair),
    );
    entries.forEach(([pair, weekdays], index) => {
      const [from, to] = JSON.parse(pair) as [string, string];
      const rule: AvailabilityRule = {
        weekdays: weekdays as [number, ...number[]],
        local_start: from,
        local_end: to,
        valid_from: parsed.data.validFrom,
        valid_until: parsed.data.validUntil || null,
      };
      const source = index === 0 ? original : undefined;
      if (
        source &&
        source.rule.valid_from === rule.valid_from &&
        (source.rule.valid_until ?? null) === rule.valid_until &&
        canonicalTime(source.rule.local_start) === from &&
        canonicalTime(source.rule.local_end) === to &&
        [...source.rule.weekdays].sort((left, right) => left - right).join() === weekdays.join()
      )
        return;
      steps.push({
        key: uuidv7(),
        rule,
        ...(source ? { id: source.id, version: source.version } : {}),
      });
    });
  }
  // Shrink/update existing rules before appending split/new rules. Each step
  // is independently acknowledged; this plan does not promise atomicity.
  steps.sort((left, right) => Number(Boolean(right.id)) - Number(Boolean(left.id)));
  return { scope: { ...base.scope }, personId: base.personId, steps };
}

export async function saveAvailabilityStep(intent: AvailabilityIntent, index: number) {
  const step = intent.steps[index];
  if (!step) throw new Error("STUDIO_UNAVAILABLE");
  const backend = await studioBackend(intent.scope);
  const result = await backend.call("availability_save_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: step.key,
    resource: { kind: "person", id: intent.personId },
    rule: step.rule,
    ...(step.id ? { rule_id: step.id, expected_version: step.version } : {}),
  });
  if (!result.primary_id || (step.id && result.primary_id !== step.id))
    throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result.primary_id;
}
