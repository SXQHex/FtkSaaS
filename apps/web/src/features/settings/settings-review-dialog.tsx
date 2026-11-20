import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@ftksaas/ui/components/dialog";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";

export function SettingsReviewDialog({
  open,
  title,
  description,
  rows,
  blockers = [],
  accepted,
  locked = false,
  notice,
  onAccepted,
  onClose,
  onApply,
  applyLabel,
  recoveryActions,
}: {
  open: boolean;
  title: string;
  description: string;
  rows: { id: string; title: string; detail: ReactNode }[] | null;
  blockers?: { id: string; text: string }[];
  accepted: boolean;
  locked?: boolean;
  notice?: string;
  onAccepted?: (value: boolean) => void;
  onClose: () => void;
  onApply?: () => void;
  applyLabel?: string;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <Dialog
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
      className="min-w-0 max-h-[calc(100dvh-2rem)] [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:min-w-0 [&>[data-slot=dialog]]:max-h-[calc(100dvh-4.5rem)] [&>[data-slot=dialog]]:overflow-y-auto [&>[data-slot=dialog]]:overscroll-contain"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <Text slot="description" elementType="div">
          <DialogDescription>{description}</DialogDescription>
        </Text>
      </DialogHeader>
      {rows?.length ? (
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.id} role="listitem" size="sm" variant="outline">
              <ItemContent>
                <ItemTitle>{row.title}</ItemTitle>
                <ItemDescription>{row.detail}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty>
          <EmptyDescription>
            {rows === null ? t(($) => $.settings.unread) : t(($) => $.settings.reviewEmpty)}
          </EmptyDescription>
        </Empty>
      )}
      {blockers.map((blocker) => (
        <Alert key={blocker.id} role="alert" variant="destructive">
          <AlertDescription>{blocker.text}</AlertDescription>
        </Alert>
      ))}
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <Field orientation="horizontal">
        <Checkbox
          id={`${id}-accept`}
          aria-labelledby={`${id}-label`}
          isSelected={accepted}
          isDisabled={locked || rows === null || !onAccepted}
          onChange={onAccepted}
        />
        <FieldLabel id={`${id}-label`} htmlFor={`${id}-accept`}>
          {t(($) => $.settings.acceptReview)}
        </FieldLabel>
      </Field>
      {recoveryActions}
      <DialogFooter className="flex-wrap">
        <Button autoFocus type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button
          type="button"
          isDisabled={locked || rows === null || blockers.length > 0 || !accepted || !onApply}
          onPress={onApply}
        >
          {applyLabel ?? t(($) => $.settings.applyReview)}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
