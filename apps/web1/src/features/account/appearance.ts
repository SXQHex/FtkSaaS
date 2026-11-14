import { v7 as uuidv7 } from "uuid";
import { getBackend } from "../../lib/backend";
import type { UserSettingsValues } from "../../lib/api-contracts/generated";

export type ThemeChoice = NonNullable<UserSettingsValues["theme"]>;
interface AppearanceValues {
  theme: ThemeChoice;
  font_scale: number | null;
}
export interface AppearanceSnapshot {
  values: AppearanceValues;
  version: number;
  writable: Record<keyof AppearanceValues, boolean>;
}
export type AppearanceChange =
  | { field: "theme"; value: ThemeChoice }
  | { field: "font_scale"; value: number | null };
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
  const { theme, font_scale: fontScale } = settings.values;
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
  function writable(key: keyof AppearanceValues) {
    const fields = catalog.fields.filter((field) => field.key === key);
    return fields.length === 1 && fields[0].writable && fields[0].consumer === "frontend";
  }
  return {
    values: { theme, font_scale: fontScale },
    version: settings.version,
    writable: { theme: writable("theme"), font_scale: writable("font_scale") },
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
    patch: change.field === "theme" ? { theme: change.value } : { font_scale: change.value },
  });
}
