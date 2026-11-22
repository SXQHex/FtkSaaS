import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { queryOptions } from "@tanstack/react-query";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";

export async function readSettingsSubscription(scope: ClientScope) {
  const subscription = await (
    await scopedBackend(scope)
  ).call("subscription_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
  });
  z.enum(["starter", "pro", "business"]).parse(subscription.plan);
  z.enum(["pending_payment", "active", "grace", "suspended", "ended"]).parse(subscription.state);
  z.boolean().parse(subscription.cancel_at_period_end);
  if (subscription.subscription_version !== undefined)
    z.number().int().positive().safe().parse(subscription.subscription_version);
  for (const instant of [
    subscription.period_start,
    subscription.period_end,
    subscription.grace_until,
  ])
    if (instant !== null) z.iso.datetime({ offset: true }).parse(instant);
  const limits = new Set<string>(),
    usage = new Set<string>();
  const limitKey = z.enum(["active_students", "instructors", "centers", "rooms", "disciplines"]);
  for (const limit of subscription.limits.entries) {
    limitKey.parse(limit.key);
    if (limits.has(limit.key)) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
    limits.add(limit.key);
    if ("unlimited" in limit) z.literal(true).parse(limit.unlimited);
    else z.number().int().nonnegative().safe().parse(limit.value);
  }
  for (const item of subscription.usage.entries) {
    limitKey.parse(item.key);
    if (usage.has(item.key)) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
    usage.add(item.key);
    z.number().int().nonnegative().safe().parse(item.value);
    if (!limits.has(item.key) && item.key !== "disciplines")
      throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  }
  if (subscription.billing) {
    z.uuid().parse(subscription.billing.current.id);
    z.enum(["monthly", "yearly"]).parse(subscription.billing.current.period);
    z.string()
      .regex(/^(0|[1-9][0-9]{0,18})$/)
      .parse(subscription.billing.current.amount_minor);
    z.string()
      .regex(/^[A-Z]{3}$/)
      .parse(subscription.billing.current.currency);
  }
  return { scope: { ...scope }, subscription, readAt: Date.now() };
}
export type SettingsSubscriptionSource = Awaited<ReturnType<typeof readSettingsSubscription>>;
export function settingsSubscriptionQuery(scope: ClientScope) {
  return queryOptions({
    queryKey: ["settings-subscription", scope.accountId, scope.orgId],
    queryFn: () => readSettingsSubscription(scope),
    retry: false,
    // Plan, entitlement and role limits may change outside this SPA.
    // Revalidate stale subscription projections after focus/reconnect.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
export async function subscriptionRenewalIntent(before: SettingsSubscriptionSource) {
  const scope = before.scope,
    operation = "subscription_renewal_set_v1" as const;
  const backend = await scopedBackend(scope);
  const [page, current] = await Promise.all([
    backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      operation,
      selector: { operation, key: {} },
      page: { limit: 1 },
    }),
    readSettingsSubscription(scope),
  ]);
  const row = page.items[0];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== operation ||
    row.entity?.type !== "saas_subscriptions" ||
    row.current?.operation !== operation
  )
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const versions = row.versions.filter(
    (entry) => entry.entity.type === "saas_subscriptions" && entry.entity.id === row.entity?.id,
  );
  const version = z
    .number()
    .int()
    .positive()
    .safe()
    .parse(before.subscription.subscription_version);
  if (
    versions.length !== 1 ||
    versions[0]?.version !== version ||
    current.subscription.subscription_version !== version ||
    current.subscription.cancel_at_period_end !== before.subscription.cancel_at_period_end ||
    row.current.values.renew !== !before.subscription.cancel_at_period_end
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return {
    scope: { ...scope },
    id: row.entity.id,
    version,
    renew: before.subscription.cancel_at_period_end,
    key: uuidv7(),
  };
}
type RenewalIntent = Awaited<ReturnType<typeof subscriptionRenewalIntent>>;
export async function writeSubscriptionRenewal(intent: RenewalIntent) {
  return (await scopedBackend(intent.scope)).call("subscription_renewal_set_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation_key: intent.key,
    expected_version: intent.version,
    renew: intent.renew,
  });
}
export async function readSubscriptionRenewalReceipt(intent: RenewalIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "subscription_renewal_set_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "subscription_renewal_set_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "saas_subscriptions" ||
        receipt.result_reference.id !== intent.id))
  )
    throw Error("SUBSCRIPTION_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSubscriptionRenewalResult(intent: RenewalIntent, id?: string) {
  if (id !== intent.id) throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  const result = await readSettingsSubscription(intent.scope);
  if (
    !result.subscription.subscription_version ||
    result.subscription.subscription_version <= intent.version ||
    result.subscription.cancel_at_period_end !== !intent.renew
  )
    throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  return result;
}
