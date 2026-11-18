import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type {
  SettingsImageUpload,
  OrganizationSettingsValues,
} from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
export type SettingsLevel = "organization" | "center";
export type InheritedPreparationFamily =
  | "event_templates"
  | "collection_templates"
  | "crm_templates"
  | "automation_templates";
export type PreparationFamily = InheritedPreparationFamily | "program_templates";
const preparationIdentity = {
  key: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  name: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => !!value.trim()),
};
const collectionTemplate = z.strictObject({
  ...preparationIdentity,
  defaults: z.strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/),
    payment_method: z.enum(["cash", "bank_transfer", "card_pos"]),
  }),
});
const crmTemplate = z.strictObject({
  ...preparationIdentity,
  defaults: z.strictObject({
    source: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => !!value.trim()),
    interest: z
      .string()
      .min(1)
      .max(1000)
      .refine((value) => !!value.trim()),
  }),
});
const weekday = z.number().int().min(1).max(7);
const capacityCount = z.number().int().nonnegative().safe();
const programTemplate = z.strictObject({
  ...preparationIdentity,
  defaults: z.strictObject({
    weekdays: z
      .tuple([weekday])
      .rest(weekday)
      .refine((days) => new Set(days).size === days.length),
    local_start: z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    duration_minutes: z.number().int().positive().safe(),
    capacity: z.strictObject({
      total: capacityCount,
      categories: z.strictObject({ male: capacityCount, female: capacityCount }).nullish(),
    }),
  }),
});
const uniquePreparationKeys = (rows: { key: string }[]) =>
  new Set(rows.map(({ key }) => key)).size === rows.length;
const eventMoney = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n);
const eventEffect = z.enum(["release", "consume"]);
const eventTemplate = z.strictObject({
  ...preparationIdentity,
  defaults: z.strictObject({
    capacity: z.union([
      z.strictObject({ kind: z.literal("unlimited") }),
      z
        .strictObject({ nominal: capacityCount, maximum: capacityCount })
        .refine(({ nominal, maximum }) => nominal <= maximum),
    ]),
    terms: z
      .strictObject({
        fee_minor: eventMoney,
        currency: z.string().regex(/^[A-Z]{3}$/),
        full_payment_required: z.boolean(),
        allowed_product_version_ids: z.array(z.uuid()),
        cancellation: z.strictObject({
          cutoff_minutes: capacityCount.nullish(),
          before_cutoff: eventEffect,
          after_cutoff: eventEffect,
          no_show: eventEffect,
        }),
        refund: z.strictObject({
          method: z.enum(["none", "credit_ratio", "used_at_unit_price", "time_ratio"]),
          used_unit_minor: eventMoney.nullish(),
        }),
        package_usage: z.enum(["consume", "eligibility_only"]).optional(),
      })
      .refine(
        (value) =>
          value.package_usage !== "eligibility_only" ||
          (value.fee_minor === "0" && value.allowed_product_version_ids.length > 0),
      ),
  }),
});
const automationTemplate = z.strictObject({
  ...preparationIdentity,
  defaults: z.strictObject({
    trigger: z.strictObject({
      kind: z.enum(["entitlement_expiring", "student_inactive", "lead_followup_due"]),
      offset_days: capacityCount,
    }),
    action: z.strictObject({
      kind: z.enum(["create_followup", "send_reminder"]),
      channel: z.literal("in_app"),
      template_key: z.string().refine((value) => !!value.trim()),
    }),
  }),
});
const patchSchema = z
  .object({
    automation_templates: z
      .array(automationTemplate)
      .max(100)
      .refine(uniquePreparationKeys)
      .optional(),
    event_templates: z.array(eventTemplate).max(100).refine(uniquePreparationKeys).optional(),
    program_templates: z.array(programTemplate).max(100).refine(uniquePreparationKeys).optional(),
    collection_templates: z
      .array(collectionTemplate)
      .max(100)
      .refine(uniquePreparationKeys)
      .optional(),
    crm_templates: z.array(crmTemplate).max(100).refine(uniquePreparationKeys).optional(),
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
    program_duration_minutes: z.number().int().min(1).max(2147483647).optional(),
    contact_phone: z.string().max(100).optional(),
    contact_email: z.union([z.email().max(320), z.null()]).optional(),
    billing_name: z.string().max(1000).optional(),
    billing_address: z.string().max(1000).optional(),
    billing_email: z.email().max(320).nullable().optional(),
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
  inherit?: InheritedPreparationFamily;
}
export async function settingsDocumentIntent(
  scope: ClientScope,
  level: SettingsLevel,
  before: SettingsDocumentSource,
  patch: SettingsDocumentPatch,
  logo?: SettingsImageUpload | null,
  inherit?: InheritedPreparationFamily,
): Promise<SettingsDocumentIntent> {
  const parsed = parseSettingsDocumentPatch(patch),
    keys = Object.keys(parsed);
  if (
    (!keys.length && logo === undefined && !inherit) ||
    (inherit && (level !== "center" || keys.length > 0 || logo !== undefined)) ||
    before.document.scope !== level ||
    before.scope.accountId !== scope.accountId ||
    before.scope.orgId !== scope.orgId ||
    before.scope.centerId !== scope.centerId
  )
    throw Error("SETTINGS_PATCH_UNAVAILABLE");
  const current = await readSettingsDocument(scope, level);
  if (current.document.version !== before.document.version)
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  for (const key of inherit ? [inherit] : keys) {
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
  if (
    level === "center" &&
    keys.some((key) => key.endsWith("_color") || key.startsWith("billing_"))
  )
    throw Error("SETTINGS_PATCH_UNAVAILABLE");
  return {
    scope: { ...scope },
    level,
    before: current.document.version,
    patch: parsed,
    ...(inherit ? { inherit } : {}),
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
        ...(intent.inherit ? { inherit_fields: [intent.inherit] } : {}),
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
  if (
    key === "collection_templates" ||
    key === "crm_templates" ||
    key === "program_templates" ||
    key === "event_templates" ||
    key === "automation_templates"
  )
    return (
      JSON.stringify(patchSchema.shape[key].parse(expected)) ===
      JSON.stringify(patchSchema.shape[key].parse(actual))
    );
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
  if (intent.inherit) {
    const inherited =
      result.document.scope === "center" && result.document.inherited_fields?.[intent.inherit];
    if (
      !inherited ||
      inherited.kind !== "organization_inherited" ||
      !Number.isSafeInteger(inherited.organization_version) ||
      inherited.organization_version < 0
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
    "program_duration_minutes",
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
