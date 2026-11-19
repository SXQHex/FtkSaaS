import { z } from "zod";

export const maxInvoiceBytes = 2 * 1024 * 1024;
export const platformInvoice = z.object({
  id: z.uuid(),
  invoice_number: z.string().min(1).max(128),
  issued_on: z.iso.date(),
  mime: z.enum(["application/zip", "application/pdf"]),
  bytes: z.number().int().positive().max(maxInvoiceBytes),
  published_at: z.iso.datetime({ offset: true }),
});
