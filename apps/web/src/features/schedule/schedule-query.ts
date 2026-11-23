import { queryOptions } from "@tanstack/react-query";
import type { Interval } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { readScheduleRange } from "./schedule-read";

export function scheduleRangeQuery(
  scope: ClientScope,
  range?: Interval,
  filters: { roomId?: string; instructorId?: string } = {},
) {
  return queryOptions({
    queryKey: [
      "schedule-range",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      range?.starts_at,
      range?.ends_at,
      filters.roomId,
      filters.instructorId,
    ] as const,
    queryFn: ({ signal, client }) => {
      if (!range) throw new Error("SCHEDULE_RANGE_INVALID");
      return readScheduleRange(scope, range, filters, signal, { client, signal });
    },
    retry: false,
  });
}
