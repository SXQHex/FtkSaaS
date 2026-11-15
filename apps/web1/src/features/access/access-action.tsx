import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../../components/ui/alert-dialog";
import { Field, FieldGroup, FieldLabel, FieldError } from "../../components/ui/field";
import { Textarea } from "../../components/ui/textarea";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { AccessAction } from "./access-view";

export function AccessActionDialog({
  selection,
  onClose,
  onConfirm,
  reason,
  onReason,
  busy = false,
  locked = false,
  error,
  notice,
  recoveryActions,
}: {
  selection: AccessAction;
  onClose: () => void;
  onConfirm?: (reason: string) => void;
  reason: string;
  onReason: (reason: string) => void;
  busy?: boolean;
  locked?: boolean;
  error?: string;
  notice?: string;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation();
  const name =
    "account" in selection
      ? selection.account.name
      : (selection.invitation.email ??
        selection.invitation.personName ??
        t(($) => $.access.contactUnavailable));
  return (
    <AlertDialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy && !locked) onClose();
      }}
      isDismissable={!busy && !locked}
      isKeyboardDismissDisabled={busy || locked}
      className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>
          {t(($) => $.access.actionTitles[selection.kind], { name })}
        </AlertDialogTitle>
        <p className="max-w-full text-sm break-words">{name}</p>
        <Text slot="description" elementType="div">
          <AlertDialogDescription>
            {t(($) => $.access.actionDescriptions[selection.kind])}
          </AlertDialogDescription>
        </Text>
      </AlertDialogHeader>
      <form
        id="access-action"
        aria-label={t(($) => $.access.actionTitles[selection.kind], { name })}
        aria-busy={busy}
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !locked) onConfirm?.(reason.trim());
        }}
      >
        {selection.kind === "unlink" && (
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="access-action-reason">
                {t(($) => $.access.reason)} <span aria-hidden="true">*</span>
              </FieldLabel>
              <Textarea
                id="access-action-reason"
                className="max-h-48 resize-y! rounded-md border-input! bg-transparent!"
                name="reason"
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                required
                disabled={busy || locked}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "access-action-error" : undefined}
              />
              {error && <FieldError id="access-action-error">{error}</FieldError>}
            </Field>
          </FieldGroup>
        )}
        {notice && (
          <Alert role="status" className="mt-3">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
      </form>
      {recoveryActions}
      <AlertDialogFooter>
        <AlertDialogCancel autoFocus isDisabled={busy || locked} onPress={onClose}>
          {t(($) => $.people.cancel)}
        </AlertDialogCancel>
        <AlertDialogAction
          slot={null}
          type="submit"
          form="access-action"
          variant={
            selection.kind === "cancel" || selection.kind === "unlink" ? "destructive" : "default"
          }
          isDisabled={busy || locked || !onConfirm}
        >
          {t(($) => $.access.actionLabels[selection.kind])}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
