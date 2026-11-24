import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { getBackend, queryBackendRead } from "./backend";

const platformScope = z.object({
  organizations: z.boolean(),
  organization_create: z.boolean(),
  owner_manage: z.boolean(),
  payment_verify: z.boolean(),
  grace_extend: z.boolean(),
  organization_suspend: z.boolean(),
  operator_manage: z.boolean().optional(),
});

const identityText = z.string().nullable();
const verifiedAt = z.iso.datetime({ offset: true }).nullable();
const identity = z.object({
  given_name: identityText,
  family_name: identityText,
  email: identityText,
  phone: identityText,
  pending_email: identityText,
  pending_phone: identityText,
  email_verified_at: verifiedAt,
  phone_verified_at: verifiedAt,
  unverified_phone: identityText,
});

const actor = z.object({
  id: z.guid(),
  state: z.enum(["active", "pending", "deletion_pending", "deleted"]),
  display_name: z.string(),
  identity: identity.optional(),
  platform_scope: platformScope.optional(),
});

export async function readAccount(
  includePlatformScope = false,
  accessToken?: string,
  signal?: AbortSignal,
) {
  const account = await queryBackendRead(
    getBackend(accessToken),
    "account_get_v1",
    {
      client_api_version: 1,
      request_id: uuidv7(),
      ...(includePlatformScope ? { include_platform_scope: true } : {}),
    },
    signal,
  );
  if (!actor.safeParse(account).success) throw new Error("ACCOUNT_PROJECTION_INVALID");
  return account;
}
