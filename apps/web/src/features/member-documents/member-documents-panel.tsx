import { useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { DocumentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@ftksaas/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@ftksaas/ui/components/field";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { PrivateSessionRevision } from "../auth/private-session-revision";
import {
  documentBody,
  documentAcceptanceIntent,
  readRequiredDocuments,
  writeDocumentAcceptance,
  readDocumentReceipt,
  readDocumentResult,
  type DocumentContext,
} from "./member-documents";

export function MemberDocumentsPanel({
  binding,
  disabled,
  onLockChange,
  onAccepted,
  onAccessLost,
}: {
  binding: DocumentContext;
  disabled: boolean;
  onLockChange: (locked: boolean) => void;
  onAccepted: () => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string>();
  const [childLocked, setChildLocked] = useState(false);
  const childLock = useCallback((value: boolean) => setChildLocked(value), []);
  const query = useQuery({
    queryKey: [
      "member-documents",
      binding.scope.accountId,
      binding.scope.orgId,
      binding.scope.centerId,
      binding.personId,
      binding.context,
    ],
    queryFn: (readContext) => readRequiredDocuments(binding, undefined, readContext),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  useEffect(() => {
    onLockChange(childLocked);
    return () => onLockChange(false);
  }, [childLocked, onLockChange]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(($) => $.memberDocuments.title)}</CardTitle>
        <CardDescription>{t(($) => $.memberDocuments.description)}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {query.isPending && <p role="status">{t(($) => $.memberDocuments.loading)}</p>}
          {query.isError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.memberDocuments.unavailable)}</AlertDescription>
            </Alert>
          )}
          {!query.isPending && !query.isError && !query.data?.length && (
            <p role="status">{t(($) => $.memberDocuments.none)}</p>
          )}
          {!query.isError &&
            query.data?.map((row) => (
              <Field key={row.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{row.name}</span>
                  {row.accepted ? (
                    <span>{t(($) => $.memberDocuments.accepted)}</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={disabled || childLocked}
                      onPress={() => setSelected(row.id)}
                    >
                      {t(($) => $.memberDocuments.read, { name: row.name })}
                    </Button>
                  )}
                </div>
              </Field>
            ))}
          {query.isError && (
            <Button
              variant="outline"
              isDisabled={disabled || childLocked}
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.memberDocuments.retry)}
            </Button>
          )}
          {selected && query.data?.find((row) => row.id === selected) && (
            <MemberDocumentEditor
              key={selected}
              binding={binding}
              before={query.data.find((row) => row.id === selected)!}
              disabled={disabled}
              onLockChange={childLock}
              onAccessLost={onAccessLost}
              onAccepted={async () => {
                const result = await query.refetch();
                if (result.error) throw result.error;
                onAccepted();
              }}
              onClose={() => setSelected(undefined)}
            />
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
export function MemberDocumentEditor({
  binding,
  before,
  disabled,
  onLockChange,
  onAccessLost,
  onAccepted,
  onClose,
}: {
  binding: DocumentContext;
  before: DocumentView;
  disabled: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
  onAccepted: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reviewId = useId();
  const sessionRevision = useContext(PrivateSessionRevision);
  const documentKey = `${sessionRevision}:${before.id}:${before.version_id}:${before.file.id}`;
  const [reviewedDocument, setReviewedDocument] = useState<string>(),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const reviewed = reviewedDocument === documentKey;
  const query = useQuery({
    queryKey: [
      "member-document-content",
      binding.scope.accountId,
      binding.scope.orgId,
      binding.scope.centerId,
      binding.personId,
      binding.context,
      before.id,
      before.version_id,
      before.file.id,
      sessionRevision,
    ],
    queryFn: async (readContext) => {
      const row = (await readRequiredDocuments(binding, before.file.id, readContext)).find(
        (r) =>
          r.id === before.id && r.version_id === before.version_id && r.file.id === before.file.id,
      );
      if (!row) throw Error("DOCUMENT_CONTENT_UNAVAILABLE");
      return { row, body: documentBody(row) };
    },
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const command = useMemberCommand({
    write: writeDocumentAcceptance,
    readReceipt: readDocumentReceipt,
    readResult: readDocumentResult,
    onRefresh: onAccepted,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  const readOnly = disabled || locked || command.state !== "ready";
  const content =
    query.isSuccess && query.fetchStatus === "idle" && query.isFetchedAfterMount
      ? query.data
      : undefined;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  async function accept() {
    if (readOnly || !content) return;
    if (!reviewed) {
      setError(true);
      return;
    }
    setPreparing(true);
    setError(false);
    try {
      await command.start(await documentAcceptanceIntent(binding, content.row, reviewed));
    } catch (cause) {
      if (!onAccessLost(cause)) setError(true);
    } finally {
      setPreparing(false);
    }
  }
  return (
    <FieldGroup>
      <h3 className="font-semibold">{before.name}</h3>
      {!content && !query.isError && <p role="status">{t(($) => $.memberDocuments.loading)}</p>}
      {query.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{t(($) => $.memberDocuments.unavailable)}</p>
            <Button
              variant="outline"
              isDisabled={readOnly}
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.memberDocuments.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {content && (
        <>
          <DocumentBody body={content.body} />
          <Field orientation="horizontal" data-invalid={error || undefined}>
            <Checkbox
              id={reviewId}
              isSelected={reviewed}
              isDisabled={readOnly || content.row.accepted}
              isInvalid={error}
              validationBehavior="aria"
              onChange={(value) => {
                setReviewedDocument(value ? documentKey : undefined);
                setError(false);
              }}
            />
            <FieldLabel htmlFor={reviewId}>{t(($) => $.memberDocuments.review)}</FieldLabel>
          </Field>
          <Button
            isDisabled={readOnly || content.row.accepted}
            onPress={() => {
              void accept();
            }}
          >
            {t(($) => $.memberDocuments.accept)}
          </Button>
        </>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription role="alert">
            {t(($) => $.memberDocuments.reviewError)}
          </AlertDescription>
        </Alert>
      )}
      <EventCommandNotice command={command} onReload={onClose} />
      <Button variant="outline" isDisabled={locked} onPress={onClose}>
        {t(($) => $.memberDocuments.close)}
      </Button>
    </FieldGroup>
  );
}
function DocumentBody({ body }: { body: ReturnType<typeof documentBody> }) {
  const { t } = useTranslation();
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current = [];
    },
    [],
  );
  if ("text" in body)
    return (
      <p lang={body.language} className="whitespace-pre-wrap wrap-anywhere">
        {body.text}
      </p>
    );
  return (
    <FieldGroup>
      <p>{t(($) => $.memberDocuments.pdfHint)}</p>
      <Button
        variant="outline"
        onPress={() => {
          const url = URL.createObjectURL(new Blob([body.pdf], { type: "application/pdf" }));
          urls.current.push(url);
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        {t(($) => $.memberDocuments.pdf)}
      </Button>
    </FieldGroup>
  );
}
