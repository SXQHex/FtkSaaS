"use client";
import { PrivateDocument } from "./private-document";
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
