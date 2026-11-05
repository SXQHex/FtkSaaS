"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { AcceptanceContext, DocumentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Label } from "@ftksaas/ui/components/label";
import { selfDocumentQuery, type SelfDocumentQuery } from "../../lib/document-acceptance";
import { readContextDocuments, readPrivateDocument } from "../../lib/document-requirements";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { PrivateDocument } from "./private-document";
type Command = ReturnType<typeof useSetupCommand>;
type Reads = { read?: typeof readContextDocuments; file?: typeof readPrivateDocument };
export function SelfDocuments({
  scope,
  context,
  ...reads
}: { scope: SetupScope; context: AcceptanceContext } & Reads) {
  return (
    <SelfDocumentConnection
      key={JSON.stringify([scope, context])}
      scope={scope}
      context={context}
      {...reads}
    />
  );
}
function SelfDocumentConnection({
  scope,
  context,
  ...reads
}: { scope: SetupScope; context: AcceptanceContext } & Reads) {
  const [revision, setRevision] = useState(0);
  const command = useSetupCommand(scope, "document-accept", () => setRevision((n) => n + 1));
  return (
    <SelfDocumentView
      key={revision}
      actorId={scope.actorId}
      query={selfDocumentQuery(scope, context)}
      command={command}
      {...reads}
    />
  );
}
export function SelfDocumentView({
  actorId,
  query,
  command,
  ...reads
}: { actorId: string; query: SelfDocumentQuery; command: Command } & Reads) {
  return (
    <SelfDocumentContent
      key={JSON.stringify([actorId, query])}
      query={query}
      command={command}
      {...reads}
    />
  );
}
function SelfDocumentContent({
  query: initialQuery,
  command,
  read = readContextDocuments,
  file = readPrivateDocument,
}: { query: SelfDocumentQuery; command: Command } & Reads) {
  const [query] = useState(initialQuery),
    t = useTranslations("documents");
  const [page, setPage] = useState<DocumentView[] | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<DocumentView | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    source = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (command.message === "saved" || command.message === "failed") heading.current?.focus();
  }, [command.message]);
  useEffect(() => {
    let active = true;
    void read(query)
      .then((rows) => {
        if (active) setPage(rows);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [query, read, retry]);
  function reload() {
    setPage(null);
    setSelected(null);
    setError(false);
    setRetry((n) => n + 1);
  }
  return (
    <section aria-label={t("selfTitle")} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
          {t("selfTitle")}
        </h3>
        <Button
          variant="outline"
          className="h-auto min-h-11 max-w-full whitespace-normal"
          onClick={reload}
          disabled={command.busy}
        >
          {t("reload")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("selfHint")}</p>
      <SetupFeedback command={command} />
      {error ? (
        <p role="alert">{t("requirementsError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : !page.length ? (
        <p>{t("selfNoRequirements")}</p>
      ) : (
        <ul className="space-y-3">
          {page.map((doc) => (
            <li key={doc.version_id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="min-w-0 break-words font-medium">{doc.name}</h4>
                <Badge variant="outline" className="max-w-full whitespace-normal wrap-anywhere">
                  {t(doc.accepted ? "requirementMet" : "acceptanceRequired")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(doc.accepted ? "acceptanceCarriedHint" : "acceptanceRequiredHint")}
              </p>
              <Button
                variant="outline"
                className="h-auto min-h-11 max-w-full whitespace-normal"
                disabled={command.busy || !!command.pending}
                onClick={(e) => {
                  source.current = e.currentTarget;
                  setSelected(doc);
                }}
              >
                {t("openDocument", { name: doc.name })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <PrivateDocument
          key={`${selected.version_id}:${selected.file.id}`}
          query={query}
          expected={selected}
          read={file}
          onClose={() => {
            setSelected(null);
            requestAnimationFrame(() =>
              (source.current?.isConnected ? source.current : heading.current)?.focus(),
            );
          }}
        >
          {!selected.accepted && (
            <AcceptanceConsent
              query={query}
              doc={selected}
              command={command}
              onSubmitting={() => {
                setSelected(null);
                heading.current?.focus();
              }}
            />
          )}
        </PrivateDocument>
      )}
    </section>
  );
}
function AcceptanceConsent({
  query,
  doc,
  command,
  onSubmitting,
}: {
  query: SelfDocumentQuery;
  doc: DocumentView;
  command: Command;
  onSubmitting: () => void;
}) {
  const t = useTranslations("documents"),
    id = useId(),
    [consent, setConsent] = useState(false);
  const disabled = command.busy || !!command.pending;
  return (
    <form
      className="space-y-4 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!consent || disabled) return;
        onSubmitting();
        void command.run({
          operation: "document_accept_v1",
          input: { ...query, document_version_id: doc.version_id, operation_key: v7() },
        });
      }}
    >
      <p className="text-sm">{t("acceptSelfHint")}</p>
      <Label htmlFor={id} className="flex min-h-11 items-start gap-3 leading-relaxed">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 shrink-0"
          checked={consent}
          disabled={disabled}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {t("acceptSelfConsent", { name: doc.name })}
      </Label>
      <Button
        type="submit"
        className="h-auto min-h-11 max-w-full whitespace-normal"
        disabled={!consent || disabled}
      >
        {t("acceptSelf")}
      </Button>
    </form>
  );
}
