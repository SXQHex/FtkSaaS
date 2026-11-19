import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend } from "../../lib/scoped-backend";
import type {
  PlatformDirectoryOrganization,
  RequestPlatformDirectoryGet,
} from "../../lib/api-contracts/generated";

const timestamp = z.iso.datetime({ offset: true });
export const platformOrganization = z.object({
  kind: z.literal("organization"),
  id: z.uuid(),
  name: z.string().min(1),
  version: z.number().int().positive().safe(),
  state: z.enum(["active", "closed", "deletion_pending", "deleted"]),
  access_mode: z.enum(["normal", "grace", "bootstrap", "closed"]),
  subscription_state: z
    .enum(["pending_payment", "active", "grace", "suspended", "ended"])
    .nullable(),
  grace_until: timestamp.nullable(),
  platform_suspended: z.boolean(),
});
const owner = z.object({
  kind: z.literal("owner"),
  org_id: z.uuid(),
  person_id: z.uuid(),
  display_name: z.string().min(1),
  account_id: z.uuid().nullable(),
});
const size = 50;
type Backend = Awaited<ReturnType<typeof scopedBackend>>;
export const platformRequest = () => ({ client_api_version: 1 as const, request_id: uuidv7() });
export const platformOrganizationsKey = (accountId: string) => [
  "platform-organizations",
  accountId,
];

export async function readDirectory<T>(
  backend: Backend,
  options: Pick<
    RequestPlatformDirectoryGet,
    "view" | "scope" | "payment_id" | "payment_state" | "account_email"
  >,
  item: z.ZodType<T>,
  cursor?: string,
) {
  return z
    .object({
      items: z.array(item).max(size),
      next_cursor: z.string().min(1).nullish(),
      as_of: timestamp,
    })
    .parse(
      await backend.call("platform_directory_get_v1", {
        ...platformRequest(),
        ...options,
        page: { limit: size, ...(cursor ? { cursor } : {}) },
      }),
    );
}

export function platformAccessDenied(error: unknown) {
  if (error instanceof BackendError)
    return ["FORBIDDEN", "AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code);
  return error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message);
}

export async function readPlatformOrganizations(accountId: string, cursor?: string) {
  const backend = await scopedBackend({ accountId });
  return readDirectory(backend, { view: "organizations" }, platformOrganization, cursor);
}

export async function organizationAt(backend: Backend, id: string) {
  const scope = { org_id: z.uuid().parse(id) };
  const result = await readDirectory(
    backend,
    { view: "organizations", scope },
    platformOrganization,
  );
  if (result.next_cursor || result.items.length > 1 || result.items.some((row) => row.id !== id))
    throw Error("PLATFORM_ORGANIZATION_SOURCE_INVALID");
  return result.items[0];
}

export async function readPlatformOrganization(accountId: string, id: string) {
  const backend = await scopedBackend({ accountId });
  const organization = await organizationAt(backend, id);
  if (!organization) return null;
  const result = await readDirectory(backend, { view: "owners", scope: { org_id: id } }, owner);
  if (
    result.next_cursor ||
    result.items.length > 1 ||
    result.items.some((row) => row.org_id !== id)
  )
    throw Error("PLATFORM_OWNER_SOURCE_INVALID");
  return { organization, owner: result.items[0] };
}

export const suspensionReason = z.string().trim().min(1).max(1000);
export function suspensionIntent(
  accountId: string,
  row: PlatformDirectoryOrganization,
  reason: string,
) {
  return {
    accountId,
    orgId: row.id,
    version: row.version,
    suspended: !row.platform_suspended,
    reason: suspensionReason.parse(reason),
    key: uuidv7(),
  };
}
type SuspensionIntent = ReturnType<typeof suspensionIntent>;
export async function writeSuspension(intent: SuspensionIntent) {
  const backend = await scopedBackend(intent);
  return backend.call("platform_organization_suspension_set_v1", {
    ...platformRequest(),
    org_id: intent.orgId,
    expected_version: intent.version,
    suspended: intent.suspended,
    reason: intent.reason,
    operation_key: intent.key,
  });
}

export async function readSuspensionResult(intent: SuspensionIntent, id?: string) {
  if (id !== intent.orgId) throw Error("PLATFORM_SUSPENSION_RESULT_INVALID");
  const source = await readPlatformOrganization(intent.accountId, id);
  if (
    !source ||
    source.organization.version <= intent.version ||
    source.organization.platform_suspended !== intent.suspended
  )
    throw Error("PLATFORM_SUSPENSION_RESULT_INVALID");
  return source;
}
