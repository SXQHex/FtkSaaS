import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export async function invalidateAccessDirectories(queries: QueryClient, scope: ClientScope) {
  const tenant = [scope.accountId, scope.orgId, scope.centerId] as const;
  await Promise.all(
    ["access-invitations", "access-accounts"].map((family) =>
      queries.invalidateQueries({ queryKey: [family, ...tenant], refetchType: "none" }),
    ),
  );
}
