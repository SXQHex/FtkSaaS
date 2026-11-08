import { validate } from "uuid";
import { setupCall, type SetupScope } from "./studio-setup";
import type { SubscriptionPlanTerms } from "@ftksaas/api-contracts";
export async function subscriptionProof(
  scope: SetupScope,
  operation: "subscription_renewal_set_v1" | "subscription_period_change_request_v1",
  target?: SubscriptionPlanTerms,
) {
  if (scope.centerId) throw Error("invalidPlanChange");
  const selector =
    operation === "subscription_period_change_request_v1"
      ? ({ operation, key: { target_plan_id: target!.id } } as const)
      : ({ operation, key: {} } as const);
  const p = await setupCall("management_state_get_v1", {
    org_id: scope.orgId,
    operation,
    selector,
  });
  const r = p.items[0],
    v = r?.versions[0];
  if (
    p.items.length !== 1 ||
    p.next_cursor ||
    !r?.exists ||
    r.operation !== operation ||
    r.entity?.type !== "saas_subscriptions" ||
    !validate(r.entity.id) ||
    r.versions.length !== 1 ||
    v?.entity.type !== r.entity.type ||
    v.entity.id !== r.entity.id ||
    !Number.isSafeInteger(v.version) ||
    v.version < 1 ||
    r.current?.operation !== operation
  )
    throw Error("invalidPlanChange");
  if (r.current.operation === "subscription_period_change_request_v1") {
    const a = r.current.values;
    if (
      !target ||
      a.target_plan_id !== target.id ||
      a.amount_minor !== target.amount_minor ||
      a.currency !== target.currency ||
      a.expected_version !== v.version ||
      !Number.isFinite(Date.parse(a.effective_at))
    )
      throw Error("VERSION_CONFLICT");
    return { version: v.version, period: a };
  }
  return { version: v.version, renew: r.current.values.renew };
}
