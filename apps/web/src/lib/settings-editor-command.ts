import { validate } from "uuid";
const scopeKeys = {
  user: [
    "honorific",
    "language",
    "date_format",
    "time_format",
    "number_format",
    "week_start",
    "timezone_mode",
    "timezone_name",
    "theme",
    "contrast",
    "motion",
    "remember_context",
    "calendar_view",
    "show_weekends",
    "marketing_in_app",
    "ad_personalization",
    "ad_measurement",
    "optional_analytics",
    "font_scale",
    "startup_context",
    "quiet_hours_enabled",
    "quiet_hours_weekdays",
    "quiet_hours_start",
    "quiet_hours_end",
  ],
  member: [
    "profile_visible",
    "photo_visible",
    "email_visible",
    "phone_visible",
    "history_recommendations",
    "interest_center_ids",
    "interest_discipline_ids",
    "in_app_reminders",
    "in_app_marketing",
    "report_templates",
    "import_templates",
    "lesson_reminders_enabled",
    "package_reminders_enabled",
    "payment_reminders_enabled",
  ],
  center: [
    "description",
    "address",
    "contact_phone",
    "contact_email",
    "program_duration_minutes",
    "report_templates",
    "import_templates",
    "public_profile_enabled",
    "public_fields",
    "public_hours",
    "availability_templates",
    "package_templates",
    "lesson_reminders_enabled",
    "lesson_reminder_hours",
    "package_reminders_enabled",
    "package_reminder_days",
    "payment_reminders_enabled",
    "payment_reminder_days",
    "agreement_templates",
    "permission_templates",
  ],
  organization: [
    "description",
    "address",
    "contact_phone",
    "contact_email",
    "billing_name",
    "billing_address",
    "billing_email",
    "program_duration_minutes",
    "report_templates",
    "import_templates",
    "public_profile_enabled",
    "public_fields",
    "public_hours",
    "availability_templates",
    "package_templates",
    "primary_color",
    "secondary_color",
    "accent_color",
    "lesson_reminders_enabled",
    "lesson_reminder_hours",
    "package_reminders_enabled",
    "package_reminder_days",
    "payment_reminders_enabled",
    "payment_reminder_days",
    "reminder_center_overrides_enabled",
    "agreement_templates",
    "permission_templates",
    "regional_defaults",
  ],
};
export function validSettingsEditor(
  input: Record<string, unknown>,
  center: string | undefined,
  slot: string,
) {
  const target = input.scope;
  if (
    !["user", "member", "center", "organization"].includes(String(target)) ||
    slot !== `settings-editor:${target}` ||
    !Number.isSafeInteger(input.expected_version) ||
    Number(input.expected_version) < 0 ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 1000
  )
    return false;
  if (
    target === "user"
      ? input.org_id !== undefined || center !== undefined
      : target === "center"
        ? !center || input.center_id !== center
        : input.center_id !== undefined || center !== undefined
  )
    return false;
  if (input.preview !== undefined) {
    if (input.inherit_fields !== undefined || input.history_source !== undefined) return false;
    const p = input.preview as { id?: unknown; token?: unknown } | null;
    return (
      !!p &&
      Object.keys(p).length === 2 &&
      typeof p.id === "string" &&
      validate(p.id) &&
      typeof p.token === "string" &&
      !!p.token
    );
  }
  if (input.history_source !== undefined) {
    const h = input.history_source as Record<string, unknown> | null;
    return (
      input.inherit_fields === undefined &&
      !!h &&
      !Array.isArray(h) &&
      Object.keys(h).length === 2 &&
      typeof h.id === "string" &&
      validate(h.id) &&
      Array.isArray(h.fields) &&
      h.fields.length === 1 &&
      scopeKeys[target as keyof typeof scopeKeys].includes(h.fields[0]) &&
      !!input.patch &&
      typeof input.patch === "object" &&
      !Array.isArray(input.patch) &&
      Object.keys(input.patch).length === 0
    );
  }
  if (input.inherit_fields !== undefined) {
    return (
      target === "center" &&
      Array.isArray(input.inherit_fields) &&
      input.inherit_fields.length === 1 &&
      [
        "report_templates",
        "import_templates",
        "agreement_templates",
        "permission_templates",
      ].includes(input.inherit_fields[0]) &&
      !!input.patch &&
      typeof input.patch === "object" &&
      !Array.isArray(input.patch) &&
      Object.keys(input.patch).length === 0
    );
  }
  const patch = input.patch;
  if (
    !patch ||
    typeof patch !== "object" ||
    Array.isArray(patch) ||
    Object.keys(patch).length !== 1
  )
    return false;
  const key = Object.keys(patch)[0]!;
  return scopeKeys[target as keyof typeof scopeKeys].includes(key);
}
