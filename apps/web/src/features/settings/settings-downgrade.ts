import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type AccountReadContext } from "../../lib/scoped-backend";
import type { StarterRetainedScope } from "@ftksaas/api-contracts";
import { readSettingsSubscription, type SettingsSubscriptionSource } from "./settings-subscription";
export type RetainedKind = "rooms" | "disciplines" | "instructors" | "students";
export async function readDowngradeCenters(
  before: SettingsSubscriptionSource,
  cursor?: string,
  readContext?: AccountReadContext,
) {
  return (await scopedBackend(before.scope, undefined, readContext)).call("centers_list_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: before.scope.orgId,
    page: { limit: 100, ...(cursor ? { cursor } : {}) },
  });
}
export async function readDowngradeSource(
  before: SettingsSubscriptionSource,
  targetId: string,
  centerId?: string,
  resources?: RetainedKind,
  cursor?: string,
  readContext?: AccountReadContext,
) {
  const version = z
    .number()
    .int()
    .positive()
    .safe()
    .parse(before.subscription.subscription_version);
  const operation = "subscription_downgrade_request_v1" as const;
  const data = await (
    await scopedBackend(before.scope, undefined, readContext)
  ).call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: before.scope.orgId,
    operation,
    selector: {
      operation,
      key: {
        target_plan_id: z.uuid().parse(targetId),
        ...(centerId ? { kept_center_id: z.uuid().parse(centerId) } : {}),
        expected_version: version,
      },
      ...(resources ? { resources } : {}),
    },
    page: { limit: resources ? 100 : 1, ...(cursor ? { cursor } : {}) },
  });
  if (data.items.length > (resources ? 100 : 1) || (cursor && data.next_cursor === cursor))
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  for (const row of data.items) {
    if (
      row.operation !== operation ||
      !row.exists ||
      row.entity?.type !== "saas_subscriptions" ||
      row.current?.operation !== operation ||
      row.current.values.target_plan_id !== targetId ||
      (centerId !== undefined && row.current.values.kept_center_id !== centerId) ||
      row.current.values.expected_version !== version
    )
      throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
    const versions = row.versions.filter(
      (item) => item.entity.type === "saas_subscriptions" && item.entity.id === row.entity!.id,
    );
    if (versions.length !== 1 || versions[0]!.version !== version)
      throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
    if (resources && row.retained_resource?.kind !== resources)
      throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  }
  if (!resources && (data.items.length !== 1 || data.next_cursor))
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  return data;
}
const retained = z.object({
  room_id: z.uuid().nullable(),
  discipline_id: z.uuid().nullable(),
  instructor_id: z.uuid().nullable(),
  student_person_ids: z
    .array(z.uuid())
    .max(100)
    .refine((values) => new Set(values).size === values.length),
});
export async function settingsDowngradeIntent(
  before: SettingsSubscriptionSource,
  targetId: string,
  centerId?: string,
  kept?: StarterRetainedScope,
) {
  const target = before.subscription.billing?.downgrade_options?.find(
    (row) => row.target.id === targetId,
  );
  if (!target || (target.kept_center_required && !centerId) || (target.plan === "starter" && !kept))
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const [page, fresh] = await Promise.all([
    readDowngradeSource(before, targetId, centerId),
    readSettingsSubscription(before.scope),
  ]);
  const live = fresh.subscription.billing?.downgrade_options?.find(
    (row) => row.target.id === targetId,
  );
  if (
    !live ||
    fresh.subscription.subscription_version !== before.subscription.subscription_version ||
    JSON.stringify(live) !== JSON.stringify(target)
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  if (!page.items[0]?.exists) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  return {
    scope: { ...before.scope },
    version: z.number().int().positive().parse(before.subscription.subscription_version),
    target: structuredClone(target),
    centerId: target.kept_center_required ? z.uuid().parse(centerId) : undefined,
    kept: target.plan === "starter" ? retained.parse(kept) : undefined,
    key: uuidv7(),
  };
}
export type SettingsDowngradeIntent = Awaited<ReturnType<typeof settingsDowngradeIntent>>;
export async function writeSettingsDowngrade(intent: SettingsDowngradeIntent) {
  return (await scopedBackend(intent.scope)).call("subscription_downgrade_request_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation_key: intent.key,
    target_plan_id: intent.target.target.id,
    expected_version: intent.version,
    ...(intent.centerId ? { kept_center_id: intent.centerId } : {}),
    ...(intent.kept ? { kept_scope: structuredClone(intent.kept) } : {}),
  });
}
export async function readSettingsDowngradeReceipt(intent: SettingsDowngradeIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "subscription_downgrade_request_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "subscription_downgrade_request_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "saas_change_requests")
  )
    throw Error("SUBSCRIPTION_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSettingsDowngradeResult(intent: SettingsDowngradeIntent, id?: string) {
  const result = await readSettingsSubscription(intent.scope);
  if (
    !id ||
    result.subscription.pending_change?.type !== "saas_change_requests" ||
    result.subscription.pending_change.id !== id ||
    !result.subscription.subscription_version ||
    result.subscription.subscription_version <= intent.version
  )
    throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  if (intent.kept) {
    const actual = result.subscription.pending_starter_scope;
    if (
      !actual ||
      actual.center_id !== intent.centerId ||
      actual.scope.room_id !== intent.kept.room_id ||
      actual.scope.discipline_id !== intent.kept.discipline_id ||
      actual.scope.instructor_id !== intent.kept.instructor_id ||
      [...actual.scope.student_person_ids].sort().join() !==
        [...intent.kept.student_person_ids].sort().join()
    )
      throw Error("SUBSCRIPTION_RESULT_UNAVAILABLE");
  }
  return result;
}
