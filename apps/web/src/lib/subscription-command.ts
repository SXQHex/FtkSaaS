import { validate } from "uuid";
export const subscriptionWrites = [
  "subscription_period_change_request_v1",
  "subscription_renewal_set_v1",
  "saas_payment_submit_v1",
  "organization_close_apply_v1",
  "organization_reopen_v1",
  "organization_delete_apply_v1",
] as const;
export const subscriptionFields = {
  subscription_period_change_request_v1: [
    "target_plan_id",
    "expected_version",
    "amount_minor",
    "currency",
    "effective_at",
  ],
  subscription_renewal_set_v1: ["expected_version", "renew"],
  saas_payment_submit_v1: ["amount_minor", "currency", "reference", "occurred_at", "quote_id"],
  organization_close_apply_v1: ["preview", "expected_version"],
  organization_reopen_v1: [],
  organization_delete_apply_v1: ["preview", "all_data"],
};
const id = (x: unknown): x is string => typeof x === "string" && validate(x);
const date = (x: unknown) => typeof x === "string" && Number.isFinite(Date.parse(x));
const money = (x: unknown) => typeof x === "string" && /^[1-9][0-9]*$/.test(x);
const currency = (x: unknown) => typeof x === "string" && /^[A-Z]{3}$/.test(x);
const version = (x: unknown) => Number.isSafeInteger(x) && Number(x) > 0;
const preview = (x: unknown) => {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  return Object.keys(p).length === 2 && id(p.id) && typeof p.token === "string" && !!p.token;
};
export function validSubscriptionCommand(
  op: string,
  i: Record<string, unknown>,
  center: string | undefined,
  slot: string,
) {
  if (center || i.center_id !== undefined) return false;
  switch (op) {
    case "subscription_period_change_request_v1":
      return (
        id(i.target_plan_id) &&
        slot === `subscription-period:${i.target_plan_id}` &&
        version(i.expected_version) &&
        money(i.amount_minor) &&
        currency(i.currency) &&
        date(i.effective_at)
      );
    case "subscription_renewal_set_v1":
      return (
        slot === "subscription-renewal" &&
        version(i.expected_version) &&
        typeof i.renew === "boolean"
      );
    case "saas_payment_submit_v1":
      return (
        slot === "subscription-payment" &&
        money(i.amount_minor) &&
        currency(i.currency) &&
        typeof i.reference === "string" &&
        !!i.reference.trim() &&
        date(i.occurred_at) &&
        (i.quote_id === undefined || i.quote_id === null || id(i.quote_id))
      );
    case "organization_close_apply_v1":
      return slot === "organization-close" && preview(i.preview) && version(i.expected_version);
    case "organization_reopen_v1":
      return slot === "organization-reopen";
    case "organization_delete_apply_v1":
      return (
        slot === "organization-delete" &&
        preview(i.preview) &&
        i.all_data === true &&
        i.reauth === undefined
      );
    default:
      return false;
  }
}
