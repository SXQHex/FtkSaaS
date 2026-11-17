import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Alert, AlertDescription } from "../../components/ui/alert";

export interface PolicyChoiceField {
  key: string;
  label: string;
  description?: string;
  value: string | null;
  options: { value: string; label: string }[];
  writable: boolean;
  input?: { type: "number" | "text" | "datetime-local"; min?: number; max?: number; step?: number };
}

/** Choices and effect/history text are supplied by the versioned policy consumer. */
export function PolicySheet({
  open,
  title,
  description,
  fields,
  changes,
  history,
  locked = false,
  dirty = false,
  onField,
  onReview,
  onClose,
  notice,
  error,
  recoveryActions,
}: {
  open: boolean;
  title: string;
  description: string;
  fields: PolicyChoiceField[] | null;
  changes: { id: string; title: string; detail: string }[] | null;
  history: { id: string; title: string; detail: string }[] | null;
  locked?: boolean;
  dirty?: boolean;
  onField?: (key: string, value: string) => void;
  onReview?: () => void;
  onClose: () => void;
  notice?: string;
  error?: string;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  const renderRows = (rows: typeof changes) =>
    rows === null ? (
      <p>{t(($) => $.settings.unread)}</p>
    ) : rows.length === 0 ? (
      <p>{t(($) => $.settings.reviewEmpty)}</p>
    ) : (
      <ItemGroup>
        {rows.map((row) => (
          <Item key={row.id} role="listitem" size="sm" variant="outline">
            <ItemContent>
              <ItemTitle>{row.title}</ItemTitle>
              <ItemDescription>{row.detail}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    );
  return (
    <Sheet
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle id={`${id}-title`}>{title}</SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{description}</SheetDescription>
        </Text>
      </SheetHeader>
      <form
        id={`${id}-form`}
        method="post"
        aria-labelledby={`${id}-title`}
        tabIndex={!fields?.some((field) => field.writable) || locked ? 0 : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && dirty && fields?.length) onReview?.();
        }}
      >
        <FieldGroup>
          {fields === null ? (
            <p>{t(($) => $.settings.unread)}</p>
          ) : (
            fields.map((field, index) => (
              <Field key={field.key}>
                <FieldLabel htmlFor={`${id}-${field.key}`}>{field.label}</FieldLabel>
                {field.input ? (
                  <Input
                    id={`${id}-${field.key}`}
                    type={field.input.type}
                    min={field.input.min}
                    max={field.input.max}
                    step={field.input.step}
                    value={field.value ?? ""}
                    disabled={locked || !field.writable || !onField}
                    aria-describedby={field.description ? `${id}-${field.key}-hint` : undefined}
                    onChange={(event) => onField?.(field.key, event.target.value)}
                  />
                ) : (
                  <NativeSelect
                    id={`${id}-${field.key}`}
                    name={field.key}
                    autoFocus={index === 0}
                    value={field.value ?? ""}
                    required
                    disabled={locked || !field.writable || !onField}
                    aria-describedby={field.description ? `${id}-${field.key}-hint` : undefined}
                    onChange={(event) => onField?.(field.key, event.target.value)}
                  >
                    {field.value === null && (
                      <NativeSelectOption value="" disabled>
                        {t(($) => $.settings.policyEditor.choose)}
                      </NativeSelectOption>
                    )}
                    {field.options.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
                {field.description && (
                  <FieldDescription id={`${id}-${field.key}-hint`}>
                    {field.description}
                  </FieldDescription>
                )}
              </Field>
            ))
          )}
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.policyEditor.effects)}</FieldLegend>
            {renderRows(changes)}
          </FieldSet>
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.policyEditor.history)}</FieldLegend>
            {renderRows(history)}
          </FieldSet>
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
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button
          type="submit"
          form={`${id}-form`}
          isDisabled={locked || !dirty || !fields?.length || !onReview}
        >
          {t(($) => $.settings.policyEditor.review)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
