import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export async function invalidateEarningsViews(queries: QueryClient, scope: ClientScope) {
  await Promise.all(
    ["earnings-directory", "earnings-instructor-catalog", "earnings-visible-counts"].map((family) =>
      queries.invalidateQueries({ queryKey: [family, scope], refetchType: "none" }),
    ),
  );
}
