import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ftksaas/ui/components/table";
import { Textarea } from "@ftksaas/ui/components/textarea";
import type { ContentTemplateView, DocumentDirectoryDocument } from "@ftksaas/api-contracts";
import { cacheVerifiedReadback } from "../../lib/cache-invalidation";
import type { ClientScope } from "../../lib/scoped-backend";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import {
  catalogIntent,
  readCatalogResult,
  readDocumentCatalog,
  writeCatalogIntent,
  type DocumentCatalogIntent,
} from "./document-catalog";
import { validDigitalDocumentText } from "./document-publication";

type Draft = { row?: ContentTemplateView; language: string; name: string; text: string };
const languages = ["tr", "en"] as const;

export function DocumentCatalogPanel({
  scope,
  document,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  document: DocumentDirectoryDocument;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const copy = t(($) => $.documents.contentCatalog, { returnObjects: true });
  const queries = useQueryClient();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>();
  const [tried, setTried] = useState(false);
  const [review, setReview] = useState<DocumentCatalogIntent>();
  const [accepted, setAccepted] = useState(false);
  const [saved, setSaved] = useState<DocumentCatalogIntent["request"]["action"]>();
  const organization = document.scope === "organization";
  const documentId = document.document_id!;
  // A newly published version can change the visible translation source while
  // this panel remains mounted; the new version must not reuse old catalog data.
  const key = [
    "native-document-catalog",
    scope,
    organization,
    documentId,
    document.latest_version?.version_id,
  ];
  const query = useQuery({
    queryKey: key,
    queryFn: (context) => readDocumentCatalog(scope, organization, documentId, context),
    retry: false,
    gcTime: 0,
  });
  const command = useMemberCommand({
    write: writeCatalogIntent,
    readResult: readCatalogResult,
    onAccessLost,
    onRefresh: async (rows) => {
      await cacheVerifiedReadback(queries, key, rows);
      setSaved(review?.request.action);
      setDraft(undefined);
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);

  if (query.isPending) return <p role="status">{t(($) => $.platform.loading)}</p>;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription className="space-y-2">
          <p>{copy.unread}</p>
          <Button variant="outline" onPress={() => void query.refetch()}>
            {t(($) => $.auth.retry)}
          </Button>
        </AlertDescription>
      </Alert>
    );
  const rows = query.data;
  const latest = document.latest_version?.version_id;
  const source = rows.find((row) => row.id === latest && row.source_version === latest);
  const translationLanguages = languages.filter((language) => language !== source?.language);
  const canEdit = !document.read_only && !command.locked && !command.unavailable;
  function openDraft(row?: ContentTemplateView) {
    const content = row?.content;
    setTried(false);
    setDraft({
      row,
      language: row?.language ?? translationLanguages[0] ?? "",
      name: content && "name" in content ? content.name : document.name,
      text: content?.text ?? "",
    });
  }
  function openReview(intent: DocumentCatalogIntent) {
    command.reset();
    setAccepted(false);
    setSaved(undefined);
    setReview(intent);
  }
  const invalidName = !draft?.name.trim() || Array.from(draft.name.trim()).length > 200;
  const invalidText = !draft || !validDigitalDocumentText(draft.text);
  function prepareTranslation(action: "draft" | "publish") {
    if (!canEdit || !draft || (!draft.row && !source)) return;
    if (invalidName || invalidText) {
      setTried(true);
      form.current
        ?.querySelector<HTMLElement>(invalidName ? '[name="name"]' : '[name="text"]')
        ?.focus();
      return;
    }
    const template = draft.row ?? source!;
    if (!("name" in template.content)) return;
    const sourceId = template.source_version;
    const version =
      draft.row?.version ??
      1 +
        rows.reduce(
          (max, row) =>
            row.source_version === sourceId && row.language === draft.language
              ? Math.max(max, row.version)
              : max,
          0,
        );
    openReview(
      catalogIntent(
        scope,
        organization,
        documentId,
        sourceId,
        {
          language: draft.language,
          version,
          rowId: draft.row?.id,
          revision: draft.row?.revision,
        },
        action,
        {
          ...template.content,
          name: draft.name.trim(),
          language: draft.language,
          text: draft.text,
        },
      ),
    );
  }
  function prepareExisting(row: ContentTemplateView, action: "retire" | "invalidate") {
    openReview(
      catalogIntent(
        scope,
        organization,
        documentId,
        row.source_version,
        {
          language: row.language,
          version: row.version,
          rowId: row.id,
          revision: row.revision,
        },
        action,
      ),
    );
  }
  function close() {
    command.reset();
    setReview(undefined);
  }

  return (
    <div className="space-y-4">
      {rows.length ? (
        <Table aria-label={copy.title} scrollRegionLabel={copy.title} className="min-w-[46rem]">
          <TableHeader>
            <TableHead isRowHeader>{copy.code}</TableHead>
            <TableHead>{copy.channel}</TableHead>
            <TableHead>{copy.language}</TableHead>
            <TableHead>{copy.source}</TableHead>
            <TableHead>{copy.revision}</TableHead>
            <TableHead>{copy.status}</TableHead>
            <TableHead>{copy.actions}</TableHead>
          </TableHeader>
          <TableBody items={rows}>
            {(row) => (
              <TableRow id={row.id}>
                <TableCell className="whitespace-normal wrap-anywhere">{row.code}</TableCell>
                <TableCell>{copy.channelDocument}</TableCell>
                <TableCell>{row.language}</TableCell>
                <TableCell className="whitespace-normal wrap-anywhere">
                  {row.source_version === latest
                    ? document.latest_version?.version_label
                    : row.source_version}
                </TableCell>
                <TableCell>
                  {row.version} · {row.revision}
                </TableCell>
                <TableCell>
                  {row.invalidated
                    ? copy.invalidated
                    : row.retired
                      ? copy.retired
                      : row.state === "draft"
                        ? copy.draft
                        : copy.published}
                </TableCell>
                <TableCell focusMode="child">
                  <div className="flex flex-wrap gap-2">
                    {row.state === "draft" && "name" in row.content && (
                      <Button
                        isDisabled={!canEdit}
                        variant="outline"
                        size="sm"
                        onPress={() => openDraft(row)}
                      >
                        {copy.edit}
                      </Button>
                    )}
                    {row.state === "published" && !row.retired && (
                      <Button
                        isDisabled={!canEdit}
                        variant="outline"
                        size="sm"
                        onPress={() => prepareExisting(row, "retire")}
                      >
                        {copy.action.retire}
                      </Button>
                    )}
                    {row.state === "published" && !row.invalidated && (
                      <Button
                        isDisabled={!canEdit}
                        variant="outline"
                        size="sm"
                        onPress={() => prepareExisting(row, "invalidate")}
                      >
                        {copy.action.invalidate}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      ) : (
        <p>{copy.empty}</p>
      )}
      {source && "name" in source.content && !draft && translationLanguages.length > 0 && (
        <Button isDisabled={!canEdit} variant="outline" onPress={() => openDraft()}>
          {copy.newTranslation}
        </Button>
      )}
      {draft && (
        <form
          ref={form}
          aria-labelledby={`${id}-translation`}
          className="grid max-w-xl gap-3 rounded-md border p-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            prepareTranslation("draft");
          }}
        >
          <h3 id={`${id}-translation`} className="font-semibold">
            {copy.translation}
          </h3>
          <Field>
            <FieldLabel htmlFor={`${id}-lang`}>{copy.language}</FieldLabel>
            <NativeSelect
              id={`${id}-lang`}
              value={draft.language}
              disabled={!canEdit || !!draft.row}
              onChange={(event) => setDraft({ ...draft, language: event.target.value })}
            >
              {(draft.row ? [draft.language] : translationLanguages).map((language) => (
                <NativeSelectOption key={language} value={language}>
                  {language}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{copy.name}</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              value={draft.name}
              disabled={!canEdit}
              required
              aria-invalid={tried && invalidName}
              aria-describedby={tried && invalidName ? `${id}-name-error` : undefined}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            {tried && invalidName && (
              <p id={`${id}-name-error`} className="text-sm text-destructive">
                {t(($) => $.documents.requiredDigitalName)}
              </p>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-text`}>{t(($) => $.documents.formatDigital)}</FieldLabel>
            <Textarea
              id={`${id}-text`}
              name="text"
              value={draft.text}
              disabled={!canEdit}
              rows={6}
              required
              aria-invalid={tried && invalidText}
              aria-describedby={tried && invalidText ? `${id}-text-error` : undefined}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            />
            {tried && invalidText && (
              <p id={`${id}-text-error`} className="text-sm text-destructive">
                {t(($) => $.documents.requiredDigitalText)}
              </p>
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              isDisabled={!canEdit}
              onPress={() => setDraft(undefined)}
            >
              {t(($) => $.settings.discard)}
            </Button>
            <Button type="submit" variant="outline" isDisabled={!canEdit}>
              {copy.action.draft}
            </Button>
            <Button
              type="button"
              isDisabled={!canEdit}
              onPress={() => prepareTranslation("publish")}
            >
              {copy.action.publish}
            </Button>
          </div>
        </form>
      )}
      {saved && <p role="status">{copy.result[saved]}</p>}
      {review && (
        <SettingsReviewDialog
          open
          title={copy.action[review.request.action]}
          description={copy.effect[review.request.action]}
          rows={[
            {
              id: review.request.code,
              title: document.name,
              detail: `${review.request.code} · ${review.sourceId} · ${review.request.language} · ${review.request.version}`,
            },
          ]}
          accepted={accepted}
          onAccepted={setAccepted}
          onClose={close}
          locked={command.locked}
          onApply={command.state === "ready" ? () => void command.start(review) : undefined}
          recoveryActions={
            <EventCommandNotice command={command} receiptAvailable={false} onReload={close} />
          }
        />
      )}
    </div>
  );
}
