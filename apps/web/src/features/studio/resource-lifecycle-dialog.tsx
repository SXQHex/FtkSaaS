import type { ReactNode } from "react";
import { Text } from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@ftksaas/ui/components/alert-dialog";
import { Field, FieldGroup, FieldLabel, FieldError } from "@ftksaas/ui/components/field";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import {
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@ftksaas/ui/components/dropdown-menu";

export function AvailabilityRetireMenu({
  records,
  disabled,
  onSelect,
}: {
  records: { id: string; label: string }[];
  disabled?: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenuTrigger>
      <Button variant="outline" isDisabled={disabled || !records.length}>
        {t(($) => $.studio.lifecycle.retire)}
      </Button>
      <DropdownMenu
        className="max-w-[calc(100dvw-2rem)]"
        aria-label={t(($) => $.studio.lifecycle.chooseRule)}
      >
        <DropdownMenuGroup>
          {records.map((record) => (
            <DropdownMenuItem
              className="whitespace-normal"
              key={record.id}
              id={record.id}
              onAction={() => onSelect(record.id)}
            >
              {record.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}

// Installed primitives own overlay, focus and dismissal. This component only
// composes explicit confirmation; no write or guessed lifecycle state lives here.
export function ResourceLifecycleDialog({
  kind,
  facts,
  reason,
  onReason,
  onClose,
  onConfirm,
  busy = false,
  locked = false,
  readOnly = false,
  error,
  notice,
  recovery,
}: {
  kind: "rule" | "closure";
  facts: { label: string; value: string }[];
  reason: string;
  onReason: (value: string) => void;
  onClose: () => void;
  onConfirm?: () => void;
  busy?: boolean;
  locked?: boolean;
  readOnly?: boolean;
  error?: string;
  notice?: string;
  recovery?: ReactNode;
}) {
  const { t } = useTranslation();
  const title =
    kind === "rule"
      ? t(($) => $.studio.lifecycle.retire)
      : t(($) => $.studio.lifecycle.cancelClosure);
  return (
    <AlertDialog
      isOpen
      isDismissable={!busy && !locked}
      isKeyboardDismissDisabled={busy || locked}
      onOpenChange={(open) => {
        if (!open && !busy && !locked) onClose();
      }}
      className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] [&>[role=alertdialog]]:min-h-0 [&>[role=alertdialog]]:overflow-y-auto"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <Text slot="description" elementType="div">
          <AlertDialogDescription>
            {kind === "rule"
              ? t(($) => $.studio.lifecycle.ruleDescription)
              : t(($) => $.studio.lifecycle.closureDescription)}
          </AlertDialogDescription>
        </Text>
      </AlertDialogHeader>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="contents">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="min-w-0 break-words">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <form
        id="resource-lifecycle"
        method="post"
        aria-label={title}
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !locked) onConfirm?.();
        }}
      >
        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="resource-lifecycle-reason">
              {t(($) => $.studio.lifecycle.reason)} <span aria-hidden="true">*</span>
            </FieldLabel>
            <Textarea
              id="resource-lifecycle-reason"
              name="reason"
              required
              value={reason}
              onChange={(event) => onReason(event.target.value)}
              readOnly={readOnly}
              disabled={busy || locked}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "resource-lifecycle-error" : undefined}
            />
            {error && <FieldError id="resource-lifecycle-error">{error}</FieldError>}
          </Field>
        </FieldGroup>
        {notice && (
          <Alert id="resource-lifecycle-notice" tabIndex={-1} role="status" className="mt-3">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
      </form>
      {recovery}
      <AlertDialogFooter>
        <AlertDialogCancel autoFocus onPress={onClose} isDisabled={busy || locked}>
          {t(($) => $.studio.cancel)}
        </AlertDialogCancel>
        <AlertDialogAction
          slot={null}
          type="submit"
          form="resource-lifecycle"
          variant="destructive"
          isDisabled={busy || locked || !onConfirm}
        >
          {title}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
