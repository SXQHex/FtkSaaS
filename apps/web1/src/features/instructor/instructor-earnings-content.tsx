import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { useInstructorScope } from "./use-instructor-scope";
import {
  instructorEarningMonths,
  readInstructorEarningPage,
  readInstructorAccount,
} from "./instructor-earnings-read";
import { InstructorEarningsView } from "./instructor-earnings-view";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { FieldSet } from "../../components/ui/field";
import { AgreementTermsFields } from "../studio/agreement-terms-fields";
import { termsDraft } from "../studio/agreement";
import type { AgreementVersionView } from "../../lib/api-contracts/generated";
export function InstructorEarningsContent({ scope }: { scope: ClientScope }) {
  const { t } = useTranslation(),
    router = useRouter();
  const { center, identity, self } = useInstructorScope(scope);
  const personId = self?.instructor ? identity?.person_id : undefined;
  const [now] = useState(() => new Date().toISOString());
  const [selected, setSelected] = useState("all");
  const [agreementId, setAgreementId] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [tab, setTab] = useState<"lines" | "payments">("lines");
  const months = useQuery({
    queryKey: ["instructor-earning-months", center?.timezone, now],
    queryFn: () => instructorEarningMonths(center!.timezone, now),
    enabled: Boolean(center && personId),
    retry: false,
  });
  const period =
    selected === "all"
      ? undefined
      : (months.data?.find((row) => row.id === selected) ?? months.data?.[0]);
  const [agreementCursors, setAgreementCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const query = useQuery({
    queryKey: [
      "instructor-earning-page",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      selected === "all" ? "all" : period?.id,
      tab === "lines" ? cursor : undefined,
    ],
    queryFn: () =>
      readInstructorEarningPage(
        scope,
        personId!,
        period?.interval,
        tab === "lines" ? cursor : undefined,
      ),
    enabled: Boolean(center && personId && (period || selected === "all") && tab === "lines"),
    retry: false,
  });
  const payments = useQuery({
    queryKey: [
      "instructor-account-payments",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      selected === "all" ? "all" : period?.id,
      tab === "payments" ? cursor : undefined,
    ],
    queryFn: () =>
      readInstructorAccount(
        scope,
        personId!,
        "payments",
        period?.interval,
        tab === "payments" ? cursor : undefined,
      ),
    enabled: Boolean(center && personId && (period || selected === "all")),
    retry: false,
  });
  const agreements = useQuery({
    queryKey: [
      "instructor-account-agreements",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      agreementCursors.at(-1),
    ],
    queryFn: () =>
      readInstructorAccount(scope, personId!, "agreements", undefined, agreementCursors.at(-1)),
    enabled: Boolean(center && personId),
    retry: false,
  });
  useEffect(() => {
    for (const error of [months.error, query.error, payments.error, agreements.error]) {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      )
        void router.invalidate();
    }
  }, [months.error, query.error, payments.error, agreements.error, router]);
  if (!center || !personId)
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">{t(($) => $.instructorEarnings.title)}</h1>
        <Alert variant="destructive">
          <AlertDescription>
            {!center
              ? t(($) => $.instructorToday.chooseScope)
              : t(($) => $.instructorToday.unavailable)}
          </AlertDescription>
        </Alert>
      </div>
    );
  const rows = !query.isError ? query.data?.items : undefined;
  const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: center.timezone });
  const agreementRows = !agreements.isError ? agreements.data?.agreements : undefined;
  const agreement = agreementRows?.find((row) => row.id === agreementId) ?? agreementRows?.[0];
  const next = tab === "payments" ? payments.data?.next_cursor : query.data?.next_cursor;
  const currentQuery = tab === "payments" ? payments : query;
  const values = !payments.isError ? payments.data?.totals : undefined;
  const metric = (key: "earned_minor" | "paid_minor" | "remaining_minor") =>
    values
      ? values.length
        ? values.map((row) => formatMinorAmount(row[key], row.currency)).join(" · ")
        : t(($) => $.instructorEarnings.emptyTotals)
      : null;
  return (
    <InstructorEarningsView
      period={selected === "all" ? "all" : (period?.id ?? "")}
      periods={[
        { id: "all", label: t(($) => $.instructorEarnings.all), disabled: false },
        ...(months.data ?? []),
      ]}
      onPeriod={(value) => {
        setSelected(value);
        setCursors([undefined]);
      }}
      totals={{
        earned: metric("earned_minor"),
        paid: metric("paid_minor"),
        remaining: metric("remaining_minor"),
      }}
      agreement={
        agreements.isError || !agreements.data ? (
          t(($) => $.instructorEarnings.unknownAgreement)
        ) : (
          <div className="flex flex-col gap-3">
            {agreementRows && agreementRows.length > 1 && (
              <NativeSelect
                aria-label={t(($) => $.instructorEarnings.agreement)}
                value={agreement?.id ?? ""}
                onChange={(event) => setAgreementId(event.target.value)}
              >
                {agreementRows.map((row, index) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {t(($) => $.instructorEarnings.agreementChoice, {
                      number: index + 1,
                      version: row.version,
                    })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            {agreement ? (
              <InstructorAgreementSummary
                key={agreement.id}
                row={agreement}
                timezone={center.timezone}
              />
            ) : (
              <p>{t(($) => $.instructorEarnings.noAgreement)}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={agreementCursors.length === 1 || agreements.isFetching}
                onPress={() => setAgreementCursors((old) => old.slice(0, -1))}
              >
                {t(($) => $.instructorEarnings.previousAgreements)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={
                  !agreements.data.next_cursor ||
                  agreements.isFetching ||
                  agreementCursors.includes(agreements.data.next_cursor)
                }
                onPress={() => {
                  const next = agreements.data?.next_cursor;
                  if (next && !agreementCursors.includes(next))
                    setAgreementCursors((old) => [...old, next]);
                }}
              >
                {t(($) => $.instructorEarnings.moreAgreements)}
              </Button>
            </div>
          </div>
        )
      }
      lines={
        rows?.map((row) => ({
          id: row.id,
          date: date.format(new Date(row.created_at)),
          session: row.session_id
            ? t(($) => $.instructorEarnings.sessionEarning)
            : t(($) => $.instructorEarnings.otherEarning),
          context: t(($) => $.instructorEarnings.recordDate),
          basis: t(($) => $.instructorEarnings.sources[row.basis.source]),
          amount: formatMinorAmount(
            (BigInt(row.amount_minor) * (row.direction === "subtract" ? -1n : 1n)).toString(),
            row.currency,
          ),
          state: row.previous_id
            ? t(($) => $.instructorEarnings.correction)
            : BigInt(row.overpaid_minor ?? "0") > 0n
              ? t(($) => $.instructorEarnings.overpaid)
              : BigInt(row.remaining_minor) > 0n
                ? BigInt(row.paid_minor) > 0n
                  ? t(($) => $.instructorEarnings.partial)
                  : t(($) => $.instructorEarnings.pending)
                : BigInt(row.paid_minor) > 0n
                  ? t(($) => $.instructorEarnings.paid)
                  : t(($) => $.instructorEarnings.settled),
        })) ?? null
      }
      payments={
        payments.isError || !payments.data
          ? null
          : payments.data.payments.map((row) => ({
              id: row.id,
              date: date.format(new Date(row.occurred_at)),
              operation: row.previous_id
                ? t(($) => $.instructorEarnings.correction)
                : t(($) => $.instructorEarnings.payment),
              method: row.method
                ? t(($) => $.instructorEarnings.methods[row.method!])
                : t(($) => $.instructorEarnings.unknownMethod),
              amount: formatMinorAmount(
                (BigInt(row.amount_minor) * (row.direction === "decrease" ? -1n : 1n)).toString(),
                row.currency,
              ),
            }))
      }
      tab={tab}
      onTab={(value) => {
        setTab(value);
        setCursors([undefined]);
      }}
      notice={
        <div className="space-y-3">
          <Alert>
            <AlertDescription>{t(($) => $.instructorEarnings.sourceLimits)}</AlertDescription>
          </Alert>
          {values
            ?.filter((row) => BigInt(row.overpaid_minor) > 0n)
            .map((row) => (
              <p key={row.currency}>
                {t(($) => $.instructorEarnings.balanceHint, {
                  amount: formatMinorAmount(row.overpaid_minor, row.currency),
                })}
              </p>
            ))}
          {(months.isError || query.isError || payments.isError || agreements.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.instructorEarnings.unread)}</AlertDescription>
            </Alert>
          )}
          {(months.isPending || currentQuery.isPending) && (
            <p role="status">{t(($) => $.instructorEarnings.loading)}</p>
          )}
          <Button
            variant="outline"
            isDisabled={
              months.isFetching ||
              currentQuery.isFetching ||
              payments.isFetching ||
              agreements.isFetching
            }
            onPress={() => {
              if (months.isError) void months.refetch();
              else {
                if (tab === "lines") void query.refetch();
                void payments.refetch();
                void agreements.refetch();
              }
            }}
          >
            {t(($) => $.instructorEarnings.retry)}
          </Button>
        </div>
      }
      pagination={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            isDisabled={cursors.length === 1 || currentQuery.isFetching}
            onPress={() => setCursors((old) => old.slice(0, -1))}
          >
            {t(($) => $.instructorEarnings.previous)}
          </Button>
          <Button
            variant="outline"
            isDisabled={
              !next || currentQuery.isError || currentQuery.isFetching || cursors.includes(next)
            }
            onPress={() => {
              if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
            }}
          >
            {t(($) => $.instructorEarnings.next)}
          </Button>
        </div>
      }
    />
  );
}

function InstructorAgreementSummary({
  row,
  timezone,
}: {
  row: AgreementVersionView;
  timezone: string;
}) {
  const { t } = useTranslation();
  const terms = useMemo(() => termsDraft(row.terms), [row.terms]);
  return (
    <div>
      <p>
        {t(($) => $.studio.payModels[row.terms.model])} · {row.terms.currency}
      </p>
      <p>
        {t(($) => $.instructorEarnings.agreementVersion, {
          version: row.version,
          date: new Intl.DateTimeFormat("tr-TR", {
            dateStyle: "medium",
            timeZone: timezone,
          }).format(new Date(row.valid.starts_at)),
        })}
      </p>
      <details>
        <summary className="cursor-pointer rounded-sm py-2 focus-visible:outline-2 focus-visible:outline-ring">
          {t(($) => $.instructorEarnings.agreementTerms)}
        </summary>
        <FieldSet disabled aria-label={t(($) => $.instructorEarnings.agreementTerms)}>
          <AgreementTermsFields
            value={terms}
            onChange={() => {}}
            disabled
            products={[]}
            loadingProducts={false}
            productsError={false}
            onLoadProducts={() => {}}
          />
        </FieldSet>
      </details>
    </div>
  );
}
