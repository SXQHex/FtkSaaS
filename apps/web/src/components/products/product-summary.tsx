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
        <dd>
          <ul className="space-y-1">
            {terms.scopes.map((scope, i) => (
              <li key={i} className="wrap-anywhere">
                {scope.scope_kind === "center_all_disciplines"
                  ? t("allDisciplinesScope")
                  : scope.discipline_id}{" "}
                ·{" "}
                {scope.usage_targets
                  .map((target) => (target === "lesson" ? t("lessonTarget") : t("eventTarget")))
                  .join(", ")}
                {scope.class_id ? ` · ${scope.class_id}` : ""}
                {scope.event_id ? ` · ${scope.event_id}` : ""}
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("freezeSummary")}</dt>
        <dd>
          {t(terms.freeze.enabled ? "freezeOn" : "freezeOff")}
          {terms.freeze.enabled && (
            <>
              {" "}
              · {t(terms.freeze.extends_validity ? "extendsValidity" : "noExtension")}
              {terms.freeze.max_days != null ? ` · ${terms.freeze.max_days}` : ""}
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}
