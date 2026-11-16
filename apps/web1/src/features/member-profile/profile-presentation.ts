import type { TFunction } from "i18next";
import type {
  EntitlementView,
  ProductView,
  PersonView,
  FinanceView,
} from "../../lib/api-contracts/generated";
import type { ProfileEntitlement, ProfileAction } from "./member-profile-view";
import { formatMinorAmount } from "../../lib/money";
export function entitlementRows(
  rows: EntitlementView[],
  catalog: ProductView[],
  t: TFunction,
): ProfileEntitlement[] | null {
  if (rows.some((x) => x.kind !== "credits" && x.kind !== "timed")) return null;
  return rows.map((row) => {
    const product = catalog.find((x) => x.version_id === row.product_version_id);
    return {
      id: row.sale_id,
      name:
        product?.terms.name ??
        t(($) =>
          row.kind === "credits"
            ? $.memberProfile.rightKinds.credits
            : $.memberProfile.rightKinds.timed,
        ),
      period: `${row.start_date} – ${row.end_date} · ${row.timezone}`,
      state: t(($) => $.memberProfile.rightStates[row.state]),
      kind: row.kind === "credits" ? "credit" : "timed",
      ...(row.kind === "credits"
        ? { counts: { available: row.available, reserved: row.reserved, consumed: row.consumed } }
        : {}),
      note:
        [
          ...(row.deficit ? [t(($) => $.memberProfile.deficit, { count: row.deficit })] : []),
          ...(row.kind === "timed" && product?.terms.kind === "timed"
            ? [
                product.terms.quota
                  ? t(($) => $.memberProfile.catalogQuota, {
                      limit: product.terms.quota.limit,
                      period: t(($) => $.products[product.terms.quota!.period]),
                    })
                  : t(($) => $.memberProfile.saleUnlimited),
              ]
            : []),
          ...row.quotas.map(
            (q) =>
              `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeZone: row.timezone }).format(new Date(q.starts_at))} – ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeZone: row.timezone }).format(new Date(q.ends_at))}: ${t(($) => $.memberProfile.quotaUsage, { limit: q.limit, reserved: q.reserved, consumed: q.consumed })}`,
          ),
        ].join(" · ") || undefined,
      actions:
        row.state === "closed"
          ? []
          : ([
              { kind: "freeze", disabled: true },
              { kind: "extend", disabled: true },
              ...(row.kind === "credits" ? [{ kind: "adjust" as const, disabled: true }] : []),
              { kind: "terminate", disabled: true },
            ] satisfies ProfileAction[]),
    };
  });
}
export function scopedProfileDebt(finance: FinanceView): string {
  // finance_get publishes the complete debt array for this exact person/center/currency.
  // Sum its native remaining amounts; never recompute debt rules or mix currencies.
  return formatMinorAmount(
    finance.debts.reduce((sum, row) => sum + BigInt(row.remaining_minor), 0n).toString(),
    finance.currency,
  );
}
export function profileMetrics(
  person: PersonView,
  t: TFunction,
  timezone?: string,
  finance?: FinanceView,
) {
  const summary = person.member_summary,
    rights = summary?.rights,
    debt = summary?.debt,
    lesson = summary?.next_lesson;
  return {
    available: {
      value:
        rights?.status === "available"
          ? new Intl.NumberFormat("tr-TR").format(BigInt(rights.available_credits))
          : null,
      detail:
        rights?.status === "available" && rights.available_timed_packages !== undefined
          ? t(($) => $.people.rowSummary.timedPackages, { count: rights.available_timed_packages })
          : null,
    },
    upcoming: {
      value: null,
      detail:
        lesson?.status === "available"
          ? lesson.lesson && timezone
            ? new Intl.DateTimeFormat("tr-TR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: timezone,
              }).format(new Date(lesson.lesson.starts_at))
            : lesson.lesson
              ? null
              : t(($) => $.people.rowSummary.noLesson)
          : null,
    },
    debt: {
      value:
        debt?.status === "available"
          ? debt.by_currency.length
            ? debt.by_currency
                .map((x) => formatMinorAmount(x.remaining_minor, x.currency))
                .join(" · ")
            : t(($) => $.people.rowSummary.noDebt)
          : finance
            ? scopedProfileDebt(finance)
            : null,
      detail:
        finance && debt?.status !== "available"
          ? t(($) => $.finance.personContext, { currency: finance.currency })
          : null,
    },
    attendance: { value: null, detail: null },
  };
}
