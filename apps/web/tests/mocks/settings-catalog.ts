import schema from "@ftksaas/api-contracts/schema";
import type { SettingsCatalog } from "@ftksaas/api-contracts";

// JSON imports widen numbers; the generated type and value share this schema.
export const settingsCatalogVersion = schema.$defs.SettingsCatalog.properties.catalog_version
  .const as SettingsCatalog["catalog_version"];
