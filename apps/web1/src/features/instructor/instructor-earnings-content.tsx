import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { useInstructorScope } from "./use-instructor-scope";
import { instructorEarningMonths, readInstructorEarningPage } from "./instructor-earnings-read";
import { InstructorEarningsView } from "./instructor-earnings-view";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
export function InstructorEarningsContent({ scope }: { scope: ClientScope }) {
  const { t } = useTranslation(),
    router = useRouter();
  const { center, identity, self } = useInstructorScope(scope);
  const personId = self?.instructor ? identity?.person_id : undefined;
  const [now] = useState(() => new Date().toISOString());
  const [selected, setSelected] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [tab, setTab] = useState<"lines" | "payments">("lines");
  const months = useQuery({
    queryKey: ["instructor-earning-months", center?.timezone, now],
    queryFn: () => instructorEarningMonths(center!.timezone, now),
    enabled: Boolean(center && personId),
    retry: false,
  });
  const period = months.data?.find((row) => row.id === selected) ?? months.data?.[0];
  const cursor = cursors.at(-1);
  const query = useQuery({
    queryKey: [
      "instructor-earning-page",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      period?.id,
      cursor,
    ],
    queryFn: () => readInstructorEarningPage(scope, personId!, period!.interval, cursor),
    enabled: Boolean(center && personId && period),
    retry: false,
  });
  useEffect(() => {
    for (const error of [months.error, query.error]) {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      )
        void router.invalidate();
    }
  }, [months.error, query.error, router]);
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
  const next = query.data?.next_cursor;
  return (
    <InstructorEarningsView
      period={period?.id ?? ""}
      periods={[
        { id: "all", label: t(($) => $.instructorEarnings.all), disabled: true },
        ...(months.data ?? []),
      ]}
      onPeriod={(value) => {
        setSelected(value);
        setCursors([undefined]);
      }}
      totals={{ earned: null, paid: null, remaining: null }}
      agreement={t(($) => $.instructorEarnings.unknownAgreement)}
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
      payments={null}
      tab={tab}
      onTab={setTab}
      notice={
        <div className="space-y-3">
          <Alert>
            <AlertDescription>{t(($) => $.instructorEarnings.sourceLimits)}</AlertDescription>
          </Alert>
          {(months.isError || query.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.instructorEarnings.unread)}</AlertDescription>
            </Alert>
          )}
          {(months.isPending || (Boolean(period) && query.isPending)) && (
            <p role="status">{t(($) => $.instructorEarnings.loading)}</p>
          )}
          <Button
            variant="outline"
            isDisabled={months.isFetching || query.isFetching}
            onPress={() => {
              if (months.isError) void months.refetch();
              else void query.refetch();
            }}
          >
            {t(($) => $.instructorEarnings.retry)}
          </Button>
        </div>
      }
      pagination={
        tab === "lines" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              isDisabled={cursors.length === 1 || query.isFetching}
              onPress={() => setCursors((old) => old.slice(0, -1))}
            >
              {t(($) => $.instructorEarnings.previous)}
            </Button>
            <Button
              variant="outline"
              isDisabled={!next || query.isError || query.isFetching || cursors.includes(next)}
              onPress={() => {
                if (next && !cursors.includes(next)) setCursors((old) => [...old, next]);
              }}
            >
              {t(($) => $.instructorEarnings.next)}
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}
