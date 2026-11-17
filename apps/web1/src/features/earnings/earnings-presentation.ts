import type { TFunction } from "i18next";
import type { InstructorFinanceDirectory } from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
import type { EarningsInstructorRow, EarningsLineRow, EarningsPaymentRow } from "./earnings-view";
export function earningsPresentation(
  data: InstructorFinanceDirectory,
  timezone: string,
  t: TFunction,
  counts: Record<string, number> = {},
) {
  const amount = (
    totals: InstructorFinanceDirectory["totals"],
    field: "earned_minor" | "paid_minor" | "remaining_minor" | "overpaid_minor",
  ) =>
    totals.length
      ? totals.map((row) => formatMinorAmount(row[field], row.currency)).join(" · ")
      : "—";
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  const people: EarningsInstructorRow[] = [],
    lines: EarningsLineRow[] = [],
    payments: EarningsPaymentRow[] = [];
  for (const row of data.items) {
    if (row.kind === "instructor")
      people.push({
        id: row.person_id,
        name: row.display_name,
        initials: row.display_name
          .split(/\s+/)
          .slice(0, 2)
          .map((x) => x[0])
          .join(""),
        agreement: t(($) => $.earnings.activeAgreements, {
          count: row.current_agreement_ids.length,
        }),
        agreementDetail: t(($) => $.earnings.agreementVersions, {
          count: row.agreement_ids.length,
        }),
        sessions:
          counts[row.person_id] === undefined
            ? "—"
            : new Intl.NumberFormat("tr-TR").format(counts[row.person_id]!),
        earned: amount(row.totals, "earned_minor"),
        paid: amount(row.totals, "paid_minor"),
        remaining: amount(row.totals, "remaining_minor"),
      });
    else if (row.kind === "earning") {
      const value = row.earning;
      lines.push({
        id: value.id,
        date: date(value.created_at),
        session: row.session_name ?? t(($) => $.earnings.unnamedSession),
        instructor: row.display_name,
        basis:
          row.agreement_version === null
            ? t(($) => $.earnings.bases[value.basis.source])
            : `${t(($) => $.earnings.bases[value.basis.source])} · ${t(($) => $.earnings.agreementVersion, { version: row.agreement_version })}`,
        amount: formatMinorAmount(
          `${value.direction === "subtract" ? "-" : ""}${value.amount_minor}`,
          value.currency,
        ),
        paid: formatMinorAmount(value.paid_minor, value.currency),
        remaining: formatMinorAmount(value.remaining_minor, value.currency),
        state: value.previous_id
          ? t(($) => $.earnings.adjustmentLine)
          : BigInt(value.overpaid_minor ?? "0") > 0n
            ? t(($) => $.earnings.overpaidLine)
            : value.remaining_minor === "0"
              ? t(($) => $.earnings.paidLine)
              : t(($) => $.earnings.openLine),
      });
    } else
      payments.push({
        id: row.id,
        date: date(row.occurred_at),
        instructor: row.display_name,
        operation: row.previous_id ? t(($) => $.earnings.correction) : t(($) => $.earnings.payment),
        amount: formatMinorAmount(
          `${row.direction === "decrease" ? "-" : ""}${row.amount_minor}`,
          row.currency,
        ),
        note: row.reason ?? "—",
        method: row.payment
          ? t(($) => $.earnings.methods[row.payment!.method]) +
            (row.payment.reference ? ` · ${row.payment.reference}` : "")
          : t(($) => $.earnings.unknownMethod),
        canCorrect: row.previous_id === null,
      });
  }
  return {
    people,
    lines,
    payments,
    summary: {
      earned: amount(data.totals, "earned_minor"),
      paid: amount(data.totals, "paid_minor"),
      remaining: amount(data.totals, "remaining_minor"),
      overpaid: amount(data.totals, "overpaid_minor"),
    },
  };
}
