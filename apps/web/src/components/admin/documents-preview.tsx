"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Operations } from "@ftksaas/api-contracts";
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
export function DocumentsPreview() {
  const t = useTranslations("documents");
  const [published, setPublished] = useState(false);
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
    </main>
  );
}
