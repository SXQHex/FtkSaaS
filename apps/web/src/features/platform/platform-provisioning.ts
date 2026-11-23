import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type AccountReadContext } from "../../lib/scoped-backend";
import { readPlatformStudioQueue } from "../workspace/studio-setup-request";
import { platformRequest, readDirectory, readPlatformOrganization } from "./platform-directory";

type Backend = Awaited<ReturnType<typeof scopedBackend>>;
const plan = z.object({
  kind: z.literal("initial_plan"),
  id: z.uuid(),
  name: z.string().min(1),
  period: z.enum(["monthly", "yearly"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const operator = z.object({
  kind: z.literal("operator"),
  account_id: z.uuid().nullable(),
  display_name: z.string().nullable(),
  eligible: z.boolean(),
  granted_at: z.iso.datetime({ offset: true }),
});
const verifiedAccount = z.object({ kind: z.literal("verified_account"), account_id: z.uuid() });
export const platformEmail = z.string().trim().pipe(z.email());
export const platformOperatorKey = (accountId: string) => ["platform-operators", accountId];
export type StudioRequest = Awaited<ReturnType<typeof readPlatformStudioQueue>>["items"][number];
export type ProvisioningIntent = {
  accountId: string;
  key: string;
  name: string;
  ownerId: string;
  planId: string;
  email?: string;
  requestId?: string;
};
export type OperatorIntent = {
  accountId: string;
  key: string;
  target: string;
  enabled: boolean;
  reason: string;
  email?: string;
};

async function allRows<T>(
  backend: Backend,
  view: "initial_plans" | "operators",
  schema: z.ZodType<T>,
) {
  const rows: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await readDirectory(backend, { view }, schema, cursor);
    rows.push(...result.items);
    cursor = result.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("PLATFORM_DIRECTORY_CURSOR_REPEATED");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return rows;
}

async function lookup(backend: Backend, email: string) {
  const result = await readDirectory(
    backend,
    {
      view: "verified_accounts",
      account_email: platformEmail.parse(email),
    },
    verifiedAccount,
  );
  if (result.next_cursor || result.items.length > 1) throw Error("PLATFORM_ACCOUNT_SOURCE_INVALID");
  return result.items[0]?.account_id;
}

export async function readVerifiedPlatformAccount(
  accountId: string,
  email: string,
  readContext?: AccountReadContext,
) {
  return lookup(await scopedBackend({ accountId }, undefined, readContext), email);
}
export async function readPlatformPlans(accountId: string, readContext?: AccountReadContext) {
  return allRows(await scopedBackend({ accountId }, undefined, readContext), "initial_plans", plan);
}
export async function readPlatformOperators(accountId: string, readContext?: AccountReadContext) {
  return allRows(await scopedBackend({ accountId }, undefined, readContext), "operators", operator);
}

export function provisionIntent(intent: Omit<ProvisioningIntent, "key">): ProvisioningIntent {
  return { ...intent, key: uuidv7() };
}
export function operatorIntent(intent: Omit<OperatorIntent, "key">): OperatorIntent {
  return { ...intent, key: uuidv7() };
}

export async function findStudioRequest(accountId: string, requestId: string) {
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await readPlatformStudioQueue(accountId, cursor);
    const row = page.items.find((candidate) => candidate.id === requestId);
    if (row) return row;
    cursor = page.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw Error("PLATFORM_DIRECTORY_CURSOR_REPEATED");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return null;
}

export async function confirmProvision(intent: ProvisioningIntent) {
  const plans = await readPlatformPlans(intent.accountId);
  if (!plans.some((row) => row.id === intent.planId)) throw Error("PLATFORM_PLAN_CHANGED");
  if (intent.requestId) {
    const row = await findStudioRequest(intent.accountId, intent.requestId);
    if (row?.account_id !== intent.ownerId || row.name !== intent.name)
      throw Error("PLATFORM_REQUEST_CHANGED");
  } else if (
    !intent.email ||
    (await readVerifiedPlatformAccount(intent.accountId, intent.email)) !== intent.ownerId
  ) {
    throw Error("PLATFORM_ACCOUNT_CHANGED");
  }
}
export async function createPlatformOrganization(intent: ProvisioningIntent) {
  return (await scopedBackend(intent)).call("organization_create_v1", {
    ...platformRequest(),
    operation_key: intent.key,
    verified_account_id: intent.ownerId,
    name: intent.name,
    initial_plan_id: intent.planId,
    ...(intent.requestId ? { studio_setup_id: intent.requestId } : {}),
  });
}
export async function readProvisionedOrganization(intent: ProvisioningIntent, id?: string) {
  if (!id) throw Error("PLATFORM_ORGANIZATION_RESULT_INVALID");
  const result = await readPlatformOrganization(intent.accountId, id);
  if (result?.organization.name !== intent.name || result.owner?.account_id !== intent.ownerId)
    throw Error("PLATFORM_ORGANIZATION_RESULT_INVALID");
  return result.organization.id;
}

export async function confirmOperator(intent: OperatorIntent) {
  const roster = await readPlatformOperators(intent.accountId);
  if (roster.some((row) => row.account_id === intent.target) === intent.enabled)
    throw Error("PLATFORM_OPERATOR_CHANGED");
  if (
    intent.enabled &&
    (!intent.email ||
      (await readVerifiedPlatformAccount(intent.accountId, intent.email)) !== intent.target)
  )
    throw Error("PLATFORM_ACCOUNT_CHANGED");
}
export async function writeOperator(intent: OperatorIntent) {
  const result = await (
    await scopedBackend(intent)
  ).call("platform_operator_access_set_v1", {
    ...platformRequest(),
    operation_key: intent.key,
    verified_account_id: intent.target,
    enabled: intent.enabled,
    reason: intent.reason,
  });
  if (result.account_id !== intent.target || result.enabled !== intent.enabled)
    throw Error("PLATFORM_OPERATOR_RESULT_INVALID");
  return { primary_id: result.account_id };
}
export async function readOperatorResult(intent: OperatorIntent, id?: string) {
  if (id !== intent.target) throw Error("PLATFORM_OPERATOR_RESULT_INVALID");
  if (!intent.enabled && id === intent.accountId) return null;
  const roster = await readPlatformOperators(intent.accountId);
  if (roster.some((row) => row.account_id === id) !== intent.enabled)
    throw Error("PLATFORM_OPERATOR_RESULT_INVALID");
  return roster;
}
