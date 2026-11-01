import { v7 } from "uuid";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import type { AccessActions, AccessOperation } from "../../lib/person-access";
// Fictional data for the public design route; never used by the live workspace.
export function createSampleAccessActions(): AccessActions {
  const records = new Map<string, ManagementStateView>();
  const completed = new Map<string, AccessOperation>();
  return {
    list: async (_scope, personId, operation) => {
      const id = v7();
      const key = `${personId}:${operation}`;
      if (!records.has(key)) {
        const entity = {
          type:
            operation === "account_access_revoke_v1"
              ? ("invitations" as const)
              : ("account_links" as const),
          id,
        };
        records.set(key, {
          operation,
          entity,
          exists: true,
          state: operation === "account_access_revoke_v1" ? "pending" : "active",
          versions: [{ entity, version: 1 }],
          as_of: "2030-10-29T00:00:00Z",
          current:
            operation === "account_access_revoke_v1"
              ? { operation, values: { person_id: personId, invitation_id: id, actionable: true } }
              : { operation, values: { person_id: personId, link_id: id, actionable: true } },
        });
      }
      return {
        items: [structuredClone(records.get(key)!)],
        next_cursor: null,
        as_of: "2030-10-29T00:00:00Z",
      };
    },
    save: async (command) => {
      const id =
        command.operation === "account_access_revoke_v1"
          ? command.input.invitation_id
          : command.input.link_id;
      const replayed = completed.has(command.input.operation_key);
      if (!replayed) {
        for (const item of records.values()) {
          if (item.operation !== command.operation || item.entity?.id !== id) continue;
          item.state = "revoked";
          item.versions[0].version++;
          if (
            item.current?.operation === "account_access_revoke_v1" ||
            item.current?.operation === "account_link_remove_v1"
          )
            item.current.values.actionable = false;
        }
        completed.set(command.input.operation_key, command.operation);
      }
      return { operation_id: command.input.operation_key, primary_id: id, related: [], replayed };
    },
    status: async (_org, operation, key) => ({
      operation,
      key,
      status: completed.has(key) ? "succeeded" : "in_progress",
      result_available: completed.has(key),
      result_reference: null,
    }),
  };
}
