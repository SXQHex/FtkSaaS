import { v7 as uuidv7 } from "uuid";
import { getBackend } from "../../lib/backend";
import type { UserSettingsValues } from "../../lib/api-contracts/generated";

export type ThemeChoice = NonNullable<UserSettingsValues["theme"]>;
interface AppearanceValues {
  theme: ThemeChoice;
  font_scale: number | null;
  language: string;
  week_start: "monday" | "sunday";
  contrast: "system" | "high";
  timezone_mode: "auto" | "manual";
  timezone_name: string | null;
}
export interface AppearanceSnapshot {
  values: AppearanceValues;
  version: number;
  writable: Record<keyof AppearanceValues, boolean>;
}
export type AppearanceChange = {
  [K in Exclude<keyof AppearanceValues, "timezone_mode">]: { field: K; value: AppearanceValues[K] };
}[Exclude<keyof AppearanceValues, "timezone_mode">];
export interface AppearanceIntent {
  change: AppearanceChange;
  version: number;
  key: string;
}
export async function readAppearance(): Promise<AppearanceSnapshot> {
  const backend = getBackend();
  const [catalog, settings] = await Promise.all([
    backend.call("settings_catalog_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      scope: "user",
    }),
    backend.call("settings_get_v1", { client_api_version: 1, request_id: uuidv7(), scope: "user" }),
  ]);
  if (
    catalog.scope !== "user" ||
    settings.scope !== "user" ||
    !Number.isSafeInteger(settings.version) ||
    settings.version < 0
  )
    throw new Error("APPEARANCE_UNAVAILABLE");
  const {
    theme,
    font_scale: fontScale,
    language,
    week_start,
    contrast,
    timezone_mode,
    timezone_name,
  } = settings.values;
  if (theme !== "system" && theme !== "light" && theme !== "dark")
    throw new Error("APPEARANCE_UNAVAILABLE");
  if (
    fontScale !== null &&
    (typeof fontScale !== "number" ||
      !Number.isFinite(fontScale) ||
      fontScale < 0.75 ||
      fontScale > 2)
  )
    throw new Error("APPEARANCE_UNAVAILABLE");
  if (
    typeof language !== "string" ||
    !/^(auto|[a-z]{2,8}(-[a-z0-9]{1,8})*)$/.test(language) ||
    language.length > 35 ||
    (week_start !== "monday" && week_start !== "sunday") ||
    (contrast !== "system" && contrast !== "high") ||
    (timezone_mode !== "auto" && timezone_mode !== "manual") ||
    (timezone_name !== null && typeof timezone_name !== "string") ||
    (timezone_mode === "manual" && !timezone_name)
  )
    throw new Error("APPEARANCE_UNAVAILABLE");
  function writable(key: keyof AppearanceValues) {
    const fields = catalog.fields.filter((field) => field.key === key);
    return (
      fields.length === 1 &&
      fields[0].writable &&
      fields[0].consumer === (key === "language" ? "user_content_language" : "frontend")
    );
  }
  return {
    values: {
      theme,
      font_scale: fontScale,
      language,
      week_start,
      contrast,
      timezone_mode,
      timezone_name,
    },
    version: settings.version,
    writable: {
      theme: writable("theme"),
      font_scale: writable("font_scale"),
      language: writable("language"),
      week_start: writable("week_start"),
      contrast: writable("contrast"),
      timezone_mode: writable("timezone_mode"),
      timezone_name: writable("timezone_mode") && writable("timezone_name"),
    },
  };
}
export function saveAppearance(intent: AppearanceIntent) {
  const { change } = intent;
  return getBackend().call("settings_update_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    scope: "user",
    expected_version: intent.version,
    operation_key: intent.key,
    patch:
      change.field === "timezone_name"
        ? { timezone_mode: change.value === null ? "auto" : "manual", timezone_name: change.value }
        : { [change.field]: change.value },
  });
}
