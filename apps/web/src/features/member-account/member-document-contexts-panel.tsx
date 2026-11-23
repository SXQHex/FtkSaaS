import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { DocumentView } from "@ftksaas/api-contracts";
import type { DocumentContext } from "../member-documents/member-documents";
import { MemberDocumentEditor } from "../member-documents/member-documents-panel";
import { readMemberDocumentContexts, documentContextKey } from "./member-document-contexts";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function MemberDocumentContextsPanel({
  scope,
  personId,
  disabled,
  onLockChange,
}: {
  scope: ClientScope;
  personId: string;
  disabled: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [locked, setLocked] = useState(false),
    [selected, setSelected] = useState<{
      key: string;
      binding: DocumentContext;
      before: DocumentView;
    }>();
  const query = useQuery({
    queryKey: [
      "member-document-contexts",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      cursors.at(-1),
    ],
    queryFn: (readContext) => readMemberDocumentContexts(scope, cursors.at(-1), readContext),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router],
  );
  const lock = useCallback((value: boolean) => setLocked(value), []);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (query.error) accessLost(query.error);
  }, [query.error, accessLost]);
  const next = query.data?.next_cursor;
  if (selected)
    return (
      <MemberDocumentEditor
        key={selected.key}
        binding={selected.binding}
        before={selected.before}
        disabled={disabled}
        onLockChange={lock}
        onAccessLost={accessLost}
        onAccepted={async () => {
          const result = await query.refetch();
          if (result.isError) throw result.error;
        }}
        onClose={() => {
          if (!locked) setSelected(undefined);
        }}
      />
    );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t(($) => $.memberAccount.documentContextHint)}
      </p>
      {query.isPending && <p role="status">{t(($) => $.memberDocuments.loading)}</p>}
      {query.isError && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.memberAccount.documentsUnavailable)}</AlertDescription>
        </Alert>
      )}
      {!query.isError && query.data?.items.length === 0 && (
        <p>{t(($) => $.memberDocuments.none)}</p>
      )}
      {!query.isError && query.data && (
        <ItemGroup className="divide-y">
          {query.data.items.flatMap((row) =>
            row.requirements.map((doc) => {
              const key = `${documentContextKey(row.context)}:${doc.id}`;
              return (
                <Item key={key} role="listitem" className="flex-wrap border-0 px-0">
                  <ItemContent>
                    <ItemTitle>{doc.name}</ItemTitle>
                    <ItemDescription>
                      {t(($) => $.documents.gates[row.context.gate])}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {doc.accepted ? (
                      <Badge variant="outline">{t(($) => $.memberDocuments.accepted)}</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={disabled || query.isFetching}
                        onPress={() =>
                          setSelected({
                            key,
                            binding: { scope, personId, context: structuredClone(row.context) },
                            before: structuredClone(doc),
                          })
                        }
                      >
                        {t(($) => $.memberDocuments.read, { name: doc.name })}
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              );
            }),
          )}
        </ItemGroup>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          isDisabled={disabled || query.isFetching || cursors.length === 1}
          onPress={() => setCursors((old) => old.slice(0, -1))}
        >
          {t(($) => $.memberReservations.previous)}
        </Button>
        <Button
          variant="outline"
          isDisabled={
            disabled || query.isFetching || query.isError || !next || cursors.includes(next)
          }
          onPress={() => {
            if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
          }}
        >
          {t(($) => $.memberReservations.next)}
        </Button>
        <Button
          variant="outline"
          isDisabled={disabled || query.isFetching}
          onPress={() => {
            void query.refetch();
          }}
        >
          {t(($) => $.memberDocuments.retry)}
        </Button>
      </div>
    </div>
  );
}
