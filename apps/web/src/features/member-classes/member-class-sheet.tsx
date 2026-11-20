import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@ftksaas/ui/components/sheet";
import { Button } from "@ftksaas/ui/components/button";
export function MemberClassSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  action,
  locked = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  locked?: boolean;
  action?: { label: string; disabled: boolean; onPress: () => void };
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      isOpen={open}
      onOpenChange={(value) => {
        if (!locked) onOpenChange(value);
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      <SheetFooter className="flex-wrap">
        <SheetClose isDisabled={locked}>{t(($) => $.memberClasses.cancel)}</SheetClose>
        {action && (
          <Button isDisabled={action.disabled} onPress={action.onPress}>
            {action.label}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
