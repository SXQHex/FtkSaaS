import { v7 as uuidv7 } from "uuid";
import { getBackend } from "./backend";

export function readAccount() {
  return getBackend().call("account_get_v1", { client_api_version: 1, request_id: uuidv7() });
}
