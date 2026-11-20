import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";

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
  fieldErrors = {},
  onInvalid,
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
  fieldErrors?: Partial<Record<keyof PaymentDraft, string>>;
  onInvalid?: (field: keyof PaymentDraft) => void;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const key = (Object.keys(fieldErrors) as (keyof PaymentDraft)[])[0];
    const name = key === "occurredAtUtc" ? "occurred_at_utc" : key;
    if (name) {
      const element = form.current?.elements.namedItem(name);
      if (element instanceof HTMLInputElement) element.focus();
    }
  }, [fieldErrors]);
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
        ref={form}
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
              className="user-invalid:border-destructive user-invalid:ring-destructive/20"
              ref={(element) => element?.setCustomValidity(fieldErrors.amount ?? "")}
              aria-invalid={!!fieldErrors.amount}
              onInvalid={() => onInvalid?.("amount")}
              name="amount"
              inputMode="decimal"
              required
              value={draft.amount}
              readOnly={disabled}
              aria-describedby={`${id}-amount-hint${fieldErrors.amount ? ` ${id}-amount-error` : ""}`}
              onChange={(event) => onDraft?.({ ...draft, amount: event.target.value })}
            />
            <FieldDescription id={`${id}-amount-hint`}>
              {t(($) => $.settings.paymentEditor.amountHint)}
            </FieldDescription>
            {fieldErrors.amount && (
              <FieldError id={`${id}-amount-error`}>{fieldErrors.amount}</FieldError>
            )}
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
              className="user-invalid:border-destructive user-invalid:ring-destructive/20"
              ref={(element) => element?.setCustomValidity(fieldErrors.reference ?? "")}
              aria-invalid={!!fieldErrors.reference}
              onInvalid={() => onInvalid?.("reference")}
              aria-describedby={fieldErrors.reference ? `${id}-reference-error` : undefined}
              name="reference"
              required
              value={draft.reference}
              readOnly={disabled}
              onChange={(event) => onDraft?.({ ...draft, reference: event.target.value })}
            />
            {fieldErrors.reference && (
              <FieldError id={`${id}-reference-error`}>{fieldErrors.reference}</FieldError>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-time`}>
              {t(($) => $.settings.paymentEditor.time)}
            </FieldLabel>
            <Input
              id={`${id}-time`}
              className="user-invalid:border-destructive user-invalid:ring-destructive/20"
              ref={(element) => element?.setCustomValidity(fieldErrors.occurredAtUtc ?? "")}
              aria-invalid={!!fieldErrors.occurredAtUtc}
              onInvalid={() => onInvalid?.("occurredAtUtc")}
              name="occurred_at_utc"
              type="datetime-local"
              step="1"
              required
              value={draft.occurredAtUtc}
              readOnly={disabled}
              aria-describedby={`${id}-time-hint${fieldErrors.occurredAtUtc ? ` ${id}-time-error` : ""}`}
              onChange={(event) => onDraft?.({ ...draft, occurredAtUtc: event.target.value })}
            />
            <FieldDescription id={`${id}-time-hint`}>
              {t(($) => $.settings.paymentEditor.timeHint)}
            </FieldDescription>
            {fieldErrors.occurredAtUtc && (
              <FieldError id={`${id}-time-error`}>{fieldErrors.occurredAtUtc}</FieldError>
            )}
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
      <SheetFooter className="flex-wrap">
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
