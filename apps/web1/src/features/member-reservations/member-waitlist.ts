import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type {
  MemberWaitlistSession,
  WaitlistEntryView,
  SeatOfferView,
} from "../../lib/api-contracts/generated";
import {
  readWaitlistTarget,
  waitlistIntent,
  type WaitlistAction,
} from "../session-detail/session-waitlist";
export interface OwnWaitlistRow {
  id: string;
  session: MemberWaitlistSession;
  entry: WaitlistEntryView;
  offer?: SeatOfferView;
}
export async function readSeatOffer(scope: ClientScope, offerId: string, personId?: string) {
  z.uuid().parse(offerId);
  const operation = "seat_offer_accept_v1";
  const backend = await scopedBackend(scope);
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    org_id: scope.orgId,
    center_id: scope.centerId,
    request_id: uuidv7(),
    operation,
    selector: { operation, key: { offer_id: offerId } },
    page: { limit: 1 },
  });
  const row = page.items[0];
  const entry = row?.waitlist_detail;
  const offer = entry?.offers.find((item) => item.id === offerId);
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== operation ||
    row.entity?.type !== "seat_offers" ||
    row.entity.id !== offerId ||
    !entry ||
    !offer ||
    entry.center_id !== scope.centerId ||
    (personId && offer.person_id !== personId) ||
    offer.entry_id !== entry.id ||
    offer.person_id !== entry.person_id ||
    offer.session_id !== entry.session_id ||
    !Number.isSafeInteger(offer.version) ||
    offer.version < 1 ||
    row.versions.filter(
      (item) =>
        item.entity.type === "seat_offers" &&
        item.entity.id === offerId &&
        item.version === offer.version,
    ).length !== 1
  )
    throw new Error("MEMBER_WAITLIST_UNAVAILABLE");
  z.uuid().parse(offer.session_id);
  z.iso.datetime({ offset: true }).parse(offer.expires_at);
  return { entry, offer, asOf: z.iso.datetime({ offset: true }).parse(page.as_of) };
}

export async function readOwnWaitlist(
  scope: ClientScope,
  view: "entries" | "offers",
  cursor?: string,
  exactOffer?: { id: string; personId: string },
) {
  if (exactOffer) z.uuid().parse(exactOffer.id);
  const backend = await scopedBackend(scope);
  const key =
    view === "entries"
      ? { directory: "self" as const, view, status: "waiting" as const }
      : {
          directory: "self" as const,
          view,
          status: exactOffer ? ("all" as const) : ("active" as const),
        };
  const page = await backend.call("management_state_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "waitlist_join_v1",
    selector: { operation: "waitlist_join_v1", key },
    ...(exactOffer ? { entity: { type: "seat_offers" as const, id: exactOffer.id } } : {}),
    page: { limit: exactOffer ? 1 : 20, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if (exactOffer && (page.items.length !== 1 || page.next_cursor))
    throw Error("MEMBER_WAITLIST_UNAVAILABLE");
  const ids = new Set<string>();
  const items: OwnWaitlistRow[] = page.items.map((row) => {
    const entry = row.waitlist_detail,
      session = row.waitlist_session;
    if (
      !row.exists ||
      row.operation !== "waitlist_join_v1" ||
      !entry ||
      !session ||
      entry.center_id !== scope.centerId ||
      entry.session_id !== session.id ||
      !row.entity ||
      row.entity.type !== (view === "entries" ? "waitlist_entries" : "seat_offers")
    )
      throw Error("MEMBER_WAITLIST_UNAVAILABLE");
    z.uuid().parse(entry.id);
    z.uuid().parse(entry.person_id);
    z.uuid().parse(session.id);
    z.string().trim().min(1).parse(session.title);
    z.number().int().positive().parse(session.version);
    z.iso.datetime({ offset: true }).parse(session.interval.starts_at);
    z.iso.datetime({ offset: true }).parse(session.interval.ends_at);
    if (Date.parse(session.interval.ends_at) <= Date.parse(session.interval.starts_at))
      throw Error("MEMBER_WAITLIST_UNAVAILABLE");
    new Intl.DateTimeFormat("tr-TR", { timeZone: session.timezone });
    const offer = view === "offers" ? entry.offers.find((o) => o.id === row.entity!.id) : undefined;
    const entityId = row.entity.id;
    if (
      ids.has(entityId) ||
      (exactOffer && (entityId !== exactOffer.id || entry.person_id !== exactOffer.personId)) ||
      !row.versions.some(
        (v) =>
          v.entity.type === "waitlist_entries" &&
          v.entity.id === entry.id &&
          v.version === entry.version,
      ) ||
      (view === "entries" && (entityId !== entry.id || entry.state !== "waiting")) ||
      (view === "offers" &&
        (!offer ||
          (!exactOffer && offer.state !== "active") ||
          offer.entry_id !== entry.id ||
          offer.person_id !== entry.person_id ||
          offer.session_id !== session.id ||
          !row.versions.some(
            (v) =>
              v.entity.type === "seat_offers" &&
              v.entity.id === offer.id &&
              v.version === offer.version,
          )))
    )
      throw Error("MEMBER_WAITLIST_UNAVAILABLE");
    if (offer) z.iso.datetime({ offset: true }).parse(offer.expires_at);
    ids.add(entityId);
    return { id: entityId, session, entry, offer };
  });
  return {
    items,
    nextCursor: page.next_cursor ?? undefined,
    asOf: z.iso.datetime({ offset: true }).parse(page.as_of),
  };
}
export async function ownWaitlistIntent(
  scope: ClientScope,
  before: OwnWaitlistRow,
  action: Exclude<WaitlistAction, "join">,
  reviewed: boolean,
) {
  if (!reviewed) throw Error("MEMBER_WAITLIST_REVIEW_REQUIRED");
  const { entry, asOf } = await readWaitlistTarget(
    scope,
    before.session.id,
    before.entry.person_id,
    before.entry.id,
  );
  const offer = before.offer ? entry.offers.find((o) => o.id === before.offer!.id) : undefined;
  if (
    entry.version !== before.entry.version ||
    (before.offer && offer?.version !== before.offer.version)
  )
    throw Error("MEMBER_WAITLIST_STALE");
  return waitlistIntent(
    scope,
    before.session.id,
    entry.person_id,
    action,
    undefined,
    entry,
    offer,
    entry.person_id,
    asOf,
  );
}
