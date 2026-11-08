"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useLocale, useTranslations } from "next-intl";
import type { SaleImpact as Impact, SessionView } from "@ftksaas/api-contracts";
export function SaleImpact({ sale, sessions }: { sale: Impact; sessions: SessionView[] }) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("flows"),
    p = useTranslations("products"),
    format = useFormatter(),
    locale = useLocale();
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      timeZone: sale.timezone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <div className="min-w-0 space-y-4">
      <p>{t("saleHint")}</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt>{t("saleDebt")}</dt>
          <dd>{effectMoney(sale.debt_minor, sale.currency, locale)}</dd>
        </div>
        <div>
          <dt>{p("kind")}</dt>
          <dd>
            {p(
              sale.kind === "credits" ? "creditsKind" : sale.quota ? "quotaKind" : "unlimitedKind",
            )}
          </dd>
        </div>
        <div>
          <dt>{p("bookingMode")}</dt>
          <dd>{p(sale.booking_mode)}</dd>
        </div>
        <div>
          <dt>{t("saleValidity")}</dt>
          <dd>
            {sale.start_date} — {sale.end_date}
            <br />
            {date(sale.valid_from)} — {date(sale.valid_until)} · {sale.timezone}
          </dd>
        </div>
        {sale.kind === "credits" && (
          <>
            <div>
              <dt>{t("saleGranted")}</dt>
              <dd>{sale.granted}</dd>
            </div>
            <div>
              <dt>{p("reserved")}</dt>
              <dd>{sale.reserved}</dd>
            </div>
            <div>
              <dt>{p("consumed")}</dt>
              <dd>{sale.consumed}</dd>
            </div>
            <div>
              <dt>{p("available")}</dt>
              <dd>{sale.available}</dd>
            </div>
          </>
        )}
        {sale.quota && (
          <div>
            <dt>{p("quota")}</dt>
            <dd>
              {sale.quota.limit} / {p(sale.quota.period)}
            </dd>
          </div>
        )}
      </dl>
      <p>{t("noCollection")}</p>
      <h5 className="font-semibold">{t("saleDeficits")}</h5>
      {!sale.deficits.length ? (
        <p>{t("noDeficits")}</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {sale.deficits.map((row, index) => (
            <li key={row.deficit_id} className="rounded-md border p-3">
              <p>{t("deficitNumber", { number: index + 1 })}</p>
              <p>
                {sessions.some((session) => session.id === row.session_id)
                  ? date(sessions.find((session) => session.id === row.session_id)!.starts_at)
                  : t("sessionRestricted")}
              </p>
              <p>
                {p(row.state)} · {row.quantity}
              </p>
              <p>{t(row.settles ? "deficitSettled" : "deficitUnchanged")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
