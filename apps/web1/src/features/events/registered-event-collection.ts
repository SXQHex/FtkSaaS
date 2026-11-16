import { z } from "zod";
import type { EventRegistrationView } from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { readDetailedEvent } from "./event-registration-read";
import {
  readCollectionAuthority,
  collectionIntent,
  financeDraft,
  readCollectionReceipt,
  type CollectionIntent,
} from "../finance/finance";
import type { EventCollectionDraft } from "./event-registration-draft";
export interface RegisteredCollectionIntent extends CollectionIntent {
  registration: {
    eventId: string;
    id: string;
    personId: string;
    amount: string;
    currency: string;
    debtIds: string[];
  };
}
export async function readRegisteredPayment(
  scope: ClientScope,
  eventId: string,
  id: string,
  personId: string,
) {
  const event = await readDetailedEvent(scope, eventId);
  const row = event.registrations?.find((row) => row.id === id && row.person_id === personId);
  if (!row?.payment_summary) throw Error("EVENT_REGISTRATION_PAYMENT_UNAVAILABLE");
  return row;
}
export async function prepareRegisteredCollection(
  scope: ClientScope,
  eventId: string,
  before: EventRegistrationView,
  timezone: string,
  draft: EventCollectionDraft,
  reviewed: boolean,
): Promise<RegisteredCollectionIntent> {
  if (!reviewed) throw Error("EVENT_REVIEW_REQUIRED");
  const fresh = await readRegisteredPayment(scope, eventId, before.id, before.person_id);
  const payment = fresh.payment_summary!;
  if (
    fresh.version !== before.version ||
    fresh.state !== before.state ||
    JSON.stringify(payment) !== JSON.stringify(before.payment_summary)
  )
    throw Error("EVENT_PAYMENT_SCOPE_CHANGED");
  if (
    payment.status !== "available" ||
    !payment.currency ||
    payment.amount_minor === null ||
    payment.remaining_minor === null ||
    BigInt(payment.remaining_minor) <= 0n
  )
    throw Error("EVENT_REGISTRATION_PAYMENT_UNAVAILABLE");
  if (!(await readCollectionAuthority(scope, fresh.person_id)))
    throw Error("FINANCE_AUTHORITY_UNAVAILABLE");
  const selection = { personId: fresh.person_id, currency: payment.currency };
  const intent = await collectionIntent(scope, selection, timezone, {
    ...financeDraft(selection),
    ...draft,
  });
  const debtIds = payment.debts
    .filter((row) => BigInt(row.remaining_minor) > 0n)
    .map((row) => row.id);
  if (!debtIds.length) throw Error("EVENT_REGISTRATION_PAYMENT_UNAVAILABLE");
  intent.request.debt_ids = debtIds;
  return {
    ...intent,
    registration: {
      eventId,
      id: fresh.id,
      personId: fresh.person_id,
      amount: payment.amount_minor,
      currency: payment.currency,
      debtIds,
    },
  };
}
// The native receipt proves the exact collection; a scoped domain reread supplies current balances.
// finance.collect does not imply permission to read the person's full finance ledger.
export async function confirmEventCollectionReceipt(intent: CollectionIntent, id?: string) {
  z.uuid().parse(id);
  const receipt = await readCollectionReceipt(intent);
  if (
    !["succeeded", "result_expired"].includes(receipt.status) ||
    receipt.result_reference?.id !== id
  )
    throw Error("EVENT_COLLECTION_RECEIPT_UNAVAILABLE");
}
export async function readRegisteredCollectionResult(
  intent: RegisteredCollectionIntent,
  id?: string,
) {
  await confirmEventCollectionReceipt(intent, id);
  const source = intent.registration;
  const row = await readRegisteredPayment(intent.scope, source.eventId, source.id, source.personId);
  const payment = row.payment_summary!;
  if (
    payment.status !== "available" ||
    payment.currency !== source.currency ||
    payment.amount_minor !== source.amount ||
    source.debtIds.some((id) => !payment.debts.some((debt) => debt.id === id))
  )
    throw Error("EVENT_REGISTRATION_PAYMENT_UNAVAILABLE");
  return row;
}
