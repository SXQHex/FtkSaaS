import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";

export async function readOrganizationSettingsCatalog(scope: ClientScope) {
  const backend = await scopedBackend(scope);
  try {
    const catalog = await backend.call("settings_catalog_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      scope: "organization",
    });
    if (
      catalog.scope !== "organization" ||
      !Array.isArray(catalog.fields) ||
      catalog.fields.some(
        (field) => typeof field.key !== "string" || typeof field.writable !== "boolean",
      )
    )
      throw new Error("SETTINGS_SOURCE_UNAVAILABLE");
    return { state: "known" as const, catalog };
  } catch (error) {
    if (error instanceof BackendError && error.code === "FORBIDDEN")
      return { state: "forbidden" as const };
    throw error;
  }
}
