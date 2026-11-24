import { readFinanceOperationReceipt } from "./finance-receipt";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError, queryBackendRead } from "../../lib/backend";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { FinanceView, RequestCollectionRecord } from "@ftksaas/api-contracts";
import type { FinanceDraft } from "./finance-action-sheet";
import { getTemporal } from "../../lib/temporal";

const money = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
const currency = z.string().regex(/^[A-Z]{3}$/);
const instant = z.iso.datetime({ offset: true });
const version = z.number().int().positive().optional();
const financeView = z.looseObject({
  person_id: z.uuid(),
  currency,
  credit_available_minor: money,
  subscriber_number: z.string().nullish(),
  debts: z.array(
    z.looseObject({
      id: z.uuid(),
      due_at: instant,
      remaining_minor: money,
      center_id: z.uuid().optional(),
      version,
      net_minor: money.optional(),
      paid_minor: money.optional(),
      claimed_minor: money.optional(),
    }),
  ),
  movements: z.looseObject({
    items: z.array(
      z.looseObject({
        id: z.uuid(),
        kind: z.enum(["collection", "refund", "correction_in", "correction_out"]),
        amount_minor: money,
        currency,
        occurred_at: instant,
        center_id: z.uuid().optional(),
        version,
        previous_id: z.uuid().nullish(),
        payment: z
          .looseObject({
            method: z.enum(["cash", "bank_transfer", "card_pos"]),
            reference: z.string().nullish(),
          })
          .nullish(),
      }),
    ),
    as_of: instant,
    next_cursor: z.string().nullish(),
  }),
}) satisfies z.ZodType<FinanceView>;

export interface FinanceSelection {
  personId: string;
  currency: string;
}
export async function readFinancePage(
  scope: ClientScope,
  selection: FinanceSelection,
  cursor?: string,
  signal?: AbortSignal,
  readContext?: AccountReadContext,
  limit: 1 | 20 = 20,
): Promise<FinanceView> {
  z.uuid().parse(selection.personId);
  currency.parse(selection.currency);
  const backend = await scopedBackend(scope, signal, readContext);
  const native = await queryBackendRead(
    backend,
    "finance_get_v1",
    {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: selection.personId,
      currency: selection.currency,
      page: { limit, ...(cursor ? { cursor } : {}) },
    },
    signal,
  );
  const parsed = financeView.safeParse(native);
  if (!parsed.success) throw new Error("FINANCE_SOURCE_UNAVAILABLE");
  const data = parsed.data;
  if (data.person_id !== selection.personId || data.currency !== selection.currency)
    throw new Error("FINANCE_SOURCE_UNAVAILABLE");
  const ids = new Set<string>();
  for (const row of data.movements.items) {
    if (
      row.currency !== selection.currency ||
      (row.center_id && row.center_id !== scope.centerId) ||
      ids.has(row.id)
    )
      throw new Error("FINANCE_SOURCE_UNAVAILABLE");
    ids.add(row.id);
  }
  for (const debt of data.debts) {
    if (debt.center_id && debt.center_id !== scope.centerId)
      throw new Error("FINANCE_SOURCE_UNAVAILABLE");
  }
  signal?.throwIfAborted();
  return data;
}
export async function readCollectionAuthority(
  scope: ClientScope,
  personId: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  try {
    const page = await backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "collection_record_v1",
      selector: { operation: "collection_record_v1", key: { person_id: personId } },
      page: { limit: 1 },
    });
    const item = page.items[0];
    if (
      page.items.length !== 1 ||
      page.next_cursor ||
      !item?.exists ||
      item.entity?.type !== "people" ||
      item.entity.id !== personId ||
      item.current?.operation !== "collection_record_v1" ||
      item.current.values.person_id !== personId
    )
      throw new Error("FINANCE_AUTHORITY_UNAVAILABLE");
    return true;
  } catch (error) {
    if (
      error instanceof BackendError &&
      ["FORBIDDEN", "PLAN_FEATURE_UNAVAILABLE", "SUBSCRIPTION_RESTRICTED", "NOT_FOUND"].includes(
        error.code,
      )
    )
      return false;
    throw error;
  }
}
export function financeDraft(selection?: FinanceSelection): FinanceDraft {
  return {
    personId: selection?.personId ?? "",
    currency: selection?.currency ?? "",
    amount: "",
    method: "",
    reference: "",
    occurredAt: "",
    note: "",
    reason: "",
    direction: "decrease",
    debtId: "",
  };
}
export interface CollectionIntent {
  scope: ClientScope;
  operation: "collection_record_v1";
  selection: FinanceSelection;
  request: Omit<RequestCollectionRecord, "request_id">;
}
export async function collectionIntent(
  scope: ClientScope,
  selection: FinanceSelection,
  timezone: string,
  draft: FinanceDraft,
): Promise<CollectionIntent> {
  const value = z
    .object({
      personId: z.uuid(),
      currency,
      amount: money.refine((value) => BigInt(value) > 0),
      method: z.enum(["cash", "bank_transfer", "card_pos"]),
      reference: z.string(),
      occurredAt: z.string().min(1),
      note: z.string(),
    })
    .superRefine((value, context) => {
      if (value.method !== "cash" && !value.reference.trim())
        context.addIssue({
          code: "custom",
          path: ["reference"],
          message: "FINANCE_REFERENCE_REQUIRED",
        });
    })
    .parse(draft);
  if (value.personId !== selection.personId || value.currency !== selection.currency)
    throw new Error("FINANCE_SCOPE_CHANGED");
  const amount = value.amount,
    method = value.method;
  const temporal = await getTemporal();
  // Reject skipped and repeated wall times. No silent DST choice or device-zone assumption.
  let occurred: string;
  try {
    occurred = temporal.PlainDateTime.from(value.occurredAt)
      .toZonedDateTime(timezone, { disambiguation: "reject" })
      .toInstant()
      .toString();
  } catch {
    throw new Error("FINANCE_TIME_INVALID");
  }
  return {
    scope: { ...scope },
    selection: { ...selection },
    operation: "collection_record_v1",
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      person_id: draft.personId,
      currency: draft.currency,
      amount_minor: amount,
      occurred_at: occurred,
      payment: { method, ...(draft.reference.trim() ? { reference: draft.reference.trim() } : {}) },
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    },
  };
}
export async function writeCollection(intent: CollectionIntent) {
  const backend = await scopedBackend(intent.scope);
  const result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  return result;
}
export function readCollectionReceipt(intent: CollectionIntent) {
  return readFinanceOperationReceipt(intent);
}
export async function readCollectionResult(
  intent: CollectionIntent,
  id?: string,
  onFirstPage?: (view: Awaited<ReturnType<typeof readFinancePage>>) => void,
) {
  z.uuid().parse(id);
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const data = await readFinancePage(intent.scope, intent.selection, cursor),
      row = data.movements.items.find((item) => item.id === id);
    if (!cursor) onFirstPage?.(data);
    if (row) {
      if (
        row.kind !== "collection" ||
        row.amount_minor !== intent.request.amount_minor ||
        row.currency !== intent.request.currency ||
        row.previous_id ||
        Date.parse(row.occurred_at) !== Date.parse(intent.request.occurred_at) ||
        row.payment?.method !== intent.request.payment?.method ||
        (row.payment?.reference ?? null) !== (intent.request.payment?.reference ?? null)
      )
        throw new Error("FINANCE_RESULT_UNAVAILABLE");
      return data;
    }
    cursor = data.movements.next_cursor ?? undefined;
    if (cursor && cursors.has(cursor)) throw new Error("FINANCE_RESULT_UNAVAILABLE");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  throw new Error("FINANCE_RESULT_UNAVAILABLE");
}
