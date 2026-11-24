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

const actor = z.object({
  id: z.uuid(),
  state: z.enum(["active", "pending", "deletion_pending", "deleted"]),
  display_name: z.string(),
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
