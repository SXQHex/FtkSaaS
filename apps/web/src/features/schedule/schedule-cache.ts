import type { ClientScope } from "../../lib/scoped-backend";
import { reportSessionMetricsFamily } from "../reports/reports-query";

export const scheduleCacheKeys = {
  range: (scope: ClientScope) =>
    ["schedule-range", scope.accountId, scope.orgId, scope.centerId] as const,
  overview: (scope: ClientScope) =>
    ["overview", scope.accountId, scope.orgId, scope.centerId] as const,
  overviewLabels: (scope: ClientScope) =>
    ["overview-labels", scope.accountId, scope.orgId, scope.centerId] as const,
  overviewParticipants: (scope: ClientScope) =>
    ["overview-participants", scope.accountId, scope.orgId, scope.centerId] as const,
  instructorCalendar: (scope: ClientScope) =>
    ["instructor-calendar", scope.accountId, scope.orgId, scope.centerId] as const,
  instructorSession: (scope: ClientScope) =>
    ["instructor-session", scope.accountId, scope.orgId, scope.centerId] as const,
  instructorAttendance: (scope: ClientScope) =>
    ["instructor-today-attendance", scope.accountId, scope.orgId, scope.centerId] as const,
};

export function sessionScheduleFamilies(scope: ClientScope) {
  return [
    scheduleCacheKeys.range(scope),
    scheduleCacheKeys.overview(scope),
    scheduleCacheKeys.overviewLabels(scope),
    scheduleCacheKeys.overviewParticipants(scope),
    scheduleCacheKeys.instructorCalendar(scope),
    scheduleCacheKeys.instructorAttendance(scope),
    reportSessionMetricsFamily(scope),
  ];
}
