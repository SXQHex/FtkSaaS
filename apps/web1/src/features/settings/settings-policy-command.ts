import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type { PolicyValue, PolicyView } from "../../lib/api-contracts/generated";
import { readSettingsPolicies } from "./settings-policies";
import type { SettingsLevel } from "./settings-document";
const count = z.number().int().nonnegative().safe();
const effect = z.enum(["release", "consume"]);
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("integer"), value: count }),
  z.object({ kind: z.literal("boolean"), value: z.boolean() }),
  z.object({
    kind: z.literal("window"),
    opens_minutes_before: count,
    closes_minutes_before: count,
    manager_exception: z.boolean(),
  }),
  z.object({
    kind: z.literal("cancellation"),
    terms: z.object({
      cutoff_minutes: count.nullable().optional(),
      before_cutoff: effect,
      after_cutoff: effect,
      no_show: effect,
    }),
  }),
  z.object({ kind: z.literal("blocked_credit"), effect }),
  z.object({
    kind: z.literal("valuation"),
    discipline_id: z.uuid(),
    format: z.enum(["group", "private"]),
    amount_minor: z
      .string()
      .regex(/^(0|[1-9][0-9]{0,18})$/)
      .refine((value) => BigInt(value) <= 9223372036854775807n),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
]);
export function parseEditablePolicy(value: unknown): PolicyValue {
  return schema.parse(value);
}
const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(schema.parse(a)) === JSON.stringify(schema.parse(b));
const common = (scope: ClientScope, level: SettingsLevel) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  ...(level === "center" ? { center_id: scope.centerId } : {}),
});
export async function previewSettingsPolicy(
  scope: ClientScope,
  level: SettingsLevel,
  before: PolicyView,
  value: PolicyValue,
  localTime: string,
  timezone: string,
  mandatory: boolean,
  reason: string,
) {
  const T = await getTemporal();
  const effective_at = T.PlainDateTime.from(localTime)
    .toZonedDateTime(timezone, { disambiguation: "reject" })
    .toInstant()
    .toString();
  const fresh = await readSettingsPolicies(scope, level),
    current = fresh.items.find((row) => row.key === before.key);
  if (
    !current ||
    current.version !== before.version ||
    current.scope.kind !== before.scope.kind ||
    !sameValue(current.value, before.value)
  )
    throw Error("POLICY_SOURCE_CHANGED");
  const change = {
    kind: "policy" as const,
    key: before.key,
    value: parseEditablePolicy(value),
    effective_at,
    mandatory: level === "organization" ? mandatory : false,
  };
  const preview = await (
    await scopedBackend(scope)
  ).call("reservation_impact_preview_v1", {
    ...common(scope, level),
    request_id: uuidv7(),
    change,
    reason: z.string().trim().min(1).max(1000).parse(reason),
  });
  if (
    preview.change.kind !== "policy" ||
    preview.change.key !== change.key ||
    !sameValue(preview.change.value, change.value) ||
    Date.parse(preview.change.effective_at) !== Date.parse(effective_at) ||
    preview.change.mandatory !== change.mandatory ||
    !preview.preserves_reservations ||
    preview.waives_independent_blocks !== false
  )
    throw Error("POLICY_PREVIEW_INVALID");
  z.uuid().parse(preview.preview.id);
  z.string().min(1).parse(preview.preview.token);
  z.iso.datetime({ offset: true }).parse(preview.preview.expires_at);
  const ids = preview.affected.map((row) => z.uuid().parse(row.reservation_id));
  if (new Set(ids).size !== ids.length) throw Error("POLICY_PREVIEW_INVALID");
  return { scope: { ...scope }, level, change, preview, reason: reason.trim(), ids };
}
export type SettingsPolicyReview = Awaited<ReturnType<typeof previewSettingsPolicy>>;
export function settingsPolicyIntent(review: SettingsPolicyReview) {
  if (
    review.preview.preview.blockers.length ||
    Date.parse(review.preview.preview.expires_at) <= Date.now()
  )
    throw Error("POLICY_PREVIEW_UNAVAILABLE");
  return { ...structuredClone(review), key: uuidv7() };
}
type Intent = ReturnType<typeof settingsPolicyIntent>;
export async function writeSettingsPolicy(intent: Intent) {
  return (await scopedBackend(intent.scope)).call("policy_publish_v1", {
    ...common(intent.scope, intent.level),
    request_id: uuidv7(),
    operation_key: intent.key,
    key: intent.change.key,
    value: structuredClone(intent.change.value),
    effective_at: intent.change.effective_at,
    mandatory: intent.change.mandatory,
    impact_approval: { id: intent.preview.preview.id, token: intent.preview.preview.token },
    accepted_reservation_ids: [...intent.ids],
  });
}
export async function readSettingsPolicyReceipt(intent: Intent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "policy_publish_v1",
    key: intent.key,
  });
  if (
    result.operation !== "policy_publish_v1" ||
    result.key !== intent.key ||
    (result.result_reference && result.result_reference.type !== "policy_versions")
  )
    throw Error("POLICY_RECEIPT_INVALID");
  return result;
}
export async function readSettingsPolicyResult(intent: Intent, id?: string) {
  const page = await (
    await scopedBackend(intent.scope)
  ).call("management_state_get_v1", {
    ...common(intent.scope, intent.level),
    request_id: uuidv7(),
    operation: "policy_publish_v1",
    selector: { operation: "policy_publish_v1", key: { key: intent.change.key } },
    page: { limit: 1 },
  });
  const row = page.items[0];
  if (
    !id ||
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.entity?.type !== "policy_versions" ||
    row.entity.id !== id ||
    row.current?.operation !== "policy_publish_v1" ||
    row.current.values.key !== intent.change.key ||
    !sameValue(row.current.values.value, intent.change.value) ||
    Date.parse(row.current.values.effective_at ?? "") !== Date.parse(intent.change.effective_at) ||
    row.current.values.mandatory !== intent.change.mandatory
  )
    throw Error("POLICY_RESULT_UNAVAILABLE");
  return readSettingsPolicies(intent.scope, intent.level);
}
