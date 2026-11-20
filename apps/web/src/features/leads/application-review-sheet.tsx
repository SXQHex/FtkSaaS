import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ApplicationAction } from "@ftksaas/api-contracts";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
export function ApplicationReviewSheet({
  name,
  content,
  action,
  onAction,
  personPicker,
  centers,
  center,
  onCenter,
  reviewed,
  onReviewed,
  disabled = false,
  readOnly = false,
  recovery,
  onClose,
  onSubmit,
}: {
  name: string;
  content: ReactNode;
  action: ApplicationAction;
  onAction: (action: ApplicationAction) => void;
  personPicker: ReactNode;
  centers: { id: string; name: string }[];
  center: string;
  onCenter: (id: string) => void;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  recovery?: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open && !disabled) onClose();
      }}
      isDismissable={!disabled}
      isKeyboardDismissDisabled={disabled}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.leads.applicationReview)}</SheetTitle>
        <SheetDescription>{name}</SheetDescription>
      </SheetHeader>
      <form
        id="application-review-form"
        method="post"
        aria-label={t(($) => $.leads.applicationReview)}
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !readOnly && reviewed) onSubmit?.();
        }}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
      >
        {content}
        <Field>
          <FieldLabel htmlFor="application-action">
            {t(($) => $.leads.applicationAction)}
          </FieldLabel>
          <NativeSelect
            id="application-action"
            name="application-action"
            value={action}
            disabled={disabled || readOnly}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "match_existing" ||
                value === "create_candidate" ||
                value === "close" ||
                value === "assign_center"
              )
                onAction(value);
            }}
          >
            {(
              [
                "match_existing",
                "create_candidate",
                "close",
                ...(centers.length ? ["assign_center" as const] : []),
              ] as const
            ).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {t(($) => $.leads.applicationActions[value])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{t(($) => $.leads.applicationsHint)}</FieldDescription>
        </Field>
        {action === "match_existing" && personPicker}
        {action === "assign_center" && (
          <Field>
            <FieldLabel htmlFor="application-center">
              {t(($) => $.workspace.chooseCenter)}
            </FieldLabel>
            <NativeSelect
              id="application-center"
              name="application-center"
              value={center}
              disabled={disabled || readOnly}
              onChange={(event) => onCenter(event.target.value)}
            >
              <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
              {centers.map((row) => (
                <NativeSelectOption key={row.id} value={row.id}>
                  {row.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Checkbox isSelected={reviewed} isDisabled={disabled || readOnly} onChange={onReviewed}>
          {t(($) => $.leads.review)}
        </Checkbox>
        {recovery}
      </form>
      <SheetFooter>
        <Button variant="outline" isDisabled={disabled} onPress={onClose}>
          {t(($) => $.leads.close)}
        </Button>
        {!readOnly && (
          <Button
            isDisabled={disabled || !reviewed || !onSubmit}
            type="submit"
            form="application-review-form"
          >
            {t(($) => $.leads.save)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
