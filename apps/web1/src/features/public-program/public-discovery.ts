import { z } from "zod";
const text = z.string().min(1);
const consent = z
  .object({
    purpose: text,
    version: text,
    required: z.boolean(),
    content_template_id: z.uuid(),
    source_version: text,
    content_hash: z.string().regex(/^[a-f0-9]{64}$/),
    content: z.object({
      name: text.max(200),
      language: z
        .string()
        .regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/)
        .max(35),
      template_id: text.max(128),
      template_version: text.max(64),
      text: text.max(262144),
    }),
  })
  .refine(
    (value) => value.version === value.source_version,
    "Public consent source version mismatch",
  );
const form = z
  .object({
    form_id: z.uuid(),
    contact_requirement: z.enum(["phone", "email", "either"]),
    required_fields: z.array(z.enum(["interest", "message", "partner_name", "mode", "level"])),
    consents: z.array(consent).min(1).max(20),
  })
  .refine(
    (value) =>
      new Set(value.consents.map((row) => `${row.purpose}:${row.version}`)).size ===
      value.consents.length,
    "Repeated public consent source",
  );
export const publicApplicationDiscovery = z.discriminatedUnion("state", [
  z.object({ state: z.literal("open"), form }),
  z.object({ state: z.enum(["closed", "unavailable"]), form: z.null() }),
]);

export type DiscoveredPublicForm = Extract<
  z.infer<typeof publicApplicationDiscovery>,
  { state: "open" }
>["form"];
