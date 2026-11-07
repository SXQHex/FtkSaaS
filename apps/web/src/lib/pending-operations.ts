import { eventWrites } from "./event-command";
import {
  proAccessWrites,
  personnelPermissions,
  type PersonnelPermission,
} from "./pro-access-command";
import { crmWrites } from "./crm-command";
import { paymentWrites } from "./instructor-payment-command";
import { waitlistWrites } from "./waitlist-command";
import { lifecycleWrites } from "./sale-lifecycle-command";
import { attendanceWrites } from "./attendance-command";
import { balanceOperations } from "./finance-actions";
import { validate } from "uuid";
import { bookingWrites } from "./booking-command";
import { rightsOperations } from "./rights-change";
import { recoverSetup, setupActorPrefix, type SetupScope } from "./studio-setup";
export type PendingOperation = {
  scope: SetupScope;
  slot: string;
  kind:
    | "event"
    | "access"
    | "crm"
    | "settings"
    | "agreements"
    | "attendance"
    | "sale"
    | "rights"
    | "reservation"
    | "request"
    | "finance";
};
const operations: Record<PendingOperation["kind"], readonly string[]> = {
  event: eventWrites,
  access: proAccessWrites,
  crm: crmWrites,
  attendance: attendanceWrites,
  settings: ["settings_update_v1", "settings_reset_apply_v1", "negcredit_valuation_set_v1"],
  agreements: ["instructor_agreement_publish_v1"],
  finance: [
    ...paymentWrites,
    "collection_record_v1",
    "collection_correct_apply_v1",
    "sale_refund_apply_v1",
    ...balanceOperations,
  ],
  sale: ["sale_apply_v1", "sale_renew_apply_v1", ...lifecycleWrites],
  rights: rightsOperations,
  reservation: [
    ...bookingWrites.filter((operation) => operation.startsWith("reservation_")),
    ...waitlistWrites,
  ],
  request: bookingWrites.filter((operation) => operation.startsWith("lesson_request_")),
};
function slotKind(slot: string): PendingOperation["kind"] | null {
  if (slot === "operating-settings:organization" || slot === "operating-settings:center")
    return "settings";
  if (slot.startsWith("permission:")) {
    const [, person, permission, ...extra] = slot.split(":");
    return person &&
      validate(person) &&
      !extra.length &&
      personnelPermissions.includes(permission as PersonnelPermission)
      ? "access"
      : null;
  }
  if (/^event-(?:register|payment):[^:]+:[^:]+$/.test(slot)) {
    const [, event, person] = slot.split(":");
    return event && person && validate(event) && validate(person) ? "event" : null;
  }
  if (/^self-bookings:[^:]+:[^:]+$/.test(slot)) {
    const [, session, person] = slot.split(":");
    return session && person && validate(session) && validate(person) ? "reservation" : null;
  }
  if (slot === "lesson-requests") return "request";
  const [family, target, extra] = slot.split(":");
  if (!target || !validate(target) || extra !== undefined) return null;
  switch (family) {
    case "self-requests":
      return "request";
    case "event-registration":
    case "event-duty":
    case "event":
    case "event-create":
      return "event";
    case "subscription-downgrade":
    case "subscription-cancel":
      return "access";
    case "crm-person":
    case "crm-lead":
    case "crm-activity":
    case "crm-offer":
    case "crm-application":
    case "publication":
      return "crm";
    case "valuation-group":
    case "valuation-private":
      return "settings";
    case "agreements":
      return "agreements";
    case "attendance":
    case "attendance-row":
      return "attendance";
    case "sale-refund":
    case "credit-refund":
    case "credit-offset":
    case "debt-adjust":
    case "collection-correct":
    case "earnings":
    case "instructor-payment":
    case "finance":
      return "finance";
    case "sale-change":
    case "sale-lifecycle":
    case "sale-renew":
      return "sale";
    case "rights":
      return "rights";
    case "waitlist-person":
    case "waitlist-entry":
    case "waitlist-offer":
    case "bookings":
      return "reservation";
    default:
      return null;
  }
}
// Storage supplies discovery only; recoverSetup and the backend validate every action.
export function discoverPendingOperations(actorId: string): PendingOperation[] | null {
  try {
    const prefix = setupActorPrefix(actorId);
    const items: PendingOperation[] = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const [orgId, centerId, ...parts] = key.slice(prefix.length).split(":");
      if (
        !orgId ||
        !centerId ||
        !validate(orgId) ||
        (centerId !== "organization" && !validate(centerId))
      )
        continue;
      const slot = parts.join(":"),
        kind = slotKind(slot);
      if (!kind) continue;
      if (
        centerId === "organization" &&
        slot !== "operating-settings:organization" &&
        !slot.startsWith("crm-application:") &&
        !slot.startsWith("subscription-")
      )
        continue;
      const scope = { actorId, orgId, ...(centerId === "organization" ? {} : { centerId }) };
      const pending = recoverSetup(scope, slot);
      if (
        pending &&
        (pending === "invalid" || operations[kind].includes(pending.command.operation))
      )
        items.push({ scope, slot, kind });
    }
    return items.sort((a, b) =>
      `${a.scope.orgId}:${a.scope.centerId}:${a.slot}`.localeCompare(
        `${b.scope.orgId}:${b.scope.centerId}:${b.slot}`,
      ),
    );
  } catch {
    return null;
  }
}
