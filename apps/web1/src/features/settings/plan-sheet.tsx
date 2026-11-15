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
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";

/** Native catalog/quote supplies prices, limits and effective dates; this sheet calculates none. */
export function PlanSheet({
  open,
  options,
  selected,
  effects,
  description,
  locked = false,
  notice,
  error,
  onSelect,
  onReview,
  onClose,
  recoveryActions,
}: {
  open: boolean;
  options: { key: string; label: string; description: string; disabledReason?: string }[] | null;
  selected: string | null;
  effects: { id: string; title: string; detail: string }[] | null;
  description: string;
  locked?: boolean;
  notice?: string;
  error?: string;
  onSelect?: (value: string) => void;
  onReview?: () => void;
  onClose: () => void;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  const available =
    options?.some((option) => option.key === selected && !option.disabledReason) === true;
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
        <SheetTitle id={`${id}-title`}>{t(($) => $.settings.planEditor.title)}</SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{description}</SheetDescription>
        </Text>
      </SheetHeader>
      <form
        id={`${id}-form`}
        method="post"
        aria-labelledby={`${id}-title`}
        tabIndex={locked || !options?.length ? 0 : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && available && effects !== null) onReview?.();
        }}
      >
        <FieldGroup>
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.planEditor.choose)}</FieldLegend>
            {options === null ? (
              <p>{t(($) => $.settings.unread)}</p>
            ) : (
              <RadioGroup
                name="plan"
                aria-label={t(($) => $.settings.planEditor.choose)}
                value={selected ?? ""}
                onChange={onSelect}
                isDisabled={locked || !onSelect}
              >
                {options.map((option) => (
                  <Field key={option.key} orientation="horizontal">
                    <RadioGroupItem
                      id={`${id}-${option.key}`}
                      value={option.key}
                      isDisabled={Boolean(option.disabledReason)}
                      aria-labelledby={`${id}-${option.key}-label`}
                      aria-describedby={`${id}-${option.key}-hint`}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <FieldLabel id={`${id}-${option.key}-label`} htmlFor={`${id}-${option.key}`}>
                        {option.label}
                      </FieldLabel>
                      <FieldDescription id={`${id}-${option.key}-hint`}>
                        {option.disabledReason ?? option.description}
                      </FieldDescription>
                    </div>
                  </Field>
                ))}
              </RadioGroup>
            )}
          </FieldSet>
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.planEditor.effects)}</FieldLegend>
            {effects === null ? (
              <p>{t(($) => $.settings.unread)}</p>
            ) : effects.length === 0 ? (
              <p>{t(($) => $.settings.reviewEmpty)}</p>
            ) : (
              <ItemGroup>
                {effects.map((effect) => (
                  <Item key={effect.id} role="listitem" size="sm" variant="outline">
                    <ItemContent>
                      <ItemTitle>{effect.title}</ItemTitle>
                      <ItemDescription>{effect.detail}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
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
      <SheetFooter>
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button
          type="submit"
          form={`${id}-form`}
          isDisabled={locked || !available || effects === null || !onReview}
        >
          {t(($) => $.settings.planEditor.review)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
