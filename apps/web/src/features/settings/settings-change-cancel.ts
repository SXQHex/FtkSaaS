import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { readSettingsSubscription, type SettingsSubscriptionSource } from "./settings-subscription";

function pendingId(source: SettingsSubscriptionSource) {
  const period = source.subscription.billing?.pending_period_change?.id;
  const change = source.subscription.pending_change;
  if (change && (change.type !== "saas_change_requests" || (period && period !== change.id)))
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  return z.uuid().parse(period ?? change?.id);
}
async function readChange(scope: ClientScope, id: string, readContext?: AccountReadContext) {
  const operation = "subscription_change_cancel_v1" as const;
  const page = await (
    await scopedBackend(scope, undefined, readContext)
  ).call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    operation,
    selector: { operation, key: { change_id: id } },
    page: { limit: 1 },
  });
  const row = page.items[0];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== operation ||
    row.entity?.type !== "saas_change_requests" ||
    row.entity.id !== id ||
    row.current?.operation !== operation ||
    row.current.values.change_id !== id
  )
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const versions = row.versions.filter(
    (entry) => entry.entity.type === "saas_change_requests" && entry.entity.id === id,
  );
  if (versions.length !== 1) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  return {
    id,
    version: z.number().int().positive().safe().parse(versions[0]!.version),
    state: row.state,
  };
}
export async function readSettingsCancelSource(
  before: SettingsSubscriptionSource,
  readContext?: AccountReadContext,
) {
  const id = pendingId(before);
  const [change, current] = await Promise.all([
    readChange(before.scope, id, readContext),
    readSettingsSubscription(before.scope, readContext),
  ]);
  if (change.state !== "scheduled" || pendingId(current) !== id)
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  return { ...change, before: current };
}
export type SettingsCancelSource = Awaited<ReturnType<typeof readSettingsCancelSource>>;
export async function settingsCancelIntent(before: SettingsCancelSource) {
  const current = await readSettingsCancelSource(before.before);
  if (current.id !== before.id || current.version !== before.version)
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return {
    scope: { ...before.before.scope },
    id: before.id,
    version: before.version,
    key: uuidv7(),
  };
}
type CancelIntent = Awaited<ReturnType<typeof settingsCancelIntent>>;
export async function writeSettingsCancel(intent: CancelIntent) {
  return (await scopedBackend(intent.scope)).call("subscription_change_cancel_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation_key: intent.key,
    change_id: intent.id,
    expected_version: intent.version,
  });
}
export async function readSettingsCancelReceipt(intent: CancelIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "subscription_change_cancel_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "subscription_change_cancel_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "saas_change_requests" ||
        receipt.result_reference.id !== intent.id))
  )
    throw Error("SUBSCRIPTION_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSettingsCancelResult(intent: CancelIntent, id?: string) {
  if (id !== intent.id) throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  const [change, current] = await Promise.all([
    readChange(intent.scope, id),
    readSettingsSubscription(intent.scope),
  ]);
  if (
    change.state !== "cancelled" ||
    change.version <= intent.version ||
    current.subscription.pending_change?.id === id ||
    current.subscription.billing?.pending_period_change?.id === id
  )
    throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  return current;
}
