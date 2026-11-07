import { validate, v7 } from "uuid";
import type { SeatOfferView, WaitlistEntryView } from "@ftksaas/api-contracts";
import type { SetupScope } from "./studio-setup";
export const waitlistFields = {
  waitlist_join_v1: ["person_id", "session_id", "booking_category"],
  waitlist_leave_v1: ["entry_id", "expected_version"],
  seat_offer_accept_v1: ["offer_id", "expected_version"],
  seat_offer_reject_v1: ["offer_id", "expected_version"],
};
export type WaitlistWrite = keyof typeof waitlistFields;
export const waitlistWrites = Object.keys(waitlistFields) as WaitlistWrite[];
export function validWaitlistCommand(
  operation: string,
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (
    !centerId ||
    input.center_id !== centerId ||
    !waitlistWrites.includes(operation as WaitlistWrite)
  )
    return false;
  if (operation === "waitlist_join_v1")
    return (
      typeof input.person_id === "string" &&
      validate(input.person_id) &&
      typeof input.session_id === "string" &&
      validate(input.session_id) &&
      slot === `waitlist-person:${input.person_id}` &&
      (input.booking_category === undefined ||
        ["male", "female"].includes(String(input.booking_category)))
    );
  const id = operation === "waitlist_leave_v1" ? input.entry_id : input.offer_id;
  return (
    typeof id === "string" &&
    validate(id) &&
    Number.isSafeInteger(input.expected_version) &&
    Number(input.expected_version) > 0 &&
    slot === `${operation === "waitlist_leave_v1" ? "waitlist-entry" : "waitlist-offer"}:${id}`
  );
}
export function waitlistCommand(
  scope: SetupScope,
  sessionId: string,
  personId: string,
  operation: WaitlistWrite,
  row?:
    | Pick<SeatOfferView, "id" | "session_id" | "person_id" | "state" | "version" | "expires_at">
    | Pick<WaitlistEntryView, "id" | "session_id" | "person_id" | "state" | "version">,
  category?: "male" | "female",
) {
  if (!scope.centerId || !validate(sessionId) || !validate(personId))
    throw Error("invalidWaitlist");
  const common = { org_id: scope.orgId, center_id: scope.centerId, operation_key: v7() };
  if (operation === "waitlist_join_v1")
    return {
      slot: `waitlist-person:${personId}`,
      command: {
        operation,
        input: {
          ...common,
          session_id: sessionId,
          person_id: personId,
          ...(category ? { booking_category: category } : {}),
        },
      },
    };
  if (
    !row ||
    row.person_id !== personId ||
    row.session_id !== sessionId ||
    !validate(row.id) ||
    !Number.isSafeInteger(row.version) ||
    row.version < 1
  )
    throw Error("invalidWaitlist");
  if (operation === "waitlist_leave_v1") {
    if (!["waiting", "offered"].includes(row.state)) throw Error("OFFER_UNAVAILABLE");
    return {
      slot: `waitlist-entry:${row.id}`,
      command: { operation, input: { ...common, entry_id: row.id, expected_version: row.version } },
    };
  }
  if (
    !("expires_at" in row) ||
    row.state !== "active" ||
    !Number.isFinite(Date.parse(row.expires_at)) ||
    Date.parse(row.expires_at) <= Date.now()
  )
    throw Error("OFFER_UNAVAILABLE");
  return {
    slot: `waitlist-offer:${row.id}`,
    command: { operation, input: { ...common, offer_id: row.id, expected_version: row.version } },
  };
}
