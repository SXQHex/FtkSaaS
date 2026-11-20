import { v7 as uuidv7 } from "uuid";
import type { SettlementProposal, SettlementRequestView } from "@ftksaas/api-contracts";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";

export const settlementRequest = (scope: ClientScope) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: scope.orgId,
  center_id: scope.centerId,
});
export const settlementKey = (scope: ClientScope) => [
  "business-settlement",
  scope.accountId,
  scope.orgId,
  scope.centerId,
];
export async function settlementAuthority(scope: ClientScope, person: string) {
  const backend = await scopedBackend(scope);
  const result = await backend.call("settlement_authority_get_v1", {
    ...settlementRequest(scope),
    person_id: person,
  });
  if (
    result.org_id !== scope.orgId ||
    result.person_id !== person ||
    result.center_grants.some((row) => row.center_id !== scope.centerId)
  )
    throw Error("SETTLEMENT_SCOPE_INVALID");
  return result;
}
export async function settlementMovements(scope: ClientScope, currency: string, cursor?: string) {
  const backend = await scopedBackend(scope);
  const result = await backend.call("settlement_movements_list_v1", {
    ...settlementRequest(scope),
    currency,
    page: { limit: 30, ...(cursor ? { cursor } : {}) },
  });
  if (
    result.items.some(
      (row) =>
        row.currency !== currency ||
        (row.debtor_center_id !== scope.centerId && row.creditor_center_id !== scope.centerId),
    ) ||
    (cursor && result.next_cursor === cursor)
  )
    throw Error("SETTLEMENT_SCOPE_INVALID");
  return result;
}
export async function settlementRequests(scope: ClientScope, cursor?: string) {
  const backend = await scopedBackend(scope);
  const result = await backend.call("settlement_requests_list_v1", {
    ...settlementRequest(scope),
    page: { limit: 30, ...(cursor ? { cursor } : {}) },
  });
  if (
    result.items.some(
      (row) => row.from_center_id !== scope.centerId && row.to_center_id !== scope.centerId,
    ) ||
    (cursor && result.next_cursor === cursor)
  )
    throw Error("SETTLEMENT_SCOPE_INVALID");
  return result;
}
type Decision = "approve" | "reject" | "withdraw";
export type SettlementIntent = { scope: ClientScope; reason: string; key: string } & (
  | { action: "submit"; peer: string; currency: string; proposal: SettlementProposal }
  | { action: Decision; before: SettlementRequestView }
);
export async function writeSettlement(intent: SettlementIntent) {
  const backend = await scopedBackend(intent.scope);
  const base = {
    ...settlementRequest(intent.scope),
    operation_key: intent.key,
    reason: intent.reason,
  };
  if (intent.action === "submit")
    return backend.call("settlement_request_submit_v1", {
      ...base,
      from_center_id: intent.scope.centerId,
      to_center_id: intent.peer,
      currency: intent.currency,
      proposal: intent.proposal,
    });
  const decision = {
    ...base,
    settlement_request_id: intent.before.id,
    expected_version: intent.before.version,
  };
  if (intent.action === "withdraw") return backend.call("settlement_request_withdraw_v1", decision);
  return backend.call("settlement_request_decide_v1", { ...decision, decision: intent.action });
}
export async function readSettlementResult(intent: SettlementIntent, id?: string) {
  if (!id || (intent.action !== "submit" && id !== intent.before.id))
    throw Error("SETTLEMENT_RESULT_INVALID");
  const result = await (
    await scopedBackend(intent.scope)
  ).call("settlement_request_get_v1", {
    ...settlementRequest(intent.scope),
    settlement_request_id: id,
  });
  if (
    result.id !== id ||
    (result.from_center_id !== intent.scope.centerId &&
      result.to_center_id !== intent.scope.centerId)
  )
    throw Error("SETTLEMENT_RESULT_INVALID");
  if (intent.action === "submit") {
    // A decision can advance this same request before the initiating center reads it back.
    if (
      result.from_center_id !== intent.scope.centerId ||
      result.to_center_id !== intent.peer ||
      result.currency !== intent.currency ||
      result.proposal.kind !== intent.proposal.kind ||
      result.proposal.amount_minor !== intent.proposal.amount_minor
    )
      throw Error("SETTLEMENT_RESULT_INVALID");
    return result;
  }
  const expected = { approve: "approved", reject: "rejected", withdraw: "withdrawn" }[
    intent.action
  ];
  if (result.state !== expected || result.version <= intent.before.version)
    throw Error("SETTLEMENT_RESULT_INVALID");
  return result;
}
