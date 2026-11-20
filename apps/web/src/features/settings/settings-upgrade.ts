import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { QuoteView } from "@ftksaas/api-contracts";
import { readSettingsSubscription, type SettingsSubscriptionSource } from "./settings-subscription";

export interface SettingsUpgradeQuote {
  scope: ClientScope;
  quote: QuoteView;
}
export async function settingsUpgradeIntent(before: SettingsSubscriptionSource, targetId: string) {
  z.uuid().parse(targetId);
  const target = before.subscription.billing?.upgrade_options?.find(
    (option) => option.target.id === targetId,
  );
  const version = z
    .number()
    .int()
    .positive()
    .safe()
    .parse(before.subscription.subscription_version);
  if (!target) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const operation = "subscription_upgrade_quote_v1" as const,
    scope = before.scope;
  const backend = await scopedBackend(scope);
  const [page, fresh] = await Promise.all([
    backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      operation,
      selector: { operation, key: { target_plan_id: targetId } },
      page: { limit: 1 },
    }),
    readSettingsSubscription(scope),
  ]);
  const row = page.items[0],
    live = fresh.subscription.billing?.upgrade_options?.find(
      (option) => option.target.id === targetId,
    );
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== operation ||
    row.entity?.type !== "saas_subscriptions" ||
    row.current?.operation !== operation ||
    row.current.values.target_plan_id !== targetId
  )
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const versions = row.versions.filter(
    (entry) => entry.entity.type === "saas_subscriptions" && entry.entity.id === row.entity?.id,
  );
  if (
    versions.length !== 1 ||
    versions[0]?.version !== version ||
    fresh.subscription.subscription_version !== version ||
    fresh.subscription.plan !== before.subscription.plan ||
    !live ||
    live.plan !== target.plan ||
    live.target.period !== target.target.period ||
    live.target.amount_minor !== target.target.amount_minor ||
    live.target.currency !== target.target.currency
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return {
    scope: { ...scope },
    version,
    from: before.subscription.plan,
    target: structuredClone(target),
    key: uuidv7(),
  };
}
export type SettingsUpgradeIntent = Awaited<ReturnType<typeof settingsUpgradeIntent>>;
export async function writeSettingsUpgrade(
  intent: SettingsUpgradeIntent,
): Promise<SettingsUpgradeQuote> {
  const quote = await (
    await scopedBackend(intent.scope)
  ).call("subscription_upgrade_quote_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation_key: intent.key,
    target_plan_id: intent.target.target.id,
  });
  z.uuid().parse(quote.id);
  z.string()
    .regex(/^(0|[1-9][0-9]{0,18})$/)
    .refine((value) => BigInt(value) <= 9223372036854775807n)
    .parse(quote.amount_minor);
  for (const instant of [quote.period_start, quote.period_end, quote.expires_at])
    z.iso.datetime({ offset: true }).parse(instant);
  if (
    quote.from_plan !== intent.from ||
    quote.to_plan !== intent.target.plan ||
    quote.currency !== intent.target.target.currency ||
    Date.parse(quote.period_start) >= Date.parse(quote.period_end)
  )
    throw Error("SUBSCRIPTION_QUOTE_UNAVAILABLE");
  return { scope: { ...intent.scope }, quote };
}
export async function readSettingsUpgradeReceipt(intent: SettingsUpgradeIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "subscription_upgrade_quote_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "subscription_upgrade_quote_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "saas_quotes")
  )
    throw Error("SUBSCRIPTION_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSettingsUpgradeResult(
  intent: SettingsUpgradeIntent,
  saved: SettingsUpgradeQuote | undefined,
  id?: string,
) {
  if (id !== undefined) z.uuid().parse(id);
  if (
    saved &&
    (id !== saved.quote.id ||
      saved.scope.accountId !== intent.scope.accountId ||
      saved.scope.orgId !== intent.scope.orgId)
  )
    throw Error("SUBSCRIPTION_QUOTE_UNAVAILABLE");
  // The full immutable QuoteView is kept only when received. A receipt alone never supplies financial terms.
  const current = await readSettingsSubscription(intent.scope);
  return {
    scope: { ...intent.scope },
    quote: saved?.quote,
    current,
    usable:
      !!saved &&
      current.subscription.plan === saved.quote.from_plan &&
      current.subscription.subscription_version === intent.version &&
      Date.parse(saved.quote.expires_at) > current.readAt,
  };
}
