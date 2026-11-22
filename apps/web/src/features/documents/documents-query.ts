import type { QueryClient } from "@tanstack/react-query";
import type { ClientScope } from "../../lib/scoped-backend";

export async function invalidateDocumentDirectoryViews(queries: QueryClient, scope: ClientScope) {
  await Promise.all(
    ["document-directory", "document-catalog", "document-versions"].map((family) =>
      queries.invalidateQueries({ queryKey: [family, scope], refetchType: "none" }),
    ),
  );
}
