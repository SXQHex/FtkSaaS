import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { InstructorFinancePayment } from "@ftksaas/api-contracts";
import { getTemporal } from "../../lib/temporal";
import { formatMinorAmount } from "../../lib/money";
import { EarningsPaymentSheet, type EarningsPaymentDraft } from "./earnings-payment-sheet";
import { readEarningsDirectory } from "./earnings-read";
import {
  earningsPaymentIntent,
  readEarningsPaymentAuthority,
  readEarningsPaymentChain,
} from "./earnings-payment";
import { useEarningsCommand } from "./use-earnings-command";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";

export function EarningsPaymentEditor({
  scope,
  timezone,
  people,
  personId,
  before,
  onRefresh,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  timezone: string;
  people: { id: string; name: string }[];
  personId?: string;
  before?: InstructorFinancePayment;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<EarningsPaymentDraft>({
    personId: before?.person_id ?? personId ?? "",
    amount: "",
    date: "",
    method: before?.payment?.method ?? "",
    reference: before?.payment?.reference ?? "",
    direction: "decrease",
    reason: "",
    earningIds: [],
  });
  const [chosenCurrency, setCurrency] = useState(before?.currency ?? "");
  const [preparing, setPreparing] = useState(false),
    [invalid, setInvalid] = useState(false);
  const command = useEarningsCommand({
    onAccessLost,
    onRefresh: async () => {
      await onRefresh();
      onClose();
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const localNow = useQuery({
    queryKey: ["earnings-input-now", timezone],
    queryFn: async () => {
      const T = await getTemporal();
      return T.Now.instant()
        .toZonedDateTimeISO(timezone)
        .toPlainDateTime()
        .toString({ smallestUnit: "minute" });
    },
    staleTime: 30_000,
    retry: false,
  });
  const authority = useQuery({
    queryKey: ["earnings-payment-authority", scope, draft.personId, before?.id],
    queryFn: () =>
      readEarningsPaymentAuthority(scope, { personId: draft.personId, paymentId: before?.id }),
    enabled: !!draft.personId,
    retry: false,
  });
  const earnings = useInfiniteQuery({
    queryKey: ["earnings-payment-source", scope, draft.personId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      readEarningsDirectory(scope, "earnings", { personId: draft.personId, cursor: pageParam }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !!draft.personId && !before,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const chain = useQuery({
    queryKey: ["earnings-payment-chain", scope, before?.id],
    queryFn: () => readEarningsPaymentChain(scope, before!.person_id, before!.id),
    enabled: !!before,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const candidates =
    earnings.data?.pages.flatMap((page) => page.items.filter((row) => row.kind === "earning")) ??
    [];
  const duplicate = new Set(candidates.map((row) => row.earning.id)).size !== candidates.length;
  const currencies = earnings.data?.pages[0]?.totals.map((row) => row.currency) ?? [];
  const currency =
    before?.currency ?? (chosenCurrency || (currencies.length === 1 ? currencies[0] : undefined));
  const ready =
    !!localNow.data &&
    authority.data === true &&
    !authority.isFetching &&
    !authority.isError &&
    (before
      ? !!chain.data && !chain.isError && !chain.isFetching
      : !!earnings.data && !earnings.isError && !earnings.isFetching && !duplicate && !!currency);
  const sourceError =
    authority.isError || earnings.isError || chain.isError || duplicate || localNow.isError;
  const amounts = earnings.data?.pages[0]?.totals.find((row) => row.currency === currency);
  const totalRemaining =
    amounts && currency ? formatMinorAmount(amounts.remaining_minor, currency) : undefined;
  const sourcePeople =
    before && !people.some((row) => row.id === before.person_id)
      ? [...people, { id: before.person_id, name: before.display_name }]
      : people;
  const message = {
    ready: "",
    writing: t(($) => $.earnings.commandStates.writing),
    unknown: t(($) => $.earnings.commandStates.unknown),
    pending: t(($) => $.earnings.commandStates.pending),
    "saved-unread": t(($) => $.earnings.commandStates["saved-unread"]),
    saved: t(($) => $.earnings.saved),
    stale: t(($) => $.earnings.commandStates.rejected),
    rejected: t(($) => $.earnings.commandStates.rejected),
  }[command.state];
  async function submit() {
    if (locked || !ready || !currency) return;
    setPreparing(true);
    setInvalid(false);
    try {
      const intent = await earningsPaymentIntent(scope, draft, currency, timezone, {
        personId: before?.person_id ?? draft.personId,
        earnings: candidates,
        before: chain.data?.root,
      });
      await command.start(intent);
    } catch (error) {
      if (!onAccessLost(error)) setInvalid(true);
    } finally {
      setPreparing(false);
    }
  }
  return (
    <EarningsPaymentSheet
      mode={before ? "correct" : "new"}
      draft={draft}
      onDraft={(value) => {
        if (!locked) {
          setInvalid(false);
          command.reset();
          if (value.personId !== draft.personId) {
            setCurrency("");
            setDraft({ ...value, earningIds: [] });
          } else setDraft(value);
        }
      }}
      people={sourcePeople}
      currency={currency}
      maxDate={localNow.data ?? ""}
      remaining={totalRemaining}
      locked={locked}
      allowPersonSelection={!before && !locked && !command.unavailable && command.state === "ready"}
      readOnly={!ready || command.unavailable || command.state !== "ready"}
      onClose={onClose}
      onSubmit={() => void submit()}
      errors={invalid ? { amount: t(($) => $.earnings.invalidPayment) } : undefined}
      history={(chain.data?.rows ?? []).map((row) => ({
        id: row.id,
        title: row.previous_id ? t(($) => $.earnings.correction) : t(($) => $.earnings.payment),
        amount: formatMinorAmount(
          `${row.direction === "decrease" ? "-" : ""}${row.amount_minor}`,
          row.currency,
        ),
        context:
          row.reason ??
          new Intl.DateTimeFormat("tr-TR", {
            timeZone: timezone,
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(row.occurred_at)),
      }))}
      earnings={
        ready && !before
          ? candidates
              .filter(
                (row) =>
                  row.earning.previous_id === null &&
                  row.earning.direction === "add" &&
                  row.earning.currency === currency &&
                  row.earning.remaining_minor !== "0",
              )
              .map((row) => ({
                id: row.earning.id,
                title: row.session_name ?? t(($) => $.earnings.unnamedSession),
                amount: formatMinorAmount(row.earning.remaining_minor, row.earning.currency),
              }))
          : null
      }
      effect={
        ready ? (
          <p className="text-sm">
            {before ? t(($) => $.earnings.correctionEffect) : t(($) => $.earnings.selectionEffect)}
          </p>
        ) : undefined
      }
      notice={
        <div className="space-y-3">
          <FieldDescription>{t(($) => $.earnings.paymentInputHint, { timezone })}</FieldDescription>
          {!before && (
            <Field>
              <FieldLabel htmlFor="earning-payment-currency">
                {t(($) => $.finance.currency)}
              </FieldLabel>
              <NativeSelect
                id="earning-payment-currency"
                value={currency ?? ""}
                disabled={locked || !earnings.data}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setDraft({ ...draft, earningIds: [] });
                  command.reset();
                }}
              >
                <NativeSelectOption value="">{t(($) => $.finance.choose)}</NativeSelectOption>
                {currencies.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {value}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {sourceError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.finance.sourceError)}
                <Button
                  variant="outline"
                  isDisabled={locked}
                  onPress={() => {
                    void authority.refetch();
                    if (before) void chain.refetch();
                    else void earnings.refetch();
                    if (localNow.isError) void localNow.refetch();
                  }}
                >
                  {t(($) => $.finance.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!before && earnings.hasNextPage && (
            <Button
              variant="outline"
              isDisabled={locked || earnings.isFetchingNextPage}
              onPress={() => void earnings.fetchNextPage()}
            >
              {t(($) => $.earnings.moreEarnings)}
            </Button>
          )}
          {message && (
            <Alert>
              <AlertDescription>
                <p role="status">{message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["unknown", "pending", "saved-unread"].includes(command.state) && (
                    <Button
                      variant="outline"
                      isDisabled={command.busy}
                      onPress={() => void command.readReceipt()}
                    >
                      {t(($) => $.finance.readResult)}
                    </Button>
                  )}
                  {command.state === "unknown" && (
                    <Button
                      variant="outline"
                      isDisabled={command.busy}
                      onPress={() => void command.retry()}
                    >
                      {t(($) => $.studio.retrySameRequest)}
                    </Button>
                  )}
                  {["stale", "rejected"].includes(command.state) && (
                    <Button
                      variant="outline"
                      onPress={() => {
                        command.reset();
                        setDraft({ ...draft, earningIds: [] });
                        void authority.refetch();
                        if (before) void chain.refetch();
                        else void earnings.refetch();
                      }}
                    >
                      {t(($) => $.profile.loadCurrent)}
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      }
    />
  );
}
