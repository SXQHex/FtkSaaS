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
import { Checkbox } from "../../components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";

export function TeamSheet({
  open,
  title,
  description,
  identity,
  roles,
  staffType,
  effects,
  locked = false,
  dirty = false,
  onIdentity,
  onRole,
  onStaffType,
  onReview,
  onClose,
  error,
  notice,
  recoveryActions,
}: {
  open: boolean;
  title: string;
  description: string;
  identity: { name: string; email: string; writable: boolean; description?: string };
  roles:
    | { key: string; label: string; description: string; selected: boolean; writable: boolean }[]
    | null;
  staffType?: {
    value: string | null;
    options: { value: string; label: string }[];
    writable: boolean;
  };
  effects: { id: string; title: string; detail: string }[] | null;
  locked?: boolean;
  dirty?: boolean;
  onIdentity?: (value: { name: string; email: string }) => void;
  onRole?: (key: string, selected: boolean) => void;
  onStaffType?: (value: string) => void;
  onReview?: () => void;
  onClose: () => void;
  error?: string;
  notice?: string;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
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
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        tabIndex={locked ? 0 : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && dirty && roles !== null) onReview?.();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t(($) => $.settings.teamEditor.name)}</FieldLabel>
            <Input
              autoFocus
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              required
              value={identity.name}
              readOnly={!identity.writable || !onIdentity}
              disabled={locked}
              onChange={(event) =>
                onIdentity?.({ name: event.target.value, email: identity.email })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>{t(($) => $.settings.teamEditor.email)}</FieldLabel>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={identity.email}
              readOnly={!identity.writable || !onIdentity}
              disabled={locked}
              aria-describedby={identity.description ? `${id}-identity-hint` : undefined}
              onChange={(event) => onIdentity?.({ name: identity.name, email: event.target.value })}
            />
            {identity.description && (
              <FieldDescription id={`${id}-identity-hint`}>{identity.description}</FieldDescription>
            )}
          </Field>
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.teamEditor.roles)}</FieldLegend>
            {roles === null ? (
              <p>{t(($) => $.settings.unread)}</p>
            ) : (
              roles.map((role) => (
                <Field key={role.key} orientation="horizontal">
                  <Checkbox
                    id={`${id}-${role.key}`}
                    name={role.key}
                    isSelected={role.selected}
                    isDisabled={locked || !role.writable || !onRole}
                    aria-labelledby={`${id}-${role.key}-label`}
                    aria-describedby={`${id}-${role.key}-hint`}
                    onChange={(selected) => onRole?.(role.key, selected)}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel id={`${id}-${role.key}-label`} htmlFor={`${id}-${role.key}`}>
                      {role.label}
                    </FieldLabel>
                    <FieldDescription id={`${id}-${role.key}-hint`}>
                      {role.description}
                    </FieldDescription>
                  </div>
                </Field>
              ))
            )}
          </FieldSet>
          {staffType && (
            <Field>
              <FieldLabel htmlFor={`${id}-staff`}>
                {t(($) => $.settings.teamEditor.staffType)}
              </FieldLabel>
              <NativeSelect
                id={`${id}-staff`}
                name="staff_type"
                value={staffType.value ?? ""}
                required
                disabled={locked || !staffType.writable || !onStaffType}
                onChange={(event) => onStaffType?.(event.target.value)}
              >
                {staffType.value === null && (
                  <NativeSelectOption value="" disabled>
                    {t(($) => $.settings.policyEditor.choose)}
                  </NativeSelectOption>
                )}
                {staffType.options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.teamEditor.effects)}</FieldLegend>
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
          isDisabled={locked || !dirty || roles === null || !onReview}
        >
          {t(($) => $.settings.teamEditor.review)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
