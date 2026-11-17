import { useCallback, useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { InstructorFinancePayment } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { readWorkspace } from "../workspace/workspace";
import { instructorEarningMonths } from "../instructor/instructor-earnings-read";
import { readDisciplineCatalog } from "../settings/discipline-reader";
import { StudioAgreementEditor } from "../studio/agreement-editor";
import { EarningsView, type EarningsTab } from "./earnings-view";
import { EarningsPaymentEditor } from "./earnings-payment-editor";
import { readEarningsDirectory } from "./earnings-read";
import { earningsPresentation } from "./earnings-presentation";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

type Editor =
  | { kind: "pay"; personId?: string }
  | { kind: "correct"; payment: InstructorFinancePayment }
  | { kind: "agreement"; personId: string; selectedId?: string };
export function EarningsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [tab, setTab] = useState<EarningsTab>("instructors"),
    [personId, setPerson] = useState(""),
    [period, setPeriod] = useState("all"),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [editor, setEditor] = useState<Editor>(),
    [locked, setLocked] = useState(false),
    [lost, setLost] = useState(false),
    [saved, setSaved] = useState(false);
  const [openedAt] = useState(() => new Date().toISOString());
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const current =
    (!workspace.isError || preservePending) &&
    workspace.data?.selected?.id === scope.orgId &&
    workspace.data.centers.some((row) => row.id === scope.centerId && row.accessible)
      ? workspace.data
      : undefined;
  const timezone = current?.centers.find((row) => row.id === scope.centerId)?.timezone;
  const months = useQuery({
    queryKey: ["earnings-months", timezone, openedAt],
    queryFn: () => instructorEarningMonths(timezone!, openedAt),
    enabled: !!timezone,
    retry: false,
    staleTime: Infinity,
  });
  const interval =
    period === "all" ? undefined : months.data?.find((row) => row.id === period)?.interval;
  const active =
    !!current && !!timezone && !!months.data && !lost && (period === "all" || !!interval);
  const view = tab === "lines" ? "earnings" : tab;
  const page = useQuery({
    queryKey: ["earnings-directory", scope, view, personId, interval, cursors[index]],
    queryFn: () =>
      readEarningsDirectory(scope, view, {
        personId: personId || undefined,
        interval,
        cursor: cursors[index],
      }),
    enabled: active,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const catalog = useInfiniteQuery({
    queryKey: ["earnings-instructor-catalog", scope],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => readEarningsDirectory(scope, "instructors", { cursor: pageParam }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: active,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const rawPeople =
    catalog.data?.pages.flatMap((value) =>
      value.items.filter((row) => row.kind === "instructor"),
    ) ?? [];
  const catalogInvalid = new Set(rawPeople.map((row) => row.person_id)).size !== rawPeople.length;
  const people =
    active && !page.isError && !catalog.isError && !catalogInvalid
      ? [
          ...new Map(
            [
              ...rawPeople,
              ...(!page.isError
                ? (page.data?.items.filter((row) => row.kind === "instructor") ?? [])
                : []),
            ].map((row) => [row.person_id, { id: row.person_id, name: row.display_name }]),
          ).values(),
        ]
      : [];
  // The native summary is requested only for visible instructors; no page rows are summed into a global count.
  const counts = useQuery({
    queryKey: ["earnings-visible-counts", scope, interval, page.data],
    enabled: active && !!page.data && view === "instructors" && !page.isError,
    queryFn: async () => {
      const visible = page.data!.items.filter((row) => row.kind === "instructor"),
        result: Record<string, number> = {};
      for (let at = 0; at < visible.length; at += 4) {
        const batch = visible.slice(at, at + 4);
        const responses = await Promise.all(
          batch.map((row) =>
            readEarningsDirectory(scope, "instructors", { personId: row.person_id, interval }),
          ),
        );
        responses.forEach((response, offset) => {
          result[batch[offset]!.person_id] = response.closed_session_count;
        });
      }
      return result;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  const disciplines = useQuery({
    queryKey: ["earnings-agreement-disciplines", scope],
    queryFn: () => readDisciplineCatalog(scope, "center"),
    enabled: active && editor?.kind === "agreement",
    retry: false,
  });
  const onLocked = useCallback((value: boolean) => setLocked(value), []);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const onAccessLost = useCallback((error: unknown) => {
    const denied =
      (error instanceof BackendError &&
        [
          "AUTH_REQUIRED",
          "SESSION_REVOKED",
          "FORBIDDEN",
          "NOT_FOUND",
          "PLAN_FEATURE_UNAVAILABLE",
          "BILLING_OPERATION_RESTRICTED",
        ].includes(error.code)) ||
      (error instanceof Error &&
        ["ACCOUNT_CHANGED", "AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.message));
    if (denied) {
      setLost(true);
      setEditor(undefined);
    }
    return denied;
  }, []);
  const readable = active && !page.isError ? page.data : undefined;
  const mapped = readable ? earningsPresentation(readable, timezone!, t, counts.data) : undefined;
  const resetPage = () => {
    setCursors([undefined]);
    setIndex(0);
    setSaved(false);
  };
  async function refresh() {
    const outcomes = await Promise.all([page.refetch(), catalog.refetch()]);
    if (outcomes.some((value) => value.isError)) throw Error("EARNINGS_REFRESH_UNAVAILABLE");
    await queries.invalidateQueries({ queryKey: ["earnings-visible-counts", scope] });
  }
  async function reload() {
    resetPage();
    setLost(false);
    await workspace.refetch();
    await router.invalidate();
    void page.refetch();
    void catalog.refetch();
    void counts.refetch();
  }
  const sourceError =
    page.isError ||
    catalog.isError ||
    catalogInvalid ||
    counts.isError ||
    months.isError ||
    lost ||
    workspace.isError;
  const mutating = locked || !active || page.isError || catalog.isError || catalogInvalid;
  return (
    <>
      <EarningsView
        tab={tab}
        onTab={(value) => {
          if (!locked) {
            setTab(value);
            resetPage();
          }
        }}
        instructor={personId}
        onInstructor={(value) => {
          if (!locked) {
            setPerson(value);
            resetPage();
          }
        }}
        instructors={people}
        period={period}
        periods={[
          { id: "all", label: t(($) => $.earnings.all) },
          ...(months.data ?? []).map((row) => ({ id: row.id, label: row.label })),
        ]}
        onPeriod={(value) => {
          if (!locked) {
            setPeriod(value);
            resetPage();
          }
        }}
        summary={mapped?.summary ?? { earned: null, paid: null, remaining: null, overpaid: null }}
        people={mapped?.people ?? null}
        lines={mapped?.lines ?? null}
        payments={mapped?.payments ?? null}
        locked={mutating}
        onPay={(id) => {
          if (!mutating) setEditor({ kind: "pay", personId: id });
        }}
        onAgreement={(id) => {
          const person = page.data?.items.find(
            (row) => row.kind === "instructor" && row.person_id === id,
          );
          const ids = person?.kind === "instructor" ? person.current_agreement_ids : [];
          if (!mutating)
            setEditor({
              kind: "agreement",
              personId: id,
              selectedId: ids.length === 1 ? ids[0] : undefined,
            });
        }}
        onCorrect={(id) => {
          const payment = page.data?.items.find((row) => row.kind === "payment" && row.id === id);
          if (!mutating && payment?.kind === "payment" && payment.previous_id === null)
            setEditor({ kind: "correct", payment });
        }}
        notice={
          <div className="space-y-3">
            {saved && (
              <Alert>
                <AlertDescription role="status">{t(($) => $.earnings.saved)}</AlertDescription>
              </Alert>
            )}
            {sourceError && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>{t(($) => $.finance.readError)}</p>
                  <Button variant="outline" isDisabled={locked} onPress={() => void reload()}>
                    {t(($) => $.finance.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!current && !workspace.isError && (
              <Alert>
                <AlertDescription>{t(($) => $.studio.chooseScope)}</AlertDescription>
              </Alert>
            )}
            {readable && (
              <p className="text-sm text-muted-foreground">
                <span>
                  {t(($) => $.earnings.closedCount, { count: readable.closed_session_count })}
                </span>{" "}
                · <span>{t(($) => $.earnings.sourceTimezone, { timezone: timezone! })}</span>
              </p>
            )}
            {catalog.hasNextPage && (
              <Button
                variant="outline"
                isDisabled={locked || catalog.isFetchingNextPage}
                onPress={() => void catalog.fetchNextPage()}
              >
                {t(($) => $.earnings.moreInstructors)}
              </Button>
            )}
          </div>
        }
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || index === 0 || page.isFetching}
              onPress={() => setIndex((value) => value - 1)}
            >
              {t(($) => $.earnings.previousPage)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || !readable || !readable.next_cursor || page.isFetching}
              onPress={() => {
                if (!readable?.next_cursor) return;
                setCursors((values) => [...values.slice(0, index + 1), readable.next_cursor!]);
                setIndex((value) => value + 1);
              }}
            >
              {t(($) => $.earnings.nextPage)}
            </Button>
          </div>
        }
        count={
          readable ? t(($) => $.earnings.pageCount, { count: readable.items.length }) : undefined
        }
      />
      {editor && active && timezone && editor.kind !== "agreement" && (
        <EarningsPaymentEditor
          key={editor.kind === "correct" ? editor.payment.id : `pay:${editor.personId ?? ""}`}
          scope={scope}
          timezone={timezone}
          people={people}
          personId={editor.kind === "pay" ? editor.personId : undefined}
          before={editor.kind === "correct" ? editor.payment : undefined}
          onRefresh={async () => {
            await refresh();
            setSaved(true);
          }}
          onClose={() => setEditor(undefined)}
          onLockChange={onLocked}
          onAccessLost={onAccessLost}
        />
      )}
      {editor?.kind === "agreement" && active && disciplines.data && !disciplines.isError && (
        <StudioAgreementEditor
          scope={scope}
          personId={editor.personId}
          selectedId={editor.selectedId}
          data={{ instructors: people, disciplines: disciplines.data }}
          onRefresh={refresh}
          onClose={() => setEditor(undefined)}
          onLockChange={onLocked}
        />
      )}
      {editor?.kind === "agreement" && disciplines.isError && (
        <div className="p-4">
          <Alert>
            <AlertDescription>
              {t(($) => $.finance.readError)}
              <Button variant="outline" onPress={() => void disciplines.refetch()}>
                {t(($) => $.finance.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
}
