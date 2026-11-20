import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
export function SettingsIdentitySheet({
  title,
  value,
  beforeName,
  reviewing,
  accepted,
  locked,
  readable,
  ready,
  notice,
  onValue,
  onAccepted,
  onReview,
  onEdit,
  onSave,
  onClose,
}: {
  title: string;
  value: string;
  beforeName?: string;
  reviewing: boolean;
  accepted: boolean;
  locked: boolean;
  readable: boolean;
  ready: boolean;
  notice?: ReactNode;
  onValue: (value: string) => void;
  onAccepted: (value: boolean) => void;
  onReview: () => void;
  onEdit: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      isOpen
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{t(($) => $.settings.identity.description)}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
        <Field>
          <FieldLabel htmlFor="settings-identity-name">{title}</FieldLabel>
          <Input
            id="settings-identity-name"
            value={value}
            maxLength={2000}
            required
            disabled={locked || !readable || reviewing || !ready}
            autoComplete="organization"
            onChange={(event) => onValue(event.target.value)}
          />
          <FieldDescription>
            {readable
              ? t(($) => $.settings.identity.timezonePreserved)
              : t(($) => $.settings.unread)}
          </FieldDescription>
        </Field>
        {reviewing && readable && (
          <>
            <p className="break-words">
              {beforeName} → {value.trim()}
            </p>
            <Field orientation="horizontal">
              <Checkbox
                id="settings-identity-review"
                isSelected={accepted}
                isDisabled={locked || !ready}
                onChange={onAccepted}
              />
              <FieldLabel htmlFor="settings-identity-review">
                {t(($) => $.settings.acceptReview)}
              </FieldLabel>
            </Field>
          </>
        )}
        {notice}
      </div>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        {reviewing ? (
          <>
            <Button variant="outline" isDisabled={locked || !ready} onPress={onEdit}>
              {t(($) => $.settings.identity.edit)}
            </Button>
            <Button isDisabled={locked || !accepted || !readable || !ready} onPress={onSave}>
              {t(($) => $.settings.save)}
            </Button>
          </>
        ) : (
          <Button
            isDisabled={locked || !readable || !value.trim() || value.trim() === beforeName}
            onPress={onReview}
          >
            {t(($) => $.settings.identity.review)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
