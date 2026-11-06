import { validate, v7 } from "uuid";
import type {
  AgreementVersionView,
  PayTerms,
  PayComponent,
  PayModel,
  RoomFee,
  ValuationBasis,
} from "@ftksaas/api-contracts";
import { money } from "./collection-command";
import { priceToMinor } from "./product-terms";
import { localTimeChoices } from "./session-change";
import type { SetupScope, SetupInput } from "./studio-setup";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const only = (x: Record<string, unknown>, keys: string[]) =>
  Object.keys(x).every((k) => keys.includes(k));
const uuid = (x: unknown): x is string => typeof x === "string" && validate(x);
const rate = (x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 10000;
function validBasis(x: unknown) {
  return (
    object(x) &&
    only(x, ["mode", "unit_minor"]) &&
    (x.mode === "fixed_unit" ? money(x.unit_minor) : x.mode === "sale_unit" && x.unit_minor == null)
  );
}
function components(x: unknown, packageOnly = false): x is PayComponent[] {
  if (!Array.isArray(x) || !x.length) return false;
  return x.every(
    (c, index) =>
      object(c) &&
      only(c, ["kind", "rate_bps", "amount_minor", "entitlement_kind", "basis"]) &&
      typeof c.kind === "string" &&
      ["percentage", "session_fixed", "per_person"].includes(c.kind) &&
      (c.entitlement_kind == null ||
        (typeof c.entitlement_kind === "string" &&
          ["credits", "timed"].includes(c.entitlement_kind))) &&
      (!packageOnly || c.kind !== "session_fixed") &&
      (c.kind === "percentage"
        ? rate(c.rate_bps) &&
          validBasis(c.basis) &&
          c.amount_minor == null &&
          (c.entitlement_kind !== "timed" || (object(c.basis) && c.basis.mode === "fixed_unit"))
        : money(c.amount_minor) &&
          c.rate_bps == null &&
          c.basis == null &&
          (c.kind !== "session_fixed" || c.entitlement_kind == null)) &&
      !x
        .slice(0, index)
        .some(
          (old) =>
            old.kind === c.kind &&
            (c.kind === "session_fixed" ||
              old.entitlement_kind == null ||
              c.entitlement_kind == null ||
              old.entitlement_kind === c.entitlement_kind),
        ),
  );
}
export function validPayTerms(x: unknown): x is PayTerms {
  if (
    !object(x) ||
    !only(x, ["model", "currency", "components", "room_fee", "package_overrides"]) ||
    typeof x.currency !== "string" ||
    !/^[A-Z]{3}$/.test(x.currency) ||
    !components(x.components)
  )
    return false;
  const kinds = [...new Set(x.components.map((c) => c.kind))].sort().join(","),
    models: Record<string, string> = {
      percentage: "percentage",
      session_fixed: "session_fixed",
      per_person: "per_person",
      fixed_plus_person: "per_person,session_fixed",
    };
  if (x.model !== "explicit_mixed" && (typeof x.model !== "string" || models[x.model] !== kinds))
    return false;
  const r = x.room_fee;
  if (
    !object(r) ||
    !only(r, ["kind", "amount_minor", "rate_bps", "basis", "order"]) ||
    typeof r.order !== "string" ||
    !["before_instructor_share", "after_instructor_share"].includes(r.order) ||
    !(r.kind === "free"
      ? r.amount_minor == null && r.rate_bps == null && r.basis == null
      : r.kind === "fixed"
        ? money(r.amount_minor) && r.rate_bps == null && r.basis == null
        : r.kind === "percentage" &&
          rate(r.rate_bps) &&
          validBasis(r.basis) &&
          r.amount_minor == null)
  )
    return false;
  if (x.package_overrides === undefined) return true;
  const seen = new Set<string>();
  return (
    Array.isArray(x.package_overrides) &&
    x.package_overrides.every((p) => {
      if (
        !object(p) ||
        !only(p, ["product_id", "components"]) ||
        !uuid(p.product_id) ||
        seen.has(p.product_id) ||
        !components(p.components, true)
      )
        return false;
      seen.add(p.product_id);
      return true;
    })
  );
}
export type ComponentDraft = {
  kind: string;
  amount: string;
  rate: string;
  entitlement: string;
  basis: string;
  unit: string;
};
export const emptyComponent = (): ComponentDraft => ({
  kind: "",
  amount: "",
  rate: "",
  entitlement: "",
  basis: "",
  unit: "",
});
export type PayDraft = {
  model: string;
  currency: string;
  components: ComponentDraft[];
  room: { kind: string; amount: string; rate: string; basis: string; unit: string; order: string };
  packages: { productId: string; name?: string; components: ComponentDraft[] }[];
};
export const emptyPayDraft = (): PayDraft => ({
  model: "",
  currency: "",
  components: [emptyComponent()],
  room: { kind: "", amount: "", rate: "", basis: "", unit: "", order: "" },
  packages: [],
});
function bps(value: string) {
  const m = /^(0|[1-9][0-9]*)(?:[.,]([0-9]{1,2}))?$/.exec(value.trim());
  if (!m) throw Error("invalidAgreement");
  const result = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (!rate(result)) throw Error("invalidAgreement");
  return result;
}
function basis(mode: string, unit: string, currency: string): ValuationBasis {
  if (mode === "sale_unit") return { mode };
  if (mode === "fixed_unit") return { mode, unit_minor: priceToMinor(unit, currency) };
  throw Error("invalidAgreement");
}
function component(d: ComponentDraft, currency: string): PayComponent {
  if (!["all", "credits", "timed"].includes(d.entitlement) && d.kind !== "session_fixed")
    throw Error("invalidAgreement");
  const entitlement: Pick<PayComponent, "entitlement_kind"> =
    d.entitlement === "credits" || d.entitlement === "timed"
      ? { entitlement_kind: d.entitlement }
      : {};
  if (d.kind === "percentage")
    return {
      kind: d.kind,
      rate_bps: bps(d.rate),
      basis: basis(d.basis, d.unit, currency),
      ...entitlement,
    };
  if (d.kind === "session_fixed" || d.kind === "per_person")
    return {
      kind: d.kind,
      amount_minor: priceToMinor(d.amount, currency),
      ...(d.kind === "per_person" ? entitlement : {}),
    };
  throw Error("invalidAgreement");
}
export function payTerms(d: PayDraft): PayTerms {
  try {
    const currency = d.currency.trim().toUpperCase(),
      room = d.room,
      roomFee: RoomFee = {
        kind: room.kind as RoomFee["kind"],
        order: room.order as RoomFee["order"],
        ...(room.kind === "fixed"
          ? { amount_minor: priceToMinor(room.amount, currency) }
          : room.kind === "percentage"
            ? { rate_bps: bps(room.rate), basis: basis(room.basis, room.unit, currency) }
            : {}),
      };
    const terms = {
      model: d.model as PayModel,
      currency,
      components: d.components.map((c) => component(c, currency)),
      room_fee: roomFee,
      ...(d.packages.length
        ? {
            package_overrides: d.packages.map((p) => ({
              product_id: p.productId,
              components: p.components.map((c) => component(c, currency)),
            })),
          }
        : {}),
    };
    if (!validPayTerms(terms)) throw Error("invalidAgreement");
    return terms;
  } catch {
    throw Error("invalidAgreement");
  }
}
export type AgreementDraft = {
  disciplineId: string;
  format: string;
  starts: string;
  ends: string;
  startOffset: string;
  endOffset: string;
  reason: string;
};
export function agreementCommand(
  scope: SetupScope,
  personId: string,
  timeZone: string,
  d: AgreementDraft,
  terms: PayTerms,
  prior?: AgreementVersionView,
) {
  const instant = (local: string, offset: string) => {
    const choices = localTimeChoices(local, timeZone);
    return choices.length === 1
      ? choices[0]?.instant
      : choices.find((c) => c.instant === offset)?.instant;
  };
  const starts = instant(d.starts, d.startOffset),
    ends = instant(d.ends, d.endOffset);
  if (
    !scope.centerId ||
    !uuid(personId) ||
    !uuid(d.disciplineId) ||
    !["group", "private"].includes(d.format) ||
    !starts ||
    !ends ||
    Date.parse(starts) >= Date.parse(ends) ||
    !d.reason.trim() ||
    d.reason.length > 10000 ||
    !validPayTerms(terms) ||
    (prior &&
      (prior.person_id !== personId ||
        prior.center_id !== scope.centerId ||
        prior.discipline_id !== d.disciplineId ||
        prior.format !== d.format ||
        !uuid(prior.id) ||
        !Number.isSafeInteger(prior.version) ||
        prior.version <= 0 ||
        Date.parse(starts) <= Date.parse(prior.valid.starts_at)))
  )
    throw Error("invalidAgreement");
  const input: SetupInput<"instructor_agreement_publish_v1"> = {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: v7(),
    person_id: personId,
    discipline_id: d.disciplineId,
    format: d.format as "group" | "private",
    valid: { starts_at: starts, ends_at: ends },
    terms,
    reason: d.reason.trim(),
    ...(prior ? { supersedes_id: prior.id, expected_version: prior.version } : {}),
  };
  return { operation: "instructor_agreement_publish_v1" as const, input };
}
export function validAgreement(
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  const interval = input.valid;
  return (
    !!centerId &&
    input.center_id === centerId &&
    uuid(input.person_id) &&
    slot === `agreements:${input.person_id}` &&
    uuid(input.discipline_id) &&
    (input.format === "group" || input.format === "private") &&
    typeof input.reason === "string" &&
    !!input.reason.trim() &&
    input.reason.length <= 10000 &&
    object(interval) &&
    only(interval, ["starts_at", "ends_at"]) &&
    typeof interval.starts_at === "string" &&
    typeof interval.ends_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(interval.starts_at) &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(interval.ends_at) &&
    Date.parse(interval.starts_at) < Date.parse(interval.ends_at) &&
    validPayTerms(input.terms) &&
    (input.supersedes_id == null
      ? input.expected_version === undefined
      : uuid(input.supersedes_id) &&
        Number.isSafeInteger(input.expected_version) &&
        Number(input.expected_version) > 0)
  );
}
