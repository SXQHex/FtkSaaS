import { validate } from "uuid";
import type { Interval, P03PaymentView } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
import { money } from "./collection-command";
export { paymentCommand, validPaymentCommand } from "./instructor-payment-command";
export const earningsApi = {
  list: async (scope: SetupScope, personId: string, interval: Interval, cursor?: string) => {
    if (!scope.centerId) throw Error("invalidEarnings");
    const page = await setupCall("earnings_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      interval,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const ids = new Set<string>(),
      paymentSnapshots = new Map<string, string>();
    if (!Number.isFinite(Date.parse(page.as_of))) throw Error("invalidEarnings");
    for (const row of page.items) {
      if (
        !validate(row.id) ||
        ids.has(row.id) ||
        row.person_id !== personId ||
        row.center_id !== scope.centerId ||
        !Number.isSafeInteger(row.version) ||
        row.version < 1 ||
        ![row.amount_minor, row.paid_minor, row.remaining_minor].every(money) ||
        (row.overpaid_minor !== undefined && !money(row.overpaid_minor)) ||
        !Number.isFinite(Date.parse(row.created_at)) ||
        Date.parse(row.created_at) < Date.parse(interval.starts_at) ||
        Date.parse(row.created_at) >= Date.parse(interval.ends_at) ||
        !/^[A-Z]{3}$/.test(row.currency) ||
        row.basis.currency !== row.currency ||
        !["add", "subtract"].includes(row.direction)
      )
        throw Error("invalidEarnings");
      ids.add(row.id);
      const payments = new Set<string>();
      for (const payment of row.payments ?? []) {
        if (!validPayment(payment, row.currency) || payments.has(payment.id))
          throw Error("invalidEarnings");
        const snapshot = JSON.stringify(payment);
        if (paymentSnapshots.has(payment.id) && paymentSnapshots.get(payment.id) !== snapshot)
          throw Error("invalidEarnings");
        paymentSnapshots.set(payment.id, snapshot);
        payments.add(payment.id);
      }
    }
    if (cursor && page.next_cursor === cursor) throw Error("invalidEarnings");
    return page;
  },
  report: async (scope: SetupScope, personId: string, interval: Interval, cursor?: string) => {
    if (!scope.centerId) throw Error("invalidEarnings");
    const filters = { interval, center_ids: [scope.centerId], person_ids: [personId] };
    const report = await setupCall("report_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      report: "earnings",
      filters,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    for (const row of [...report.rows.items, ...report.totals]) {
      if (
        (row.amount_minor !== undefined &&
          row.amount_minor !== null &&
          (!money(row.amount_minor) ||
            typeof row.currency !== "string" ||
            !/^[A-Z]{3}$/.test(row.currency))) ||
        (row.count !== undefined &&
          row.count !== null &&
          (!Number.isSafeInteger(row.count) || row.count < 0))
      )
        throw Error("invalidEarnings");
    }
    if (!Number.isFinite(Date.parse(report.as_of))) throw Error("invalidEarnings");
    if (
      report.report_kind !== "earnings" ||
      report.filters.interval.starts_at !== interval.starts_at ||
      report.filters.interval.ends_at !== interval.ends_at ||
      report.filters.center_ids.length !== 1 ||
      report.filters.center_ids[0] !== scope.centerId ||
      report.filters.person_ids?.length !== 1 ||
      report.filters.person_ids[0] !== personId ||
      report.rows.items.some((r) => r.center_id !== scope.centerId || r.person_id !== personId) ||
      (cursor && report.rows.next_cursor === cursor)
    )
      throw Error("invalidEarnings");
    return report;
  },
};
export type EarningsApi = typeof earningsApi;
function validPayment(payment: P03PaymentView, currency: string) {
  return (
    validate(payment.id) &&
    Number.isSafeInteger(payment.version) &&
    payment.version > 0 &&
    payment.currency === currency &&
    [payment.amount_minor, payment.net_minor].every(money) &&
    Number.isFinite(Date.parse(payment.occurred_at)) &&
    new Set(payment.corrections.map((c) => c.id)).size === payment.corrections.length &&
    payment.corrections.every(
      (c) =>
        validate(c.id) &&
        c.previous_id === payment.id &&
        ["increase", "decrease"].includes(c.direction) &&
        money(c.amount_minor) &&
        Number.isFinite(Date.parse(c.occurred_at)) &&
        !!c.reason.trim(),
    )
  );
}
