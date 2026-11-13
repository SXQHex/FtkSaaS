import { v7 as uuidv7 } from "uuid";
import { getBackend } from "../../lib/backend";
import type { UserSettingsValues } from "../../lib/api-contracts/generated";

export type ThemeChoice = NonNullable<UserSettingsValues["theme"]>;
export interface ThemeSnapshot {
  theme: ThemeChoice;
  version: number;
  writable: boolean;
}
export interface ThemeIntent {
  theme: ThemeChoice;
  version: number;
  key: string;
}
export async function readTheme(): Promise<ThemeSnapshot> {
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
    throw new Error("THEME_UNAVAILABLE");
  const theme = settings.values.theme;
  if (theme !== "system" && theme !== "light" && theme !== "dark")
    throw new Error("THEME_UNAVAILABLE");
  const descriptors = catalog.fields.filter((field) => field.key === "theme");
  return {
    theme,
    version: settings.version,
    writable:
      descriptors.length === 1 && descriptors[0].writable && descriptors[0].consumer === "frontend",
  };
}
export function saveTheme(intent: ThemeIntent) {
  return getBackend().call("settings_update_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    scope: "user",
    expected_version: intent.version,
    operation_key: intent.key,
    patch: { theme: intent.theme },
  });
}
