import { queryOptions } from "@tanstack/react-query";
import type { Interval } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { readInstructorCalendar } from "./instructor-read";

export function instructorCalendarQuery(
  scope: ClientScope,
  personId?: string,
  interval?: Interval,
) {
  const normalized = interval && {
    starts_at: new Date(interval.starts_at).toISOString(),
    ends_at: new Date(interval.ends_at).toISOString(),
  };
  return queryOptions({
    queryKey: [
      "instructor-calendar",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      normalized?.starts_at,
      normalized?.ends_at,
    ] as const,
    queryFn: (readContext) => {
      if (!personId || !normalized) throw new Error("INSTRUCTOR_CALENDAR_UNAVAILABLE");
      return readInstructorCalendar(scope, personId, normalized, readContext);
    },
    retry: false,
  });
}
