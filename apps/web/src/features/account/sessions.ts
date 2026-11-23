import { v7 as uuidv7 } from "uuid";
import { getBackend, queryBackendRead } from "../../lib/backend";

export function readSessions(cursor?: string, signal?: AbortSignal) {
  return queryBackendRead(
    getBackend(),
    "account_sessions_list_v1",
    { client_api_version: 1, request_id: uuidv7(), ...(cursor ? { cursor } : {}) },
    signal,
  );
}

export function saveSessionLabel(input: {
  sessionId: string;
  version: number;
  label: string;
  operationKey: string;
}) {
  const label = input.label.trim();
  if (Array.from(label).length > 80) return Promise.reject(new Error("LABEL_INVALID"));
  return getBackend().call("account_session_label_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    session_id: input.sessionId,
    expected_version: input.version,
    operation_key: input.operationKey,
    label: label || null,
  });
}

export function revokeSession(sessionId: string, operationKey: string, accessToken?: string) {
  const backend = accessToken ? getBackend(accessToken) : getBackend();
  return backend.call("account_sessions_revoke_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    mode: "selected",
    session_id: sessionId,
    operation_key: operationKey,
  });
}
