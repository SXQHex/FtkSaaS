import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedUploadUrl, sha256Hex } from "../../lib/document-upload";
import type { PlatformInvoice } from "@ftksaas/api-contracts";
import { maxInvoiceBytes, platformInvoice } from "../../lib/invoice";
import { scopedBackend } from "../../lib/scoped-backend";
import { platformRequest } from "./platform-directory";

export const invoiceNumber = z.string().trim().min(1).max(128);
export const invoiceDate = z.iso.date();

export function invoiceFileMime(file?: File): PlatformInvoice["mime"] | undefined {
  if (!file || file.size === 0 || file.size > maxInvoiceBytes) return undefined;
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".pdf") && ["", "application/pdf"].includes(file.type))
    return "application/pdf";
  if (
    filename.endsWith(".zip") &&
    ["", "application/zip", "application/x-zip-compressed"].includes(file.type)
  )
    return "application/zip";
}

export async function invoiceUploadIntent(
  scope: { accountId: string; orgId: string },
  number: string,
  date: string,
  file: File,
) {
  const mime = invoiceFileMime(file);
  if (!mime) throw Error("INVOICE_FILE_INVALID");
  const body = new Uint8Array(await file.arrayBuffer());
  if (body.length !== file.size) throw Error("INVOICE_FILE_INVALID");
  const pdf = new TextDecoder().decode(body.subarray(0, 5)) === "%PDF-";
  const zip = body[0] === 0x50 && body[1] === 0x4b && body[2] === 3 && body[3] === 4;
  if (mime === "application/pdf" ? !pdf : !zip) throw Error("INVOICE_FILE_INVALID");
  return {
    scope,
    body,
    invoice_number: invoiceNumber.parse(number),
    issued_on: invoiceDate.parse(date),
    mime,
    checksum: await sha256Hex(body),
    uploadKey: uuidv7(),
    publishKey: uuidv7(),
  };
}

export type InvoiceUploadIntent = Awaited<ReturnType<typeof invoiceUploadIntent>>;
export type StagedInvoice = {
  intent: Omit<InvoiceUploadIntent, "body" | "uploadKey"> & { bytes: number };
  id: string;
};

export async function uploadPlatformInvoice(intent: InvoiceUploadIntent) {
  const backend = await scopedBackend(intent.scope);
  const upload = await backend.call("platform_invoice_upload_prepare_v1", {
    ...platformRequest(),
    org_id: intent.scope.orgId,
    operation_key: intent.uploadKey,
    invoice_number: intent.invoice_number,
    issued_on: intent.issued_on,
    mime: intent.mime,
    bytes: intent.body.byteLength,
    checksum: intent.checksum,
  });
  const id = z.uuid().parse(upload.invoice_id);
  if (upload.upload_url !== null) {
    const url = scopedUploadUrl(
      import.meta.env.VITE_SUPABASE_URL,
      upload.upload_url,
      "ftksaas-invoices",
      intent.scope.orgId,
      id,
    );
    if (!url) throw Error("INVOICE_UPLOAD_UNAVAILABLE");
    const response = await fetch(url, {
      method: "PUT",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "content-type": intent.mime,
      },
      body: intent.body,
    });
    // On a lost response or conflict, native prepare verifies the stored bytes on replay.
    if (!response.ok) throw Error("INVOICE_TRANSFER_UNCONFIRMED");
  }
  return { primary_id: id };
}

export async function publishPlatformInvoice({
  id,
  intent,
}: StagedInvoice): Promise<PlatformInvoice> {
  const backend = await scopedBackend(intent.scope);
  const row = platformInvoice.parse(
    await backend.call("platform_invoice_publish_v1", {
      ...platformRequest(),
      org_id: intent.scope.orgId,
      operation_key: intent.publishKey,
      invoice_id: id,
    }),
  );
  if (
    row.id !== id ||
    row.invoice_number !== intent.invoice_number ||
    row.issued_on !== intent.issued_on ||
    row.mime !== intent.mime ||
    row.bytes !== intent.bytes
  )
    throw Error("INVOICE_PUBLISH_RESULT_INVALID");
  return row;
}
