import { useState } from "react";
import { useTranslation } from "react-i18next";
import { removeTotpFactor } from "./security";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function TotpRemove({
  factorId,
  name,
  onRemoved,
}: {
  factorId: string;
  name: string;
  onRemoved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function remove() {
    setPending(true);
    setFailed(false);
    try {
      await removeTotpFactor(factorId);
      setOpen(false);
      await onRemoved();
    } catch {
      setFailed(true);
      await onRemoved();
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPress={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        {t(($) => $.security.remove)}
      </Button>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        isDismissable={!pending}
        isKeyboardDismissDisabled={pending}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t(($) => $.security.removeTitle)}</DialogTitle>
          <DialogDescription>{t(($) => $.security.removeDescription, { name })}</DialogDescription>
        </DialogHeader>
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.security.removeError)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" isDisabled={pending} onPress={() => setOpen(false)}>
            {t(($) => $.security.cancel)}
          </Button>
          <Button
            variant="destructive"
            isDisabled={pending}
            onPress={() => {
              void remove();
            }}
          >
            {t(($) => $.security.removeConfirm)}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
