import type { TFunction } from "i18next";
import type { PersonSummary } from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
import type { PeopleRow } from "./people-view";

// Presentation only: all three aggregates and their visibility come from the
// final server cursor page. Never derive balances or lessons from other rows.
export function peopleRow(
  person: PersonSummary,
  centerId: string,
  t: TFunction,
  timezone?: string,
): PeopleRow {
  const students = person.relationships.filter(
    (item) => item.center_id === centerId && item.kind === "student",
  );
  const summary = person.member_summary;
  const rights = summary?.rights;
  const debt = summary?.debt;
  const lesson = summary?.next_lesson;
  const unavailable = (status: "restricted" | "not_enabled") =>
    status === "restricted"
      ? t(($) => $.people.rowSummary.restricted)
      : t(($) => $.people.rowSummary.notEnabled);
  return {
    id: person.id,
    name: person.display_name,
    email: person.contacts?.find((contact) => contact.kind === "email")?.value ?? null,
    state: students.some((item) => item.state === "active")
      ? "active"
      : students.length
        ? "inactive"
        : "none",
    entitlement: rights
      ? {
          label:
            rights.status === "available"
              ? [
                  t(($) => $.people.rowSummary.credits, {
                    amount: new Intl.NumberFormat("tr-TR").format(BigInt(rights.available_credits)),
                  }),
                  ...(rights.available_timed_packages === undefined
                    ? []
                    : [
                        t(($) => $.people.rowSummary.timedPackages, {
                          count: rights.available_timed_packages,
                        }),
                      ]),
                ].join(" · ")
              : unavailable(rights.status),
        }
      : null,
    debt: debt
      ? debt.status === "available"
        ? debt.by_currency.length
          ? debt.by_currency
              .map((item) => formatMinorAmount(item.remaining_minor, item.currency))
              .join(" · ")
          : t(($) => $.people.rowSummary.noDebt)
        : unavailable(debt.status)
      : null,
    debtOutstanding: debt?.status === "available" && debt.by_currency.length > 0,
    nextSession: lesson
      ? lesson.status === "available"
        ? lesson.lesson === null
          ? t(($) => $.people.rowSummary.noLesson)
          : timezone
            ? new Intl.DateTimeFormat("tr-TR", {
                timeZone: timezone,
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              }).format(new Date(lesson.lesson.starts_at))
            : null
        : unavailable(lesson.status)
      : null,
  };
}
