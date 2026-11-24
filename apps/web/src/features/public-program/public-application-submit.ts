import { readPublicGatewayUrl } from "../../lib/public-config";
import type { DiscoveredPublicForm } from "./public-discovery";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type { CrmContactIntake, RequestPublicApplicationSubmit } from "@ftksaas/api-contracts";
import { readEnvelope } from "../../lib/backend";

const intakeSchema = z.object({
  display_name: z.string().trim().min(1).max(200),
  email: z.email().max(320).optional(),
  phone: z.string().min(7).max(40).optional(),
  interest: z.string().min(1).max(1000).optional(),
  message: z.string().max(10000).optional(),
  partner_name: z.string().max(200).optional(),
  mode: z.string().max(200).optional(),
  level: z.string().max(200).optional(),
  consents: z
    .array(
      z.object({
        purpose: z.string(),
        version: z.string(),
        accepted: z.boolean(),
        occurred_at: z.iso.datetime(),
      }),
    )
    .max(20),
});
export type PublicApplicationAttempt = {
  formId: string;
  centerId?: string;
  key: string;
  intake: CrmContactIntake;
};
export type PublicEventApplicationAttempt = {
  publicationId: string;
  slug: string;
  centerId?: string;
  key: string;
  contact: string;
};

export function preparePublicEventApplication(
  publicationId: string,
  slug: string,
  values: FormData,
  centerId?: string,
): PublicEventApplicationAttempt {
  return {
    publicationId: z.uuid().parse(publicationId),
    slug: z.string().min(1).parse(slug),
    ...(centerId ? { centerId: z.uuid().parse(centerId) } : {}),
    key: uuidv7(),
    contact: z.string().trim().pipe(z.email().max(320)).parse(values.get("email")),
  };
}

export function preparePublicApplication(
  form: DiscoveredPublicForm,
  values: FormData,
  centerId?: string,
): PublicApplicationAttempt {
  if (values.get("website")) throw new Error("HONEYPOT");
  const fields: Record<string, string> = {};
  for (const name of [
    "display_name",
    "email",
    "phone",
    "interest",
    "message",
    "partner_name",
    "mode",
    "level",
  ]) {
    const value = values.get(name);
    if (typeof value === "string" && value.trim()) fields[name] = value.trim();
  }
  if (
    (!fields.phone && !fields.email) ||
    (form.contact_requirement !== "either" && !fields[form.contact_requirement])
  )
    throw new Error("CONTACT_REQUIRED");
  if (form.required_fields.some((name) => !fields[name])) throw new Error("REQUIRED_FIELD");
  const occurred_at = new Date().toISOString();
  const consents = form.consents.map((consent, index) => {
    const accepted = values.has(`consent-${index}`);
    if (consent.required && !accepted) throw new Error("CONSENT_REQUIRED");
    return { purpose: consent.purpose, version: consent.version, accepted, occurred_at };
  });
  // The native generator models maxItems as tuple unions; the parsed bounded array preserves that wire contract.
  const intake = intakeSchema.parse({ ...fields, consents }) as CrmContactIntake;
  return {
    formId: z.uuid().parse(form.form_id),
    ...(centerId ? { centerId: z.uuid().parse(centerId) } : {}),
    key: uuidv7(),
    intake,
  };
}

export async function submitPublicApplication(
  attempt: PublicApplicationAttempt | PublicEventApplicationAttempt,
  proof: string,
) {
  const base = readPublicGatewayUrl();
  if (!base || !proof.trim()) throw new Error("PUBLIC_SUBMIT_UNAVAILABLE");
  const request: RequestPublicApplicationSubmit = {
    client_api_version: 1,
    request_id: uuidv7(),
    ...("publicationId" in attempt
      ? {
          publication_id: attempt.publicationId,
          event_application: true,
          page_slug: attempt.slug,
          contact: attempt.contact,
        }
      : { form_id: attempt.formId, contact_intake: attempt.intake }),
    ...(attempt.centerId ? { center_id: attempt.centerId } : {}),
    client_request_key: attempt.key,
    bot_proof: proof,
  };
  const response = await fetch(`${base}/api/public/application`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = await readEnvelope(response);
  return "publicationId" in attempt
    ? z.object({ accepted: z.literal(true), application_state: z.literal("pending") }).parse(result)
    : z.object({ accepted: z.literal(true) }).parse(result);
}
