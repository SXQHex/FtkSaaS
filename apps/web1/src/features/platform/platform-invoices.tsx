import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import type { PlatformInvoice } from "../../lib/api-contracts/generated";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { usePlatformActivity } from "./platform-activity-context";
import { platformAccessDenied } from "./platform-directory";
import {
  invoiceDate,
  invoiceFileMime,
  invoiceNumber,
  invoiceUploadIntent,
  publishPlatformInvoice,
  uploadPlatformInvoice,
  type StagedInvoice,
} from "./platform-invoice-upload";

export function PlatformInvoices({
  accountId,
  orgId,
  name,
  onDenied,
}: {
  accountId: string;
  orgId: string;
  name: string;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const copy = t(($) => $.platform.invoices, { returnObjects: true });
  const { record } = usePlatformActivity();
  const id = useId();
  const number = useRef<HTMLInputElement>(null);
  const date = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const staging = useRef(false);
  const acknowledged = useRef<PlatformInvoice | undefined>(undefined);
  const [readingFile, setReadingFile] = useState(false);
  const [invalid, setInvalid] = useState<"number" | "date" | "file">();
  const [staged, setStaged] = useState<StagedInvoice>();
  const [published, setPublished] = useState<PlatformInvoice>();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const onAccessLost = (error: unknown) => {
    if (!platformAccessDenied(error)) return false;
    onDenied();
    return true;
  };
  const upload = useMemberCommand({
    write: uploadPlatformInvoice,
    readResult: async (intent, invoiceId) => {
      if (!invoiceId) throw Error("INVOICE_UPLOAD_RESULT_INVALID");
      return { id: invoiceId, intent };
    },
    onRefresh: async (result) => setStaged(result),
    onAccessLost,
  });
  const publish = useMemberCommand({
    write: async (value: StagedInvoice) => {
      const result = await publishPlatformInvoice(value);
      acknowledged.current = result;
      return { primary_id: result.id };
    },
    readResult: async (value, invoiceId) => {
      const result = acknowledged.current;
      if (!result || invoiceId !== value.id || result.id !== invoiceId)
        throw Error("INVOICE_PUBLISH_RESULT_INVALID");
      return result;
    },
    onRefresh: async (row) => {
      if (!staged) throw Error("INVOICE_PUBLISH_RESULT_INVALID");
      setPublished(row);
      record({ kind: "invoicePublished", key: staged.intent.publishKey, subject: name });
    },
    onAccessLost,
  });
  const locked = readingFile || upload.locked || publish.locked;
  useEffect(() => {
    if (!locked && invalid) ({ number, date, file })[invalid].current?.focus();
  }, [invalid, locked]);
  async function startUpload() {
    if (staging.current || locked || staged || upload.state !== "ready") return;
    const invoice = invoiceNumber.safeParse(number.current?.value);
    if (!invoice.success) return setInvalid("number");
    const issued = invoiceDate.safeParse(date.current?.value);
    if (!issued.success) return setInvalid("date");
    const selected = file.current?.files?.[0];
    if (!selected || !invoiceFileMime(selected)) return setInvalid("file");
    staging.current = true;
    setReadingFile(true);
    setInvalid(undefined);
    try {
      const intent = await invoiceUploadIntent(
        { accountId, orgId },
        invoice.data,
        issued.data,
        selected,
      );
      await upload.start(intent);
    } catch {
      setInvalid("file");
    } finally {
      staging.current = false;
      setReadingFile(false);
    }
  }
  function reset() {
    upload.reset();
    publish.reset();
    setOpen(false);
    setAccepted(false);
    setStaged(undefined);
    setPublished(undefined);
    setInvalid(undefined);
    acknowledged.current = undefined;
    if (file.current) file.current.value = "";
  }
  function closeReview() {
    if (publish.locked) return;
    setOpen(false);
    setAccepted(false);
    if (publish.state !== "saved") publish.reset();
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2 id={`${id}-title`}>{copy.title}</h2>
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!staged && (
          <form
            aria-labelledby={`${id}-title`}
            noValidate
            className="grid max-w-xl gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void startUpload();
            }}
          >
            <Field>
              <FieldLabel htmlFor={`${id}-number`}>{copy.number}</FieldLabel>
              <Input
                ref={number}
                id={`${id}-number`}
                maxLength={128}
                required
                disabled={locked}
                aria-invalid={invalid === "number"}
                aria-describedby={invalid === "number" ? `${id}-number-error` : undefined}
              />
              {invalid === "number" && (
                <FieldError id={`${id}-number-error`}>{copy.numberError}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-date`}>{copy.date}</FieldLabel>
              <Input
                ref={date}
                id={`${id}-date`}
                type="date"
                required
                disabled={locked}
                aria-invalid={invalid === "date"}
                aria-describedby={invalid === "date" ? `${id}-date-error` : undefined}
              />
              {invalid === "date" && (
                <FieldError id={`${id}-date-error`}>{copy.dateError}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-file`}>{copy.file}</FieldLabel>
              <Input
                ref={file}
                id={`${id}-file`}
                type="file"
                accept=".pdf,.zip,application/pdf,application/zip"
                required
                disabled={locked}
                aria-invalid={invalid === "file"}
                aria-describedby={`${id}-file-hint${invalid === "file" ? ` ${id}-file-error` : ""}`}
              />
              <FieldDescription id={`${id}-file-hint`}>{copy.fileHint}</FieldDescription>
              {invalid === "file" && (
                <FieldError id={`${id}-file-error`}>{copy.fileError}</FieldError>
              )}
            </Field>
            <Button type="submit" className="w-fit" isDisabled={locked || upload.state !== "ready"}>
              {copy.upload}
            </Button>
            <EventCommandNotice command={upload} onReload={reset} receiptAvailable={false} />
          </form>
        )}
        {staged && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="font-medium wrap-anywhere">
              {staged.intent.invoice_number} · {staged.intent.issued_on}
            </p>
            <p className="text-sm text-muted-foreground">
              {staged.intent.mime === "application/pdf" ? "PDF" : "ZIP"} ·{" "}
              {t(($) => $.platform.invoices.bytes, { count: staged.intent.body.byteLength })}
            </p>
            <p className="text-sm">
              {copy.hash} <span className="font-mono wrap-anywhere">{staged.intent.checksum}</span>
            </p>
            <p role="status">{published ? copy.published : copy.staged}</p>
            <div className="flex flex-wrap gap-2">
              {!published && (
                <Button isDisabled={locked} onPress={() => setOpen(true)}>
                  {copy.publish}
                </Button>
              )}
              <Button variant="outline" isDisabled={locked} onPress={reset}>
                {copy.newInvoice}
              </Button>
            </div>
          </div>
        )}
        {open && staged && (
          <SettingsReviewDialog
            open
            title={copy.publish}
            description={copy.publishEffect}
            rows={[
              {
                id: staged.id,
                title: name,
                detail: staged.intent.invoice_number + " · " + staged.intent.issued_on,
              },
            ]}
            accepted={accepted}
            onAccepted={setAccepted}
            onClose={closeReview}
            locked={publish.locked}
            onApply={publish.state === "ready" ? () => void publish.start(staged) : undefined}
            recoveryActions={
              <EventCommandNotice
                command={publish}
                onReload={closeReview}
                receiptAvailable={false}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
