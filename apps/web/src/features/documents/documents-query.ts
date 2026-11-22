import type { QueryClient } from "@tanstack/react-query";
import { retainFirstInfinitePage } from "../../lib/cache-invalidation";
import type { ClientScope } from "../../lib/scoped-backend";

// These keys are owned by the document workspace. Native translations use their
// own query because they are not pages in the document-directory cursor.
const documentFamilies = new Set([
  "document-directory",
  "document-catalog",
  "document-versions",
  "native-document-catalog",
]);

function affectedDocumentKey(
  key: readonly unknown[],
  scope: ClientScope,
  publishedScope: "center" | "organization",
) {
  const keyScope = key[1];
  if (
    typeof key[0] !== "string" ||
    !documentFamilies.has(key[0]) ||
    !keyScope ||
    typeof keyScope !== "object"
  )
    return false;
  return (
    "accountId" in keyScope &&
    keyScope.accountId === scope.accountId &&
    "orgId" in keyScope &&
    keyScope.orgId === scope.orgId &&
    (publishedScope === "organization" ||
      ("centerId" in keyScope && keyScope.centerId === scope.centerId))
  );
}

export async function invalidateDocumentDirectoryViews(
  queries: QueryClient,
  scope: ClientScope,
  publishedScope: "center" | "organization" = "center",
) {
  const affected = (key: readonly unknown[]) => affectedDocumentKey(key, scope, publishedScope);

  // Inactive catalog/version variants can also have old continuation cursors.
  // Trim every affected infinite query before invalidation: setQueryData clears
  // isInvalidated, and an untrimmed infinite refetch would replay old cursors.
  for (const { queryKey } of queries.getQueryCache().findAll({
    predicate: ({ queryKey }) => affected(queryKey),
  })) {
    if (queryKey[0] === "document-catalog" || queryKey[0] === "document-versions")
      retainFirstInfinitePage(queries, queryKey);
  }

  // An organization document is inherited by every center in that organization;
  // a center document affects only that center. Never touch another actor/org.
  // Do not refetch every old filter/page. The caller reads the visible first
  // page after native write, receipt and result readback.
  await queries.invalidateQueries({
    predicate: ({ queryKey }) => affected(queryKey),
    refetchType: "none",
  });
}
