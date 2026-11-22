import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { z } from "zod";
import type {
  DocumentDirectoryDocument,
  DocumentDirectoryVersion,
  UploadRef,
} from "@ftksaas/api-contracts";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { DocumentSheet, type DocumentDraft } from "./document-sheet";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import {
  uploadIntent,
  prepareUpload,
  transferUpload,
  completeIntent,
  writeComplete,
  readComplete,
  documentReceipt,
  previewPublication,
  publicationIntent,
  writePublication,
  validDigitalDocumentText,
  readPublication,
  type UploadIntent,
  type PublicationPreview,
} from "./document-publication";
export function DocumentEditor({
  scope,
  onClose,
  onLockChange,
  onAccessLost,
  onSaved,
  onCompleted,
  target,
  level = "center",
  history,
  timezone = "UTC",
}: {
  scope: ClientScope;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
  onSaved: (version: string, publishedScope: "center" | "organization") => void | Promise<void>;
  onCompleted: (uploadScope: "center" | "organization") => Promise<void>;
  target?: DocumentDirectoryDocument;
  level?: "center" | "organization";
  history?: DocumentDirectoryVersion[];
  timezone?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DocumentDraft>({
    name: target?.name ?? "",
    format: "file",
    language: "tr",
    digitalText: "",
    versionLabel: "",
    gates: [...new Set(target?.latest_version?.requirements?.map((row) => row.gate) ?? [])],
    renewedAcceptance: target?.latest_version?.requirements?.length
      ? new Set(target.latest_version.requirements.map((row) => row.renewed_acceptance)).size === 1
        ? target.latest_version.requirements[0]!.renewed_acceptance
        : undefined
      : true,
  });
  const [file, setFile] = useState<File>(),
    [preview, setPreview] = useState<PublicationPreview>(),
    [reviewed, setReviewed] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [busy, setBusy] = useState(false),
    [unknownUpload, setUnknownUpload] = useState(false),
    [error, setError] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "versionLabel" | "file" | "digitalText" | "gates", string>>
  >({});
  const upload = useRef<UploadIntent | undefined>(undefined),
    prepared = useRef<UploadRef | undefined>(undefined),
    ready = useRef<string | undefined>(
      target?.kind === "unpublished_file" &&
        target.state === "ready_unpublished" &&
        !target.read_only
        ? target.file_id!
        : undefined,
    ),
    executing = useRef(false),
    mounted = useRef(true);
  const completion = useMemberCommand({
    write: writeComplete,
    readReceipt: documentReceipt,
    readResult: readComplete,
    onAccessLost,
    onRefresh: async (fileId) => {
      ready.current = fileId;
      setUnknownUpload(false);
      // File completion is a separate native write. Its ready-unpublished
      // directory state must also be visible if preview/publication stops here.
      await onCompleted(upload.current?.request.center_id === null ? "organization" : "center");
    },
  });
  const publication = useMemberCommand({
    write: writePublication,
    readReceipt: documentReceipt,
    readResult: readPublication,
    onAccessLost,
    onRefresh: async (result) => {
      await onSaved(result.versionLabel!, result.publishedScope);
    },
  });
  const locked = busy || unknownUpload || completion.locked || publication.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useBlocker({
    shouldBlockFn: () => unknownUpload || executing.current,
    enableBeforeUnload: unknownUpload || busy,
    disabled: !unknownUpload && !busy,
  });
  const terminal = completion.unavailable || publication.unavailable;
  function change(next: DocumentDraft, nextFile: File | undefined) {
    if (locked || terminal) return;
    if (next.name !== draft.name || nextFile !== file || next.format !== draft.format) {
      upload.current = undefined;
      prepared.current = undefined;
      setCanVerify(false);
      ready.current = undefined;
      completion.reset();
    }
    publication.reset();
    setDraft(next);
    setFile(next.format === "file" ? nextFile : undefined);
    setErrors({});
    setError(false);
    setPreview(undefined);
    setReviewed(false);
  }
  async function complete() {
    if (!upload.current || !prepared.current) return;
    await completion.start(completeIntent(upload.current, prepared.current));
  }
  async function review(verifyOnly = false) {
    if (executing.current || completion.locked || publication.locked || terminal) return;
    const nextErrors: typeof errors = {};
    const digital = draft.format === "digital";
    const name = draft.name.trim();
    if (!name || name.length > (digital ? 200 : 500))
      nextErrors.name = t(($) =>
        digital ? $.documents.requiredDigitalName : $.documents.requiredName,
      );
    if (digital && !validDigitalDocumentText(draft.digitalText))
      nextErrors.digitalText = t(($) => $.documents.requiredDigitalText);
    if (!draft.versionLabel.trim() || draft.versionLabel.trim().length > 500)
      nextErrors.versionLabel = t(($) => $.documents.requiredVersion);
    if (
      !digital &&
      !ready.current &&
      (!file ||
        !["application/pdf", "text/plain"].includes(file.type) ||
        file.size < 1 ||
        file.size > 2 * 1024 * 1024)
    )
      nextErrors.file = t(($) => $.documents.requiredFile);
    if (!draft.gates.length) nextErrors.gates = t(($) => $.documents.requiredGates);
    if (typeof draft.renewedAcceptance !== "boolean")
      nextErrors.gates = t(($) => $.documents.chooseRenewal);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    executing.current = true;
    setBusy(true);
    setError(false);
    let transferStarted = false;
    try {
      if (!digital && !ready.current) {
        if (!upload.current)
          upload.current = await uploadIntent(scope, draft.name, file!, target?.scope ?? level);
        if (!verifyOnly) {
          setUnknownUpload(true);
          prepared.current = await prepareUpload(upload.current);
          if (mounted.current) setCanVerify(true);
          transferStarted = true;
          await transferUpload(upload.current, prepared.current);
        }
        if (!mounted.current) return;
        setUnknownUpload(false);
        await complete();
      }
      if (!mounted.current || (!digital && !ready.current)) return;
      const result = await previewPublication({
        scope,
        ...(digital
          ? {
              digitalContent: {
                name,
                language: draft.language,
                text: draft.digitalText,
                template_id: "document.text",
                template_version: "1",
              },
            }
          : { fileId: ready.current! }),
        versionLabel: draft.versionLabel,
        gates: draft.gates,
        renewedAcceptance: z.boolean().parse(draft.renewedAcceptance),
        documentId: target?.document_id ?? undefined,
        level: target?.scope ?? level,
        baseRequirements: target?.latest_version?.requirements ?? undefined,
      });
      if (mounted.current) {
        setPreview(result);
        setReviewed(false);
      }
    } catch (cause) {
      if (!mounted.current) return;
      if (onAccessLost(cause)) {
        setUnknownUpload(false);
        return;
      }
      if (
        !transferStarted &&
        cause instanceof BackendError &&
        !cause.retryable &&
        ![
          "OPERATION_IN_PROGRESS",
          "IDEMPOTENCY_PAYLOAD_MISMATCH",
          "OPERATION_RESULT_EXPIRED",
        ].includes(cause.code)
      )
        setUnknownUpload(false);
      setError(true);
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function publish() {
    if (!preview || locked || terminal || executing.current) return;
    executing.current = true;
    setBusy(true);
    setError(false);
    try {
      const intent = await publicationIntent(preview.target, preview, reviewed);
      if (mounted.current) await publication.start(intent);
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) {
        setPreview(undefined);
        setReviewed(false);
        setError(true);
      }
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function reload() {
    if (!locked) {
      completion.reset();
      publication.reset();
      setPreview(undefined);
      setReviewed(false);
      setError(false);
    }
  }
  return (
    <DocumentSheet
      draft={draft}
      onDraft={(value) => change(value, file)}
      onFile={(value) => change(draft, value)}
      fileLabel={
        file?.name ??
        (target?.kind === "unpublished_file" && target.state === "ready_unpublished"
          ? target.name
          : undefined)
      }
      mode={target?.kind === "document" ? "version" : target ? "draft" : "new"}
      history={
        history?.map((row) => ({
          id: row.version_id,
          version: row.version_label,
          published:
            new Intl.DateTimeFormat("tr-TR", {
              timeZone: timezone,
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(row.published_at)) + ` ${timezone}`,
          renewal:
            row.requirements === null
              ? t(($) => $.documents.unknown)
              : row.requirements.every((item) => item.renewed_acceptance)
                ? t(($) => $.documents.renewAll)
                : row.requirements.every((item) => !item.renewed_acceptance)
                  ? t(($) => $.documents.keepAcceptances)
                  : t(($) => $.documents.mixedRenewal),
        })) ?? null
      }
      reviewed={reviewed}
      onReviewed={setReviewed}
      onPreview={() => {
        void review();
      }}
      onPublish={() => {
        void publish();
      }}
      onClose={onClose}
      locked={locked}
      fixedName={!!target}
      readOnly={terminal || publication.state === "saved"}
      errors={errors}
      preview={
        preview ? (
          <div className="space-y-2">
            <p>{t(($) => $.documents.protectedCount, { count: preview.affected.length })}</p>
            <p>{t(($) => $.documents.previewExpiry, { time: preview.preview.expires_at })}</p>
            {preview.preview.blockers.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.documents.blocked)}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : undefined
      }
      notice={
        <>
          <EventCommandNotice command={completion} onReload={reload} />
          <EventCommandNotice command={publication} onReload={reload} />
          {(error || terminal) && (
            <Alert variant="destructive">
              <AlertDescription role="alert">
                {t(($) => $.documents.operationError)}
              </AlertDescription>
            </Alert>
          )}
          {unknownUpload && (
            <Alert>
              <AlertDescription>
                <p role="status">{t(($) => $.documents.uploadUnknown)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    isDisabled={busy}
                    variant="outline"
                    onPress={() => {
                      void review();
                    }}
                  >
                    {t(($) => $.studio.retrySameRequest)}
                  </Button>
                  {canVerify && (
                    <Button
                      isDisabled={busy}
                      variant="outline"
                      onPress={() => {
                        void review(true);
                      }}
                    >
                      {t(($) => $.documents.verifyUpload)}
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </>
      }
    />
  );
}
