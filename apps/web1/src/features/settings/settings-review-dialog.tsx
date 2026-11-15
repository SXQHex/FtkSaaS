import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Field, FieldLabel } from "../../components/ui/field";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Empty, EmptyDescription } from "../../components/ui/empty";

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
  rows: { id: string; title: string; detail: string }[] | null;
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
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
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
