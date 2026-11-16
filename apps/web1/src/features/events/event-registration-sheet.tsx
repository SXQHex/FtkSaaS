import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function EventRegistrationSheet({
  step,
  eventName,
  personPicker,
  salePicker,
  preview,
  payment,
  summary,
  reviewed,
  onReviewed,
  onNext,
  onBack,
  onClose,
  locked = false,
  nextDisabled = false,
  backDisabled = false,
  error,
  notice,
}: {
  step: 1 | 2 | 3;
  eventName: string;
  personPicker: ReactNode;
  salePicker?: ReactNode;
  preview: ReactNode;
  payment: ReactNode;
  summary: ReactNode;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  locked?: boolean;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  error?: string;
  notice?: ReactNode;
}) {
  const { t } = useTranslation(),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.eventDetail.actions.register)}</SheetTitle>
        <SheetDescription>{eventName}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <p className="text-sm text-muted-foreground">
          {t(($) => $.eventDetail.registration.step, { step })}
        </p>
        <h3 ref={heading} tabIndex={-1} className="font-semibold">
          {t(($) => $.eventDetail.registration.steps[step])}
        </h3>
        {notice}
        {step === 1 && (
          <>
            {personPicker}
            {salePicker}
            {preview}
          </>
        )}
        {step === 2 && (
          <>
            {preview}
            {payment}
          </>
        )}
        {step === 3 && (
          <>
            {summary}
            <Field orientation="horizontal">
              <Checkbox
                id="event-register-reviewed"
                name="reviewed"
                isSelected={reviewed}
                isDisabled={locked}
                onChange={onReviewed}
              />
              <FieldLabel htmlFor="event-register-reviewed">
                {t(($) => $.eventDetail.registration.confirm)}
              </FieldLabel>
            </Field>
            <p className="text-sm text-muted-foreground">
              {t(($) => $.eventDetail.registration.hint)}
            </p>
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          variant="outline"
          type="button"
          isDisabled={locked || backDisabled}
          onPress={step === 1 ? onClose : onBack}
        >
          {step === 1
            ? t(($) => $.events.editor.cancel)
            : t(($) => $.eventDetail.registration.back)}
        </Button>
        <Button
          type="button"
          isDisabled={locked || nextDisabled || (step === 3 && !reviewed)}
          onPress={onNext}
        >
          {step === 3
            ? t(($) => $.eventDetail.registration.save)
            : t(($) => $.eventDetail.registration.next)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
