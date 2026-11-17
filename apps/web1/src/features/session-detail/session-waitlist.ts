import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  BookingCategory,
  WaitlistEntryView,
  SeatOfferView,
} from "../../lib/api-contracts/generated";
import { readPersonSessionWaitlist, readSessionParticipants } from "./session-detail-read";

export type WaitlistAction = "join" | "leave" | "accept" | "reject";
export interface WaitlistIntent {
  scope: ClientScope;
  action: WaitlistAction;
  operation:
    | "waitlist_join_v1"
    | "waitlist_leave_v1"
    | "seat_offer_accept_v1"
    | "seat_offer_reject_v1";
  key: string;
  sessionId: string;
  personId: string;
  category?: BookingCategory;
  entry?: WaitlistEntryView;
  offer?: SeatOfferView;
}
export function waitlistIntent(
  scope: ClientScope,
  sessionId: string,
  personId: string,
  action: WaitlistAction,
  category?: BookingCategory,
  entry?: WaitlistEntryView,
  offer?: SeatOfferView,
  ownPersonId?: string,
): WaitlistIntent {
  z.uuid().parse(sessionId);
  z.uuid().parse(personId);
  if (category) z.enum(["male", "female"]).parse(category);
  if (
    action !== "join" &&
    (!entry ||
      entry.session_id !== sessionId ||
      entry.person_id !== personId ||
      entry.center_id !== scope.centerId)
  )
    throw new Error("SESSION_WAITLIST_SOURCE_UNAVAILABLE");
  if (action === "leave" && !["waiting", "offered"].includes(entry!.state))
    throw new Error("SESSION_WAITLIST_SOURCE_UNAVAILABLE");
  if (
    (action === "accept" || action === "reject") &&
    (!offer ||
      offer.entry_id !== entry!.id ||
      offer.session_id !== sessionId ||
      offer.person_id !== personId ||
      personId !== ownPersonId ||
      offer.state !== "active" ||
      Date.parse(offer.expires_at) <= Date.now())
  )
    throw new Error("SESSION_WAITLIST_SOURCE_UNAVAILABLE");
  return {
    scope: { ...scope },
    sessionId,
    personId,
    action,
    category,
    entry,
    offer,
    key: uuidv7(),
    operation: (
      {
        join: "waitlist_join_v1",
        leave: "waitlist_leave_v1",
        accept: "seat_offer_accept_v1",
        reject: "seat_offer_reject_v1",
      } as const
    )[action],
  };
}
export async function readWaitlistTarget(
  scope: ClientScope,
  sessionId: string,
  personId: string,
  entryId: string,
) {
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "waitlist_leave_v1",
    selector: { operation: "waitlist_leave_v1", key: { entry_id: entryId } },
    page: { limit: 1 },
  });
  const row = page.items[0],
    entry = row?.waitlist_detail;
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !entry ||
    !row?.exists ||
    row.entity?.type !== "waitlist_entries" ||
    row.entity.id !== entryId ||
    entry.id !== entryId ||
    entry.center_id !== scope.centerId ||
    entry.session_id !== sessionId ||
    entry.person_id !== personId ||
    row.versions.filter(
      (v) =>
        v.entity.type === "waitlist_entries" &&
        v.entity.id === entryId &&
        v.version === entry.version,
    ).length !== 1
  )
    throw new Error("SESSION_WAITLIST_SOURCE_UNAVAILABLE");
  return entry;
}
export async function writeWaitlist(intent: WaitlistIntent) {
  const backend = await scopedBackend(intent.scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
  };
  switch (intent.operation) {
    case "waitlist_join_v1":
      return backend.call(intent.operation, {
        ...common,
        person_id: intent.personId,
        session_id: intent.sessionId,
        ...(intent.category ? { booking_category: intent.category } : {}),
      });
    case "waitlist_leave_v1":
      return backend.call(intent.operation, {
        ...common,
        entry_id: intent.entry!.id,
        expected_version: intent.entry!.version,
      });
    default:
      return backend.call(intent.operation, {
        ...common,
        offer_id: intent.offer!.id,
        expected_version: intent.offer!.version,
      });
  }
}
export async function readWaitlistReceipt(intent: WaitlistIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.key,
  });
  const type = intent.offer ? "seat_offers" : "waitlist_entries";
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== type)
  )
    throw new Error("SESSION_WAITLIST_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readWaitlistResult(intent: WaitlistIntent, primaryId?: string) {
  if (primaryId && intent.entry && !intent.offer && primaryId !== intent.entry.id)
    throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await readPersonSessionWaitlist(
      intent.scope,
      intent.sessionId,
      intent.personId,
      cursor,
    );
    const matches = page.items.filter((entry) =>
      intent.entry
        ? entry.id === intent.entry.id
        : primaryId
          ? entry.id === primaryId
          : ["waiting", "offered"].includes(entry.state) &&
            (entry.booking_category ?? undefined) === intent.category,
    );
    if (matches.length > 1) throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
    const entry = matches[0];
    if (entry) {
      if (intent.action === "join" && !["waiting", "offered", "converted"].includes(entry.state))
        throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
      if (
        intent.action === "leave" &&
        (entry.state !== "left" || entry.version <= intent.entry!.version)
      )
        throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
      if (intent.offer) {
        // The primary entity of accept/reject is the offer, never its reservation.
        const offer = entry.offers.find((row) => row.id === intent.offer!.id);
        if (
          (primaryId && primaryId !== intent.offer.id) ||
          !offer ||
          offer.version <= intent.offer.version ||
          offer.state !== (intent.action === "accept" ? "accepted" : "rejected") ||
          entry.state !== (intent.action === "accept" ? "converted" : "closed")
        )
          throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
        if (intent.action === "accept") {
          const reservations = await readSessionParticipants(
            intent.scope,
            intent.sessionId,
            intent.personId,
          );
          if (!reservations.items.some((row) => row.reservation.state === "active"))
            throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
        }
      }
      return entry;
    }
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  throw new Error("SESSION_WAITLIST_RESULT_UNAVAILABLE");
}
