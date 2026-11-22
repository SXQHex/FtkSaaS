import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { invalidateDocumentDirectoryViews } from "./documents-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const otherCenter = { ...scope, centerId: "center-b" };
const otherOrg = { ...scope, orgId: "org-b" };
const otherActor = { ...scope, accountId: "actor-b" };
const directory = (
  source: typeof scope,
  search = "",
  cursor?: string,
) => ["document-directory", source, "center", "documents", "", "", "all", search, cursor];
const catalog = (source: typeof scope, level: "center" | "organization" = "center") =>
  ["document-catalog", source, level];
const versions = (
  source: typeof scope,
  level: "center" | "organization" = "center",
  documentId = "doc-a",
) => ["document-versions", source, level, documentId];
const infinite = () => ({
  pages: [{ items: ["first"], next_cursor: "cursor-2" }, { items: ["old"], next_cursor: null }],
  pageParams: [undefined, "cursor-2"],
});

it("M02: native publication stales all old document cursor/filter variants without a refetch storm", async () => {
  const queries = new QueryClient();
  const first = directory(scope);
  const old = directory(scope, "", "cursor-2");
  const filtered = directory(scope, "another filter", "cursor-3");
  const other = directory(otherCenter, "", "cursor-2");
  for (const key of [first, old, filtered, other])
    queries.setQueryData(key, { revision: "before" });

  const oldReader = vi.fn(async () => ({ revision: "after" }));
  const stop = new QueryObserver(queries, {
    queryKey: old,
    queryFn: oldReader,
    staleTime: Infinity,
  }).subscribe(() => {});

  await invalidateDocumentDirectoryViews(queries, scope, "center");
  for (const key of [first, old, filtered])
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(other)?.isInvalidated).toBe(false);
  expect(oldReader).not.toHaveBeenCalled();

  // The required visible first page is reread; an older page is fetched only
  // when the user actually navigates back to its cached cursor.
  const firstReader = vi.fn(async () => ({ revision: "after" }));
  await expect(
    queries.fetchQuery({ queryKey: first, queryFn: firstReader, staleTime: 0, retry: false }),
  ).resolves.toEqual({ revision: "after" });
  expect(oldReader).not.toHaveBeenCalled();
  await expect(
    queries.fetchQuery({ queryKey: old, queryFn: oldReader, staleTime: Infinity, retry: false }),
  ).resolves.toEqual({ revision: "after" });
  expect(firstReader).toHaveBeenCalledTimes(1);
  expect(oldReader).toHaveBeenCalledTimes(1);
  stop();
});

it("M02: inactive catalog and version continuations are trimmed before all affected variants go stale", async () => {
  const queries = new QueryClient();
  const keys = [
    catalog(scope, "center"),
    catalog(scope, "organization"),
    versions(scope, "center", "doc-a"),
    versions(scope, "organization", "doc-b"),
  ];
  for (const key of keys) queries.setQueryData(key, infinite());
  const translationKey = ["native-document-catalog", scope, false, "doc-a"];
  queries.setQueryData(translationKey, [{ version: 1 }]);
  const otherKey = catalog(otherCenter);
  queries.setQueryData(otherKey, infinite());

  await invalidateDocumentDirectoryViews(queries, scope);
  for (const key of keys) {
    expect(queries.getQueryData(key)).toEqual({
      pages: [{ items: ["first"], next_cursor: "cursor-2" }],
      pageParams: [undefined],
    });
    // setQueryData during trimming must not clear the final stale marker.
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  }
  expect(queries.getQueryState(translationKey)?.isInvalidated).toBe(true);
  expect(queries.getQueryData(otherKey)).toEqual(infinite());
  expect(queries.getQueryState(otherKey)?.isInvalidated).toBe(false);
});

it("M02: organization publication reaches shared documents in the same org, not another org or actor", async () => {
  const queries = new QueryClient();
  const owned = directory(scope, "", "cursor-2");
  const inherited = directory(otherCenter, "", "cursor-2");
  const inheritedVersions = versions(otherCenter, "organization", "org-doc");
  const foreignOrg = directory(otherOrg, "", "cursor-2");
  const foreignActor = directory(otherActor, "", "cursor-2");
  for (const key of [owned, inherited, foreignOrg, foreignActor])
    queries.setQueryData(key, { revision: "before" });
  queries.setQueryData(inheritedVersions, infinite());

  await invalidateDocumentDirectoryViews(queries, scope, "center");
  expect(queries.getQueryState(inherited)?.isInvalidated).toBe(false);
  await invalidateDocumentDirectoryViews(queries, scope, "organization");

  for (const key of [owned, inherited, inheritedVersions])
    expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  expect(queries.getQueryData(inheritedVersions)).toEqual({
    pages: [{ items: ["first"], next_cursor: "cursor-2" }],
    pageParams: [undefined],
  });
  for (const key of [foreignOrg, foreignActor])
    expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
});

it("M02: a failed mandatory first-page readback never makes an old cursor fresh", async () => {
  const queries = new QueryClient();
  const first = directory(scope);
  const old = directory(scope, "", "cursor-2");
  queries.setQueryData(first, { revision: "before" });
  queries.setQueryData(old, { revision: "before" });
  await invalidateDocumentDirectoryViews(queries, scope);

  const error = new Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
  await expect(
    queries.fetchQuery({
      queryKey: first,
      queryFn: async () => {
        throw error;
      },
      staleTime: 0,
      retry: false,
    }),
  ).rejects.toBe(error);
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryData(old)).toEqual({ revision: "before" });
});
