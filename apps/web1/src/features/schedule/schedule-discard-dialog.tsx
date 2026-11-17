import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../../components/ui/alert-dialog";
export function ScheduleDiscardDialog({
  open,
  onClose,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t(($) => $.schedule.discardTitle)}</AlertDialogTitle>
        <Text slot="description" elementType="div">
          <AlertDialogDescription>{t(($) => $.schedule.discardDescription)}</AlertDialogDescription>
        </Text>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel autoFocus onPress={onClose}>
          {t(($) => $.schedule.keepEditing)}
        </AlertDialogCancel>
        <AlertDialogAction variant="destructive" onPress={onDiscard}>
          {t(($) => $.schedule.discard)}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
