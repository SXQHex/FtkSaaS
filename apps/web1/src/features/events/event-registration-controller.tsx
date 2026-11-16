import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  EventView,
  PersonSummary,
  Preview,
  EventPaymentPreparationView,
} from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readProfileRights } from "../member-profile/profile-read";
import { LeadPersonPicker } from "../leads/lead-person-picker";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { EventRegistrationSheet } from "./event-registration-sheet";
import { EventPaymentPanel } from "./event-payment-panel";
import { EventActionDialog } from "./event-action-dialog";
import { EventCommandNotice } from "./event-command-notice";
import { EventPreviewEffects } from "./event-preview-effects";
import { readDetailedEvent, readRegistrationPayment } from "./event-registration-read";
import {
  previewEventRegistration,
  eventRegistrationIntent,
  eventPreparationIntent,
  writeEventRegistration,
  writeEventPreparation,
  readRegistrationReceipt,
  readRegistrationResult,
  readPreparationResult,
  prepareEventCollection,
  writeCollection,
  readCollectionReceipt,
  readEventCollectionResult,
  type RegistrationTarget,
} from "./event-registration-command";
import { emptyEventCollection } from "./event-registration-draft";
import { Field, FieldLabel, FieldDescription } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

import { RegisteredEventPayment } from "./registered-event-payment";
type RegistrationControllerProps = {
  scope: ClientScope;
  before: EventView;
  registrationId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
};
export function EventRegistrationController(props: RegistrationControllerProps) {
  const { registrationId, ...rest } = props;
  return registrationId ? (
    <RegisteredEventPayment {...rest} registrationId={registrationId} />
  ) : (
    <NewEventRegistrationController {...rest} />
  );
}
function NewEventRegistrationController({
  scope,
  before,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  before: EventView;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [person, setPerson] = useState<PersonSummary | null>(null),
    [sale, setSale] = useState(""),
    [step, setStep] = useState<1 | 2 | 3>(1),
    [preview, setPreview] = useState<{ target: RegistrationTarget; value: Preview }>(),
    [preparation, setPreparation] = useState<EventPaymentPreparationView>(),
    [draft, setDraft] = useState({ ...emptyEventCollection }),
    [reviewed, setReviewed] = useState(false),
    [confirmation, setConfirmation] = useState<"prepare" | "collect">(),
    [confirmed, setConfirmed] = useState(false),
    [capacityClosed, setCapacityClosed] = useState(false),
    [working, setWorking] = useState(false),
    [error, setError] = useState<string>();
  const active = useRef(true),
    running = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const personId = person?.id,
    name = person?.display_name ?? t(($) => $.events.unknown);
  const rights = useQuery({
    queryKey: ["event-registration-rights", scope.accountId, scope.orgId, scope.centerId, personId],
    queryFn: () => readProfileRights(scope, personId!),
    enabled: !!personId,
    retry: false,
  });
  const existing = useQuery({
    queryKey: [
      "event-registration-payment",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      before.id,
      personId,
    ],
    queryFn: () => readRegistrationPayment(scope, before.id, personId!),
    enabled: !!personId,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const payment =
    preparation ?? (existing.data?.kind === "available" ? existing.data.value : undefined);
  const registerCommand = useMemberCommand({
    write: writeEventRegistration,
    readReceipt: readRegistrationReceipt,
    readResult: readRegistrationResult,
    onAccessLost,
    onRefresh: async (result) => {
      if (result.outcome === "capacity_closed") {
        setCapacityClosed(true);
        setPreparation(result.payment);
      }
      await onSaved();
    },
  });
  const prepareCommand = useMemberCommand({
    write: writeEventPreparation,
    readReceipt: readRegistrationReceipt,
    readResult: readPreparationResult,
    onAccessLost,
    onRefresh: async (value) => {
      setPreparation(value);
      setPreview(undefined);
      await onSaved();
    },
  });
  const collectionCommand = useMemberCommand({
    write: writeCollection,
    readReceipt: readCollectionReceipt,
    readResult: readEventCollectionResult,
    onAccessLost,
    onRefresh: async (value) => {
      setPreparation(value);
      setPreview(undefined);
      await onSaved();
    },
  });
  const locked =
    working || registerCommand.locked || prepareCommand.locked || collectionCommand.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const cause of [rights.error, existing.error]) if (cause) onAccessLost(cause);
  }, [rights.error, existing.error, onAccessLost]);
  function target(): RegistrationTarget {
    if (!personId) throw new Error("EVENT_PERSON_REQUIRED");
    return {
      scope: { ...scope },
      eventId: before.id,
      personId,
      ...(payment ? { preparationId: payment.id } : sale ? { saleId: sale } : {}),
    };
  }
  function fail(cause: unknown) {
    if (!active.current || onAccessLost(cause)) return;
    setError(
      cause instanceof BackendError
        ? scheduleBackendError(cause.code, t)
        : t(($) => $.events.invalid),
    );
  }
  async function next() {
    if (running.current || locked || !personId) return;
    running.current = true;
    setWorking(true);
    setError(undefined);
    try {
      if (step === 3) {
        if (!preview || !reviewed || registerCommand.state !== "ready") return;
        await registerCommand.start(
          eventRegistrationIntent(preview.target, preview.value, reviewed),
        );
      } else {
        const selected = target(),
          value = await previewEventRegistration(selected);
        if (!active.current) return;
        setPreview({ target: selected, value });
        setReviewed(false);
        // A payment blocker is visible at step 2; a fresh preview after payment is mandatory.
        if (step === 1) setStep(2);
        else if (!value.blockers.length) setStep(3);
      }
    } catch (cause) {
      fail(cause);
    } finally {
      running.current = false;
      if (active.current) setWorking(false);
    }
  }
  async function confirm() {
    if (running.current || locked || !confirmed || !personId || !confirmation) return;
    running.current = true;
    setWorking(true);
    setError(undefined);
    try {
      if (confirmation === "prepare") {
        const current = await readDetailedEvent(scope, before.id);
        if (!active.current) return;
        if (current.version !== before.version) throw new Error("EVENT_SOURCE_CHANGED");
        await prepareCommand.start(
          eventPreparationIntent({ scope: { ...scope }, eventId: before.id, personId }, true),
        );
      } else {
        if (!payment) throw new Error("EVENT_PAYMENT_UNAVAILABLE");
        const intent = await prepareEventCollection(scope, payment, before.timezone, draft, true);
        if (active.current) await collectionCommand.start(intent);
      }
    } catch (cause) {
      fail(cause);
    } finally {
      running.current = false;
      if (active.current) {
        setWorking(false);
        setConfirmed(false);
      }
    }
  }
  function openConfirmation(value: "prepare" | "collect") {
    if (!locked) {
      setConfirmation(value);
      setConfirmed(false);
      setError(undefined);
    }
  }
  const nativeNotices = (
    <>
      {capacityClosed && (
        <Alert>
          <AlertDescription>{t(($) => $.eventDetail.capacityClosed)}</AlertDescription>
        </Alert>
      )}
      <EventCommandNotice command={registerCommand} onReload={onClose} />
      <EventCommandNotice
        command={prepareCommand}
        onReload={() => {
          if (!locked) {
            prepareCommand.reset();
            setConfirmation(undefined);
          }
        }}
      />
      <EventCommandNotice
        command={collectionCommand}
        onReload={() => {
          if (!locked) {
            collectionCommand.reset();
            setConfirmation(undefined);
            setDraft({ ...emptyEventCollection });
          }
        }}
      />
    </>
  );
  const facts = payment
    ? [
        {
          label: t(($) => $.eventDetail.fee),
          value: formatMinorAmount(payment.amount_minor, payment.currency),
        },
        {
          label: t(($) => $.eventDetail.paid),
          value: formatMinorAmount(payment.paid_minor, payment.currency),
        },
        {
          label: t(($) => $.eventDetail.remaining),
          value: formatMinorAmount(payment.remaining_minor, payment.currency),
        },
        {
          label: t(($) => $.eventDetail.credited),
          value: formatMinorAmount(payment.credited_minor, payment.currency),
        },
      ]
    : [
        {
          label: t(($) => $.eventDetail.fee),
          value: formatMinorAmount(before.terms.fee_minor, before.terms.currency),
        },
      ];
  const paymentPanel = (
    <>
      <EventPaymentPanel
        facts={facts}
        draft={draft}
        onDraft={(value) => {
          setDraft(value);
          setPreview(undefined);
          setReviewed(false);
        }}
        prepared={!!payment}
        onPrepare={() => openConfirmation("prepare")}
        onCollect={() => openConfirmation("collect")}
        canPrepare={
          !!personId &&
          !sale &&
          before.state === "published" &&
          before.terms.full_payment_required &&
          BigInt(before.terms.fee_minor) > 0n &&
          !existing.isFetching &&
          !existing.isError &&
          prepareCommand.state === "ready"
        }
        canCollect={
          !!payment &&
          ["prepared", "registered"].includes(payment.state) &&
          BigInt(payment.remaining_minor) > 0n &&
          collectionCommand.state === "ready"
        }
        locked={locked}
      />
      {existing.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.eventDetail.paymentUnread)}
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => {
                void existing.refetch();
              }}
            >
              {t(($) => $.studio.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
  return (
    <>
      <EventRegistrationSheet
        eventName={before.name}
        step={step}
        reviewed={reviewed}
        onReviewed={setReviewed}
        onNext={() => {
          void next();
        }}
        onBack={() => {
          if (!locked) {
            setStep(step === 3 ? 2 : 1);
            setReviewed(false);
            setPreview(undefined);
          }
        }}
        onClose={onClose}
        locked={locked}
        backDisabled={!!payment && step === 2}
        nextDisabled={
          !personId ||
          existing.isFetching ||
          registerCommand.state !== "ready" ||
          (step === 2 &&
            draft.choice === "now" &&
            (!payment || BigInt(payment.remaining_minor) > 0n))
        }
        error={error}
        notice={nativeNotices}
        personPicker={
          <LeadPersonPicker
            scope={scope}
            selected={person}
            disabled={locked || !!payment}
            onSelect={(value) => {
              if (!locked && !payment) {
                setPerson(value);
                setSale("");
                setPreview(undefined);
                setReviewed(false);
                setError(undefined);
              }
            }}
          />
        }
        salePicker={
          <Field>
            <FieldLabel htmlFor="event-registration-sale">
              {t(($) => $.eventDetail.saleChoice)}
            </FieldLabel>
            <NativeSelect
              id="event-registration-sale"
              value={sale}
              disabled={locked || !!payment || !personId || rights.isPending || rights.isError}
              onChange={(event) => {
                setSale(event.target.value);
                setPreview(undefined);
                setReviewed(false);
              }}
            >
              <NativeSelectOption value="">{t(($) => $.eventDetail.noSale)}</NativeSelectOption>
              {rights.data?.map((row) => (
                <NativeSelectOption key={row.sale_id} value={row.sale_id}>
                  {row.start_date} – {row.end_date} ·{" "}
                  {t(($) => $.eventDetail.availableRights, { count: row.available })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>{t(($) => $.eventDetail.saleHint)}</FieldDescription>
            {rights.isError && (
              <Button
                variant="outline"
                isDisabled={locked}
                onPress={() => {
                  void rights.refetch();
                }}
              >
                {t(($) => $.studio.retry)}
              </Button>
            )}
          </Field>
        }
        preview={
          preview ? (
            <EventPreviewEffects preview={preview.value} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(($) => $.eventDetail.previewRegistrationHint)}
            </p>
          )
        }
        payment={paymentPanel}
        summary={
          <div className="space-y-3">
            <p className="font-semibold">
              {name} · {before.name}
            </p>
            {preview && <EventPreviewEffects preview={preview.value} />}
            <p>
              {payment
                ? formatMinorAmount(payment.remaining_minor, payment.currency)
                : t(($) => $.eventDetail.previewRegistrationHint)}
            </p>
          </div>
        }
      />
      {confirmation && (
        <EventActionDialog
          title={
            confirmation === "prepare"
              ? t(($) => $.eventDetail.registration.prepare)
              : t(($) => $.eventDetail.registration.collect)
          }
          description={
            <>
              {before.name} · {name}
              <span className="mt-2 block">
                {confirmation === "prepare"
                  ? t(($) => $.eventDetail.registration.prepareHint)
                  : t(($) => $.eventDetail.collectionHint)}
              </span>
            </>
          }
          confirmLabel={
            confirmation === "prepare"
              ? t(($) => $.eventDetail.registration.prepare)
              : t(($) => $.eventDetail.collectConfirm)
          }
          reason=""
          onReason={() => {}}
          reviewed={confirmed}
          onReviewed={setConfirmed}
          onConfirm={() => {
            void confirm();
          }}
          onClose={() => {
            if (!locked) setConfirmation(undefined);
          }}
          locked={locked}
          disabled={
            (confirmation === "prepare" ? prepareCommand.state : collectionCommand.state) !==
            "ready"
          }
          error={error}
          notice={nativeNotices}
          extra={
            <dl className="space-y-2 text-sm">
              {facts.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className="font-semibold">{row.value}</dd>
                </div>
              ))}
              {confirmation === "collect" && (
                <>
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
                </>
              )}
            </dl>
          }
        />
      )}
    </>
  );
}
