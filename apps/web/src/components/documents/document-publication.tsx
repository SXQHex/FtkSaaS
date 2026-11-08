"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { Operations, DocumentGate } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { setupError, type SetupScope } from "../../lib/studio-setup";
import { previewDocumentPublication, type DocumentPublication } from "../../lib/documents";
import { errorKey, type useSetupCommand } from "../setup/setup-command";
const gates: DocumentGate[] = ["sale", "reservation", "attendance"];
export function DocumentPublicationForm({
  scope,
  fileId,
  documentId,
  command,
  previewPublication = previewDocumentPublication,
}: {
  scope: SetupScope;
  fileId: string;
  documentId?: string;
  command: ReturnType<typeof useSetupCommand>;
  previewPublication?: typeof previewDocumentPublication;
}) {
  const t = useTranslations("documents"),
    setup = useTranslations("setup"),
    format = useFormatter(),
    id = useId();
  const [approval, setApproval] = useState<{
    input: DocumentPublication;
    result: Operations["document_publication_preview_v1"]["response"]["data"];
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = data
      .getAll("gate")
      .filter((gate): gate is DocumentGate => gates.includes(gate as DocumentGate));
    if (!selected.length) {
      setError(t("chooseGate"));
      return;
    }
    const input: DocumentPublication = {
      org_id: scope.orgId,
      ...(scope.centerId ? { center_id: scope.centerId } : {}),
      ...(documentId ? { document_id: documentId } : {}),
      file_id: fileId,
      version_label: String(data.get("version")).trim(),
      scope: scope.centerId
        ? { kind: "center", center_id: scope.centerId }
        : { kind: "organization" },
      requirements: selected.map((gate) => ({
        gate,
        scope: scope.centerId ? { center_ids: [scope.centerId] } : {},
        renewed_acceptance: data.get("renewed") === "on",
      })),
    };
    const attempt = ++generation.current;
    setBusy(true);
    setError("");
    setApproval(null);
    try {
      const result = await previewPublication(input);
      if (attempt === generation.current) setApproval({ input, result });
    } catch (cause) {
      if (attempt === generation.current) setError(setup(errorKey(setupError(cause))));
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label={t("publicationTitle")}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("publicationTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("publicationHint")}</p>
      <form
        className="space-y-4"
        onSubmit={(event) => void preview(event)}
        onChange={() => {
          generation.current++;
          setApproval(null);
          setBusy(false);
        }}
      >
        <fieldset disabled={busy || command.busy || !!command.pending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={id}>{t("versionLabel")}</Label>
            <Input id={id} name="version" required maxLength={200} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t("requiredAt")}</legend>
            {gates.map((gate) => (
              <label key={gate} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="gate" value={gate} />
                {t(`gates.${gate}`)}
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="renewed" />
            {t("renewed")}
          </label>
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            type="submit"
            variant="outline"
          >
            {t(busy ? "previewing" : "preview")}
          </Button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {approval && (
        <PublicationApproval
          key={approval.result.preview.id}
          approval={approval}
          disabled={command.busy || !!command.pending}
          onExpired={() => {
            setApproval(null);
            heading.current?.focus();
            setError(t("previewExpired"));
          }}
          onPublish={() => {
            setApproval(null);
            heading.current?.focus();
            void command.run({
              operation: "document_version_publish_v1",
              input: {
                ...approval.input,
                operation_key: v7(),
                impact_approval: {
                  preview: { id: approval.result.preview.id, token: approval.result.preview.token },
                  accepted_subjects: approval.result.affected.map((item) => item.subject),
                },
              },
            });
          }}
          expiryLabel={format.dateTime(new Date(approval.result.preview.expires_at), {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        />
      )}
    </section>
  );
}
function PublicationApproval({
  approval,
  disabled,
  onPublish,
  onExpired,
  expiryLabel,
}: {
  approval: {
    input: DocumentPublication;
    result: Operations["document_publication_preview_v1"]["response"]["data"];
  };
  disabled: boolean;
  onPublish: () => void;
  onExpired: () => void;
  expiryLabel: string;
}) {
  const t = useTranslations("documents");
  const [accepted, setAccepted] = useState(false);
  const approvalInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    approvalInput.current?.focus();
  }, []);
  const blocked = approval.result.preview.blockers.length > 0;
  return (
    <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
      <p className="font-medium">{t("affected", { count: approval.result.affected.length })}</p>
      <p className="text-sm">{t("preserves")}</p>
      {approval.result.affected.length > 0 && (
        <ul className="space-y-3 text-xs">
          {approval.result.affected.map((item) => (
            <li key={`${item.subject.type}:${item.subject.id}`} className="space-y-1 break-all">
              <p>{t("affectedRecord", { id: item.subject.id, version: item.version })}</p>
              <p>{t("affectedPerson", { id: item.person_id, center: item.center_id })}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs">{t("expiresAt", { time: expiryLabel })}</p>
      {blocked ? (
        <p role="alert">{t("publicationBlocked")}</p>
      ) : (
        <>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              ref={approvalInput}
              className="mt-1 shrink-0"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            {t("approveEffects")}
          </label>
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            disabled={!accepted || disabled}
            onClick={() => {
              if (Date.parse(approval.result.preview.expires_at) <= Date.now()) onExpired();
              else onPublish();
            }}
          >
            {t("publish")}
          </Button>
        </>
      )}
    </div>
  );
}
