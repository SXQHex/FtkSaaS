import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { UploadRef } from "../../lib/api-contracts/generated";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { DocumentSheet, type DocumentDraft } from "./document-sheet";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
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
}: {
  scope: ClientScope;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
  onSaved: (version: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DocumentDraft>({
    name: "",
    versionLabel: "",
    gates: [],
    renewedAcceptance: true,
  });
  const [file, setFile] = useState<File>(),
    [preview, setPreview] = useState<PublicationPreview>(),
    [reviewed, setReviewed] = useState(false);
  const [canVerify, setCanVerify] = useState(false);
  const [busy, setBusy] = useState(false),
    [unknownUpload, setUnknownUpload] = useState(false),
    [error, setError] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "versionLabel" | "file" | "gates", string>>
  >({});
  const upload = useRef<UploadIntent | undefined>(undefined),
    prepared = useRef<UploadRef | undefined>(undefined),
    ready = useRef<string | undefined>(undefined),
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
    },
  });
  const publication = useMemberCommand({
    write: writePublication,
    readReceipt: documentReceipt,
    readResult: readPublication,
    onAccessLost,
    onRefresh: async (result) => {
      onSaved(result.versionLabel!);
    },
  });
  const locked = busy || unknownUpload || completion.locked || publication.locked;
  useEffect(() => {
    onLockChange(locked);
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
    if (next.name !== draft.name || nextFile !== file) {
      upload.current = undefined;
      prepared.current = undefined;
      setCanVerify(false);
      ready.current = undefined;
      completion.reset();
    }
    publication.reset();
    setDraft(next);
    setFile(nextFile);
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
    if (!draft.name.trim() || draft.name.trim().length > 500)
      nextErrors.name = t(($) => $.documents.requiredName);
    if (!draft.versionLabel.trim() || draft.versionLabel.trim().length > 500)
      nextErrors.versionLabel = t(($) => $.documents.requiredVersion);
    if (
      !file ||
      !["application/pdf", "text/plain"].includes(file.type) ||
      file.size < 1 ||
      file.size > 2 * 1024 * 1024
    )
      nextErrors.file = t(($) => $.documents.requiredFile);
    if (!draft.gates.length) nextErrors.gates = t(($) => $.documents.requiredGates);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    executing.current = true;
    setBusy(true);
    setError(false);
    let transferStarted = false;
    try {
      if (!ready.current) {
        if (!upload.current) upload.current = await uploadIntent(scope, draft.name, file!);
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
      if (!mounted.current || !ready.current) return;
      const result = await previewPublication({
        scope,
        fileId: ready.current,
        versionLabel: draft.versionLabel,
        gates: draft.gates,
        renewedAcceptance: draft.renewedAcceptance,
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
      fileLabel={file?.name}
      mode="new"
      history={null}
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
