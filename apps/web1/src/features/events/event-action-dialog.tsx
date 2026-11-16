import { useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "../../components/ui/alert-dialog";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function EventActionDialog({
  title,
  description,
  confirmLabel,
  reason,
  onReason,
  requireReason = false,
  reviewed,
  onReviewed,
  onConfirm,
  onClose,
  locked = false,
  disabled = false,
  extra,
  notice,
  error,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  reason: string;
  onReason: (value: string) => void;
  requireReason?: boolean;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
  locked?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
  notice?: ReactNode;
  error?: string;
}) {
  const { t } = useTranslation(),
    formId = useId(),
    cancel = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      isOpen
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onEnter={() => cancel.current?.focus()}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <form
        id={formId}
        method="post"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && !disabled) onConfirm();
        }}
        className="flex min-w-0 flex-col gap-4"
      >
        <FieldGroup>
          {extra}
          {requireReason && (
            <Field>
              <FieldLabel htmlFor={`${formId}-reason`}>
                {t(($) => $.eventDetail.requiredReason)}
              </FieldLabel>
              <Textarea
                id={`${formId}-reason`}
                name="reason"
                rows={2}
                value={reason}
                disabled={locked}
                onChange={(event) => onReason(event.target.value)}
                required
              />
            </Field>
          )}
          <Field orientation="horizontal">
            <Checkbox
              id={`${formId}-review`}
              name="reviewed"
              isSelected={reviewed}
              isDisabled={locked}
              onChange={onReviewed}
            />
            <FieldLabel htmlFor={`${formId}-review`}>{t(($) => $.eventDetail.review)}</FieldLabel>
          </Field>
        </FieldGroup>
        {notice}
        <div className="min-h-16">
          <Alert variant="destructive" className={error ? undefined : "invisible"}>
            <AlertDescription>{error ?? t(($) => $.eventDetail.review)}</AlertDescription>
          </Alert>
        </div>
      </form>
      <AlertDialogFooter>
        <AlertDialogCancel ref={cancel} isDisabled={locked} onPress={onClose}>
          {t(($) => $.events.editor.cancel)}
        </AlertDialogCancel>
        <Button
          type="submit"
          form={formId}
          isDisabled={locked || disabled || !reviewed || (requireReason && !reason.trim())}
        >
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
