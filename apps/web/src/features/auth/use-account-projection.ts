import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { accountQuery } from "./account-query";

// Read the native actor from the committed guarded route, not from a second
// getSession call or a backend account UUID. Only protected routes may use this.
export function useAccountProjection(includePlatformScope = false) {
  const authUserId = useRouterState({
    select: (state) => {
      const context: unknown = state.matches[state.matches.length - 1]?.context;
      if (
        context &&
        typeof context === "object" &&
        "authUserId" in context &&
        typeof context.authUserId === "string"
      )
        return context.authUserId;
      return undefined;
    },
  });
  if (!authUserId) throw new Error("AUTH_CONTEXT_REQUIRED");
  return useSuspenseQuery(accountQuery(authUserId, includePlatformScope)).data;
}
