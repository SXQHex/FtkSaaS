import type { RoleView, ManagementStateView } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";

export async function getSetupRoles(
  scope: Pick<SetupScope, "orgId" | "centerId">,
): Promise<RoleView[]> {
  const plan = await setupCall("subscription_get_v1", { org_id: scope.orgId });
  const rows: RoleView[] = [];
  let cursor: string | null | undefined;
  do {
    if (plan.plan !== "starter") {
      const page = await setupCall("roles_list_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
      });
      rows.push(...page.items);
      cursor = page.next_cursor;
    } else {
      const page = await setupCall("management_state_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId!,
        operation: "role_assign_v1",
        selector: {
          operation: "role_assign_v1",
          key: { role: "instructor", scope: { center_id: scope.centerId! } },
        },
        page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
      });
      for (const item of page.items) {
        const values = item.current?.operation === "role_assign_v1" ? item.current.values : null;
        const version = item.versions.find(
          (v) => v.entity.type === "role_assignments" && v.entity.id === item.entity?.id,
        )?.version;
        if (
          item.operation !== "role_assign_v1" ||
          !item.exists ||
          item.entity?.type !== "role_assignments" ||
          !version ||
          !values?.person_id ||
          values.role !== "instructor" ||
          values.scope?.center_id !== scope.centerId ||
          !["active", "inactive"].includes(item.state ?? "")
        )
          throw new Error("Unreadable instructor assignment");
        rows.push({
          id: item.entity.id,
          person_id: values.person_id,
          role: "instructor",
          scope_center_id: scope.centerId!,
          state: item.state as "active" | "inactive",
          version,
        });
      }
      cursor = page.next_cursor;
    }
  } while (cursor);
  return rows;
}

export async function getInstructorTasks(
  scope: Pick<SetupScope, "orgId" | "centerId">,
): Promise<ManagementStateView[]> {
  const rows: ManagementStateView[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId!,
      operation: "session_assignment_set_v1",
      selector: { operation: "session_assignment_set_v1", key: {} },
      page: { limit: 50, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    rows.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return rows;
}
