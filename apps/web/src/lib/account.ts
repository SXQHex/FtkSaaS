import { v7 as uuidv7 } from "uuid";
import { getBackend } from "./backend";

export function readAccount(includePlatformScope = false, accessToken?: string) {
  return getBackend(accessToken).call("account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    ...(includePlatformScope ? { include_platform_scope: true } : {}),
  });
}
