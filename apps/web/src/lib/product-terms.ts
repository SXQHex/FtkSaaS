import { validate } from "uuid";
import type {
  ProductTerms,
  DisciplineView,
  BookingMode,
  RefundMethod,
  FreezeTerms,
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
  scopes?: ProductTerms["scopes"];
  freeze?: FreezeTerms;
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
  discipline: DisciplineView | undefined,
  centerId: string,
): ProductTerms {
  if (
    (!draft.scopes &&
      (!discipline || discipline.id !== draft.disciplineId || discipline.state !== "active")) ||
    !draft.name.trim()
  )
    throw Error("invalidProduct");
  const terms: ProductTerms = {
    name: draft.scopes ? draft.name.trim() : `${discipline!.name} ${draft.name.trim()}`,
    kind: draft.kind === "credits" ? "credits" : "timed",
    booking_mode: draft.bookingMode,
    credits: draft.kind === "credits" ? Number(draft.credits) : null,
    price_minor: priceToMinor(draft.price, draft.currency),
    currency: draft.currency,
    freeze: draft.freeze ?? { enabled: false, extends_validity: false },
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
    scopes: draft.scopes ?? [
      {
        scope_kind: "center_discipline",
        center_id: centerId,
        discipline_id: discipline!.id,
        usage_targets: ["lesson"],
      },
    ],
  };
  if (!validPublishedTerms(terms, centerId)) throw Error("invalidProduct");
  return terms;
}
// Publication recovery accepts native center-scoped terms; the writer enforces the live plan.
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
    !keys(value.freeze, ["enabled", "extends_validity", "max_days"]) ||
    typeof value.freeze.enabled !== "boolean" ||
    typeof value.freeze.extends_validity !== "boolean" ||
    (!value.freeze.enabled && value.freeze.extends_validity) ||
    (value.freeze.max_days != null && !positive(value.freeze.max_days)) ||
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
  if (!Array.isArray(value.scopes) || !value.scopes.length) return false;
  const signatures = new Set<string>();
  return value.scopes.every((scope) => {
    if (
      !object(scope) ||
      !keys(scope, [
        "scope_kind",
        "center_id",
        "discipline_id",
        "class_id",
        "event_id",
        "usage_targets",
      ]) ||
      scope.center_id !== centerId ||
      !["center_discipline", "center_all_disciplines"].includes(String(scope.scope_kind)) ||
      (scope.scope_kind === "center_discipline"
        ? typeof scope.discipline_id !== "string" || !validate(scope.discipline_id)
        : scope.discipline_id !== null) ||
      !Array.isArray(scope.usage_targets) ||
      !scope.usage_targets.length ||
      new Set(scope.usage_targets).size !== scope.usage_targets.length ||
      scope.usage_targets.some((t) => t !== "lesson" && t !== "event") ||
      [scope.class_id, scope.event_id].some(
        (id) => id != null && (typeof id !== "string" || !validate(id)),
      ) ||
      (scope.class_id != null && !scope.usage_targets.includes("lesson")) ||
      (scope.event_id != null && !scope.usage_targets.includes("event"))
    )
      return false;
    const signature = JSON.stringify([
      scope.scope_kind,
      scope.discipline_id,
      scope.class_id ?? null,
      scope.event_id ?? null,
      [...scope.usage_targets].sort(),
    ]);
    if (signatures.has(signature)) return false;
    signatures.add(signature);
    return true;
  });
}
