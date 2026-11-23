import { queryOptions } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";

export function readOrganizationSettingsCatalogQuery(
  scope: Pick<ClientScope, "accountId" | "orgId">,
) {
  return queryOptions({
    queryKey: ["settings-organization-catalog", scope.accountId, scope.orgId],
    queryFn: (context) => readOrganizationSettingsCatalog(scope, context),
    retry: false,
  });
}

export async function readOrganizationSettingsCatalog(
  scope: Pick<ClientScope, "accountId" | "orgId">,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
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
      return { state: "forbidden" as const, error };
    throw error;
  }
}
