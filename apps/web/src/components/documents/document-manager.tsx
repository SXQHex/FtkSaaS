"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import {
  listDocumentFiles,
  listDocumentPublications,
  restoreUpload,
  uploadStorageKey,
} from "../../lib/documents";
import { setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey, SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { DocumentUpload } from "./document-upload";
import { DocumentPublicationForm } from "./document-publication";
export function DocumentManager({ scope }: { scope: SetupScope }) {
  const t = useTranslations("documents"),
    setup = useTranslations("setup");
  const [retry, setRetry] = useState(0),
    [cursor, setCursor] = useState<string>();
  const [files, setFiles] = useState<Awaited<ReturnType<typeof listDocumentFiles>> | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ fileId: string; documentId?: string } | null>(null);
  const [newTarget, setNewTarget] = useState<string>(),
    [uploadNonce, setUploadNonce] = useState(0);
  const uploadHeading = useRef<HTMLDivElement>(null);
  const command = useSetupCommand(scope, "document-publish", () => {
    setFiles(null);
    setCursor(undefined);
    setRetry((n) => n + 1);
  });
  const pendingFile =
    command.pending &&
    command.pending !== "invalid" &&
    command.pending.command.operation === "document_version_publish_v1"
      ? command.pending.command.input
      : null;
  useEffect(() => {
    let active = true;
    void listDocumentFiles(scope, cursor)
      .then((result) => {
        if (active) setFiles(result);
      })
      .catch((cause) => {
        if (active) setError(setup(errorKey(setupError(cause))));
      });
    return () => {
      active = false;
    };
  }, [scope, cursor, retry, setup]);
  function refresh() {
    setFiles(null);
    setError("");
    setCursor(undefined);
    setRetry((n) => n + 1);
  }
  function begin(documentId?: string) {
    const pending = restoreUpload(scope);
    if (pending === "invalid") {
      setError(t("storageFailed"));
      return;
    }
    if (pending && pending.phase !== "ready") {
      setError(t("pendingUpload"));
      return;
    }
    try {
      sessionStorage.removeItem(uploadStorageKey(scope));
      setNewTarget(documentId);
      setUploadNonce((n) => n + 1);
      requestAnimationFrame(() => uploadHeading.current?.focus());
    } catch {
      setError(t("storageFailed"));
    }
  }
  const fileId = pendingFile?.file_id ?? selected?.fileId;
  const documentId = pendingFile?.document_id ?? selected?.documentId ?? undefined;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button className="h-auto min-h-11 max-w-full whitespace-normal" onClick={() => begin()}>
          {t("newDocument")}
        </Button>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          onClick={refresh}
        >
          {t("reload")}
        </Button>
      </div>
      <div ref={uploadHeading} tabIndex={-1} className="outline-none">
        <DocumentUpload
          key={uploadNonce}
          scope={scope}
          targetDocumentId={newTarget}
          onReady={(id, documentId) => {
            setSelected({ fileId: id, documentId });
            refresh();
          }}
        />
      </div>
      <SetupFeedback command={command} />
      {error && <p role="alert">{error}</p>}
      <section className="space-y-4" aria-label={t("libraryTitle")}>
        <h2 className="text-lg font-semibold">{t("libraryTitle")}</h2>
        {!files && !error && <output>{t("loading")}</output>}
        {files && (
          <>
            {!files.items.length ? (
              <p className="text-sm text-muted-foreground">{t("emptyFiles")}</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card px-5">
                {files.items.map((item) => {
                  const current = item.current;
                  if (
                    item.entity?.type !== "files" ||
                    current?.operation !== "document_upload_prepare_v1"
                  )
                    return null;
                  const id = item.entity.id;
                  return (
                    <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{current.values.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(item.state === "ready" ? "fileReady" : "filePending")}
                        </p>
                      </div>
                      <Button
                        className="h-auto min-h-11 max-w-full whitespace-normal"
                        variant="outline"
                        disabled={item.state !== "ready" || !!command.pending}
                        onClick={() => setSelected({ fileId: id })}
                      >
                        {t("openPublication")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {files.next_cursor && (
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal"
                variant="outline"
                onClick={() => {
                  setFiles(null);
                  setError("");
                  setCursor(files.next_cursor ?? undefined);
                }}
              >
                {t("next")}
              </Button>
            )}
          </>
        )}
      </section>
      {fileId && (
        <PublicationPanel
          key={`${fileId}:${documentId ?? "new"}:${retry}`}
          scope={scope}
          fileId={fileId}
          documentId={documentId}
          command={command}
          onNewVersion={begin}
        />
      )}
    </div>
  );
}
function PublicationPanel({
  scope,
  fileId,
  documentId,
  command,
  onNewVersion,
}: {
  scope: SetupScope;
  fileId: string;
  documentId?: string;
  command: ReturnType<typeof useSetupCommand>;
  onNewVersion: (id: string) => void;
}) {
  const t = useTranslations("documents"),
    setup = useTranslations("setup");
  const [page, setPage] = useState<Awaited<ReturnType<typeof listDocumentPublications>> | null>(
      null,
    ),
    [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void listDocumentPublications(scope, fileId, cursor)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((cause) => {
        if (active) setError(setup(errorKey(setupError(cause))));
      });
    return () => {
      active = false;
    };
  }, [scope, fileId, cursor, retry, setup]);
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={t("publishedTitle")}>
      <h2 className="text-lg font-semibold">{t("publishedTitle")}</h2>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            variant="outline"
            onClick={() => {
              setError("");
              setPage(null);
              setCursor(undefined);
              setRetry((n) => n + 1);
            }}
          >
            {t("reload")}
          </Button>
        </>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {page.items.length > 0 ? (
            <ul className="space-y-3">
              {page.items.map((item) => {
                const current = item.current;
                if (
                  current?.operation !== "document_version_publish_v1" ||
                  !current.values.document_id
                )
                  return null;
                const id = current.values.document_id;
                return (
                  <li key={item.entity?.id} className="space-y-3">
                    <p className="break-words">
                      {t("publishedVersion", { label: current.values.version_label ?? "" })}
                    </p>
                    <Button
                      className="h-auto min-h-11 max-w-full whitespace-normal"
                      variant="outline"
                      disabled={!!command.pending}
                      onClick={() => onNewVersion(id)}
                    >
                      {t("uploadNextVersion")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !cursor && (
              <DocumentPublicationForm
                scope={scope}
                fileId={fileId}
                documentId={documentId}
                command={command}
              />
            )
          )}
          {page.next_cursor && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={() => {
                setPage(null);
                setCursor(page.next_cursor ?? undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
