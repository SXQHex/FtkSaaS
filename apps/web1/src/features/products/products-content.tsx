import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProductsView, type ProductRow } from "./products-view";
import { ProductEditor, type ProductDraft } from "./product-editor";
import { productDraft, productIntent, readProductsPage, type ProductIntent } from "./products";
import { useProductCommand } from "./use-product-command";
import { readDisciplineCatalog } from "../settings/discipline-reader";
import { readWorkspace } from "../workspace/workspace";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ProductView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function ProductsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [pageIndex, setPageIndex] = useState(0);
  const [editor, setEditor] = useState<{ base?: ProductView } | null>(null);
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const current =
    (!workspace.isError || preservePending) &&
    workspace.data?.selected?.id === scope.orgId &&
    workspace.data.centers.some((row) => row.id === scope.centerId && row.accessible)
      ? workspace.data
      : undefined;
  const canWrite =
    !workspace.isError &&
    Boolean(
      current?.roles.some(
        (role) =>
          role.state === "active" &&
          role.person_id === current.selected?.self_context?.person_id &&
          (role.role === "owner" ||
            role.role === "org_manager" ||
            (role.role === "center_manager" && role.scope_center_id === scope.centerId)),
      ),
    );
  const query = useQuery({
    queryKey: ["products", scope.accountId, scope.orgId, scope.centerId, cursors[pageIndex]],
    queryFn: () => readProductsPage(scope, cursors[pageIndex]),
    enabled: Boolean(current),
    retry: false,
  });
  const rows: ProductRow[] =
    !query.isError && query.data
      ? query.data.items.map((row) => ({
          id: row.id,
          name: row.terms.name,
          kind:
            row.terms.kind === "timed"
              ? t(($) => $.products.timedKind)
              : `${row.terms.credits} · ${t(($) => $.products.creditKind)}`,
          scope: row.terms.scopes
            .map((item) =>
              [
                item.scope_kind.startsWith("organization_")
                  ? t(($) => $.products.organizationScope)
                  : (current?.centers.find((center) => center.id === item.center_id)?.name ??
                    t(($) => $.products.centerScope)),
                item.discipline_id
                  ? t(($) => $.products.disciplineScope)
                  : t(($) => $.products.allDisciplines),
                ...item.usage_targets.map((target) =>
                  target === "lesson" ? t(($) => $.products.lessons) : t(($) => $.products.event),
                ),
                ...(item.class_id ? [t(($) => $.products.classRestricted)] : []),
                ...(item.event_id ? [t(($) => $.products.eventRestricted)] : []),
              ].join(" · "),
            )
            .join("; "),
          validity: null,
          price: formatMinorAmount(row.terms.price_minor, row.terms.currency),
          activeRights: null,
          salesState: null,
        }))
      : [];
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED", "FORBIDDEN"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router],
  );
  useEffect(() => {
    if (query.error) accessLost(query.error);
  }, [query.error, accessLost]);
  return (
    <>
      <ProductsView
        rows={rows}
        summary={{ onSale: null, recentSales: null, recentRevenue: null, activeHolders: null }}
        state={query.isError ? "error" : query.isPending ? "loading" : "ready"}
        search=""
        filter="all"
        count={t(($) => $.products.count, { count: rows.length })}
        notice={
          <Alert>
            <AlertDescription>
              {t(($) => $.products.catalogOnly)}
              {query.isError && (
                <Button
                  variant="outline"
                  onPress={() => {
                    void query.refetch();
                  }}
                >
                  {t(($) => $.products.retry)}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        }
        onAdd={canWrite && !query.isError ? () => setEditor({}) : undefined}
        onSelect={(id) => {
          const base = query.data?.items.find((row) => row.id === id);
          if (base) setEditor({ base: structuredClone(base) });
        }}
        pagination={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              isDisabled={pageIndex === 0 || query.isFetching}
              onPress={() => setPageIndex((index) => index - 1)}
            >
              {t(($) => $.products.previous)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              isDisabled={!query.data?.next_cursor || query.isFetching || query.isError}
              onPress={() => {
                const next = query.data?.next_cursor;
                if (next) {
                  setCursors((old) => [...old.slice(0, pageIndex + 1), next]);
                  setPageIndex((index) => index + 1);
                }
              }}
            >
              {t(($) => $.products.next)}
            </Button>
          </div>
        }
      />
      {editor && (
        <ProductEditorController
          key={editor.base?.version_id ?? "new"}
          scope={scope}
          base={editor.base}
          canWrite={canWrite && !workspace.isError}
          onClose={() => setEditor(null)}
          onLockChange={onLockChange}
          onAccessLost={accessLost}
          onRefresh={async () => {
            await query.refetch({ throwOnError: true });
          }}
        />
      )}
    </>
  );
}
function ProductEditorController({
  scope,
  base,
  canWrite,
  onClose,
  onRefresh,
  onAccessLost,
  onLockChange,
}: {
  scope: ClientScope;
  base?: ProductView;
  canWrite: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAccessLost: (error: unknown) => boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProductDraft>(() => productDraft(base)),
    [stage, setStage] = useState<"edit" | "review">("edit"),
    [accepted, setAccepted] = useState(false),
    [review, setReview] = useState<ProductIntent>(),
    [invalid, setInvalid] = useState(false);
  const disciplines = useQuery({
    queryKey: ["product-disciplines", scope.accountId, scope.orgId, scope.centerId],
    queryFn: () => readDisciplineCatalog(scope, "center"),
    enabled: !base,
    retry: false,
  });
  const command = useProductCommand({
    onAccessLost,
    onRefresh: async () => {
      await onRefresh();
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  const activeDisciplines =
    disciplines.data?.filter(
      (row) => row.state === "active" && row.presentation.center?.state === "active",
    ) ?? [];
  function changeStage(next: "edit" | "review") {
    if (command.locked) return;
    command.reset();
    setInvalid(false);
    setAccepted(false);
    if (next === "review") {
      try {
        setReview(
          productIntent(
            scope,
            draft,
            base,
            activeDisciplines.map((row) => row.id),
          ),
        );
        setStage(next);
      } catch {
        setInvalid(true);
      }
    } else {
      setReview(undefined);
      setStage(next);
    }
  }
  const status = command.state;
  const message =
    status === "saved"
      ? t(($) => $.products.saved)
      : status === "saved-unread"
        ? t(($) => $.products.savedUnread)
        : status === "unknown"
          ? t(($) => $.products.unknownWrite)
          : status === "pending"
            ? t(($) => $.products.pending)
            : ["stale", "rejected"].includes(status)
              ? t(($) => $.products.rejected)
              : undefined;
  return (
    <ProductEditor
      open
      editing={Boolean(base)}
      stage={stage}
      draft={draft}
      support={{ validity: false, saleState: false, negativeValue: false, versionNote: false }}
      scopesEditable={!base && canWrite}
      unitPrice={null}
      versions={
        base
          ? [{ id: base.version_id, title: t(($) => $.products.versions), detail: base.terms.name }]
          : null
      }
      sales={null}
      changes={
        review
          ? [
              {
                id: "terms",
                title: t(($) => $.products.reviewChanges),
                detail: `${review.request.terms.name} · ${formatMinorAmount(review.request.terms.price_minor, review.request.terms.currency)}`,
              },
            ]
          : []
      }
      effects={[
        {
          id: "new",
          title: t(($) => $.products.effects),
          detail: t(($) => $.products.reviewEffects),
        },
      ]}
      accepted={accepted}
      disciplines={activeDisciplines.map((row) => ({ id: row.id, name: row.name }))}
      pending={command.locked}
      readOnly={!canWrite || status === "saved"}
      notice={
        <>
          <Alert>
            <AlertDescription>
              {t(($) => $.products.unsupportedFields)}
              {base && <p>{t(($) => $.products.scopesPreserved)}</p>}
            </AlertDescription>
          </Alert>
          {invalid && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.products.invalid)}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {["unknown", "pending", "saved-unread"].includes(status) && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                isDisabled={command.busy}
                onPress={() => {
                  void command.readReceipt();
                }}
              >
                {t(($) =>
                  status === "saved-unread" ? $.products.readAgain : $.products.readReceipt,
                )}
              </Button>
              {status === "unknown" && (
                <Button
                  variant="outline"
                  isDisabled={command.busy}
                  onPress={() => {
                    void command.retry();
                  }}
                >
                  {t(($) => $.products.retryWrite)}
                </Button>
              )}
            </div>
          )}
          {status === "saved" && <Button onPress={onClose}>{t(($) => $.products.close)}</Button>}
        </>
      }
      onClose={() => {
        if (!command.locked) onClose();
      }}
      onDraft={(value) => {
        if (!command.locked) {
          setDraft(value);
          setReview(undefined);
          setAccepted(false);
          setInvalid(false);
        }
      }}
      onStage={changeStage}
      onAccepted={setAccepted}
      onPublish={
        review && canWrite && status === "ready"
          ? () => {
              if (accepted) void command.start(review);
            }
          : undefined
      }
    />
  );
}
