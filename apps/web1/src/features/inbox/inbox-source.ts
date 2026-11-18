import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { NotificationSourceState } from "../../lib/api-contracts/generated";
import { requestDetail } from "../lesson-requests/lesson-requests-read";
import { readSeatOffer } from "../member-reservations/member-waitlist";
import { readMemberReservations } from "../member-profile/reservations";

export async function readMemberSessionNotice(
  scope: ClientScope,
  personId: string,
  sessionId: string,
) {
  const page = await readMemberReservations(scope, personId, undefined, "all", { sessionId });
  const own = page.items.find(
    ({ reservation, session }) =>
      session?.id === sessionId &&
      (reservation.state === "active" || reservation.state === "completed"),
  );
  if (!own?.session) throw new Error("INBOX_SOURCE_UNAVAILABLE");
  const search = new URLSearchParams({
    org: scope.orgId,
    center: scope.centerId,
    session: sessionId,
  });
  return {
    kind: "session" as const,
    workState: "informational" as const,
    at: own.session.starts_at,
    note: null,
    ownHref: null,
    href: `/member/reservations?${search}`,
    personId,
  };
}
export async function readInboxSource(
  scope: ClientScope,
  source: NotificationSourceState,
  memberPersonId?: string,
) {
  const selector = source.selector;
  if (selector?.operation === "seat_offer_accept_v1") z.uuid().parse(selector.key.offer_id);
  else if (selector?.operation === "lesson_request_create_v1") {
    z.uuid().parse(selector.key.lesson_request_id);
    if (selector.key.catalog) throw new Error("INBOX_SOURCE_UNAVAILABLE");
  } else if (selector?.operation === "crm_activity_save_v1") {
    if (memberPersonId) throw new Error("INBOX_SOURCE_UNAVAILABLE");
    z.uuid().parse(selector.key.activity_id);
    z.uuid().parse(selector.key.lead_id || selector.key.person_id);
  } else throw new Error("INBOX_SOURCE_UNAVAILABLE");
  if (!source.center_id || !selector || source.state === "unavailable")
    throw new Error("INBOX_SOURCE_UNAVAILABLE");
  const centerId = z.uuid().parse(source.center_id);
  const targetScope = { ...scope, centerId };
  if (selector.operation === "seat_offer_accept_v1") {
    const { offer, asOf } = await readSeatOffer(targetScope, selector.key.offer_id, memberPersonId);
    const search = new URLSearchParams({ org: scope.orgId, center: centerId, offer: offer.id });
    return {
      kind: "offer" as const,
      state: offer.state,
      workState:
        offer.state !== "active"
          ? ("completed" as const)
          : Date.parse(offer.expires_at) > Date.parse(asOf)
            ? ("pending" as const)
            : ("unavailable" as const),
      at: offer.expires_at,
      note: null,
      href: `/member/reservations?${search}`,
      ownHref: null,
      personId: offer.person_id,
    };
  }
  const page = await (
    await scopedBackend(targetScope)
  ).call("management_state_get_v1", {
    client_api_version: 1,
    org_id: scope.orgId,
    center_id: centerId,
    request_id: uuidv7(),
    operation: selector.operation,
    selector,
    page: { limit: 1 },
  });
  const row = page.items[0];
  const expected =
    selector.operation === "lesson_request_create_v1"
      ? { type: "lesson_requests", id: selector.key.lesson_request_id }
      : { type: "crm_activities", id: selector.key.activity_id };
  z.uuid().parse(expected.id);
  if (
    page.items.length !== 1 ||
    page.next_cursor ||
    !row?.exists ||
    row.operation !== selector.operation ||
    row.entity?.type !== expected.type ||
    row.entity.id !== expected.id ||
    row.versions.filter(
      (v) =>
        v.entity.type === expected.type &&
        v.entity.id === expected.id &&
        z.number().int().positive().safe().safeParse(v.version).success,
    ).length !== 1
  )
    throw new Error("INBOX_SOURCE_UNAVAILABLE");
  const base = `/o/${scope.orgId}/c/${centerId}`;
  if (selector.operation === "lesson_request_create_v1") {
    const detail = requestDetail(row, targetScope, selector.operation, expected.id);
    if (memberPersonId && (detail.person_id !== memberPersonId || detail.format !== "private"))
      throw new Error("INBOX_SOURCE_UNAVAILABLE");
    return {
      kind: "request" as const,
      state: detail.state,
      workState:
        detail.state === "pending" || detail.state === "alternative_offered"
          ? ("pending" as const)
          : ("completed" as const),
      at: detail.requested_start,
      note: null,
      href: `${base}/requests?request=${detail.id}`,
      ownHref: `/member/private-lessons?org=${scope.orgId}&center=${centerId}&request=${detail.id}`,
      personId: detail.person_id,
    };
  }
  if (
    row.current?.operation !== "crm_activity_save_v1" ||
    row.current.values.activity_id !== expected.id ||
    (selector.key.lead_id
      ? row.current.values.lead_id !== selector.key.lead_id
      : row.current.values.person_id !== selector.key.person_id)
  )
    throw new Error("INBOX_SOURCE_UNAVAILABLE");
  const values = row.current.values;
  if (values.due_at) z.iso.datetime({ offset: true }).parse(values.due_at);
  return {
    kind: "activity" as const,
    state: row.state,
    workState:
      values.kind !== "followup"
        ? ("informational" as const)
        : row.state === "completed"
          ? ("completed" as const)
          : ("pending" as const),
    at: values.due_at ?? null,
    note: values.note ?? null,
    href: selector.key.lead_id
      ? `${base}/leads`
      : `${base}/people/${z.uuid().parse(selector.key.person_id)}`,
    ownHref: null,
    personId: values.person_id,
  };
}
