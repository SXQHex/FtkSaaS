import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { studioBackend, type StudioScope } from "./studio";
import type { ManagementStateView, ResourceRef } from "../../lib/api-contracts/generated";

export interface ResourceLifecycleSelection {
  kind: "rule" | "closure";
  id: string;
  resource: ResourceRef;
  label: string;
}
export interface ResourceLifecycleBase {
  scope: StudioScope;
  selection: ResourceLifecycleSelection;
  current: ManagementStateView;
  version: number;
  active: boolean;
}
export interface ResourceLifecycleIntent {
  scope: StudioScope;
  selection: ResourceLifecycleSelection;
  version: number;
  reason: string;
  key: string;
}
export async function readResourceLifecycle(
  scope: StudioScope,
  selection: ResourceLifecycleSelection,
): Promise<ResourceLifecycleBase> {
  const backend = await studioBackend(scope);
  const selector =
    selection.kind === "rule"
      ? {
          operation: "availability_save_v1" as const,
          key: { resource: selection.resource, rule_id: selection.id },
        }
      : {
          operation: "availability_exception_save_v1" as const,
          key: { resource: selection.resource },
        };
  let cursor: string | undefined;
  let current: ManagementStateView | undefined;
  do {
    const page = await backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: selector.operation,
      selector,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    const matches = page.items.filter((item) => item.entity?.id === selection.id);
    if (matches.length > 1) throw new Error("STUDIO_UNAVAILABLE");
    current = matches[0];
    if (current) break;
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  const projection = current?.current;
  const entityType = selection.kind === "rule" ? "availability_rules" : "availability_exceptions";
  if (
    !current?.exists ||
    current.operation !== selector.operation ||
    current.entity?.type !== entityType ||
    projection?.operation !== selector.operation
  )
    throw new Error("STUDIO_UNAVAILABLE");
  if (
    (projection.operation === "availability_save_v1" && !projection.values.rule) ||
    (projection.operation === "availability_exception_save_v1" && !projection.values.interval)
  )
    throw new Error("STUDIO_UNAVAILABLE");
  const values = projection.values;
  if (
    values.resource?.kind !== selection.resource.kind ||
    values.resource.id !== selection.resource.id
  )
    throw new Error("STUDIO_UNAVAILABLE");
  const id =
    "rule_id" in values
      ? values.rule_id
      : "exception_id" in values
        ? values.exception_id
        : undefined;
  if (id !== selection.id) throw new Error("STUDIO_UNAVAILABLE");
  if (
    current.state !== "active" &&
    current.state !== (selection.kind === "rule" ? "inactive" : "cancelled")
  )
    throw new Error("STUDIO_UNAVAILABLE");
  const versions = current.versions.filter(
    (entry) =>
      entry.entity.type === (selection.kind === "rule" ? "availability_rules" : "centers") &&
      entry.entity.id === (selection.kind === "rule" ? selection.id : scope.centerId),
  );
  const version = versions[0]?.version;
  if (versions.length !== 1 || !version || !Number.isSafeInteger(version) || version < 1)
    throw new Error("STUDIO_UNAVAILABLE");
  return {
    scope: { ...scope },
    selection: { ...selection, resource: { ...selection.resource } },
    current,
    version,
    active: current.state === "active",
  };
}
export function resourceLifecycleIntent(
  base: ResourceLifecycleBase,
  reason: string,
): ResourceLifecycleIntent {
  if (!base.active) throw new Error("STUDIO_LIFECYCLE_CLOSED");
  return {
    scope: { ...base.scope },
    selection: { ...base.selection, resource: { ...base.selection.resource } },
    version: base.version,
    reason: z.string().trim().min(1, "REASON_REQUIRED").parse(reason),
    key: uuidv7(),
  };
}
export async function writeResourceLifecycle(intent: ResourceLifecycleIntent) {
  const backend = await studioBackend(intent.scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    expected_version: intent.version,
    resource: intent.selection.resource,
    reason: intent.reason,
  };
  const receipt =
    intent.selection.kind === "rule"
      ? await backend.call("availability_save_v1", {
          ...common,
          action: "retire",
          rule_id: intent.selection.id,
        })
      : await backend.call("availability_exception_save_v1", {
          ...common,
          action: "cancel",
          exception_id: intent.selection.id,
        });
  if (receipt.primary_id !== intent.selection.id) throw new Error("STUDIO_ACK_UNAVAILABLE");
}
export async function rereadResourceLifecycle(intent: ResourceLifecycleIntent) {
  const current = await readResourceLifecycle(intent.scope, intent.selection);
  if (current.active || current.version <= intent.version)
    throw new Error("STUDIO_LIFECYCLE_UNREAD");
  return current;
}
