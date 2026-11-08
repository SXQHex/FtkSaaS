import { setupCall, type SetupScope, type SetupInput } from "./studio-setup";
import type { SettingsCatalog, SettingsFieldKey, SettingsView } from "@ftksaas/api-contracts";
import { validate, v7 } from "uuid";
export type DeliveryTarget = "user" | "member" | "center" | "organization";
export const deliveryKeys = [
  "in_app_reminders",
  "lesson_reminders_enabled",
  "package_reminders_enabled",
  "payment_reminders_enabled",
  "lesson_reminder_hours",
  "package_reminder_days",
  "payment_reminder_days",
  "reminder_center_overrides_enabled",
  "quiet_hours_enabled",
  "quiet_hours_weekdays",
  "quiet_hours_start",
  "quiet_hours_end",
  "timezone_mode",
  "timezone_name",
] as const satisfies readonly SettingsFieldKey[];
export type DeliveryKey = (typeof deliveryKeys)[number];
export function deliveryQuery(scope: SetupScope, target: DeliveryTarget) {
  if (target === "user") return { scope: target };
  if (target === "center") {
    if (!scope.centerId) throw Error("invalidPreferences");
    return { scope: target, org_id: scope.orgId, center_id: scope.centerId };
  }
  return { scope: target, org_id: scope.orgId };
}
export function deliveryValue(key: DeliveryKey, value: unknown) {
  if (key === "quiet_hours_weekdays")
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 7 &&
      new Set(value).size === value.length &&
      value.every((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    );
  if (key === "quiet_hours_start" || key === "quiet_hours_end")
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (key === "timezone_mode") return value === "device" || value === "manual";
  if (key === "timezone_name") {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }
  if (key === "lesson_reminder_hours")
    return [1, 3, 24].includes(Number(value)) && typeof value === "number";
  if (key === "package_reminder_days")
    return [3, 7, 14].includes(Number(value)) && typeof value === "number";
  if (key === "payment_reminder_days")
    return [1, 3, 7].includes(Number(value)) && typeof value === "number";
  return typeof value === "boolean";
}
export function deliveryFields(catalog: SettingsCatalog) {
  const support = catalog.notification_delivery;
  return catalog.fields.filter(
    (f) =>
      deliveryKeys.some((k) => k === f.key) &&
      (f.key.startsWith("quiet_hours_") || f.key.startsWith("timezone_")
        ? support?.quiet_hours.controls_available
        : support?.reminders.feature_licensed),
  );
}
export async function readDeliverySettings(scope: SetupScope, target: DeliveryTarget) {
  const q = deliveryQuery(scope, target),
    [catalog, view] = await Promise.all([
      setupCall("settings_catalog_get_v1", q),
      setupCall("settings_get_v1", q),
    ]);
  if (
    catalog.scope !== target ||
    view.scope !== target ||
    !Number.isSafeInteger(view.version) ||
    view.version < 0
  )
    throw Error("invalidPreferences");
  return { catalog, view };
}
export function deliveryCommand(
  scope: SetupScope,
  target: DeliveryTarget,
  key: DeliveryKey,
  value: unknown,
  source: { catalog: SettingsCatalog; view: SettingsView },
) {
  if (
    !deliveryValue(key, value) ||
    source.catalog.scope !== target ||
    source.view.scope !== target ||
    !deliveryFields(source.catalog).some((f) => f.key === key && f.writable)
  )
    throw Error("invalidPreferences");
  return {
    operation: "settings_update_v1" as const,
    input: {
      ...deliveryQuery(scope, target),
      operation_key: v7(),
      expected_version: source.view.version,
      patch: { [key]: value },
    } as SetupInput<"settings_update_v1">,
  };
}
export function validDelivery(
  input: Record<string, unknown>,
  center: string | undefined,
  slot: string,
) {
  const target = input.scope;
  if (
    !["user", "member", "center", "organization"].includes(String(target)) ||
    slot !== `delivery:${target}` ||
    (target === "user"
      ? input.org_id !== undefined || center !== undefined
      : target === "center"
        ? !center || input.center_id !== center
        : input.center_id !== undefined || center !== undefined) ||
    !Number.isSafeInteger(input.expected_version) ||
    Number(input.expected_version) < 0
  )
    return false;
  if (input.preview !== undefined) {
    const p = input.preview as Record<string, unknown> | null;
    return (
      !!p &&
      Object.keys(p).length === 2 &&
      typeof p.id === "string" &&
      validate(p.id) &&
      typeof p.token === "string" &&
      !!p.token
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
  return Object.entries(patch).every(
    ([k, v]) =>
      deliveryKeys.some((n) => n === k) &&
      deliveryValue(k as DeliveryKey, v) &&
      (target === "user"
        ? k.startsWith("quiet_hours_") || k.startsWith("timezone_")
        : !k.startsWith("quiet_hours_") &&
          !k.startsWith("timezone_") &&
          (target !== "member" ||
            [
              "in_app_reminders",
              "lesson_reminders_enabled",
              "package_reminders_enabled",
              "payment_reminders_enabled",
            ].includes(k))),
  );
}

// The org-shaped value is a local journal namespace only; user API requests omit org_id.
export const ownDeliveryScope = (actorId: string): SetupScope => ({ actorId, orgId: actorId });
