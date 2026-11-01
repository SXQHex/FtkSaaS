import type { ManagementStateView, Operations } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { apiClient, ApiFailure, getOperationStatus } from "./api";
import type { StudentScope } from "./students";
export type AccessOperation = "account_access_revoke_v1" | "account_link_remove_v1";
type Input<O extends AccessOperation> = Omit<
  Operations[O]["request"],
  "client_api_version" | "request_id"
>;
export type AccessCommand =
  | { operation: "account_access_revoke_v1"; input: Input<"account_access_revoke_v1"> }
  | { operation: "account_link_remove_v1"; input: Input<"account_link_remove_v1"> };
export async function listPersonAccess(
  scope: StudentScope,
  personId: string,
  operation: AccessOperation,
  cursor?: string,
) {
  const result = await apiClient().call("management_state_get_v1", {
    client_api_version: 1,
    request_id: v7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation,
    selector: { operation, key: { person_id: personId } },
    page: { limit: 25, ...(cursor ? { cursor } : {}) },
  });
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export async function changePersonAccess(command: AccessCommand) {
  const header = { client_api_version: 1 as const, request_id: v7() };
  const result =
    command.operation === "account_access_revoke_v1"
      ? await apiClient().call(command.operation, { ...header, ...command.input })
      : await apiClient().call(command.operation, { ...header, ...command.input });
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export function accessTarget(item: ManagementStateView, operation: AccessOperation) {
  const current = item.current;
  const type = operation === "account_access_revoke_v1" ? "invitations" : "account_links";
  if (
    !item.exists ||
    item.operation !== operation ||
    current?.operation !== operation ||
    !item.entity ||
    item.entity.type !== type
  )
    return null;
  const id =
    current.operation === "account_access_revoke_v1"
      ? current.values.invitation_id
      : current.values.link_id;
  const version = item.versions.find((v) => v.entity.id === id && v.entity.type === type)?.version;
  if (id !== item.entity.id || !version || !Number.isSafeInteger(version)) return null;
  return { id, version, actionable: current.values.actionable === true };
}
export const accessActions = {
  list: listPersonAccess,
  save: changePersonAccess,
  status: getOperationStatus,
};
export type AccessActions = typeof accessActions;
export type PendingAccess = { command: AccessCommand; blocked?: boolean };
export const accessStorageKey = (
  scope: StudentScope,
  personId: string,
  operation: AccessOperation,
) =>
  `ftksaas:person-access:${scope.actorId}:${scope.orgId}:${scope.centerId}:${personId}:${operation}`;
export function recoverAccess(
  key: string,
  scope: StudentScope,
  operation: AccessOperation,
): PendingAccess | "invalid" | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value === null) return null;
    const c = value.command;
    const input = c?.input;
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
    const targetUuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
    const target = operation === "account_access_revoke_v1" ? "invitation_id" : "link_id";
    if (
      c?.operation !== operation ||
      input?.org_id !== scope.orgId ||
      input.center_id !== scope.centerId ||
      !uuid.test(input.operation_key) ||
      !targetUuid.test(input[target]) ||
      !Number.isSafeInteger(input.expected_version) ||
      input.expected_version < 1 ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean") ||
      Object.keys(input).some(
        (k) =>
          ![
            "org_id",
            "center_id",
            "operation_key",
            "expected_version",
            target,
            ...(operation === "account_link_remove_v1" ? ["reason"] : []),
          ].includes(k),
      ) ||
      (operation === "account_link_remove_v1" &&
        (typeof input.reason !== "string" || !input.reason.trim()))
    )
      return "invalid";
    return { command: c, blocked: value.blocked };
  } catch {
    return "invalid";
  }
}
