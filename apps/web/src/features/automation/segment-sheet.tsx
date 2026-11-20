import { useId, useEffect, useRef, type ReactNode } from "react";
import { v7 as uuidv7 } from "uuid";
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
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import type { SegmentDraft, SegmentConditionKind } from "./automation-draft";
export function SegmentSheet({
  draft,
  onDraft,
  editing,
  match,
  notice,
  error,
  nameError,
  onSave,
  onClose,
  onDelete,
  canDelete = false,
  supported,
  locked = false,
  readOnly = false,
  reviewed,
  onReviewed,
}: {
  draft: SegmentDraft;
  onDraft: (value: SegmentDraft) => void;
  editing: boolean;
  match: ReactNode;
  notice?: ReactNode;
  error?: string;
  nameError?: string;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  supported: SegmentConditionKind[];
  locked?: boolean;
  readOnly?: boolean;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    formId = useId(),
    name = useRef<HTMLInputElement>(null),
    alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nameError) name.current?.focus();
    else if (error) alert.current?.focus();
  }, [nameError, error]);
  const change = (value: SegmentDraft) => {
    if (!locked) {
      onDraft(value);
      onReviewed(false);
    }
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
          {editing ? t(($) => $.automation.editSegment) : t(($) => $.automation.addSegment)}
        </SheetTitle>
        <SheetDescription>
          {editing ? draft.name : t(($) => $.automation.segmentDescription)}
        </SheetDescription>
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
            <FieldLabel htmlFor="segment-name">{t(($) => $.automation.segmentName)}</FieldLabel>
            <Input
              ref={name}
              id="segment-name"
              name="name"
              value={draft.name}
              required
              autoComplete="off"
              autoFocus
              disabled={locked || readOnly}
              onChange={(event) => change({ ...draft, name: event.target.value })}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "segment-name-error" : undefined}
            />
            <FieldError
              id="segment-name-error"
              errors={nameError ? [{ message: nameError }] : []}
            />
          </Field>
          <Field>
            <FieldLabel>{t(($) => $.automation.columns.conditions)}</FieldLabel>
            <FieldDescription>{t(($) => $.automation.allConditions)}</FieldDescription>
            <FieldGroup>
              {draft.conditions.map((condition) => (
                <Field key={condition.id}>
                  {condition.kind === "remaining" ||
                  condition.kind === "ending" ||
                  condition.kind === "kind" ? (
                    <FieldLabel htmlFor={`segment-condition-${condition.id}`}>
                      {t(($) => $.automation.conditions[condition.kind])}
                    </FieldLabel>
                  ) : (
                    <p className="text-sm font-medium">
                      {t(($) => $.automation.conditions[condition.kind])}
                    </p>
                  )}
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {condition.kind === "remaining" || condition.kind === "ending" ? (
                      <>
                        <Input
                          className="w-28"
                          id={`segment-condition-${condition.id}`}
                          name={`condition_${condition.id}`}
                          inputMode="numeric"
                          value={condition.value}
                          disabled={locked || readOnly || !supported.includes(condition.kind)}
                          onChange={(event) =>
                            change({
                              ...draft,
                              conditions: draft.conditions.map((row) =>
                                row.id === condition.id
                                  ? { ...row, value: event.target.value }
                                  : row,
                              ),
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {condition.kind === "remaining"
                            ? t(($) => $.automation.creditsOrLess)
                            : t(($) => $.automation.daysOrLess)}
                        </span>
                      </>
                    ) : condition.kind === "kind" ? (
                      <NativeSelect
                        id={`segment-condition-${condition.id}`}
                        name={`condition_${condition.id}`}
                        value={condition.value}
                        disabled={locked || readOnly || !supported.includes(condition.kind)}
                        onChange={(event) =>
                          change({
                            ...draft,
                            conditions: draft.conditions.map((row) =>
                              row.id === condition.id ? { ...row, value: event.target.value } : row,
                            ),
                          })
                        }
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.automation.choose)}
                        </NativeSelectOption>
                        <NativeSelectOption value="credits">
                          {t(($) => $.automation.credits)}
                        </NativeSelectOption>
                        <NativeSelectOption value="timed">
                          {t(($) => $.automation.timed)}
                        </NativeSelectOption>
                      </NativeSelect>
                    ) : (
                      <p id={`segment-condition-${condition.id}`} className="text-sm">
                        {t(($) => $.automation.conditionRequired)}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      isDisabled={locked || readOnly}
                      onPress={() =>
                        change({
                          ...draft,
                          conditions: draft.conditions.filter((row) => row.id !== condition.id),
                        })
                      }
                      aria-label={t(($) => $.automation.removeCondition, {
                        name: t(($) => $.automation.conditions[condition.kind]),
                      })}
                    >
                      {t(($) => $.automation.remove)}
                    </Button>
                  </div>
                </Field>
              ))}
            </FieldGroup>
            <NativeSelect
              aria-label={t(($) => $.automation.addCondition)}
              value=""
              disabled={locked || readOnly}
              onChange={(event) => {
                const kind = event.target.value as SegmentConditionKind;
                if (!supported.includes(kind) || draft.conditions.some((row) => row.kind === kind))
                  return;
                change({
                  ...draft,
                  conditions: [...draft.conditions, { id: uuidv7(), kind, value: "" }],
                });
              }}
            >
              <NativeSelectOption value="">
                {t(($) => $.automation.addCondition)}
              </NativeSelectOption>
              {(["remaining", "ending", "debt", "noNext", "kind"] as const).map((key) => (
                <NativeSelectOption
                  key={key}
                  value={key}
                  disabled={
                    !supported.includes(key) || draft.conditions.some((row) => row.kind === key)
                  }
                >
                  {t(($) => $.automation.conditions[key])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel>{t(($) => $.automation.matches)}</FieldLabel>
            {match}
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="segment-reviewed"
              isSelected={reviewed}
              isDisabled={locked || readOnly}
              onChange={onReviewed}
            />
            <FieldLabel htmlFor="segment-reviewed">{t(($) => $.automation.review)}</FieldLabel>
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
            {t(($) => $.automation.deleteSegment)}
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
