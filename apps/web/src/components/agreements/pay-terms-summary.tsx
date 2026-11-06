"use client";
import { useLocale, useTranslations } from "next-intl";
import type { PayComponent, PayTerms } from "@ftksaas/api-contracts";
import { effectMoney } from "../../lib/effect-money";
export function PayTermsSummary({
  terms,
  packages = [],
}: {
  terms: PayTerms;
  packages?: { productId: string; name?: string }[];
}) {
  const t = useTranslations("agreements"),
    locale = useLocale(),
    room = terms.room_fee;
  return (
    <div className="space-y-3">
      <p>
        {t(`models.${terms.model}`)} · {terms.currency}
      </p>
      <ul className="space-y-2">
        {terms.components.map((c, i) => (
          <li key={i}>
            <ComponentSummary value={c} currency={terms.currency} />
          </li>
        ))}
      </ul>
      <div className="rounded-md border p-3">
        <p>
          {t("roomFee")}: {t(`roomKinds.${room.kind}`)} · {t(room.order)}
        </p>
        {room.amount_minor != null && (
          <p>{effectMoney(room.amount_minor, terms.currency, locale)}</p>
        )}
        {room.rate_bps != null && <p>{room.rate_bps / 100}%</p>}
        {room.basis && (
          <p>
            {t(room.basis.mode === "sale_unit" ? "saleUnit" : "fixedUnit")}
            {room.basis.unit_minor != null &&
              ` · ${effectMoney(room.basis.unit_minor, terms.currency, locale)}`}
          </p>
        )}
      </div>
      {terms.package_overrides?.map((p, index) => (
        <section key={p.product_id} className="space-y-2 rounded-md border p-3">
          <p>
            {packages.find((row) => row.productId === p.product_id)?.name ??
              t("packageNumber", { number: index + 1 })}{" "}
            · {p.product_id}
          </p>
          {p.components.map((c, i) => (
            <ComponentSummary key={i} value={c} currency={terms.currency} />
          ))}
        </section>
      ))}
    </div>
  );
}
function ComponentSummary({ value, currency }: { value: PayComponent; currency: string }) {
  const t = useTranslations("agreements"),
    locale = useLocale();
  return (
    <div>
      <p>
        {t(`componentKinds.${value.kind}`)}
        {value.entitlement_kind && ` · ${t(`entitlements.${value.entitlement_kind}`)}`}
      </p>
      {value.amount_minor != null && <p>{effectMoney(value.amount_minor, currency, locale)}</p>}
      {value.rate_bps != null && <p>{value.rate_bps / 100}%</p>}
      {value.basis && (
        <p>
          {t(value.basis.mode === "sale_unit" ? "saleUnit" : "fixedUnit")}
          {value.basis.unit_minor != null &&
            ` · ${effectMoney(value.basis.unit_minor, currency, locale)}`}
        </p>
      )}
    </div>
  );
}
