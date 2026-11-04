import { setupCall, type SetupScope } from "./studio-setup";
export async function readNotificationPreferences(scope: SetupScope) {
  const query = { scope: "member" as const, org_id: scope.orgId };
  const [catalog, view] = await Promise.all([
    setupCall("settings_catalog_get_v1", query),
    setupCall("settings_get_v1", query),
  ]);
  if (
    catalog.scope !== "member" ||
    view.scope !== "member" ||
    !Number.isSafeInteger(view.version) ||
    view.version < 0 ||
    typeof view.values.in_app_marketing !== "boolean"
  )
    throw Error("invalidPreferences");
  return {
    version: view.version,
    enabled: view.values.in_app_marketing,
    writable:
      catalog.notification_delivery?.channels.in_app === true &&
      catalog.fields.some((field) => field.key === "in_app_marketing" && field.writable),
  };
}
