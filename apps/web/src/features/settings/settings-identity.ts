import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { SettingsLevel } from "./settings-document";
const common = (scope: ClientScope, level: SettingsLevel) => ({
  client_api_version: 1 as const,
  org_id: scope.orgId,
  ...(level === "center" ? { center_id: scope.centerId } : {}),
});
export async function readSettingsIdentity(
  scope: ClientScope,
  level: SettingsLevel,
  readContext?: AccountReadContext,
) {
  const operation =
    level === "organization" ? ("organization_update_v1" as const) : ("center_update_v1" as const);
  const id = level === "organization" ? scope.orgId : scope.centerId,
    type = level === "organization" ? "organizations" : "centers";
  const page = await (
    await scopedBackend(scope, undefined, readContext)
  ).call("management_state_get_v1", {
    ...common(scope, level),
    request_id: uuidv7(),
    operation,
    selector: { operation, key: {} },
    page: { limit: 1 },
  });
  const row = page.items[0];
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== operation ||
    row.entity?.type !== type ||
    row.entity.id !== id ||
    row.current?.operation !== operation
  )
    throw Error("SETTINGS_IDENTITY_UNAVAILABLE");
  const versions = row.versions.filter((v) => v.entity.type === type && v.entity.id === id);
  if (versions.length !== 1) throw Error("SETTINGS_IDENTITY_UNAVAILABLE");
  const name = z.string().min(1).max(2000).parse(row.current.values.name);
  const timezone =
    row.current.operation === "center_update_v1"
      ? z.string().min(1).parse(row.current.values.timezone)
      : undefined;
  if (timezone) new Intl.DateTimeFormat("tr-TR", { timeZone: timezone });
  return {
    scope: { ...scope },
    level,
    id,
    type,
    operation,
    name,
    timezone,
    version: z.number().int().positive().safe().parse(versions[0]!.version),
  };
}
export type SettingsIdentitySource = Awaited<ReturnType<typeof readSettingsIdentity>>;
export interface SettingsIdentityIntent {
  before: SettingsIdentitySource;
  name: string;
  key: string;
}
export async function settingsIdentityIntent(
  before: SettingsIdentitySource,
  name: string,
): Promise<SettingsIdentityIntent> {
  const value = z.string().trim().min(1).max(2000).parse(name),
    current = await readSettingsIdentity(before.scope, before.level);
  if (current.version !== before.version || current.timezone !== before.timezone)
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  if (value === current.name) throw Error("SETTINGS_IDENTITY_UNCHANGED");
  return { before: structuredClone(before), name: value, key: uuidv7() };
}
export async function writeSettingsIdentity(intent: SettingsIdentityIntent) {
  const { before } = intent,
    backend = await scopedBackend(before.scope),
    base = {
      ...common(before.scope, before.level),
      request_id: uuidv7(),
      operation_key: intent.key,
      expected_version: before.version,
      name: intent.name,
    };
  if (before.level === "organization") return backend.call("organization_update_v1", base);
  if (!before.timezone) throw Error("SETTINGS_IDENTITY_UNAVAILABLE");
  return backend.call("center_update_v1", { ...base, timezone: before.timezone });
}
export async function readSettingsIdentityReceipt(intent: SettingsIdentityIntent) {
  const before = intent.before,
    receipt = await (
      await scopedBackend(before.scope)
    ).call("operation_status_get_v1", {
      client_api_version: 1,
      org_id: before.scope.orgId,
      request_id: uuidv7(),
      operation: before.operation,
      key: intent.key,
    });
  if (
    receipt.operation !== before.operation ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== before.type || receipt.result_reference.id !== before.id))
  )
    throw Error("SETTINGS_IDENTITY_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSettingsIdentityResult(intent: SettingsIdentityIntent, id?: string) {
  if (id !== intent.before.id) throw Error("SETTINGS_IDENTITY_RESULT_UNAVAILABLE");
  const value = await readSettingsIdentity(intent.before.scope, intent.before.level);
  if (
    value.version <= intent.before.version ||
    value.name !== intent.name ||
    value.timezone !== intent.before.timezone
  )
    throw Error("SETTINGS_IDENTITY_RESULT_UNAVAILABLE");
  return value;
}
