import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { PaymentSheet, type PaymentDraft } from "./payment-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import type { SettingsSubscriptionSource } from "./settings-subscription";
import {
  settingsPaymentIntent,
  writeSettingsPayment,
  readSettingsPaymentReceipt,
  readSettingsPaymentResult,
  type SettingsPaymentIntent,
} from "./settings-payment";

export function SettingsPaymentEditor({
  before,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  before: SettingsSubscriptionSource;
  onSaved: (result: SettingsSubscriptionSource) => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PaymentDraft>({
      amount: "",
      reference: "",
      occurredAtUtc: "",
    }),
    [review, setReview] = useState<SettingsPaymentIntent>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>(),
    [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PaymentDraft, string>>>({});
  const busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeSettingsPayment,
    readReceipt: readSettingsPaymentReceipt,
    readResult: readSettingsPaymentResult,
    onRefresh: onSaved,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function invalid(field: keyof PaymentDraft) {
    const message =
      field === "amount"
        ? t(($) => $.settings.paymentAmountError)
        : field === "reference"
          ? t(($) => $.settings.paymentReferenceError)
          : t(($) => $.settings.paymentTimeError);
    setFieldErrors((previous) => ({ ...previous, [field]: message }));
    setError(t(($) => $.settings.paymentInvalid));
  }
  async function prepare() {
    if (locked || busy.current || review) return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await settingsPaymentIntent(before, draft);
      if (active.current) {
        command.reset();
        setAccepted(false);
        setReview(intent);
      }
    } catch (cause) {
      if (!active.current || onAccessLost(cause)) return;
      if (cause instanceof Error && cause.message === "PAYMENT_AMOUNT") invalid("amount");
      else if (cause instanceof Error && cause.message === "PAYMENT_REFERENCE")
        invalid("reference");
      else if (cause instanceof Error && cause.message === "PAYMENT_TIME") invalid("occurredAtUtc");
      else
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.settings.subscriptionReadError),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={t(($) => $.settings.paymentEditor.title)}
        description={t(($) => $.settings.paymentEditor.description)}
        rows={[
          {
            id: "amount",
            title: t(($) => $.settings.paymentEditor.amount),
            detail: formatMinorAmount(review.amount_minor, review.currency),
          },
          {
            id: "reference",
            title: t(($) => $.settings.paymentEditor.reference),
            detail: review.reference,
          },
          {
            id: "time",
            title: t(($) => $.settings.paymentEditor.time),
            detail: review.occurred_at,
          },
        ]}
        accepted={accepted}
        onAccepted={setAccepted}
        locked={locked}
        onClose={() => {
          if (locked) return;
          if (command.state === "ready") {
            setReview(undefined);
            setAccepted(false);
          } else onClose();
        }}
        onApply={
          !command.unavailable && command.state === "ready"
            ? () => {
                if (accepted && !locked) void command.start(review);
              }
            : undefined
        }
        notice={command.state === "saved" ? t(($) => $.settings.paymentSubmitted) : undefined}
        recoveryActions={
          <EventCommandNotice command={command} onReload={() => window.location.reload()} />
        }
      />
    );
  return (
    <PaymentSheet
      open
      draft={draft}
      currency={before.subscription.billing?.current.currency ?? null}
      writable={!command.unavailable}
      dirty={Object.values(draft).some(Boolean)}
      locked={locked}
      error={error}
      fieldErrors={fieldErrors}
      onInvalid={invalid}
      onDraft={(next) => {
        if (!locked) {
          setDraft(next);
          setFieldErrors({});
          setError(undefined);
        }
      }}
      recoveryActions={
        error && !Object.keys(fieldErrors).length ? (
          <Button
            type="button"
            variant="outline"
            isDisabled={locked}
            onPress={() => window.location.reload()}
          >
            {t(($) => $.settings.subscriptionReload)}
          </Button>
        ) : undefined
      }
      onReview={() => {
        void prepare();
      }}
      onClose={() => {
        if (!locked) onClose();
      }}
    />
  );
}
