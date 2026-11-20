import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend } from "../../lib/scoped-backend";
import { readSettingsSubscription, type SettingsSubscriptionSource } from "./settings-subscription";

export async function settingsPeriodIntent(before: SettingsSubscriptionSource, targetId: string) {
  z.uuid().parse(targetId);
  const target = before.subscription.billing?.period_change_options.find(
    (row) => row.id === targetId,
  );
  const version = z
    .number()
    .int()
    .positive()
    .safe()
    .parse(before.subscription.subscription_version);
  if (!target || !before.subscription.period_end) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const operation = "subscription_period_change_request_v1" as const,
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
  const values = row.current.values;
  z.iso.datetime({ offset: true }).parse(values.effective_at);
  const live = fresh.subscription.billing?.period_change_options.find(
    (option) => option.id === targetId,
  );
  if (
    versions.length !== 1 ||
    versions[0]?.version !== version ||
    values.expected_version !== version ||
    fresh.subscription.subscription_version !== version ||
    values.target_plan_id !== targetId ||
    values.amount_minor !== target.amount_minor ||
    values.currency !== target.currency ||
    Date.parse(values.effective_at) !== Date.parse(before.subscription.period_end) ||
    !live ||
    live.period !== target.period ||
    live.amount_minor !== target.amount_minor ||
    live.currency !== target.currency
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return {
    scope: { ...scope },
    version,
    target: structuredClone(target),
    effectiveAt: values.effective_at,
    key: uuidv7(),
  };
}
export type SettingsPeriodIntent = Awaited<ReturnType<typeof settingsPeriodIntent>>;
export async function writeSettingsPeriod(intent: SettingsPeriodIntent) {
  return (await scopedBackend(intent.scope)).call("subscription_period_change_request_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation_key: intent.key,
    expected_version: intent.version,
    target_plan_id: intent.target.id,
    amount_minor: intent.target.amount_minor,
    currency: intent.target.currency,
    effective_at: intent.effectiveAt,
  });
}
export async function readSettingsPeriodReceipt(intent: SettingsPeriodIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "subscription_period_change_request_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "subscription_period_change_request_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "saas_change_requests")
  )
    throw Error("SUBSCRIPTION_RECEIPT_UNAVAILABLE");
  if (receipt.result_reference) z.uuid().parse(receipt.result_reference.id);
  return receipt;
}
export async function readSettingsPeriodResult(intent: SettingsPeriodIntent, id?: string) {
  z.uuid().parse(id);
  const result = await readSettingsSubscription(intent.scope),
    pending = result.subscription.billing?.pending_period_change;
  if (
    !pending ||
    pending.id !== id ||
    pending.target.id !== intent.target.id ||
    pending.target.period !== intent.target.period ||
    pending.target.amount_minor !== intent.target.amount_minor ||
    pending.target.currency !== intent.target.currency ||
    Date.parse(pending.effective_at) !== Date.parse(intent.effectiveAt) ||
    !result.subscription.subscription_version ||
    result.subscription.subscription_version <= intent.version
  )
    throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  return result;
}
