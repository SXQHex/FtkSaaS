import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { PreferenceId } from "./member-account-view";
export const preferenceFields = {
  inApp: "in_app_reminders",
  package: "package_reminders_enabled",
  marketing: "in_app_marketing",
} as const;
export async function readMemberPreferences(scope: ClientScope) {
  const backend = await scopedBackend(scope),
    base = { client_api_version: 1 as const, org_id: scope.orgId };
  const [catalog, settings, notifications] = await Promise.all([
    backend.call("settings_catalog_get_v1", { ...base, request_id: uuidv7(), scope: "member" }),
    backend.call("settings_get_v1", { ...base, request_id: uuidv7(), scope: "member" }),
    backend.call("notifications_list_v1", {
      ...base,
      center_id: scope.centerId,
      request_id: uuidv7(),
      page: { limit: 1 },
      unread_only: false,
    }),
  ]);
  if (
    settings.scope !== "member" ||
    catalog.scope !== "member" ||
    !Number.isSafeInteger(settings.version) ||
    settings.version < 0
  )
    throw new Error("PREFERENCES_UNAVAILABLE");
  const rows = Object.entries(preferenceFields).map(([id, field]) => {
    const descriptor = catalog.fields.filter((row) => row.key === field),
      value = settings.values[field];
    return {
      id: id as keyof typeof preferenceFields,
      selected: typeof value === "boolean" ? value : undefined,
      version: settings.version,
      writable: descriptor.length === 1 && descriptor[0].writable && id !== "marketing",
    };
  });
  const email = notifications.reminder_email_preference;
  return {
    rows: [
      ...rows,
      {
        id: "email" as const,
        selected: email?.enabled,
        version: email?.version,
        writable: email?.available === true,
      },
      {
        id: "mandatory" as const,
        selected: catalog.notification_delivery?.transactional_in_app_required,
        version: undefined,
        writable: false,
      },
    ],
  };
}
export type PreferencesSnapshot = Awaited<ReturnType<typeof readMemberPreferences>>;
export interface PreferenceIntent {
  scope: ClientScope;
  id: Exclude<PreferenceId, "mandatory" | "marketing">;
  enabled: boolean;
  version: number;
  key: string;
}
export async function writeMemberPreference(intent: PreferenceIntent) {
  const backend = await scopedBackend(intent.scope),
    base = {
      client_api_version: 1 as const,
      org_id: intent.scope.orgId,
      request_id: uuidv7(),
      operation_key: intent.key,
      expected_version: intent.version,
    };
  if (intent.id === "email")
    return backend.call("notification_preferences_set_v1", {
      ...base,
      center_id: intent.scope.centerId,
      channel: "email",
      purpose: "reminder",
      enabled: intent.enabled,
    });
  return backend.call("settings_update_v1", {
    ...base,
    scope: "member",
    patch: { [preferenceFields[intent.id]]: intent.enabled },
  });
}
export async function readMemberPreferenceReceipt(intent: PreferenceIntent) {
  const backend = await scopedBackend(intent.scope);
  const operation =
    intent.id === "email" ? "notification_preferences_set_v1" : "settings_update_v1";
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation,
    key: intent.key,
  });
  if (receipt.operation !== operation || receipt.key !== intent.key)
    throw new Error("PREFERENCE_RECEIPT_MISMATCH");
  return receipt;
}
