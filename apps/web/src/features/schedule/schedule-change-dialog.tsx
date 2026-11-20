import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@ftksaas/ui/components/dialog";
import { Button } from "@ftksaas/ui/components/button";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import {
  FieldSet,
  FieldLegend,
  Field,
  FieldLabel,
  FieldDescription,
} from "@ftksaas/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@ftksaas/ui/components/radio-group";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { Switch } from "@ftksaas/ui/components/switch";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";

export interface ScheduleChangeRow {
  id: string;
  title: string;
  from: string;
  to: string;
  detail: string | null;
  status: string | null;
}
export function ScheduleChangeDialog({
  open,
  rows,
  scope,
  reason,
  notify,
  affectedLabel,
  notice,
  error,
  locked = false,
  onScope,
  onReason,
  onNotify,
  onClose,
  onPreview,
  onApply,
  recoveryActions,
}: {
  open: boolean;
  rows: ScheduleChangeRow[];
  scope: "single" | "this_and_future";
  reason: string;
  notify: boolean;
  affectedLabel: string | null;
  notice?: string;
  error?: string;
  locked?: boolean;
  onScope?: (scope: "single" | "this_and_future") => void;
  onReason?: (reason: string) => void;
  onNotify?: (notify: boolean) => void;
  onClose: () => void;
  onPreview?: () => void;
  onApply?: () => void;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation();
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
        <DialogTitle>{t(($) => $.schedule.saveTitle)}</DialogTitle>
        <Text slot="description" elementType="div">
          <DialogDescription>{t(($) => $.schedule.saveHint)}</DialogDescription>
        </Text>
      </DialogHeader>
      <ItemGroup className="gap-2">
        {rows.map((row) => (
          <Item key={row.id} role="listitem" size="sm" variant="outline">
            <ItemContent>
              <ItemTitle>{row.title}</ItemTitle>
              <ItemDescription>
                {row.from} → {row.to}
              </ItemDescription>
              {row.detail && <ItemDescription>{row.detail}</ItemDescription>}
              {row.status && <ItemDescription>{row.status}</ItemDescription>}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      <form
        id="schedule-save"
        method="post"
        aria-label={t(($) => $.schedule.saveTitle)}
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked) onPreview?.();
        }}
      >
        <FieldSet>
          <FieldLegend variant="label">{t(($) => $.schedule.changeScope)}</FieldLegend>
          <RadioGroup
            value={scope}
            isDisabled={locked || !onScope}
            aria-label={t(($) => $.schedule.changeScope)}
            onChange={(value) => {
              if (value === "single" || value === "this_and_future") onScope?.(value);
            }}
          >
            {(["single", "this_and_future"] as const).map((value) => (
              <Field key={value} orientation="horizontal">
                <RadioGroupItem id={`schedule-scope-${value}`} value={value} />
                <FieldLabel htmlFor={`schedule-scope-${value}`} className="py-2 whitespace-normal">
                  {t(($) => $.schedule.scopes[value])}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        <Field className="mt-4">
          <FieldLabel htmlFor="schedule-save-reason">
            {t(($) => $.schedule.reason)} <span aria-hidden="true">*</span>
          </FieldLabel>
          <Textarea
            id="schedule-save-reason"
            name="reason"
            required
            value={reason}
            disabled={locked || !onReason}
            onChange={(event) => onReason?.(event.target.value)}
            className="max-h-48 resize-y! rounded-md border-input! bg-transparent!"
          />
        </Field>
        <Field orientation="horizontal" className="mt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <FieldLabel htmlFor="schedule-save-notify">{t(($) => $.schedule.notify)}</FieldLabel>
            <FieldDescription>
              {affectedLabel ?? t(($) => $.schedule.notificationUnavailable)}
            </FieldDescription>
          </div>
          <Switch
            id="schedule-save-notify"
            isSelected={notify}
            isDisabled={locked || !onNotify}
            onChange={onNotify}
          />
        </Field>
      </form>
      {error && (
        <Alert role="alert" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {recoveryActions}
      <DialogFooter>
        <Button variant="outline" autoFocus onPress={onClose} isDisabled={locked}>
          {t(($) => $.people.cancel)}
        </Button>
        <Button type="submit" form="schedule-save" isDisabled={locked || !onPreview}>
          {t(($) => $.schedule.reviewChanges)}
        </Button>
        {onApply && (
          <Button onPress={onApply} isDisabled={locked}>
            {t(($) => $.schedule.applyChanges)}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
