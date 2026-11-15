import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export interface PaymentDraft {
  amount: string;
  reference: string;
  occurredAtUtc: string;
}

/** WF13 manual payment notification. No card capture or client-side payment verification. */
export function PaymentSheet({
  open,
  draft,
  currency,
  writable = false,
  dirty = false,
  locked = false,
  onDraft,
  onReview,
  onClose,
  notice,
  error,
  recoveryActions,
}: {
  open: boolean;
  draft: PaymentDraft;
  currency: string | null;
  writable?: boolean;
  dirty?: boolean;
  locked?: boolean;
  onDraft?: (draft: PaymentDraft) => void;
  onReview?: () => void;
  onClose: () => void;
  notice?: string;
  error?: string;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  const disabled = locked || !writable || !onDraft || currency === null;
  return (
    <Sheet
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle id={`${id}-title`}>{t(($) => $.settings.paymentEditor.title)}</SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{t(($) => $.settings.paymentEditor.description)}</SheetDescription>
        </Text>
      </SheetHeader>
      <form
        id={`${id}-form`}
        method="post"
        aria-labelledby={`${id}-title`}
        tabIndex={disabled ? 0 : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && dirty) onReview?.();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-amount`}>
              {t(($) => $.settings.paymentEditor.amount)}
            </FieldLabel>
            <Input
              autoFocus
              id={`${id}-amount`}
              name="amount"
              inputMode="decimal"
              required
              value={draft.amount}
              readOnly={disabled}
              aria-describedby={`${id}-amount-hint`}
              onChange={(event) => onDraft?.({ ...draft, amount: event.target.value })}
            />
            <FieldDescription id={`${id}-amount-hint`}>
              {t(($) => $.settings.paymentEditor.amountHint)}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-currency`}>
              {t(($) => $.settings.paymentEditor.currency)}
            </FieldLabel>
            <Input
              id={`${id}-currency`}
              name="currency"
              readOnly
              value={currency ?? ""}
              aria-describedby={`${id}-currency-hint`}
            />
            <FieldDescription id={`${id}-currency-hint`}>
              {currency === null
                ? t(($) => $.settings.unread)
                : t(($) => $.settings.paymentEditor.currencyHint)}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-reference`}>
              {t(($) => $.settings.paymentEditor.reference)}
            </FieldLabel>
            <Input
              id={`${id}-reference`}
              name="reference"
              required
              value={draft.reference}
              readOnly={disabled}
              onChange={(event) => onDraft?.({ ...draft, reference: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-time`}>
              {t(($) => $.settings.paymentEditor.time)}
            </FieldLabel>
            <Input
              id={`${id}-time`}
              name="occurred_at_utc"
              type="datetime-local"
              step="1"
              required
              value={draft.occurredAtUtc}
              readOnly={disabled}
              aria-describedby={`${id}-time-hint`}
              onChange={(event) => onDraft?.({ ...draft, occurredAtUtc: event.target.value })}
            />
            <FieldDescription id={`${id}-time-hint`}>
              {t(($) => $.settings.paymentEditor.timeHint)}
            </FieldDescription>
          </Field>
          {error && (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert role="status">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {recoveryActions}
        </FieldGroup>
      </form>
      <SheetFooter>
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button type="submit" form={`${id}-form`} isDisabled={disabled || !dirty || !onReview}>
          {t(($) => $.settings.paymentEditor.review)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
