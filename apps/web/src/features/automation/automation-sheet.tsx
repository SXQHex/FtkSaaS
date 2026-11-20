import { useId, useRef, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Switch } from "@ftksaas/ui/components/switch";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import type { AutomationChoice, AutomationDraft } from "./automation-draft";
export function AutomationSheet({
  draft,
  onDraft,
  editing,
  segments,
  triggers,
  templates,
  assignees,
  recipients = [],
  effect,
  notice,
  error,
  nameError,
  onSave,
  onClose,
  onDelete,
  canDelete = false,
  reviewed,
  onReviewed,
  locked = false,
  readOnly = false,
  nativeMode = false,
  preparationPicker,
  workAlert = false,
}: {
  draft: AutomationDraft;
  onDraft: (draft: AutomationDraft) => void;
  editing: boolean;
  segments: AutomationChoice[];
  triggers: AutomationChoice[];
  templates: AutomationChoice[];
  assignees: AutomationChoice[];
  recipients?: AutomationChoice[];
  effect: ReactNode;
  notice?: ReactNode;
  error?: string;
  nameError?: string;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  locked?: boolean;
  readOnly?: boolean;
  nativeMode?: boolean;
  workAlert?: boolean;
  preparationPicker?: ReactNode;
}) {
  const { t } = useTranslation(),
    formId = useId(),
    name = useRef<HTMLInputElement>(null),
    alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nameError) name.current?.focus();
    else if (error) alert.current?.focus();
  }, [error, nameError]);
  const set = <K extends keyof AutomationDraft>(key: K, value: AutomationDraft[K]) => {
    onDraft({ ...draft, [key]: value });
    onReviewed(false);
  };
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
        <SheetTitle>
          {editing ? t(($) => $.automation.editAutomation) : t(($) => $.automation.add)}
        </SheetTitle>
        <SheetDescription>{editing ? draft.name : t(($) => $.automation.newHint)}</SheetDescription>
      </SheetHeader>
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked) onSave();
        }}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5"
      >
        {notice}
        <FieldGroup>
          <Field data-invalid={!!nameError}>
            <FieldLabel htmlFor="automation-name">{t(($) => $.automation.name)}</FieldLabel>
            <Input
              ref={name}
              id="automation-name"
              name="name"
              value={draft.name}
              required
              autoComplete="off"
              autoFocus
              disabled={locked || readOnly}
              onChange={(event) => set("name", event.target.value)}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "automation-name-error" : undefined}
            />
            <FieldError
              id="automation-name-error"
              errors={nameError ? [{ message: nameError }] : []}
            />
          </Field>
          {preparationPicker}
          <Field>
            <FieldLabel htmlFor="automation-segment">
              {t(($) => $.automation.columns.segment)}
            </FieldLabel>
            <NativeSelect
              id="automation-segment"
              name="segment_id"
              value={draft.segmentId}
              disabled={locked || readOnly}
              onChange={(event) => set("segmentId", event.target.value)}
            >
              <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
              {nativeMode && (
                <NativeSelectOption value="__none__">
                  {t(($) => $.automation.noSegment)}
                </NativeSelectOption>
              )}
              {segments.map((row) => (
                <NativeSelectOption key={row.id} value={row.id} disabled={row.disabled}>
                  {row.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="automation-trigger">
              {t(($) => $.automation.columns.when)}
            </FieldLabel>
            <NativeSelect
              id="automation-trigger"
              name="trigger"
              value={draft.trigger}
              disabled={locked || readOnly}
              onChange={(event) => set("trigger", event.target.value)}
            >
              <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
              {triggers.map((row) => (
                <NativeSelectOption key={row.id} value={row.id} disabled={row.disabled}>
                  {row.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {nativeMode && (
            <Field>
              <FieldLabel htmlFor="automation-offset">
                {t(($) => $.automation.offsetDays)}
              </FieldLabel>
              <Input
                id="automation-offset"
                name="offset_days"
                value={draft.offsetDays}
                inputMode="numeric"
                disabled={locked || readOnly || workAlert}
                onChange={(event) => set("offsetDays", event.target.value)}
              />
              <FieldDescription>
                {t(($) =>
                  workAlert ? $.automation.workAlertTiming : $.automation.nativeTriggerHint,
                )}
              </FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="automation-action">
              {t(($) => $.automation.columns.action)}
            </FieldLabel>
            <NativeSelect
              id="automation-action"
              name="action"
              value={draft.action}
              disabled={locked || readOnly}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "email" ||
                  value === "task" ||
                  value === "inbox" ||
                  value === "followup" ||
                  value === ""
                )
                  set("action", value);
              }}
            >
              <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
              {(["email", "task", "inbox"] as const).map((key) => (
                <NativeSelectOption key={key} value={key} disabled={nativeMode && key !== "inbox"}>
                  {t(($) => $.automation.actions[key])}
                </NativeSelectOption>
              ))}
              {nativeMode && (
                <NativeSelectOption value="followup" disabled={workAlert}>
                  {t(($) => $.automation.followup)}
                </NativeSelectOption>
              )}
            </NativeSelect>
          </Field>
          {draft.action === "email" && (
            <Field>
              <FieldLabel htmlFor="automation-template">
                {t(($) => $.automation.emailTemplate)}
              </FieldLabel>
              <NativeSelect
                id="automation-template"
                name="template_key"
                value={draft.template}
                disabled={locked || readOnly || !templates.length}
                onChange={(event) => set("template", event.target.value)}
              >
                <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
                {templates.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id} disabled={row.disabled}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t(($) => $.automation.templateHint)}</FieldDescription>
            </Field>
          )}
          {draft.action === "task" && (
            <Field>
              <FieldLabel htmlFor="automation-assignee">
                {t(($) => $.automation.assignee)}
              </FieldLabel>
              <NativeSelect
                id="automation-assignee"
                name="assignee_id"
                value={draft.assignee}
                disabled={locked || readOnly || !assignees.length}
                onChange={(event) => set("assignee", event.target.value)}
              >
                <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
                {assignees.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id} disabled={row.disabled}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {(draft.action === "task" ||
            draft.action === "followup" ||
            (draft.action === "inbox" && !nativeMode)) && (
            <Field>
              <FieldLabel htmlFor="automation-text">
                {draft.action === "task" || draft.action === "followup"
                  ? t(($) => $.automation.taskText)
                  : t(($) => $.automation.alertTitle)}
              </FieldLabel>
              <Input
                id="automation-text"
                name="text"
                value={draft.text}
                disabled={locked || readOnly}
                autoComplete="off"
                onChange={(event) => set("text", event.target.value)}
              />
            </Field>
          )}
          {recipients.length > 0 && (
            <FieldSet>
              <FieldLegend>{t(($) => $.automation.recipients)}</FieldLegend>
              <FieldGroup>
                {recipients.map((row) => (
                  <Field key={row.id} orientation="horizontal">
                    <Checkbox
                      id={`automation-recipient-${row.id}`}
                      isSelected={draft.recipients.includes(row.id)}
                      isDisabled={locked || readOnly || row.disabled}
                      onChange={(selected) =>
                        set(
                          "recipients",
                          selected
                            ? [...draft.recipients, row.id]
                            : draft.recipients.filter((id) => id !== row.id),
                        )
                      }
                    />
                    <FieldLabel htmlFor={`automation-recipient-${row.id}`}>{row.name}</FieldLabel>
                  </Field>
                ))}
              </FieldGroup>
            </FieldSet>
          )}
          <Field orientation="horizontal">
            <FieldLabel htmlFor="automation-enabled">
              {t(($) => $.automation.columns.enabled)}
            </FieldLabel>
            <Switch
              aria-label={t(($) => $.automation.columns.enabled)}
              id="automation-enabled"
              isSelected={draft.enabled}
              isDisabled={locked || readOnly}
              onChange={(value) => set("enabled", value)}
            />
          </Field>
          <FieldDescription>{t(($) => $.automation.enabledHint)}</FieldDescription>
          <Field>
            <FieldLabel>{t(($) => $.automation.effect)}</FieldLabel>
            {effect}
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="automation-reviewed"
              isSelected={reviewed}
              isDisabled={locked || readOnly}
              onChange={onReviewed}
            />
            <FieldLabel htmlFor="automation-reviewed">{t(($) => $.automation.review)}</FieldLabel>
          </Field>
        </FieldGroup>
        {error && (
          <Alert ref={alert} tabIndex={-1} variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </form>
      <SheetFooter className="flex-wrap">
        {editing && (
          <Button
            variant="ghost"
            type="button"
            isDisabled={locked || readOnly || !canDelete}
            onPress={onDelete}
          >
            {t(($) => $.automation.deleteAutomation)}
          </Button>
        )}
        <Button variant="outline" type="button" isDisabled={locked} onPress={onClose}>
          {t(($) => $.automation.cancel)}
        </Button>
        <Button type="submit" form={formId} isDisabled={locked || readOnly}>
          {t(($) => $.automation.save)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
