import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type {
  SettingsImageUpload,
  OrganizationSettingsValues,
} from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
export type SettingsLevel = "organization" | "center";
const patchSchema = z
  .object({
    public_profile_enabled: z.boolean().optional(),
    public_fields: z
      .array(
        z.enum([
          "name",
          "description",
          "logo",
          "address",
          "contact",
          "hours",
          "location",
          "website",
        ]),
      )
      .max(8)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    public_application_form: z
      .object({
        form_id: z.uuid(),
        consents: z
          .array(
            z.object({
              purpose: z.string().min(1).max(100),
              version: z.string().min(1).max(200),
              required: z.boolean(),
              content_template_id: z.uuid(),
            }),
          )
          .min(1)
          .max(20),
      })
      .nullable()
      .optional(),
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
export type SettingsDocumentPatch = Omit<
  z.infer<typeof patchSchema>,
  "public_fields" | "public_application_form"
> &
  Pick<OrganizationSettingsValues, "public_fields" | "public_application_form">;
// The closed runtime schema checks the generated DTO's finite array bounds.
export const parseSettingsDocumentPatch = (value: unknown): SettingsDocumentPatch =>
  patchSchema.parse(value) as SettingsDocumentPatch;
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
  reset?: { id: string; token: string };
}
export async function settingsDocumentIntent(
  scope: ClientScope,
  level: SettingsLevel,
  before: SettingsDocumentSource,
  patch: SettingsDocumentPatch,
  logo?: SettingsImageUpload | null,
): Promise<SettingsDocumentIntent> {
  const parsed = parseSettingsDocumentPatch(patch),
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
  if (intent.reset)
    return backend.call("settings_reset_apply_v1", {
      ...base,
      preview: intent.reset,
    });
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
    operation: intent.reset ? "settings_reset_apply_v1" : "settings_update_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== (intent.reset ? "settings_reset_apply_v1" : "settings_update_v1") ||
    receipt.key !== intent.key ||
    (receipt.result_reference &&
      (receipt.result_reference.type !== "accounts" ||
        receipt.result_reference.id !== intent.scope.accountId))
  )
    throw Error("SETTINGS_RECEIPT_UNAVAILABLE");
  return receipt;
}
function settingsFieldMatches(key: string, expected: unknown, actual: unknown) {
  if (key === "public_fields" && Array.isArray(expected) && Array.isArray(actual))
    return (
      z
        .array(z.string())
        .parse(expected)
        .sort((a, b) => a.localeCompare(b))
        .join() ===
      z
        .array(z.string())
        .parse(actual)
        .sort((a, b) => a.localeCompare(b))
        .join()
    );
  if (key === "public_application_form")
    return (
      JSON.stringify(
        patchSchema.parse({ public_application_form: expected }).public_application_form,
      ) ===
      JSON.stringify(patchSchema.parse({ public_application_form: actual }).public_application_form)
    );
  return expected === actual;
}
export async function readSettingsDocumentResult(intent: SettingsDocumentIntent, id?: string) {
  if (id !== intent.scope.accountId) throw Error("SETTINGS_RESULT_UNAVAILABLE");
  const result = await readSettingsDocument(intent.scope, intent.level);
  if (
    result.document.version <= intent.before ||
    Object.entries(intent.patch).some(
      ([key, value]) =>
        !Object.prototype.hasOwnProperty.call(result.document.values, key) ||
        !settingsFieldMatches(key, value, Reflect.get(result.document.values, key)),
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

export async function settingsResetIntent(
  scope: ClientScope,
  level: SettingsLevel,
  before: SettingsDocumentSource,
  fields: (keyof SettingsDocumentPatch)[],
): Promise<SettingsDocumentIntent> {
  if (!fields.length || new Set(fields).size !== fields.length)
    throw Error("SETTINGS_PATCH_UNAVAILABLE");
  // The same live source/version/field gates apply to update and reset.
  const original = Object.fromEntries(
    fields.map((key) => [key, Reflect.get(before.document.values, key)]),
  );
  const intent = await settingsDocumentIntent(
    scope,
    level,
    before,
    parseSettingsDocumentPatch(original),
  );
  const backend = await scopedBackend(scope);
  const [first, ...rest] = fields;
  if (first === undefined) throw Error("SETTINGS_PATCH_UNAVAILABLE");
  const centerField = z.enum([
    "address",
    "contact_email",
    "contact_phone",
    "lesson_reminder_hours",
    "lesson_reminders_enabled",
    "package_reminder_days",
    "package_reminders_enabled",
    "payment_reminder_days",
    "payment_reminders_enabled",
  ]);
  const preview =
    level === "organization"
      ? await backend.call("settings_reset_preview_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          scope: "organization",
          org_id: scope.orgId,
          fields: [first, ...rest],
        })
      : await backend.call("settings_reset_preview_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          scope: "center",
          org_id: scope.orgId,
          center_id: scope.centerId,
          fields: [centerField.parse(first), ...rest.map((key) => centerField.parse(key))],
        });
  z.uuid().parse(preview.id);
  z.string().min(1).max(128).parse(preview.token);
  if (
    preview.scope !== level ||
    preview.version !== intent.before ||
    preview.fields.length !== fields.length ||
    fields.some((key) => !preview.fields.some((field) => field === key)) ||
    fields.some(
      (key) =>
        !Object.prototype.hasOwnProperty.call(preview.before, key) ||
        !settingsFieldMatches(
          key,
          Reflect.get(before.document.values, key),
          Reflect.get(preview.before, key),
        ),
    )
  )
    throw Error("SETTINGS_SOURCE_UNAVAILABLE");
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  if (Date.parse(preview.expires_at) <= Date.now())
    throw new BackendError({ code: "PREVIEW_STALE", retryable: false, trace_id: uuidv7() });
  if (fields.some((key) => !Object.prototype.hasOwnProperty.call(preview.after, key)))
    throw Error("SETTINGS_SOURCE_UNAVAILABLE");
  return {
    ...intent,
    patch: parseSettingsDocumentPatch(
      Object.fromEntries(fields.map((key) => [key, Reflect.get(preview.after, key)])),
    ),
    reset: { id: preview.id, token: preview.token },
  };
}
