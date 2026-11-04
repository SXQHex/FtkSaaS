"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { DocumentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import {
  documentReadActions,
  type DocumentReadActions,
  type DocumentQuery,
} from "../../lib/document-requirements";
type ReaderProps = {
  actorId: string;
  query: DocumentQuery;
  actions?: DocumentReadActions;
};
export function ContextDocuments({ actorId, query, actions = documentReadActions }: ReaderProps) {
  return (
    <ContextDocumentReader key={JSON.stringify([actorId, query])} query={query} actions={actions} />
  );
}
function ContextDocumentReader({
  query: initialQuery,
  actions,
}: {
  query: DocumentQuery;
  actions: DocumentReadActions;
}) {
  const [query] = useState(initialQuery);
  const t = useTranslations("documents");
  const [page, setPage] = useState<{ name: string; documents: DocumentView[] } | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<DocumentView | null>(null);
  const sourceButton = useRef<HTMLButtonElement | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([actions.read(query), actions.person(query)])
      .then(([documents, person]) => {
        if (active) setPage({ name: person.display_name, documents });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [query, retry, actions]);
  function refresh() {
    setSelected(null);
    setPage(null);
    setError(false);
    setRetry((n) => n + 1);
  }
  return (
    <section aria-label={t("requirementsTitle")} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
          {t("requirementsTitle")}
        </h3>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          onClick={refresh}
        >
          {t("reload")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("requirementsHint")}</p>
      {error ? (
        <p role="alert">{t("requirementsError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          <p className="font-medium">{page.name}</p>
          {!page.documents.length ? (
            <p className="text-sm">{t("noRequirements")}</p>
          ) : (
            <ul className="divide-y rounded-lg border px-4">
              {page.documents.map((doc, index) => (
                <li key={`${doc.version_id}:${index}`} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="min-w-0 break-words font-medium">{doc.name}</h4>
                    <Badge variant="outline">
                      {t(doc.accepted ? "requirementMet" : "acceptanceRequired")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(doc.accepted ? "acceptanceCarriedHint" : "acceptanceRequiredHint")}
                  </p>
                  <Button
                    className="h-auto min-h-11 max-w-full whitespace-normal"
                    variant="outline"
                    onClick={(event) => {
                      sourceButton.current = event.currentTarget;
                      setSelected(doc);
                    }}
                  >
                    {t("openDocument", { name: doc.name })}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {selected && (
        <PrivateDocument
          key={`${selected.version_id}:${selected.file.id}`}
          query={query}
          expected={selected}
          read={actions.file}
          onClose={() => {
            setSelected(null);
            requestAnimationFrame(() =>
              (sourceButton.current?.isConnected ? sourceButton.current : heading.current)?.focus(),
            );
          }}
        />
      )}
      <p className="text-xs text-muted-foreground">{t("readOnlyDocuments")}</p>
    </section>
  );
}
function PrivateDocument({
  query,
  expected,
  read,
  onClose,
}: {
  query: DocumentQuery;
  expected: DocumentView;
  read: DocumentReadActions["file"];
  onClose: () => void;
}) {
  const t = useTranslations("documents");
  const [content, setContent] = useState<{ url: string; text: string | null; pdf: boolean } | null>(
      null,
    ),
    [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    void read(query, expected)
      .then(async (file) => {
        const text = file.type === "text/plain" ? await file.text() : null;
        if (!active) return;
        url = URL.createObjectURL(file);
        setContent({ url, text, pdf: file.type === "application/pdf" });
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error && cause.message === "documentChanged"
              ? "documentChanged"
              : "documentReadError",
          );
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [query, expected, read]);
  return (
    <article
      className="space-y-4 rounded-lg border bg-muted/30 p-4"
      aria-label={t("privateContent")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 ref={heading} tabIndex={-1} className="min-w-0 break-words font-medium outline-none">
          {expected.name}
        </h4>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          onClick={onClose}
        >
          {t("closeDocument")}
        </Button>
      </div>
      {error ? (
        <p role="alert">{t(error)}</p>
      ) : !content ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {content.text !== null && (
            <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm">
              {content.text}
            </pre>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              className="inline-flex min-h-11 items-center underline underline-offset-4"
              href={content.url}
              download={content.pdf ? "document.pdf" : "document.txt"}
            >
              {t("downloadDocument")}
            </a>
            {content.pdf && (
              <a
                className="inline-flex min-h-11 items-center underline underline-offset-4"
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("openPdf")}
              </a>
            )}
          </div>
        </>
      )}
    </article>
  );
}
