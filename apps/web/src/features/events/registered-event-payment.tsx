import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { EventView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { useMemberCommand } from "../member-profile/use-member-command";
import { writeCollection, readCollectionReceipt } from "../finance/finance";
import {
  readRegisteredPayment,
  prepareRegisteredCollection,
  readRegisteredCollectionResult,
} from "./registered-event-collection";
import { emptyEventCollection } from "./event-registration-draft";
import { EventPaymentPanel } from "./event-payment-panel";
import { EventActionDialog } from "./event-action-dialog";
import { EventCommandNotice } from "./event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function RegisteredEventPayment({
  scope,
  before,
  registrationId,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  before: EventView;
  registrationId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient();
  const expected = before.registrations?.find((row) => row.id === registrationId);
  const [draft, setDraft] = useState({ ...emptyEventCollection }),
    [confirmation, setConfirmation] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const key = [
    "registered-event-payment",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    before.id,
    registrationId,
    expected?.person_id,
  ];
  const source = useQuery({
    queryKey: key,
    queryFn: () => readRegisteredPayment(scope, before.id, registrationId, expected!.person_id),
    enabled: !!expected,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const command = useMemberCommand({
    write: writeCollection,
    readReceipt: readCollectionReceipt,
    readResult: readRegisteredCollectionResult,
    onAccessLost,
    onRefresh: async (row) => {
      queries.setQueryData(key, row);
      await onSaved();
    },
  });
  const locked = preparing || command.locked;
  const row = !source.isError ? source.data : undefined;
  const payment = row?.payment_summary;
  const readOnly = locked || command.state !== "ready";
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (source.error) onAccessLost(source.error);
  }, [source.error, onAccessLost]);
  const reload = useCallback(() => {
    if (!locked) {
      command.reset();
      setConfirmation(false);
      setReviewed(false);
      setError(undefined);
      void source.refetch();
    }
  }, [locked, command, source]);
  const amount = (value: string | null | undefined) =>
    value !== null && value !== undefined && payment?.currency
      ? formatMinorAmount(value, payment.currency)
      : t(($) => $.events.unknown);
  const facts = [
    { label: t(($) => $.eventDetail.registrationFee), value: amount(payment?.amount_minor) },
    { label: t(($) => $.eventDetail.netAmount), value: amount(payment?.net_minor) },
    { label: t(($) => $.eventDetail.paid), value: amount(payment?.paid_minor) },
    { label: t(($) => $.eventDetail.remaining), value: amount(payment?.remaining_minor) },
    { label: t(($) => $.eventDetail.credited), value: amount(payment?.credited_minor) },
    { label: t(($) => $.eventDetail.cancelledAmount), value: amount(payment?.cancelled_minor) },
  ];
  async function confirm() {
    if (running.current || locked || command.state !== "ready" || !reviewed || !row) return;
    running.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await prepareRegisteredCollection(
        scope,
        before.id,
        row,
        before.timezone,
        draft,
        true,
      );
      if (mounted.current) await command.start(intent);
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : cause instanceof Error && cause.message === "EVENT_PAYMENT_SCOPE_CHANGED"
              ? t(($) => $.eventDetail.paymentChanged)
              : t(($) => $.events.invalid),
        );
    } finally {
      running.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const notice = <EventCommandNotice command={command} onReload={reload} />;
  return (
    <>
      <Sheet
        isOpen
        onOpenChange={(open) => {
          if (!open && !locked) onClose();
        }}
        isDismissable={!locked}
        isKeyboardDismissDisabled={locked}
      >
        <SheetHeader>
          <SheetTitle>{t(($) => $.eventDetail.actions.payment)}</SheetTitle>
          <SheetDescription>
            {before.name} · {row?.display_name ?? expected?.display_name}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {notice}
          {source.isPending && <p role="status">{t(($) => $.eventDetail.paymentUnread)}</p>}
          {(source.isError || !expected) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.eventDetail.paymentUnread)}</AlertDescription>
            </Alert>
          )}
          {payment && (
            <>
              <p>{t(($) => $.eventDetail.registeredPaymentHint)}</p>
              {payment.status !== "available" && (
                <Alert>
                  <AlertDescription>
                    {t(($) => $.eventDetail.paymentStates[payment.status])}
                  </AlertDescription>
                </Alert>
              )}
              <EventPaymentPanel
                facts={facts}
                draft={draft}
                onDraft={(value) => {
                  if (!readOnly) setDraft(value);
                }}
                prepared
                existingRegistration
                onPrepare={() => {}}
                canPrepare={false}
                onCollect={() => {
                  setReviewed(false);
                  setError(undefined);
                  setConfirmation(true);
                }}
                canCollect={
                  !source.isFetching &&
                  payment.status === "available" &&
                  payment.remaining_minor !== null &&
                  BigInt(payment.remaining_minor) > 0n &&
                  !readOnly
                }
                locked={readOnly}
              />
            </>
          )}
          <Button variant="outline" isDisabled={locked || source.isFetching} onPress={reload}>
            {t(($) => $.events.reload)}
          </Button>
          {error && !confirmation && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" isDisabled={locked} onPress={onClose}>
            {t(($) => $.events.editor.cancel)}
          </Button>
        </SheetFooter>
      </Sheet>
      {confirmation && (
        <EventActionDialog
          title={t(($) => $.eventDetail.registration.collect)}
          description={
            <>
              {before.name} · {row?.display_name}
              <span className="mt-2 block">{t(($) => $.eventDetail.registeredCollectionHint)}</span>
            </>
          }
          confirmLabel={t(($) => $.eventDetail.collectConfirm)}
          reason=""
          onReason={() => {}}
          reviewed={reviewed}
          onReviewed={setReviewed}
          onConfirm={() => {
            void confirm();
          }}
          onClose={() => {
            if (!locked) setConfirmation(false);
          }}
          locked={locked}
          disabled={command.state !== "ready" || !row}
          error={error}
          notice={notice}
          extra={
            <dl className="flex flex-col gap-2 text-sm">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd className="font-semibold">{fact.value}</dd>
                </div>
              ))}
              <div>
                <dt>{t(($) => $.eventDetail.registration.amount)}</dt>
                <dd>
                  {draft.amount} {payment?.currency}
                </dd>
              </div>
              <div>
                <dt>{t(($) => $.eventDetail.registration.method)}</dt>
                <dd>
                  {draft.method === "cash"
                    ? t(($) => $.eventDetail.registration.cash)
                    : draft.method === "bank_transfer"
                      ? t(($) => $.eventDetail.registration.bank)
                      : t(($) => $.events.unknown)}
                </dd>
              </div>
              <div>
                <dt>{t(($) => $.eventDetail.registration.collectedAt)}</dt>
                <dd>
                  {draft.occurredAt} · {before.timezone}
                </dd>
              </div>
              {draft.reference && (
                <div>
                  <dt>{t(($) => $.eventDetail.registration.reference)}</dt>
                  <dd>{draft.reference}</dd>
                </div>
              )}
            </dl>
          }
        />
      )}{" "}
    </>
  );
}
