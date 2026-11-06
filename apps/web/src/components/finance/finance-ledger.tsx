"use client";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { effectMoney } from "../../lib/effect-money";
export function FinanceLedger({ view }: { view: FinanceView }) {
  const t = useTranslations("finance"),
    locale = useLocale(),
    format = useFormatter();
  const amount = (value: string) => effectMoney(value, view.currency, locale);
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{t("outstanding")}</dt>
          <dd className="mt-2 break-words text-xl font-semibold tabular-nums">
            {amount(
              view.debts
                .reduce((total, debt) => total + BigInt(debt.remaining_minor), 0n)
                .toString(),
            )}
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{t("credit")}</dt>
          <dd className="mt-2 break-words text-xl font-semibold tabular-nums">
            {amount(view.credit_available_minor)}
          </dd>
        </div>
      </dl>
      <section className="space-y-3" aria-label={t("debts")}>
        <h4 className="font-semibold">{t("debts")}</h4>
        {!view.debts.length && <p>{t("emptyDebts")}</p>}
        <ul className="space-y-3">
          {view.debts.map((debt, index) => (
            <li className="space-y-2 rounded-lg border p-4" key={debt.id}>
              <p className="font-medium">
                {t("debtNumber", { number: index + 1 })} ·{" "}
                {format.dateTime(new Date(debt.due_at), { dateStyle: "medium" })}
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {(["net_minor", "paid_minor", "claimed_minor", "remaining_minor"] as const).map(
                  (key) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-muted-foreground">{t(key)}</dt>
                      <dd className="break-words tabular-nums">
                        {debt[key] === undefined ? t("unspecified") : amount(debt[key])}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-label={t("movements")}>
        <h4 className="font-semibold">{t("movements")}</h4>
        {!view.movements.items.length && <p>{t("emptyMovements")}</p>}
        <ul className="space-y-3">
          {view.movements.items.map((row) => (
            <li className="min-w-0 space-y-2 rounded-lg border p-4" key={row.id}>
              <p className="flex flex-wrap justify-between gap-2">
                <span>{t(`kinds.${row.kind}`)}</span>
                <span className="break-words font-medium tabular-nums">
                  {amount(row.amount_minor)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {format.dateTime(new Date(row.occurred_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="text-sm">
                {row.payment ? t(`methods.${row.payment.method}`) : t("unspecified")}
                {row.payment?.reference && (
                  <span className="block break-words">{row.payment.reference}</span>
                )}
              </p>
              {row.previous_id && (
                <p className="text-sm text-muted-foreground">{t("linkedMovement")}</p>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {t("asOf", {
            date: format.dateTime(new Date(view.movements.as_of), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      </section>
    </div>
  );
}
