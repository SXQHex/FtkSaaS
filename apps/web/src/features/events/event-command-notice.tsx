import { useTranslation } from "react-i18next";
import type { useMemberCommand } from "../member-profile/use-member-command";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ftksaas/ui/components/dialog";
import type { ReactNode } from "react";

export function EventCommandRecovery({
  locked,
  onClose,
  children,
}: {
  locked: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      isOpen
      showCloseButton={!locked}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(($) => $.eventDetail.title)}</DialogTitle>
        <DialogDescription>{t(($) => $.events.sourceError)}</DialogDescription>
      </DialogHeader>
      {children}
    </Dialog>
  );
}

export function EventCommandNotice({
  command,
  onReload,
  receiptAvailable = true,
}: {
  command: Pick<ReturnType<typeof useMemberCommand>, "state" | "busy" | "retry" | "readReceipt">;
  onReload: () => void;
  receiptAvailable?: boolean;
}) {
  const { t } = useTranslation();
  if (command.state === "ready") return null;
  return (
    <Alert
      variant={
        command.state === "rejected" || command.state === "unknown" ? "destructive" : "default"
      }
    >
      <AlertDescription>
        <p role="status">{t(($) => $.events.commandStates[command.state])}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(command.state === "saved-unread" ||
            (receiptAvailable && ["unknown", "pending"].includes(command.state))) && (
            <Button
              variant="outline"
              size="sm"
              isDisabled={command.busy}
              onPress={() => {
                void command.readReceipt();
              }}
            >
              {t(($) => $.finance.readResult)}
            </Button>
          )}
          {(command.state === "unknown" || (!receiptAvailable && command.state === "pending")) && (
            <Button
              variant="outline"
              size="sm"
              isDisabled={command.busy}
              onPress={() => {
                void command.retry();
              }}
            >
              {t(($) => $.studio.retrySameRequest)}
            </Button>
          )}
          {["saved", "stale", "rejected"].includes(command.state) && (
            <Button variant="outline" size="sm" isDisabled={command.busy} onPress={onReload}>
              {t(($) => $.profile.loadCurrent)}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
