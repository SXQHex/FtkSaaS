"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Operations } from "@ftksaas/api-contracts";
import { SelfDocumentView } from "../documents/self-documents";
import { ContextDocuments } from "../documents/context-documents";
import type { DocumentReadActions, DocumentQuery } from "../../lib/document-requirements";
import { DocumentPublicationForm } from "../documents/document-publication";
import type { useSetupCommand } from "../setup/setup-command";
const org = "019a2b3c-4d5e-7000-8000-000000000080",
  id = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: id, orgId: org, centerId: id };
async function previewPublication(): Promise<
  Operations["document_publication_preview_v1"]["response"]["data"]
> {
  return {
    preview: {
      id,
      token: "synthetic-design-preview",
      scope_hash: "synthetic",
      dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
      effects: [],
      blockers: [],
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
    affected: [
      { subject: { type: "reservations", id }, version: 3, person_id: org, center_id: id },
    ],
    preserves_reservations: true,
  };
}
const readingQuery: DocumentQuery = {
  org_id: org,
  person_id: id,
  context: { gate: "reservation", subject: { type: "reservations", id } },
};
const readingActions: DocumentReadActions = {
  read: async () => [
    {
      id,
      version_id: id,
      name: "Örnek katılım koşulları",
      required_at: "reservation",
      accepted: false,
      content_hash: "synthetic-design-only",
      file: { type: "files", id },
    },
  ],
  person: async () => ({
    id,
    display_name: "Deniz Örnek",
    relationships: [],
    discipline_relationships: [],
    version: 1,
  }),
  file: async () =>
    new File(["Sentetik belge. Okumak veya indirmek kabul kaydı oluşturmaz."], "document.txt", {
      type: "text/plain",
    }),
};
export function DocumentsPreview() {
  const t = useTranslations("documents");
  const [published, setPublished] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const selfCommand: ReturnType<typeof useSetupCommand> = {
    pending: null,
    busy: false,
    message: accepted ? "saved" : "",
    run: async (input) => {
      if (input?.operation === "document_accept_v1") setAccepted(true);
    },
    check: async () => {
      throw Error("No pending design command");
    },
  };

  const command: ReturnType<typeof useSetupCommand> = {
    pending: null,
    busy: false,
    message: "",
    run: async (input) => {
      if (input?.operation === "document_version_publish_v1") setPublished(true);
    },
    check: async () => {
      throw Error("No pending design command");
    },
  };
  return (
    <main
      id="main-content"
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-5 py-8 wrap-anywhere"
    >
      <h1 className="text-2xl font-semibold">{t("demoTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("demoHint")}</p>
      <section className="space-y-5 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("publishedTitle")}</h2>
        {published ? (
          <output>{t("demoSaved")}</output>
        ) : (
          <DocumentPublicationForm
            scope={scope}
            fileId={id}
            command={command}
            previewPublication={previewPublication}
          />
        )}
      </section>
      <section className="space-y-5 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("sessionDocuments")}</h2>
        <ContextDocuments actorId={id} query={readingQuery} actions={readingActions} />
      </section>
      <section className="min-w-0 space-y-5">
        <h2 className="text-lg font-semibold">{t("selfTitle")}</h2>
        <SelfDocumentView
          key={String(accepted)}
          actorId={id}
          query={{
            org_id: org,
            context: { gate: "reservation", subject: { type: "sessions", id } },
          }}
          command={selfCommand}
          read={async () => [
            {
              id,
              version_id: id,
              name: "Örnek kendi kabul belgesi",
              required_at: "reservation",
              accepted,
              content_hash: "synthetic-design-only",
              file: { type: "files", id },
            },
          ]}
          file={readingActions.file}
        />
      </section>
    </main>
  );
}
