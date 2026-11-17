import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { getTemporal } from "../../lib/temporal";
import { studioBackend, studioPages, type StudioScope } from "./studio";
import type {
  AgreementVersionView,
  PayComponent,
  PayTerms,
  RequestInstructorAgreementPublish,
  ValuationBasis,
} from "../../lib/api-contracts/generated";

export interface PayComponentDraft {
  key: string;
  kind: string;
  amount: string;
  rate: string;
  entitlement: string;
  basis: string;
  unit: string;
}
export interface PayTermsDraft {
  model: string;
  currency: string;
  components: PayComponentDraft[];
  roomKind: string;
  roomAmount: string;
  roomRate: string;
  roomBasis: string;
  roomUnit: string;
  roomOrder: string;
  overrides: { key: string; productId: string; components: PayComponentDraft[] }[];
}
export interface AgreementDraft {
  personId: string;
  disciplineId: string;
  format: string;
  from: string;
  until: string;
  reason: string;
  accepted: boolean;
  terms: PayTermsDraft;
}
export interface AgreementIntent {
  scope: StudioScope;
  key: string;
  payload: Omit<
    RequestInstructorAgreementPublish,
    "client_api_version" | "request_id" | "org_id" | "center_id" | "operation_key"
  >;
}
export function componentDraft(component?: PayComponent): PayComponentDraft {
  return {
    key: uuidv7(),
    kind: component?.kind ?? "",
    amount: component?.amount_minor ?? "",
    rate:
      component?.rate_bps == null
        ? ""
        : `${Math.floor(component.rate_bps / 100)}.${String(component.rate_bps % 100).padStart(2, "0")}`,
    entitlement: component?.entitlement_kind ?? (component ? "all" : ""),
    basis: component?.basis?.mode ?? "",
    unit: component?.basis?.unit_minor ?? "",
  };
}
export function termsDraft(terms?: PayTerms): PayTermsDraft {
  return {
    model: terms?.model ?? "",
    currency: terms?.currency ?? "",
    components: terms?.components.map(componentDraft) ?? [componentDraft()],
    roomKind: terms?.room_fee.kind ?? "",
    roomAmount: terms?.room_fee.amount_minor ?? "",
    roomRate:
      terms?.room_fee.rate_bps == null
        ? ""
        : `${Math.floor(terms.room_fee.rate_bps / 100)}.${String(terms.room_fee.rate_bps % 100).padStart(2, "0")}`,
    roomBasis: terms?.room_fee.basis?.mode ?? "",
    roomUnit: terms?.room_fee.basis?.unit_minor ?? "",
    roomOrder: terms?.room_fee.order ?? "",
    overrides:
      terms?.package_overrides?.map((item) => ({
        key: uuidv7(),
        productId: item.product_id,
        components: item.components.map(componentDraft),
      })) ?? [],
  };
}
export async function agreementDraft(base?: AgreementVersionView): Promise<AgreementDraft> {
  const temporal = await getTemporal();
  const utcInput = (instant: string) =>
    temporal.Instant.from(instant)
      .toZonedDateTimeISO("UTC")
      .toPlainDateTime()
      .toString({ smallestUnit: "second" });
  return {
    personId: base?.person_id ?? "",
    disciplineId: base?.discipline_id ?? "",
    format: base?.format ?? "",
    from: "",
    until: base?.valid.ends_at ? utcInput(base.valid.ends_at) : "",
    reason: "",
    accepted: false,
    terms: termsDraft(base?.terms),
  };
}
const amountSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n);
function amount(value: string) {
  return amountSchema.parse(value.trim());
}
function rate(value: string) {
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(value)) throw new Error("AGREEMENT_INVALID");
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result > 10000) throw new Error("AGREEMENT_INVALID");
  return result;
}
function basis(mode: string, unit: string): ValuationBasis {
  return {
    mode: z.enum(["sale_unit", "fixed_unit"]).parse(mode),
    ...(mode === "fixed_unit" ? { unit_minor: amount(unit) } : {}),
  };
}
function components(
  rows: PayComponentDraft[],
  isPackage = false,
): [PayComponent, ...PayComponent[]] {
  if (!rows.length) throw new Error("AGREEMENT_INVALID");
  const result = rows.map((row): PayComponent => {
    const kind = z.enum(["session_fixed", "per_person", "percentage"]).parse(row.kind);
    if (isPackage && kind === "session_fixed") throw new Error("AGREEMENT_INVALID");
    if (kind === "session_fixed") return { kind, amount_minor: amount(row.amount) };
    const entitlement = z.enum(["all", "credits", "timed"]).parse(row.entitlement);
    if (kind === "percentage" && entitlement === "timed" && row.basis !== "fixed_unit")
      throw new Error("AGREEMENT_INVALID");
    return {
      kind,
      ...(entitlement !== "all" ? { entitlement_kind: entitlement } : {}),
      ...(kind === "percentage"
        ? { rate_bps: rate(row.rate), basis: basis(row.basis, row.unit) }
        : { amount_minor: amount(row.amount) }),
    };
  });
  if (
    result.some((left, index) =>
      result.some(
        (right, other) =>
          other < index &&
          left.kind === right.kind &&
          (left.kind === "session_fixed" ||
            !left.entitlement_kind ||
            !right.entitlement_kind ||
            left.entitlement_kind === right.entitlement_kind),
      ),
    )
  )
    throw new Error("AGREEMENT_INVALID");
  return result as [PayComponent, ...PayComponent[]];
}
export function payTerms(draft: PayTermsDraft): PayTerms {
  const model = z
    .enum(["session_fixed", "per_person", "percentage", "fixed_plus_person", "explicit_mixed"])
    .parse(draft.model);
  const parts = components(draft.components);
  const kinds = new Set(parts.map((part) => part.kind));
  if (
    (model === "session_fixed" && (kinds.size !== 1 || !kinds.has("session_fixed"))) ||
    (model === "per_person" && (kinds.size !== 1 || !kinds.has("per_person"))) ||
    (model === "percentage" && (kinds.size !== 1 || !kinds.has("percentage"))) ||
    (model === "fixed_plus_person" &&
      (kinds.size !== 2 || !kinds.has("session_fixed") || !kinds.has("per_person")))
  )
    throw new Error("AGREEMENT_INVALID");
  const roomKind = z.enum(["free", "fixed", "percentage"]).parse(draft.roomKind);
  const overrides = draft.overrides.map((item) => ({
    product_id: z.uuid().parse(item.productId),
    components: components(item.components, true),
  }));
  if (new Set(overrides.map((item) => item.product_id)).size !== overrides.length)
    throw new Error("AGREEMENT_INVALID");
  return {
    model,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .parse(draft.currency.trim()),
    components: parts,
    room_fee: {
      kind: roomKind,
      order: z.enum(["before_instructor_share", "after_instructor_share"]).parse(draft.roomOrder),
      ...(roomKind === "fixed"
        ? { amount_minor: amount(draft.roomAmount) }
        : roomKind === "percentage"
          ? { rate_bps: rate(draft.roomRate), basis: basis(draft.roomBasis, draft.roomUnit) }
          : {}),
    },
    ...(overrides.length ? { package_overrides: overrides } : {}),
  };
}
export async function agreementIntent(
  scope: StudioScope,
  draft: AgreementDraft,
  base?: AgreementVersionView,
): Promise<AgreementIntent> {
  if (!draft.accepted) throw new Error("AGREEMENT_APPROVAL_REQUIRED");
  const personId = z.uuid().parse(draft.personId),
    disciplineId = z.uuid().parse(draft.disciplineId);
  const format = z.enum(["group", "private"]).parse(draft.format);
  if (
    base &&
    (base.center_id !== scope.centerId ||
      base.person_id !== personId ||
      base.discipline_id !== disciplineId ||
      base.format !== format ||
      !Number.isSafeInteger(base.version) ||
      base.version < 1)
  )
    throw new Error("AGREEMENT_CHANGED");
  const temporal = await getTemporal();
  const utc = (value: string) =>
    temporal.PlainDateTime.from(value)
      .toZonedDateTime("UTC", { disambiguation: "reject" })
      .toInstant();
  const from = utc(draft.from),
    until = utc(draft.until);
  if (
    from.epochNanoseconds >= until.epochNanoseconds ||
    (base && from.epochNanoseconds <= temporal.Instant.from(base.valid.starts_at).epochNanoseconds)
  )
    throw new Error("AGREEMENT_INVALID");
  return {
    scope: { ...scope },
    key: uuidv7(),
    payload: {
      person_id: personId,
      discipline_id: disciplineId,
      format,
      reason: z.string().trim().min(1).parse(draft.reason),
      valid: { starts_at: from.toString(), ends_at: until.toString() },
      terms: payTerms(draft.terms),
      ...(base ? { supersedes_id: base.id, expected_version: base.version } : {}),
    },
  };
}
export async function publishAgreement(intent: AgreementIntent) {
  const backend = await studioBackend(intent.scope);
  const result = await backend.call("instructor_agreement_publish_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    ...intent.payload,
  });
  if (!result.primary_id) throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result.primary_id;
}
export async function readAgreementProducts(scope: StudioScope) {
  const backend = await studioBackend(scope);
  return studioPages((cursor) =>
    backend
      .call("products_list_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: scope.orgId,
        center_id: scope.centerId,
        include_timed_products: true,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      })
      .then((page) => ({ items: page.items, next_cursor: page.next_cursor ?? null })),
  );
}
