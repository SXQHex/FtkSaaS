import { useTranslation } from "react-i18next";
import type {
  DocumentDirectoryDocument,
  DocumentDirectoryVersion,
} from "../../lib/api-contracts/generated";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function DocumentDirectorySheet({
  document,
  versions,
  timezone,
  error,
  onRetry,
  onMore,
  loadingMore,
  onEdit,
  onAcceptances,
  onClose,
}: {
  document: DocumentDirectoryDocument;
  versions: DocumentDirectoryVersion[] | null;
  timezone: string;
  error: boolean;
  onRetry: () => void;
  onMore?: () => void;
  loadingMore?: boolean;
  onEdit: () => void;
  onAcceptances: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const writable =
    !document.read_only && ["published", "ready_unpublished"].includes(document.state);
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle>{document.name}</SheetTitle>
        <SheetDescription>
          {t(($) => $.documents.scopeHint, {
            scope:
              document.scope === "organization"
                ? t(($) => $.documents.organizationScope)
                : t(($) => $.documents.centerScope),
          })}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {(document.read_only || !["published", "ready_unpublished"].includes(document.state)) && (
          <Alert>
            <AlertDescription>
              {document.read_only
                ? t(($) => $.documents.metadataOnly)
                : t(($) => $.documents.uploadUnavailable)}
            </AlertDescription>
          </Alert>
        )}
        {document.acceptance_records !== null && (
          <p className="text-sm">
            {t(($) => $.documents.historyCount, { count: document.acceptance_records })}
          </p>
        )}
        {document.kind === "document" && (
          <>
            <h2 className="text-sm font-semibold">{t(($) => $.documents.history)}</h2>
            {error ? (
              <Alert>
                <AlertDescription>
                  {t(($) => $.documents.historyUnread)}
                  <Button variant="outline" onPress={onRetry}>
                    {t(($) => $.finance.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : versions === null ? (
              <p role="status">{t(($) => $.documents.historyUnread)}</p>
            ) : (
              <ItemGroup>
                {versions.map((row) => (
                  <Item key={row.version_id} role="listitem">
                    <ItemContent>
                      <ItemTitle>{row.version_label}</ItemTitle>
                      <ItemDescription>
                        {date(row.published_at)} · {timezone}
                      </ItemDescription>
                      <ItemDescription>
                        {row.requirements === null
                          ? t(($) => $.documents.metadataOnly)
                          : row.requirements
                              .map((item) => t(($) => $.documents.gates[item.gate]))
                              .join(" · ")}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
            {onMore && (
              <Button variant="outline" isDisabled={loadingMore} onPress={onMore}>
                {t(($) => $.documents.moreVersions)}
              </Button>
            )}
          </>
        )}
      </div>
      <SheetFooter>
        <Button variant="outline" onPress={onClose}>
          {t(($) => $.documents.close)}
        </Button>
        {document.document_id && (
          <Button variant="outline" onPress={onAcceptances}>
            {t(($) => $.documents.acceptanceTab)}
          </Button>
        )}
        {writable && (
          <Button onPress={onEdit}>
            {document.kind === "document"
              ? t(($) => $.documents.newVersion)
              : t(($) => $.documents.resumeReady)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
