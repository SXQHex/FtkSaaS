import type { Interval } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
import { money } from "./collection-command";
export const financeReportApi = {
  async read(
    scope: SetupScope,
    personId: string,
    currency: string,
    interval: Interval,
    cursor?: string,
  ) {
    if (!scope.centerId) throw Error("invalidFinance");
    const filters = { interval, center_ids: [scope.centerId], person_ids: [personId], currency };
    const report = await setupCall("report_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      report: "collections_debts",
      filters,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const metrics = new Set(["collections", "refunds", "outstanding_debt"]);
    if (
      report.report_kind !== "collections_debts" ||
      report.filters.interval.starts_at !== interval.starts_at ||
      report.filters.interval.ends_at !== interval.ends_at ||
      report.filters.currency !== currency ||
      report.filters.center_ids.length !== 1 ||
      report.filters.center_ids[0] !== scope.centerId ||
      report.filters.person_ids?.length !== 1 ||
      report.filters.person_ids[0] !== personId ||
      !Number.isFinite(Date.parse(report.as_of)) ||
      !Number.isFinite(Date.parse(report.rows.as_of)) ||
      report.rows.items.some((r) => r.center_id !== scope.centerId || r.person_id !== personId) ||
      [...report.rows.items, ...report.totals].some(
        (r) =>
          !r.group_key ||
          !metrics.has(r.group_key) ||
          r.currency !== currency ||
          !money(r.amount_minor) ||
          !Number.isSafeInteger(r.count) ||
          r.count! < 0,
      ) ||
      (cursor && report.rows.next_cursor === cursor)
    )
      throw Error("invalidFinance");
    return report;
  },
};
export type FinanceReportApi = typeof financeReportApi;
