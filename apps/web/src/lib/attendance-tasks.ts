import { validate } from "uuid";
import type { Interval } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
export const attendanceTasksApi = {
  list: async (scope: SetupScope, interval: Interval, cursor?: string, selfPersonId?: string) => {
    if (!scope.centerId) throw Error("invalidAttendance");
    const page = await setupCall("calendar_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      interval,
      ...(selfPersonId ? { resource: { kind: "person" as const, id: selfPersonId } } : {}),
      page: { limit: 25, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const ids = new Set<string>();
    for (const row of page.items) {
      const key = `${row.type}:${row.id}`,
        start = Date.parse(row.starts_at),
        end = Date.parse(row.ends_at);
      if (
        !validate(row.id) ||
        (selfPersonId &&
          !row.resources?.some((r) => r.kind === "person" && r.id === selfPersonId)) ||
        row.center_id !== scope.centerId ||
        ids.has(key) ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start ||
        end <= Date.parse(interval.starts_at) ||
        start >= Date.parse(interval.ends_at)
      )
        throw Error("invalidAttendance");
      ids.add(key);
    }
    if (cursor && page.next_cursor === cursor) throw Error("invalidAttendance");
    return { ...page, items: page.items.filter((row) => row.type === "session") };
  },
};
export type AttendanceTasksApi = typeof attendanceTasksApi;
