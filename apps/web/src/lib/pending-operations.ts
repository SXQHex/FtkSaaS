import { attendanceWrites } from "./attendance-command";
import { balanceOperations } from "./finance-actions";
import { validate } from "uuid";
import { bookingWrites } from "./booking-command";
import { rightsOperations } from "./rights-change";
import { recoverSetup, setupActorPrefix, type SetupScope } from "./studio-setup";
export type PendingOperation = {
  scope: SetupScope;
  slot: string;
  kind: "agreements" | "attendance" | "sale" | "rights" | "reservation" | "request" | "finance";
};
const operations: Record<PendingOperation["kind"], readonly string[]> = {
  attendance: attendanceWrites,
  agreements: ["instructor_agreement_publish_v1"],
  finance: [
    "collection_record_v1",
    "collection_correct_apply_v1",
    "sale_refund_apply_v1",
    ...balanceOperations,
  ],
  sale: ["sale_apply_v1", "sale_renew_apply_v1"],
  rights: rightsOperations,
  reservation: bookingWrites.filter((operation) => operation.startsWith("reservation_")),
  request: bookingWrites.filter((operation) => operation.startsWith("lesson_request_")),
};
function slotKind(slot: string): PendingOperation["kind"] | null {
  if (slot === "lesson-requests") return "request";
  const [family, target, extra] = slot.split(":");
  if (!target || !validate(target) || extra !== undefined) return null;
  switch (family) {
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
    case "finance":
      return "finance";
    case "sale-renew":
      return "sale";
    case "rights":
      return "rights";
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
      if (!orgId || !centerId || !validate(orgId) || !validate(centerId)) continue;
      const slot = parts.join(":"),
        kind = slotKind(slot);
      if (!kind) continue;
      const scope = { actorId, orgId, centerId };
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
