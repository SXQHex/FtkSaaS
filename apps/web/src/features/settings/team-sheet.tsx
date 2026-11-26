import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { Text } from "react-aria-components";
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
  FieldSet,
  FieldLegend,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
type TeamSheetRole = {
  key: string;
  label: string;
  description: string;
  selected: boolean;
  writable: boolean;
};

export function TeamSheet({
  open,
  title,
  description,
  identity,
  roles,
  extraRoles,
  rolesUnread,
  effects,
  locked = false,
  dirty = false,
  onRole,
  onReview,
  onClose,
  error,
  recoveryActions,
  submitLabel,
}: {
  open: boolean;
  title: string;
  description: string;
  identity: { name: string; email: string; description?: string };
  roles: TeamSheetRole[];
  extraRoles: TeamSheetRole[];
  rolesUnread: boolean;
  effects: string[];
  locked?: boolean;
  dirty?: boolean;
  onRole: (key: string, selected: boolean) => void;
  onReview: () => void;
  onClose: () => void;
  error?: string;
  recoveryActions?: ReactNode;
  submitLabel: string;
}) {
  const { t } = useTranslation(),
    id = useId();
  function roleOption(role: TeamSheetRole) {
    return (
      <label key={role.key} className="team-role-option" data-slot="team-role-option">
        <input
          type="checkbox"
          name={role.key}
          checked={role.selected}
          disabled={locked || !role.writable}
          aria-labelledby={`${id}-${role.key}-label`}
          aria-describedby={`${id}-${role.key}-hint`}
          onChange={(event) => onRole(role.key, event.currentTarget.checked)}
        />
        <span>
          <span id={`${id}-${role.key}-label`} className="team-role-label">
            {role.label}
          </span>
          <small id={`${id}-${role.key}-hint`}>{role.description}</small>
        </span>
      </label>
    );
  }
  return (
    <Sheet
      className="settings-team-sheet"
      aria-labelledby={`${id}-title`}
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <div>
          <SheetTitle id={`${id}-title`}>{title}</SheetTitle>
          <Text slot="description" elementType="div">
            <SheetDescription>{description}</SheetDescription>
          </Text>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.settings.teamEditor.close)}
          isDisabled={locked}
          onPress={onClose}
        >
          <XIcon />
        </Button>
      </SheetHeader>
      <form
        id={`${id}-form`}
        method="post"
        aria-labelledby={`${id}-title`}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        tabIndex={locked ? 0 : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && dirty && !rolesUnread) onReview();
        }}
      >
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t(($) => $.settings.teamEditor.name)}</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              autoComplete="off"
              value={identity.name}
              readOnly
              disabled={locked}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>{t(($) => $.settings.teamEditor.email)}</FieldLabel>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={identity.email}
              readOnly
              disabled={locked}
              aria-describedby={identity.description ? `${id}-identity-hint` : undefined}
            />
            {identity.description && (
              <FieldDescription id={`${id}-identity-hint`}>{identity.description}</FieldDescription>
            )}
          </Field>
          <FieldSet className="gap-2">
            <FieldLegend>{t(($) => $.settings.teamEditor.roles)}</FieldLegend>
            {roles.map(roleOption)}
            {rolesUnread && <p role="status">{t(($) => $.settings.unread)}</p>}
          </FieldSet>
          <div>
            <p className="team-effect-heading">{t(($) => $.settings.teamEditor.effects)}</p>
            <ul className="team-effects">
              {effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </div>
          {extraRoles.length > 0 && (
            <details className="team-extra-roles">
              <summary>{t(($) => $.settings.teamEditor.otherRoles)}</summary>
              <div className="mt-2 grid gap-2">{extraRoles.map(roleOption)}</div>
            </details>
          )}
          {error && (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {recoveryActions}
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button type="submit" form={`${id}-form`} isDisabled={locked || !dirty || rolesUnread}>
          {submitLabel}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
