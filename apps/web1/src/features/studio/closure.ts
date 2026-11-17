import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { getTemporal } from "../../lib/temporal";
import { studioBackend, studioPages, type StudioScope } from "./studio";
import type { CenterView, Interval, ResourceRef } from "../../lib/api-contracts/generated";

export interface ClosureDraft {
  kind: "room" | "person";
  target: string;
  from: string;
  to: string;
  reason: string;
  startOffset: string;
  endOffset: string;
}
export interface ClosureContext {
  scope: StudioScope;
  center: CenterView;
}
export interface ClosureIntent {
  scope: StudioScope;
  key: string;
  version: number;
  resource: ResourceRef;
  interval: Interval;
  reason: string;
}
export class ClosureTimeError extends Error {
  startOffsets: string[];
  endOffsets: string[];
  constructor(startOffsets: string[], endOffsets: string[]) {
    super("CLOSURE_AMBIGUOUS");
    this.startOffsets = startOffsets;
    this.endOffsets = endOffsets;
  }
}
export async function readClosureContext(scope: StudioScope): Promise<ClosureContext> {
  const backend = await studioBackend(scope);
  const centers = await studioPages((cursor) =>
    backend
      .call("centers_list_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      })
      .then((page) => ({ items: page.items, next_cursor: page.next_cursor ?? null })),
  );
  const matches = centers.filter((center) => center.id === scope.centerId);
  const center = matches[0];
  if (
    matches.length !== 1 ||
    !center?.accessible ||
    !Number.isSafeInteger(center.version) ||
    center.version < 1 ||
    !center.timezone
  )
    throw new Error("STUDIO_UNAVAILABLE");
  return { scope: { ...scope }, center };
}
const schema = z.object({
  kind: z.enum(["room", "person"]),
  target: z.uuid(),
  from: z.iso.date(),
  to: z.iso.date(),
  reason: z.string().trim().min(1),
  startOffset: z.string(),
  endOffset: z.string(),
});
export async function closureIntent(
  context: ClosureContext,
  draft: ClosureDraft,
): Promise<ClosureIntent> {
  const value = schema.parse(draft);
  const temporal = await getTemporal();
  const from = temporal.PlainDate.from(value.from);
  const inclusiveEnd = temporal.PlainDate.from(value.to);
  if (temporal.PlainDate.compare(from, inclusiveEnd) > 0) throw new Error("CLOSURE_INVALID");
  const until = inclusiveEnd.add({ days: 1 });
  const boundary = (date: typeof from, offset: string) => {
    const fields = {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: 0,
      timeZone: context.center.timezone,
    };
    const earlier = temporal.ZonedDateTime.from(fields, { disambiguation: "earlier" });
    const later = temporal.ZonedDateTime.from(fields, { disambiguation: "later" });
    const expected = date.toPlainDateTime("00:00");
    // Never shift a nonexistent midnight/date; explicit offsets cannot bypass it.
    if (!earlier.toPlainDateTime().equals(expected) || !later.toPlainDateTime().equals(expected))
      throw new Error("CLOSURE_DATE_UNAVAILABLE");
    const offsets =
      earlier.epochNanoseconds === later.epochNanoseconds ? [] : [earlier.offset, later.offset];
    try {
      const instant = temporal.ZonedDateTime.from(
        { ...fields, ...(offset ? { offset } : {}) },
        { disambiguation: "reject", offset: "reject", overflow: "reject" },
      );
      return { instant, offsets };
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      if (!offsets.length) throw new Error("CLOSURE_INVALID_OFFSET");
      return { instant: undefined, offsets };
    }
  };
  const start = boundary(from, value.startOffset),
    end = boundary(until, value.endOffset);
  if (!start.instant || !end.instant) throw new ClosureTimeError(start.offsets, end.offsets);
  if (start.instant.epochNanoseconds >= end.instant.epochNanoseconds)
    throw new Error("CLOSURE_INVALID");
  return {
    scope: { ...context.scope },
    key: uuidv7(),
    version: context.center.version,
    resource: { kind: value.kind, id: value.target },
    reason: value.reason,
    interval: {
      starts_at: start.instant.toInstant().toString(),
      ends_at: end.instant.toInstant().toString(),
    },
  };
}
export async function saveClosure(intent: ClosureIntent) {
  const backend = await studioBackend(intent.scope);
  const result = await backend.call("availability_exception_save_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    expected_version: intent.version,
    resource: intent.resource,
    interval: intent.interval,
    reason: intent.reason,
  });
  if (!result.primary_id) throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result.primary_id;
}
