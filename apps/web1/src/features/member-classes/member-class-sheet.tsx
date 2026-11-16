import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
export function MemberClassSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  action,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  action?: { label: string; disabled: boolean; onPress: () => void };
}) {
  const { t } = useTranslation();
  return (
    <Sheet isOpen={open} onOpenChange={onOpenChange} showCloseButton={false}>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      <SheetFooter className="flex-wrap">
        <SheetClose>{t(($) => $.memberClasses.cancel)}</SheetClose>
        {action && (
          <Button isDisabled={action.disabled} onPress={action.onPress}>
            {action.label}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
