import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export const accessKeys = {
  invitations: (scope: ClientScope) =>
    ["access-invitations", scope.accountId, scope.orgId, scope.centerId] as const,
  accounts: (scope: ClientScope) =>
    ["access-accounts", scope.accountId, scope.orgId, scope.centerId] as const,
};

export async function invalidateAccessDirectories(queries: QueryClient, scope: ClientScope) {
  const prefixes = [accessKeys.invitations(scope), accessKeys.accounts(scope)];

  // A read started before a confirmed native write must not overwrite the
  // subsequent first-page readback, even when its transport ignores AbortSignal.
  // Cancellation and invalidation touch only the current actor and center.
  await Promise.all(prefixes.map((queryKey) => queries.cancelQueries({ queryKey })));
  await Promise.all(
    prefixes.map((queryKey) => queries.invalidateQueries({ queryKey, refetchType: "none" })),
  );
}
