import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type AccountReadContext } from "../../lib/scoped-backend";

export const studioSetupName = z.string().trim().min(1).max(200);
const pageSize = 50;
const request = z
  .object({
    id: z.uuid(),
    account_id: z.uuid(),
    name: studioSetupName,
    state: z.enum(["pending", "fulfilled"]),
    organization_id: z.uuid().nullable(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .refine((row) => (row.state === "pending") === (row.organization_id === null));
const page = z.object({
  items: z.array(request).max(pageSize),
  next_cursor: z.string().min(1).nullish(),
  as_of: z.iso.datetime({ offset: true }),
});
const common = () => ({ client_api_version: 1 as const, request_id: uuidv7() });

async function readStudioSetupPage(
  backend: Awaited<ReturnType<typeof scopedBackend>>,
  cursor: string | undefined,
  platformQueue = false,
) {
  return page.parse(
    await backend.call("studio_setup_list_v1", {
      ...common(),
      ...(platformQueue ? { platform_queue: true } : {}),
      page: { limit: pageSize, ...(cursor ? { cursor } : {}) },
    }),
  );
}

export async function readPlatformStudioQueue(
  accountId: string,
  cursor?: string,
  context?: AccountReadContext,
) {
  const backend = await scopedBackend({ accountId }, undefined, context);
  const result = await readStudioSetupPage(backend, cursor, true);
  if (result.items.some((row) => row.state !== "pending"))
    throw Error("STUDIO_SETUP_SOURCE_INVALID");
  return result;
}

export async function readOwnStudioSetup(accountId: string, context?: AccountReadContext) {
  const backend = await scopedBackend({ accountId }, undefined, context);
  const rows = new Map<string, z.infer<typeof request>>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await readStudioSetupPage(backend, cursor);
    for (const row of result.items) {
      if (row.account_id !== accountId || rows.has(row.id))
        throw Error("STUDIO_SETUP_SOURCE_INVALID");
      rows.set(row.id, row);
    }
    cursor = result.next_cursor ?? undefined;
    if (cursor) {
      if (cursors.has(cursor)) throw Error("STUDIO_SETUP_SOURCE_INVALID");
      cursors.add(cursor);
    }
  } while (cursor);
  const items = [...rows.values()];
  const pending = items.filter((row) => row.state === "pending");
  if (pending.length > 1) throw Error("STUDIO_SETUP_SOURCE_INVALID");
  return { items, current: pending[0] ?? items.at(-1) };
}

export function studioSetupIntent(
  accountId: string,
  name: string,
  before: Awaited<ReturnType<typeof readOwnStudioSetup>>,
) {
  return {
    accountId,
    key: uuidv7(),
    name: studioSetupName.parse(name),
    knownIds: before.items.map((row) => row.id),
  };
}
type Intent = ReturnType<typeof studioSetupIntent>;

export async function openStudioSetup(intent: Intent) {
  const backend = await scopedBackend(intent);
  return backend.call("studio_setup_open_v1", {
    ...common(),
    operation_key: intent.key,
    name: intent.name,
  });
}

export async function readStudioSetupReceipt(intent: Intent) {
  const backend = await scopedBackend(intent);
  const receipt = await backend.call("operation_status_get_v1", {
    ...common(),
    operation: "studio_setup_open_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "studio_setup_open_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "accounts")
  )
    throw Error("STUDIO_SETUP_RECEIPT_INVALID");
  return receipt;
}

export async function readStudioSetupResult(intent: Intent, id?: string) {
  const data = await readOwnStudioSetup(intent.accountId);
  const matches = data.items.filter(
    (row) =>
      row.name === intent.name && !intent.knownIds.includes(row.id) && (!id || row.id === id),
  );
  if (matches.length !== 1) throw Error("STUDIO_SETUP_RESULT_INVALID");
  return data;
}
