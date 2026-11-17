import type { TFunction } from "i18next";
import type { ProductView } from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
export interface SaleProductNames {
  centers: { id: string; name: string }[];
  disciplines: { id: string; name: string }[];
}
export function saleProductConditions(product: ProductView, names: SaleProductNames, t: TFunction) {
  const terms = product.terms;
  return [
    t(($) => $.products[terms.booking_mode]),
    terms.kind === "credits"
      ? `${terms.credits} · ${t(($) => $.products.creditKind)}`
      : terms.quota
        ? t(($) => $.memberProfile.catalogQuota, {
            limit: terms.quota.limit,
            period: t(($) => $.products[terms.quota!.period]),
          })
        : t(($) => $.memberProfile.saleUnlimited),
    ...terms.scopes.map((scope) =>
      [
        scope.scope_kind.startsWith("organization_")
          ? t(($) => $.products.organizationScope)
          : (names.centers.find((x) => x.id === scope.center_id)?.name ??
            t(($) => $.memberProfile.unknownScopeCenter)),
        scope.discipline_id
          ? (names.disciplines.find((x) => x.id === scope.discipline_id)?.name ??
            t(($) => $.memberProfile.unknownScopeDiscipline))
          : t(($) => $.products.allDisciplines),
        ...scope.usage_targets.map((target) =>
          t(($) => (target === "lesson" ? $.products.lessons : $.products.event)),
        ),
        ...(scope.class_id ? [t(($) => $.products.classRestricted)] : []),
        ...(scope.event_id ? [t(($) => $.products.eventRestricted)] : []),
      ].join(" · "),
    ),
  ].join("; ");
}
export function saleProductDetail(product: ProductView, names: SaleProductNames, t: TFunction) {
  return `${formatMinorAmount(product.terms.price_minor, product.terms.currency)} · ${saleProductConditions(product, names, t)}`;
}
