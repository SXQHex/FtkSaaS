"use client";
import { useLocale, useTranslations } from "next-intl";
import type { ProductTerms } from "@ftksaas/api-contracts";
import { effectMoney } from "../../lib/effect-money";
export function ProductSummary({ terms }: { terms: ProductTerms }) {
  const t = useTranslations("products"),
    locale = useLocale();
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">{t("kind")}</dt>
        <dd>
          {t(
            terms.kind === "credits" ? "creditsKind" : terms.quota ? "quotaKind" : "unlimitedKind",
          )}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("price")}</dt>
        <dd className="wrap-anywhere">{effectMoney(terms.price_minor, terms.currency, locale)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("bookingMode")}</dt>
        <dd>{t(terms.booking_mode)}</dd>
      </div>
      {terms.kind === "credits" && (
        <div>
          <dt className="text-muted-foreground">{t("credits")}</dt>
          <dd>{terms.credits}</dd>
        </div>
      )}
      {terms.quota && (
        <div>
          <dt className="text-muted-foreground">{t("quota")}</dt>
          <dd>
            {terms.quota.limit} / {t(terms.quota.period)}
          </dd>
        </div>
      )}
      <div>
        <dt className="text-muted-foreground">{t("refund")}</dt>
        <dd>
          {t(`refunds.${terms.refund.method}`)}
          {terms.refund.method === "used_at_unit_price" && terms.refund.used_unit_minor
            ? ` · ${effectMoney(terms.refund.used_unit_minor, terms.currency, locale)}`
            : ""}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("scopeCount")}</dt>
        <dd>{terms.scopes.length}</dd>
      </div>
    </dl>
  );
}
