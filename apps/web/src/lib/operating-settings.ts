import { validate, v7 } from "uuid";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { SettingsView, SettingsCatalog, SettingsFieldKey } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope, type SetupInput } from "./studio-setup";
export const operatingFields = {
  description: 3000,
  address: 1000,
  contact_phone: 100,
  contact_email: 320,
  program_duration_minutes: 2147483647,
  billing_name: 1000,
  billing_address: 1000,
  billing_email: 320,
} as const;
export type OperatingKey = keyof typeof operatingFields;
export type OperatingTarget = "organization" | "center";
export function settingsQuery(scope: SetupScope, target: OperatingTarget) {
  if (target === "center" && !scope.centerId) throw Error("invalidSettings");
  return target === "center"
    ? { scope: target, org_id: scope.orgId, center_id: scope.centerId! }
    : { scope: target, org_id: scope.orgId };
}
export const operatingApi = {
  read: async (scope: SetupScope, target: OperatingTarget) => {
    const query = settingsQuery(scope, target);
    const [catalog, view] = await Promise.all([
      setupCall("settings_catalog_get_v1", query),
      setupCall("settings_get_v1", query),
    ]);
    if (
      catalog.scope !== target ||
      view.scope !== target ||
      !Number.isSafeInteger(view.version) ||
      view.version < 0 ||
      new Set(catalog.fields.map((f) => f.key)).size !== catalog.fields.length
    )
      throw Error("invalidSettings");
    return { catalog, view };
  },
  history: (scope: SetupScope, target: OperatingTarget, cursor?: string) =>
    setupCall("settings_history_get_v1", {
      ...settingsQuery(scope, target),
      ...(cursor ? { cursor } : {}),
    }),
  reset: (scope: SetupScope, target: OperatingTarget, key: OperatingKey) =>
    setupCall("settings_reset_preview_v1", { ...settingsQuery(scope, target), fields: [key] }),
};
export type OperatingApi = typeof operatingApi;
export function isOperatingKey(key: string): key is OperatingKey {
  return Object.hasOwn(operatingFields, key);
}
function validValue(key: OperatingKey, value: unknown) {
  if (key === "program_duration_minutes")
    return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 2147483647;
  if (key.endsWith("email"))
    return (
      value === null ||
      (typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    );
  if (typeof value !== "string" || value.length > operatingFields[key]) return false;
  if (key === "contact_phone" && value !== "")
    return /^\+[1-9]\d{1,14}$/.test(value) && parsePhoneNumberFromString(value)?.isValid() === true;
  return true;
}
export function operatingPatch(key: OperatingKey, text: string) {
  let value: string | number | null = text;
  if (key === "program_duration_minutes") {
    if (!/^[1-9]\d*$/.test(text)) throw Error("invalidSettings");
    value = Number(text);
  } else if (key.endsWith("email")) {
    value = text.trim() || null;
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw Error("invalidSettings");
  } else if (key === "contact_phone" && text.trim()) {
    const phone = parsePhoneNumberFromString(text, "TR");
    if (!phone?.isValid()) throw Error("invalidSettings");
    value = phone.number;
  }
  if (!validValue(key, value)) throw Error("invalidSettings");
  return { [key]: value };
}
export function operatingCommand(
  scope: SetupScope,
  target: OperatingTarget,
  key: OperatingKey,
  text: string,
  source: { catalog: SettingsCatalog; view: SettingsView },
  reason: string,
) {
  if (
    source.catalog.scope !== target ||
    source.view.scope !== target ||
    !source.catalog.fields.some((f) => f.key === key && f.writable) ||
    !Number.isSafeInteger(source.view.version) ||
    source.view.version < 0 ||
    reason.length > 10000 ||
    (target === "center" && key.startsWith("billing_")) ||
    !reason.trim()
  )
    throw Error("invalidSettings");
  return {
    operation: "settings_update_v1" as const,
    input: {
      ...settingsQuery(scope, target),
      operation_key: v7(),
      expected_version: source.view.version,
      patch: operatingPatch(key, text),
      reason: reason.trim(),
    } as SetupInput<"settings_update_v1">,
  };
}
export function operatingSlot(target: OperatingTarget) {
  return `operating-settings:${target}`;
}
export function validOperating(
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  const target = input.scope;
  if (
    (target !== "organization" && target !== "center") ||
    slot !== operatingSlot(target) ||
    (target === "center"
      ? !centerId || input.center_id !== centerId
      : input.center_id !== undefined || centerId !== undefined) ||
    !Number.isSafeInteger(input.expected_version) ||
    Number(input.expected_version) < 0 ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 10000
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
  const p = input.patch;
  if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).length !== 1) return false;
  return Object.entries(p).every(
    ([key, value]) =>
      isOperatingKey(key) &&
      !(target === "center" && key.startsWith("billing_")) &&
      validValue(key, value),
  );
}
export function writableOperating(catalog: SettingsCatalog) {
  return catalog.fields.filter(
    (f): f is typeof f & { key: OperatingKey } =>
      isOperatingKey(f.key) && !(catalog.scope === "center" && f.key.startsWith("billing_")),
  );
}
export function operatingValue(values: object, key: SettingsFieldKey) {
  return Object.entries(values).find(([name]) => name === key)?.[1] as unknown;
}
