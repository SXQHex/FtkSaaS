import { BackendError } from "../../lib/backend";
import { v7 as uuidv7 } from "uuid";
import type { ClientScope } from "../../lib/scoped-backend";
import { readMemberClasses, type MemberClass } from "./member-classes-read";
import {
  readBookingRights,
  sessionBookingIntent,
  writeSessionBooking,
  readSessionBookingReceipt,
  readSessionBookingResult,
  type SessionBookingIntent,
} from "../session-detail/session-booking";
import {
  waitlistIntent,
  readWaitlistTarget,
  writeWaitlist,
  readWaitlistReceipt,
  readWaitlistResult,
  type WaitlistIntent,
} from "../session-detail/session-waitlist";
import type { SessionBookingDraft } from "../session-detail/session-detail-panels";
import { readRequiredDocuments } from "../member-documents/member-documents";
export type ClassAction = "book" | "join" | "leave" | "accept" | "reject";
export type MemberClassIntent =
  | { kind: "booking"; value: SessionBookingIntent }
  | { kind: "waitlist"; value: WaitlistIntent };
const stale = () =>
  new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
export async function memberClassIntent(
  scope: ClientScope,
  personId: string,
  before: MemberClass,
  action: ClassAction,
  draft: SessionBookingDraft,
): Promise<MemberClassIntent> {
  if (!draft.reviewed || draft.personId !== personId || draft.override)
    throw Error("MEMBER_CLASS_REVIEW_REQUIRED");
  const rows = await readMemberClasses(scope, {
    starts_at: before.starts_at,
    ends_at: before.ends_at,
  });
  const fresh = rows.find((row) => row.id === before.id),
    b = before.member_lesson,
    d = fresh?.member_lesson;
  if (
    !fresh ||
    !d ||
    d.version !== b.version ||
    JSON.stringify(d.booking_window) !== JSON.stringify(b.booking_window) ||
    JSON.stringify(d.cancellation) !== JSON.stringify(b.cancellation)
  )
    throw stale();
  if (action === "book") {
    if (
      d.own_reservation?.state === "active" ||
      d.booking_window.state !== "open" ||
      fresh.capacity.remaining === 0
    )
      throw stale();
    const rights = await readBookingRights(scope, personId, before.id, draft.mode);
    const source = rights.find((row) => row.sale_id === draft.saleId);
    if (!source) throw Error("MEMBER_CLASS_RIGHT_UNAVAILABLE");
    const documents = await readRequiredDocuments({
      scope,
      personId,
      context: {
        gate: "reservation",
        subject: { type: "sessions", id: before.id },
        ...(source.product_version_id ? { product_version_id: source.product_version_id } : {}),
      },
    });
    if (documents.some((row) => !row.accepted))
      throw new BackendError({ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: uuidv7() });
    return { kind: "booking", value: sessionBookingIntent(scope, before.id, draft, source, false) };
  }
  if (!d.waitlist_enabled) throw Error("MEMBER_CLASS_WAITLIST_UNAVAILABLE");
  if (action === "join") {
    if (
      d.own_reservation?.state === "active" ||
      d.own_waitlist ||
      d.booking_window.state !== "open" ||
      (draft.category
        ? (fresh.capacity.category_remaining?.[draft.category] ?? fresh.capacity.remaining)
        : fresh.capacity.remaining) > 0
    )
      throw stale();
    return {
      kind: "waitlist",
      value: waitlistIntent(scope, before.id, personId, "join", draft.category || undefined),
    };
  }
  if (
    !b.own_waitlist ||
    !d.own_waitlist ||
    b.own_waitlist.id !== d.own_waitlist.id ||
    b.own_waitlist.version !== d.own_waitlist.version
  )
    throw stale();
  const { entry, asOf } = await readWaitlistTarget(scope, before.id, personId, d.own_waitlist.id);
  if (entry.version !== d.own_waitlist.version) throw stale();
  const offer =
    action === "accept" || action === "reject"
      ? entry.offers.find((row) => row.id === b.own_waitlist?.offer?.id)
      : undefined;
  if (action !== "leave" && (!offer || offer.version !== b.own_waitlist.offer?.version))
    throw stale();
  return {
    kind: "waitlist",
    value: waitlistIntent(
      scope,
      before.id,
      personId,
      action,
      undefined,
      entry,
      offer,
      personId,
      asOf,
    ),
  };
}
export async function writeMemberClass(intent: MemberClassIntent) {
  return intent.kind === "booking"
    ? writeSessionBooking(intent.value)
    : writeWaitlist(intent.value);
}
export async function readMemberClassReceipt(intent: MemberClassIntent) {
  return intent.kind === "booking"
    ? readSessionBookingReceipt(intent.value)
    : readWaitlistReceipt(intent.value);
}
export async function readMemberClassResult(intent: MemberClassIntent, id?: string) {
  return intent.kind === "booking"
    ? readSessionBookingResult(intent.value, id)
    : readWaitlistResult(intent.value, id);
}
