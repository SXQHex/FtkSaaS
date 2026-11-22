import { useWorkspaceQuery } from "../workspace/workspace-query";
import { invalidateDocumentDirectoryViews } from "./documents-query";
import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { DocumentDirectoryDocument } from "@ftksaas/api-contracts";

import { DocumentsView, type DocumentRow, type DocumentAcceptanceRow } from "./documents-view";
import { DocumentCatalogPanel } from "./document-catalog-panel";
import { DocumentEditor } from "./document-editor";
import { DocumentDirectorySheet } from "./document-directory-sheet";
import { readDocumentDirectory, directoryDocuments, directoryVersions } from "./document-directory";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
export function DocumentsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [editor, setEditor] = useState<{ target?: DocumentDirectoryDocument } | undefined>(),
    [detail, setDetail] = useState<DocumentDirectoryDocument>(),
    [locked, setLocked] = useState(false),
    [lost, setLost] = useState(false),
    [saved, setSaved] = useState<string>();
  const [tab, setTab] = useState<"documents" | "acceptance" | "catalog">("documents"),
    [filter, setFilter] = useState<"pending" | "all">("pending"),
    [level, setLevel] = useState<"center" | "organization">("center"),
    [documentId, setDocument] = useState(""),
    [versionId, setVersion] = useState(""),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0);
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const current =
    (!workspace.isError || preservePending) &&
    workspace.data?.selected?.id === scope.orgId &&
    workspace.data.centers.some((row) => row.id === scope.centerId && row.accessible)
      ? workspace.data
      : undefined;
  const timezone = current?.centers.find((row) => row.id === scope.centerId)?.timezone;
  const active = !!current && !!timezone && !lost;
  const reset = () => {
    setCursors([undefined]);
    setIndex(0);
  };
  const catalog = useInfiniteQuery({
    queryKey: ["document-catalog", scope, level],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      readDocumentDirectory(scope, { view: "documents", level, cursor: pageParam }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: active,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const available = catalog.data?.pages.flatMap(directoryDocuments) ?? [];
  const catalogInvalid = new Set(available.map((row) => row.key)).size !== available.length;
  const selected = available.find((row) => row.document_id === documentId);
  const versionTarget = detail?.document_id
    ? detail
    : editor?.target?.document_id
      ? editor.target
      : selected;
  const versions = useInfiniteQuery({
    queryKey: ["document-versions", scope, level, versionTarget?.document_id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      readDocumentDirectory(scope, {
        view: "versions",
        level,
        documentId: versionTarget!.document_id!,
        cursor: pageParam,
      }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: active && !!versionTarget?.document_id && !versionTarget.read_only,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const versionRows = versions.data?.pages.flatMap(directoryVersions);
  const page = useQuery({
    queryKey: [
      "document-directory",
      scope,
      level,
      tab,
      documentId,
      versionId,
      filter,
      query,
      cursors[index],
    ],
    queryFn: () =>
      readDocumentDirectory(scope, {
        view: tab === "documents" ? "documents" : "acceptances",
        level,
        ...(tab === "acceptance" ? { documentId, versionId: versionId || undefined } : {}),
        filter: tab === "acceptance" ? filter : "all",
        query: query || undefined,
        cursor: cursors[index],
      }),
    enabled: active && (tab === "documents" || (tab === "acceptance" && !!documentId)),
    retry: false,
    // After a native readback, returning from an old cursor to page one must
    // reuse that just-verified page rather than issuing the same request again.
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  useEffect(() => () => onLockChange(false), [onLockChange]);
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          [
            "AUTH_REQUIRED",
            "SESSION_REVOKED",
            "FORBIDDEN",
            "NOT_FOUND",
            "PLAN_FEATURE_UNAVAILABLE",
          ].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        setLost(true);
        setEditor(undefined);
        setDetail(undefined);
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router],
  );
  const readDenied = [page.error, catalog.error, versions.error].some(
    (error) =>
      (error instanceof BackendError &&
        [
          "AUTH_REQUIRED",
          "SESSION_REVOKED",
          "FORBIDDEN",
          "NOT_FOUND",
          "PLAN_FEATURE_UNAVAILABLE",
        ].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message)),
  );
  const readable =
    active && !page.isError && (tab === "documents" || !!documentId) ? page.data : undefined;
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone!,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  const rawRows = readable ? directoryDocuments(readable) : [];
  const documents: DocumentRow[] | null =
    readable && tab === "documents"
      ? rawRows.map((row) => ({
          id: row.key,
          name: row.name,
          gates: row.latest_version?.requirements?.map((item) => item.gate),
          version: row.latest_version?.version_label,
          publishedAt: row.latest_version ? date(row.latest_version.published_at) : undefined,
          state:
            row.state === "published"
              ? "published"
              : row.state === "ready_unpublished"
                ? "draft"
                : row.state === "expired_upload"
                  ? "expired"
                  : row.state === "pending_upload"
                    ? "uploading"
                    : row.state === "inactive"
                      ? "inactive"
                      : "unavailable",
          acceptance:
            row.kind === "document"
              ? {
                  accepted: row.required_members - row.pending_members,
                  total: row.required_members,
                }
              : undefined,
        }))
      : null;
  const names = new Map<string, string>([
    ...(versionRows ?? []).map((row) => [row.version_id, row.version_label] as const),
    ...(selected?.latest_version
      ? [[selected.latest_version.version_id, selected.latest_version.version_label] as const]
      : []),
  ]);
  const versionName = (id: string | null) =>
    id ? (names.get(id) ?? t(($) => $.documents.versionUnshared)) : t(($) => $.documents.unknown);
  const acceptances: DocumentAcceptanceRow[] | null =
    readable && tab === "acceptance"
      ? readable.items.flatMap((row) => {
          if (!("kind" in row) || (row.kind !== "requirement" && row.kind !== "history")) return [];
          return [
            {
              id: row.key,
              name: row.display_name,
              initials: row.display_name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => Array.from(part)[0])
                .join(""),
              document: selected?.name ?? t(($) => $.documents.unknown),
              requiredVersion:
                row.kind === "history"
                  ? t(($) => $.documents.historyOnly)
                  : versionName(row.required_version_id),
              state:
                row.kind === "history"
                  ? row.evidence_state
                  : row.accepted
                    ? ("accepted" as const)
                    : row.status === "outdated"
                      ? ("old" as const)
                      : ("pending" as const),
              acceptedVersion:
                row.kind === "history" ? row.version_label : versionName(row.evidence_version_id),
              context: t(($) => $.documents.gates[row.context.gate]),
              evidenceMatches: row.kind === "requirement" ? row.evidence_matches_version : null,
            },
          ];
        })
      : null;
  const summary =
    readable?.summary ??
    (tab === "catalog" || (tab === "acceptance" && !documentId)
      ? catalog.data?.pages[0]?.summary
      : undefined);
  const invalid = page.isError || catalog.isError || catalogInvalid || lost || workspace.isError;
  async function refresh(publishedScope: "center" | "organization") {
    await invalidateDocumentDirectoryViews(queries, scope, publishedScope);
    // The catalog's first page and an unfiltered document-directory first page
    // are the same native read. Share the verified result instead of refetching
    // both query keys; filtered documents and acceptances remain distinct reads.
    const readVisible = active && (tab === "documents" || (tab === "acceptance" && !!documentId));
    const shareCatalogPage = readVisible && tab === "documents" && !query.trim();
    const firstPageKey = [
      "document-directory",
      scope,
      level,
      tab,
      documentId,
      versionId,
      filter,
      query,
      undefined,
    ];
    const [catalogResult, versionsResult] = await Promise.all([
      catalog.refetch(),
      active && versionTarget?.document_id && !versionTarget.read_only
        ? versions.refetch()
        : Promise.resolve(undefined),
      readVisible && !shareCatalogPage
        ? queries.fetchQuery({
            queryKey: firstPageKey,
            queryFn: () =>
              readDocumentDirectory(scope, {
                view: tab === "documents" ? "documents" : "acceptances",
                level,
                ...(tab === "acceptance"
                  ? { documentId, versionId: versionId || undefined }
                  : {}),
                filter: tab === "acceptance" ? filter : "all",
                query: query || undefined,
                cursor: undefined,
              }),
            staleTime: 0,
            retry: false,
          })
        : Promise.resolve(undefined),
    ]);
    if (catalogResult.isError || versionsResult?.isError)
      throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
    if (shareCatalogPage) {
      const firstPage = catalogResult.data?.pages[0];
      if (!firstPage) throw Error("DOCUMENT_DIRECTORY_UNAVAILABLE");
      queries.setQueryData(firstPageKey, firstPage);
    }
    setCursors([undefined]);
    setIndex(0);
  }
  function retry() {
    setLost(false);
    reset();
    void workspace.refetch();
    void page.refetch();
    void catalog.refetch();
  }
  return (
    <>
      <DocumentsView
        loading={active && page.isPending}
        acceptancePrompt={
          tab === "acceptance" && !documentId ? t(($) => $.documents.chooseDocument) : undefined
        }
        contentCatalog={
          tab === "catalog" && !invalid && active && selected ? (
            <DocumentCatalogPanel
              key={selected.key}
              scope={scope}
              document={selected}
              onLockChange={lock}
              onAccessLost={accessLost}
            />
          ) : (
            <p>{t(($) => $.documents.chooseDocument)}</p>
          )
        }
        documents={documents}
        acceptances={acceptances}
        tab={tab}
        onTab={(value) => {
          if (!locked) {
            setTab(value);
            setSearch("");
            setQuery("");
            reset();
          }
        }}
        filter={filter}
        onFilter={(value) => {
          if (!locked) {
            setFilter(value);
            reset();
          }
        }}
        summary={{
          published: summary ? String(summary.published_documents) : null,
          draft: summary ? String(summary.unpublished_files) : null,
          pending: summary ? `${summary.pending_members} / ${summary.total_members}` : null,
          lastPublished: summary?.last_publication
            ? date(summary.last_publication)
            : summary
              ? t(($) => $.documents.unknown)
              : null,
        }}
        pendingCount={summary ? String(summary.pending_members) : undefined}
        locked={locked || !active || invalid}
        onAdd={() => {
          setSaved(undefined);
          setEditor({});
        }}
        onOpen={(key) => {
          const row = rawRows.find((row) => row.key === key);
          if (row) setDetail(row);
        }}
        notice={
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="document-level">{t(($) => $.documents.scopeLabel)}</FieldLabel>
                <NativeSelect
                  id="document-level"
                  value={level}
                  disabled={locked}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next !== "center" && next !== "organization") return;
                    setLost(false);
                    setLevel(next);
                    setDocument("");
                    setVersion("");
                    setDetail(undefined);
                    reset();
                  }}
                >
                  <NativeSelectOption value="center">
                    {t(($) => $.documents.centerScope)}
                  </NativeSelectOption>
                  <NativeSelectOption value="organization">
                    {t(($) => $.documents.organizationScope)}
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              {tab !== "documents" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="acceptance-document">
                      {t(($) => $.documents.columns.document)}
                    </FieldLabel>
                    <NativeSelect
                      id="acceptance-document"
                      value={documentId}
                      disabled={locked || catalog.isError}
                      onChange={(event) => {
                        setDocument(event.target.value);
                        setVersion("");
                        reset();
                      }}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.documents.chooseDocument)}
                      </NativeSelectOption>
                      {(invalid ? [] : available)
                        .filter((row) => row.kind === "document")
                        .map((row) => (
                          <NativeSelectOption key={row.key} value={row.document_id!}>
                            {row.name}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </Field>
                  {tab === "acceptance" && documentId && (
                    <Field>
                      <FieldLabel htmlFor="acceptance-version">
                        {t(($) => $.documents.columns.version)}
                      </FieldLabel>
                      <NativeSelect
                        id="acceptance-version"
                        value={versionId}
                        disabled={locked}
                        onChange={(event) => {
                          setVersion(event.target.value);
                          reset();
                        }}
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.documents.allVersions)}
                        </NativeSelectOption>
                        {(invalid ? [] : [...names]).map(([id, name]) => (
                          <NativeSelectOption key={id} value={id}>
                            {name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                  )}
                </>
              )}
            </div>
            {tab !== "catalog" && (
              <search aria-label={t(($) => $.documents.search)}>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setQuery(search.trim());
                    reset();
                  }}
                >
                  <Field className="min-w-0 flex-1">
                    <FieldLabel htmlFor="document-search">
                      {tab === "documents"
                        ? t(($) => $.documents.searchDocument)
                        : t(($) => $.documents.searchPerson)}
                    </FieldLabel>
                    <Input
                      id="document-search"
                      name="query"
                      type="search"
                      maxLength={200}
                      value={search}
                      disabled={locked}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </Field>
                  <Button type="submit" variant="outline" isDisabled={locked}>
                    {t(($) => $.documents.search)}
                  </Button>
                </form>
              </search>
            )}
            {catalog.hasNextPage && (
              <Button
                variant="outline"
                isDisabled={locked || catalog.isFetchingNextPage}
                onPress={() => void catalog.fetchNextPage()}
              >
                {t(($) => $.documents.moreDocuments)}
              </Button>
            )}
            {saved && (
              <Alert>
                <AlertDescription role="status">
                  {t(($) => $.documents.publishedVersion, { version: saved })}
                </AlertDescription>
              </Alert>
            )}
            {invalid && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>{t(($) => $.documents.documentsUnread)}</p>
                  <Button variant="outline" isDisabled={locked} onPress={retry}>
                    {t(($) => $.finance.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {tab === "acceptance" && !documentId && (
              <Alert>
                <AlertDescription>{t(($) => $.documents.chooseDocument)}</AlertDescription>
              </Alert>
            )}
            {readable && !readable.history_available && tab === "acceptance" && (
              <Alert>
                <AlertDescription>{t(($) => $.documents.currentOnly)}</AlertDescription>
              </Alert>
            )}
            {readable && (
              <p className="text-xs text-muted-foreground">
                {tab === "acceptance"
                  ? t(($) => $.documents.selectedSummary, {
                      name: selected?.name ?? t(($) => $.documents.unknown),
                    })
                  : t(($) => $.documents.allSummary)}
              </p>
            )}
          </div>
        }
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || index === 0 || page.isFetching}
              onPress={() => setIndex((value) => value - 1)}
            >
              {t(($) => $.earnings.previousPage)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || !readable?.next_cursor || page.isFetching}
              onPress={() => {
                if (!readable?.next_cursor) return;
                setCursors((values) => [...values.slice(0, index + 1), readable.next_cursor!]);
                setIndex((value) => value + 1);
              }}
            >
              {t(($) => $.earnings.nextPage)}
            </Button>
          </div>
        }
      />
      {detail && active && !readDenied && timezone && (
        <DocumentDirectorySheet
          document={detail}
          versions={
            detail.read_only
              ? detail.latest_version
                ? [detail.latest_version]
                : []
              : (versionRows ?? null)
          }
          timezone={timezone}
          error={!detail.read_only && versions.isError}
          onRetry={() => void versions.refetch()}
          onMore={
            !detail.read_only && versions.hasNextPage
              ? () => void versions.fetchNextPage()
              : undefined
          }
          loadingMore={versions.isFetchingNextPage}
          onClose={() => setDetail(undefined)}
          onAcceptances={() => {
            setDocument(detail.document_id!);
            setVersion("");
            setDetail(undefined);
            setTab("acceptance");
            reset();
          }}
          onEdit={() => {
            setEditor({ target: detail });
            setDetail(undefined);
          }}
        />
      )}
      {editor && active && !readDenied && (
        <DocumentEditor
          key={editor.target?.key ?? `new:${level}`}
          scope={scope}
          target={editor.target}
          level={level}
          timezone={timezone!}
          history={versionRows}
          onLockChange={lock}
          onAccessLost={accessLost}
          onCompleted={refresh}
          onSaved={async (version, publishedScope) => {
            await refresh(publishedScope);
            setSaved(version);
          }}
          onClose={() => {
            if (!locked) {
              setEditor(undefined);
              lock(false);
            }
          }}
        />
      )}
    </>
  );
}
