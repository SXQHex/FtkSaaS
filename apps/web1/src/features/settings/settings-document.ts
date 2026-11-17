import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type { SettingsImageUpload } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
export type SettingsLevel = "organization" | "center";
const patchSchema = z
  .object({
    lesson_reminders_enabled: z.boolean().optional(),
    lesson_reminder_hours: z.union([z.literal(1), z.literal(3), z.literal(24)]).optional(),
    package_reminders_enabled: z.boolean().optional(),
    package_reminder_days: z.union([z.literal(3), z.literal(7), z.literal(14)]).optional(),
    payment_reminders_enabled: z.boolean().optional(),
    payment_reminder_days: z.union([z.literal(1), z.literal(3), z.literal(7)]).optional(),
    address: z.string().max(1000).optional(),
    contact_phone: z.string().max(100).optional(),
    contact_email: z.union([z.email().max(320), z.null()]).optional(),
    primary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    secondary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    accent_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
  })
  .strict();
export const parseSettingsDocumentPatch = (value: unknown) => patchSchema.parse(value);
export type SettingsDocumentPatch = z.infer<typeof patchSchema>;
const common = (scope: ClientScope, level: SettingsLevel) =>
  level === "center"
    ? {
        client_api_version: 1 as const,
        scope: "center" as const,
        org_id: scope.orgId,
        center_id: scope.centerId,
      }
    : { client_api_version: 1 as const, scope: "organization" as const, org_id: scope.orgId };
export async function readSettingsDocument(scope: ClientScope, level: SettingsLevel) {
  const backend = await scopedBackend(scope);
  const [catalog, document] = await Promise.all([
    backend.call("settings_catalog_get_v1", { ...common(scope, level), request_id: uuidv7() }),
    backend.call("settings_get_v1", { ...common(scope, level), request_id: uuidv7() }),
  ]);
  if (
    catalog.scope !== level ||
    document.scope !== level ||
    (document.scope !== "organization" && document.scope !== "center")
  )
    throw Error("SETTINGS_SOURCE_UNAVAILABLE");
  z.number().int().nonnegative().safe().parse(document.version);
  z.iso.datetime({ offset: true }).parse(document.as_of);
  const seen = new Set<string>();
  for (const field of catalog.fields) {
    if (seen.has(field.key)) throw Error("SETTINGS_SOURCE_UNAVAILABLE");
    seen.add(field.key);
    z.boolean().parse(field.writable);
  }
  patchSchema.parse(
    Object.fromEntries(
      Object.entries(document.values).filter(([key]) =>
        Object.prototype.hasOwnProperty.call(patchSchema.shape, key),
      ),
    ),
  );
  if (document.scope === "organization" && document.logo !== undefined && document.logo !== null)
    z.object({
      id: z.uuid(),
      mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
      bytes: z.number().int().min(1).max(1048576),
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
    }).parse(document.logo);
  // Missing values stay missing. Native defaults are not a fallback for an unread document.
  return { scope: { ...scope }, level, catalog, document };
}
export type SettingsDocumentSource = Awaited<ReturnType<typeof readSettingsDocument>>;
export interface SettingsDocumentIntent {
  scope: ClientScope;
  level: SettingsLevel;
  before: number;
  patch: SettingsDocumentPatch;
  key: string;
  logo?: SettingsImageUpload | null;
}
export async function settingsDocumentIntent(
  scope: ClientScope,
  level: SettingsLevel,
  before: SettingsDocumentSource,
  patch: SettingsDocumentPatch,
  logo?: SettingsImageUpload | null,
): Promise<SettingsDocumentIntent> {
  const parsed = patchSchema.parse(patch),
    keys = Object.keys(parsed);
  if (
    (!keys.length && logo === undefined) ||
    before.document.scope !== level ||
    before.scope.accountId !== scope.accountId ||
    before.scope.orgId !== scope.orgId ||
    before.scope.centerId !== scope.centerId
  )
    throw Error("SETTINGS_PATCH_UNAVAILABLE");
  const current = await readSettingsDocument(scope, level);
  if (current.document.version !== before.document.version)
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  for (const key of keys) {
    if (!current.catalog.fields.some((field) => field.key === key && field.writable))
      throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: uuidv7() });
  }
  if (logo !== undefined) {
    if (
      level !== "organization" ||
      !current.catalog.fields.some((field) => field.key === "address" && field.writable)
    )
      throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: uuidv7() });
    if (logo !== null)
      z.object({
        mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
        data_base64: z.string().min(4).max(1398104),
        checksum: z.string().regex(/^[a-f0-9]{64}$/),
      })
        .strict()
        .parse(logo);
  }
  if (level === "center" && keys.some((key) => key.endsWith("_color")))
    throw Error("SETTINGS_PATCH_UNAVAILABLE");
  return {
    scope: { ...scope },
    level,
    before: current.document.version,
    patch: parsed,
    key: uuidv7(),
    ...(logo !== undefined ? { logo } : {}),
  };
}
export async function writeSettingsDocument(intent: SettingsDocumentIntent) {
  const backend = await scopedBackend(intent.scope),
    base = {
      ...common(intent.scope, intent.level),
      request_id: uuidv7(),
      expected_version: intent.before,
      operation_key: intent.key,
    };
  return intent.level === "organization"
    ? backend.call("settings_update_v1", {
        ...base,
        scope: "organization",
        patch: intent.patch,
        ...(intent.logo !== undefined ? { logo_image: intent.logo } : {}),
      })
    : backend.call("settings_update_v1", {
        ...base,
        scope: "center",
        center_id: intent.scope.centerId,
        patch: intent.patch,
      });
}
export async function readSettingsDocumentReceipt(intent: SettingsDocumentIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    org_id: intent.scope.orgId,
    request_id: uuidv7(),
    operation: "settings_update_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "settings_update_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "accounts" ||
        receipt.result_reference.id !== intent.scope.accountId))
  )
    throw Error("SETTINGS_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readSettingsDocumentResult(intent: SettingsDocumentIntent, id?: string) {
  if (id !== intent.scope.accountId) throw Error("SETTINGS_RESULT_UNAVAILABLE");
  const result = await readSettingsDocument(intent.scope, intent.level);
  if (
    result.document.version <= intent.before ||
    Object.entries(intent.patch).some(
      ([key, value]) =>
        !Object.prototype.hasOwnProperty.call(result.document.values, key) ||
        Reflect.get(result.document.values, key) !== value,
    )
  )
    throw Error("SETTINGS_RESULT_UNAVAILABLE");
  if (intent.logo !== undefined) {
    const logo = result.document.scope === "organization" ? result.document.logo : undefined;
    if (
      intent.logo === null
        ? logo !== null
        : !logo ||
          logo.checksum !== intent.logo.checksum ||
          logo.mime !== intent.logo.mime ||
          logo.bytes !== atob(intent.logo.data_base64).length
    )
      throw Error("SETTINGS_RESULT_UNAVAILABLE");
  }
  return result;
}
