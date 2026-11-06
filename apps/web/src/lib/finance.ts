import { validate } from "uuid";
import type { FinanceView } from "@ftksaas/api-contracts";
import { balanceApi, refundApi } from "./finance-management";
import { correctionApi } from "./collection-correction";
import { actionAuthority } from "./action-authority";
import { money } from "./collection-command";
export { collectionCommand, validCollection } from "./collection-command";
import { setupCall, type SetupScope, type SetupInput } from "./studio-setup";
export function financeMatches(
  view: FinanceView,
  personId: string,
  currency: string,
  centerId?: string,
) {
  const debts = new Set<string>(),
    movements = new Set<string>();
  return (
    view.person_id === personId &&
    view.currency === currency &&
    money(view.credit_available_minor) &&
    view.debts.every((row) => {
      if (
        !validate(row.id) ||
        debts.has(row.id) ||
        (centerId && row.center_id && row.center_id !== centerId) ||
        !Number.isFinite(Date.parse(row.due_at)) ||
        !money(row.remaining_minor) ||
        [row.net_minor, row.paid_minor, row.claimed_minor].some((v) => v !== undefined && !money(v))
      )
        return false;
      debts.add(row.id);
      return true;
    }) &&
    view.movements.items.every((row) => {
      if (
        !validate(row.id) ||
        movements.has(row.id) ||
        row.currency !== currency ||
        (centerId && row.center_id && row.center_id !== centerId) ||
        !money(row.amount_minor) ||
        !Number.isFinite(Date.parse(row.occurred_at))
      )
        return false;
      movements.add(row.id);
      return true;
    })
  );
}
export const financeApi = {
  corrections: correctionApi,
  balance: balanceApi,
  refunds: refundApi,
  read: async (scope: SetupScope, personId: string, currency: string, cursor?: string) => {
    const view = await setupCall("finance_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      currency,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (!financeMatches(view, personId, currency, scope.centerId)) throw Error("invalidFinance");
    return view;
  },
  canCollect: (scope: SetupScope, personId: string) =>
    actionAuthority(scope, { operation: "collection_record_v1", key: { person_id: personId } }),
};
export type FinanceApi = typeof financeApi;
export type CollectionInput = SetupInput<"collection_record_v1">;
