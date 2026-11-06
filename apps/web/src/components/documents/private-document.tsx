"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DocumentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import type { DocumentQuery, DocumentReadActions } from "../../lib/document-requirements";
export function PrivateDocument({
  query,
  expected,
  read,
  onClose,
  children,
  headingLevel = 4,
}: {
  query: DocumentQuery;
  expected: DocumentView;
  read: DocumentReadActions["file"];
  onClose: () => void;
  children?: ReactNode;
  headingLevel?: 3 | 4;
}) {
  const t = useTranslations("documents");
  const Heading = headingLevel === 3 ? "h3" : "h4";
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
        <Heading
          ref={heading}
          tabIndex={-1}
          className="min-w-0 break-words font-medium outline-none"
        >
          {expected.name}
        </Heading>
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
          {children}
        </>
      )}
    </article>
  );
}
