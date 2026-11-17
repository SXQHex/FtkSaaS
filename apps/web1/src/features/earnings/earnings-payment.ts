import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import type {
  InstructorFinanceEarning,
  InstructorFinancePayment,
  RequestInstructorPaymentRecord,
  RequestInstructorPaymentCorrect,
} from "../../lib/api-contracts/generated";
import type { EarningsPaymentDraft } from "./earnings-payment-sheet";
import { readEarningsDirectory } from "./earnings-read";

type OmitTransport<T> = Omit<T, "request_id">;
export type EarningsPaymentIntent =
  | {
      scope: ClientScope;
      personId: string;
      operation: "instructor_payment_record_v1";
      request: OmitTransport<RequestInstructorPaymentRecord>;
    }
  | {
      scope: ClientScope;
      personId: string;
      before: InstructorFinancePayment;
      operation: "instructor_payment_correct_v1";
      request: OmitTransport<RequestInstructorPaymentCorrect>;
    };
function amountMinor(value: string, currency: string) {
  const digits =
    new Intl.NumberFormat("tr-TR", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 0;
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  const whole = match?.[1]?.replace(/^0+(?=\d)/, "");
  if (!match || !whole || whole.length > 19 || (match[2]?.length ?? 0) > digits)
    throw Error("EARNINGS_AMOUNT_INVALID");
  const amount =
    BigInt(whole) * 10n ** BigInt(digits) + BigInt((match[2] ?? "").padEnd(digits, "0") || "0");
  if (amount <= 0n || amount > 9223372036854775807n) throw Error("EARNINGS_AMOUNT_INVALID");
  return amount.toString();
}
export async function earningsPaymentIntent(
  scope: ClientScope,
  draft: EarningsPaymentDraft,
  currency: string,
  timezone: string,
  source: {
    personId: string;
    earnings: InstructorFinanceEarning[];
    before?: InstructorFinancePayment;
  },
): Promise<EarningsPaymentIntent> {
  z.uuid().parse(draft.personId);
  z.string()
    .regex(/^[A-Z]{3}$/)
    .parse(currency);
  if (draft.personId !== source.personId) throw Error("EARNINGS_SCOPE_CHANGED");
  const method = z.enum(["cash", "bank_transfer", "card_pos"]).parse(draft.method),
    reference = draft.reference.trim();
  if (method !== "cash" && !reference) throw Error("EARNINGS_REFERENCE_REQUIRED");
  const payment = { method, ...(reference ? { reference } : {}) };
  const amount = amountMinor(draft.amount, currency),
    T = await getTemporal();
  if (source.before) {
    const before = source.before;
    if (
      before.previous_id !== null ||
      before.id !== before.root_payment_id ||
      before.currency !== currency ||
      !draft.reason.trim()
    )
      throw Error("EARNINGS_CORRECTION_INVALID");
    z.enum(["increase", "decrease"]).parse(draft.direction);
    return {
      scope: { ...scope },
      personId: source.personId,
      before: structuredClone(before),
      operation: "instructor_payment_correct_v1",
      request: {
        client_api_version: 1,
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: uuidv7(),
        expected_version: before.version,
        payment_id: before.id,
        correction: {
          direction: draft.direction,
          amount_minor: amount,
          currency,
          occurred_at: T.Now.instant().toString(),
        },
        reason: draft.reason.trim(),
        payment,
      },
    };
  }
  const ids = new Set(draft.earningIds);
  if (!ids.size || ids.size !== draft.earningIds.length) throw Error("EARNINGS_SELECTION_REQUIRED");
  let remaining = 0n;
  for (const id of ids) {
    z.uuid().parse(id);
    const row = source.earnings.find((x) => x.earning.id === id)?.earning;
    if (
      !row ||
      row.center_id !== scope.centerId ||
      row.previous_id !== null ||
      row.direction !== "add" ||
      row.currency !== currency ||
      row.remaining_minor === "0"
    )
      throw Error("EARNINGS_SELECTION_CHANGED");
    remaining += BigInt(row.remaining_minor);
  }
  if (BigInt(amount) > remaining) throw Error("EARNINGS_AMOUNT_EXCEEDS_SELECTION");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(draft.date))
    throw Error("EARNINGS_TIME_INVALID");
  let occurred_at: string;
  try {
    occurred_at = T.PlainDateTime.from(draft.date)
      .toZonedDateTime(timezone, { disambiguation: "reject" })
      .toInstant()
      .toString();
  } catch {
    throw Error("EARNINGS_TIME_INVALID");
  }
  if (T.Instant.compare(occurred_at, T.Now.instant()) > 0) throw Error("EARNINGS_TIME_INVALID");
  return {
    scope: { ...scope },
    personId: source.personId,
    operation: "instructor_payment_record_v1",
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: uuidv7(),
      person_id: source.personId,
      earning_ids: [...ids],
      amount_minor: amount,
      currency,
      occurred_at,
      payment,
    },
  };
}
export async function writeEarningsPayment(intent: EarningsPaymentIntent) {
  const backend = await scopedBackend(intent.scope);
  const result =
    intent.operation === "instructor_payment_record_v1"
      ? await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() })
      : await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  z.uuid().parse(result.primary_id);
  z.uuid().parse(result.operation_id);
  if (
    intent.operation === "instructor_payment_correct_v1" &&
    result.primary_id !== intent.before.id
  )
    throw Error("EARNINGS_RESULT_MISMATCH");
  return result;
}
export async function readEarningsPaymentReceipt(intent: EarningsPaymentIntent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (
    result.operation !== intent.operation ||
    result.key !== intent.request.operation_key ||
    (result.result_reference &&
      (result.result_reference.type !== "instructor_payments" ||
        (intent.operation === "instructor_payment_correct_v1" &&
          result.result_reference.id !== intent.before.id)))
  )
    throw Error("EARNINGS_RECEIPT_MISMATCH");
  return result;
}
/** Only the explicitly selected instructor's chain is traversed; global summaries always come from the native directory. */
export async function readEarningsPaymentChain(
  scope: ClientScope,
  personId: string,
  rootId: string,
) {
  z.uuid().parse(rootId);
  const found = new Map<string, InstructorFinancePayment>(),
    seen = new Set<string>();
  let cursor: string | undefined;
  let root: InstructorFinancePayment | undefined;
  do {
    const page = await readEarningsDirectory(scope, "payments", { personId, cursor });
    for (const row of page.items)
      if (row.kind === "payment" && row.root_payment_id === rootId) {
        if (found.has(row.id)) throw Error("EARNINGS_CHAIN_UNAVAILABLE");
        found.set(row.id, row);
        if (row.id === rootId) root = row;
      }
    if (root && found.size === root.version) return { root, rows: [...found.values()] };
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw Error("EARNINGS_CHAIN_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw Error("EARNINGS_CHAIN_UNAVAILABLE");
}
export async function readEarningsPaymentResult(intent: EarningsPaymentIntent, primaryId?: string) {
  const id = z.uuid().parse(primaryId);
  if (intent.operation === "instructor_payment_correct_v1" && id !== intent.before.id)
    throw Error("EARNINGS_RESULT_MISMATCH");
  const chain = await readEarningsPaymentChain(intent.scope, intent.personId, id);
  const temporal = await getTemporal();
  if (intent.operation === "instructor_payment_record_v1") {
    const row = chain.root,
      r = intent.request;
    if (
      row.direction !== "increase" ||
      row.amount_minor !== r.amount_minor ||
      row.currency !== r.currency ||
      temporal.Instant.compare(row.occurred_at, r.occurred_at) !== 0 ||
      row.payment?.method !== r.payment?.method ||
      (row.payment?.reference ?? null) !== (r.payment?.reference ?? null)
    )
      throw Error("EARNINGS_RESULT_MISMATCH");
  } else if (chain.root.version <= intent.before.version) throw Error("EARNINGS_RESULT_MISMATCH");
  return chain;
}
export async function readEarningsPaymentAuthority(
  scope: ClientScope,
  target: { personId: string; paymentId?: string },
) {
  const backend = await scopedBackend(scope);
  const operation = target.paymentId
    ? "instructor_payment_correct_v1"
    : "instructor_payment_record_v1";
  const selector = target.paymentId
    ? { operation: "instructor_payment_correct_v1" as const, key: { payment_id: target.paymentId } }
    : { operation: "instructor_payment_record_v1" as const, key: { person_id: target.personId } };
  const state = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation,
    selector,
    page: { limit: 1 },
  });
  const row = state.items[0];
  if (
    state.items.length !== 1 ||
    state.next_cursor ||
    !row?.exists ||
    row.entity?.id !== (target.paymentId ?? target.personId) ||
    row.entity?.type !== (target.paymentId ? "instructor_payments" : "people")
  )
    throw Error("EARNINGS_AUTHORITY_UNAVAILABLE");
  return true;
}
