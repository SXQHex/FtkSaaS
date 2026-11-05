import { validate } from "uuid";
import type { AcceptanceContext } from "@ftksaas/api-contracts";
import type { SetupScope } from "./studio-setup";
const subjects: Record<string, readonly string[]> = {
  sale: ["sales", "product_versions"],
  reservation: ["sessions", "reservations", "lesson_requests"],
  attendance: ["sessions", "reservations", "events", "event_registrations"],
  event_registration: ["events", "event_registrations"],
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validSelfDocumentContext(value: unknown): value is AcceptanceContext {
  if (
    !record(value) ||
    !record(value.subject) ||
    Object.keys(value).some((key) => !["gate", "subject", "product_version_id"].includes(key)) ||
    Object.keys(value.subject).some((key) => !["type", "id"].includes(key)) ||
    typeof value.gate !== "string" ||
    !Object.hasOwn(subjects, value.gate) ||
    typeof value.subject.type !== "string" ||
    !subjects[value.gate]?.includes(value.subject.type) ||
    typeof value.subject.id !== "string" ||
    !validate(value.subject.id)
  )
    return false;
  return (
    value.product_version_id === undefined ||
    (typeof value.product_version_id === "string" && validate(value.product_version_id))
  );
}
export function selfDocumentQuery(scope: SetupScope, context: AcceptanceContext) {
  if (!validSelfDocumentContext(context)) throw Error("invalidDocumentContext");
  return {
    org_id: scope.orgId,
    ...(scope.centerId ? { center_id: scope.centerId } : {}),
    context: {
      gate: context.gate,
      subject: { ...context.subject },
      ...(context.product_version_id ? { product_version_id: context.product_version_id } : {}),
    },
  };
}
export type SelfDocumentQuery = ReturnType<typeof selfDocumentQuery>;
