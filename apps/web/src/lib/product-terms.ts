import { validate } from "uuid";
import type {
  ProductTerms,
  DisciplineView,
  BookingMode,
  RefundMethod,
} from "@ftksaas/api-contracts";
export type ProductDraft = {
  name: string;
  disciplineId: string;
  kind: "credits" | "quota" | "unlimited";
  bookingMode: BookingMode;
  credits: string;
  price: string;
  currency: string;
  quotaPeriod: "week" | "month";
  quotaLimit: string;
  refund: RefundMethod;
  usedUnitPrice: string;
};
const maxMoney = 9223372036854775807n;
function money(value: unknown): value is string {
  return (
    typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= maxMoney
  );
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
export function priceToMinor(value: string, currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw Error("invalidProduct");
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const match = /^(0|[1-9][0-9]*)(?:[.,]([0-9]+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > digits) throw Error("invalidProduct");
  const minor = (
    BigInt(match[1]!) * 10n ** BigInt(digits) +
    BigInt((match[2] ?? "").padEnd(digits, "0") || "0")
  ).toString();
  if (!money(minor)) throw Error("invalidProduct");
  return minor;
}
export function productTerms(
  draft: ProductDraft,
  discipline: DisciplineView,
  centerId: string,
): ProductTerms {
  if (discipline.id !== draft.disciplineId || discipline.state !== "active" || !draft.name.trim())
    throw Error("invalidProduct");
  const terms: ProductTerms = {
    name: `${discipline.name} ${draft.name.trim()}`,
    kind: draft.kind === "credits" ? "credits" : "timed",
    booking_mode: draft.bookingMode,
    credits: draft.kind === "credits" ? Number(draft.credits) : null,
    price_minor: priceToMinor(draft.price, draft.currency),
    currency: draft.currency,
    freeze: { enabled: false, extends_validity: false },
    refund: {
      method: draft.refund,
      ...(draft.refund === "used_at_unit_price"
        ? { used_unit_minor: priceToMinor(draft.usedUnitPrice, draft.currency) }
        : {}),
    },
    quota:
      draft.kind === "quota"
        ? { period: draft.quotaPeriod, limit: Number(draft.quotaLimit) }
        : null,
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: centerId,
        discipline_id: discipline.id,
        usage_targets: ["lesson"],
      },
    ],
  };
  if (!validPublishedTerms(terms, centerId)) throw Error("invalidProduct");
  return terms;
}
// Recovery accepts only the narrow lesson product shape this Starter form can create.
export function validPublishedTerms(value: unknown, centerId: string): value is ProductTerms {
  if (
    !object(value) ||
    !keys(value, [
      "name",
      "kind",
      "booking_mode",
      "credits",
      "price_minor",
      "currency",
      "freeze",
      "refund",
      "quota",
      "scopes",
    ]) ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    !["credits", "timed"].includes(String(value.kind)) ||
    !["priority", "flexible"].includes(String(value.booking_mode)) ||
    !money(value.price_minor) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    !object(value.freeze) ||
    !keys(value.freeze, ["enabled", "extends_validity"]) ||
    value.freeze.enabled !== false ||
    value.freeze.extends_validity !== false ||
    !object(value.refund) ||
    !keys(value.refund, ["method", "used_unit_minor"]) ||
    !["none", "credit_ratio", "used_at_unit_price", "time_ratio"].includes(
      String(value.refund.method),
    )
  )
    return false;
  if (value.kind === "timed" && value.refund.method === "credit_ratio") return false;
  if (
    value.refund.method === "used_at_unit_price"
      ? !money(value.refund.used_unit_minor)
      : value.refund.used_unit_minor !== undefined
  )
    return false;
  if (
    value.kind === "credits"
      ? !positive(value.credits) || value.quota !== null
      : value.credits !== null ||
        (value.quota !== null &&
          (!object(value.quota) ||
            !keys(value.quota, ["period", "limit"]) ||
            !["week", "month"].includes(String(value.quota.period)) ||
            !positive(value.quota.limit)))
  )
    return false;
  if (!Array.isArray(value.scopes) || value.scopes.length !== 1) return false;
  const scope = value.scopes[0];
  return (
    object(scope) &&
    keys(scope, ["scope_kind", "center_id", "discipline_id", "usage_targets"]) &&
    scope.scope_kind === "center_discipline" &&
    scope.center_id === centerId &&
    typeof scope.discipline_id === "string" &&
    validate(scope.discipline_id) &&
    Array.isArray(scope.usage_targets) &&
    scope.usage_targets.length === 1 &&
    scope.usage_targets[0] === "lesson"
  );
}
