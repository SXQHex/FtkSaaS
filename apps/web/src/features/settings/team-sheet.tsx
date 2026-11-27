import { useId } from "react";
import { useTranslation } from "react-i18next";
import { BanIcon, XIcon } from "lucide-react";
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
  onNameChange,
  onEmailChange,
  roles,
  rolesUnread,
  effects,
  locked = false,
  dirty = false,
  canCheckResult = false,
  invite = false,
  onRole,
  onReview,
  onClose,
  error,
  submitLabel,
}: {
  open: boolean;
  title: string;
  description: string;
  identity: { name: string; email: string; description?: string };
  onNameChange?: (value: string) => void;
  onEmailChange?: (value: string) => void;
  roles: TeamSheetRole[];
  rolesUnread: boolean;
  effects: string[];
  locked?: boolean;
  dirty?: boolean;
  canCheckResult?: boolean;
  invite?: boolean;
  onRole: (key: string, selected: boolean) => void;
  onReview: () => void;
  onClose: () => void;
  error?: string;
  submitLabel: string;
}) {
  const { t } = useTranslation(),
    id = useId();
  const canSubmit = canCheckResult || (!locked && dirty && !rolesUnread);
  function roleOption(role: TeamSheetRole) {
    return (
      <label key={role.key} className="team-role-option" data-slot="team-role-option">
        <input
          type="checkbox"
          autoFocus={!onNameChange && role.key === "center_manager" && role.writable}
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
      className={invite ? "settings-team-sheet settings-team-invite" : "settings-team-sheet"}
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
        noValidate={invite}
        aria-labelledby={`${id}-title`}
        className="team-sheet-form min-h-0 flex-1 overflow-y-auto px-5 py-4"
        tabIndex={locked ? 0 : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (!invite && canSubmit) onReview();
        }}
      >
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t(($) => $.settings.teamEditor.name)}</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              autoFocus={!!onNameChange}
              autoComplete="off"
              value={identity.name}
              readOnly={!onNameChange}
              onChange={(event) => onNameChange?.(event.target.value)}
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
              readOnly={!onEmailChange}
              onChange={(event) => onEmailChange?.(event.target.value)}
              disabled={locked}
              aria-describedby={identity.description ? `${id}-identity-hint` : undefined}
            />
            {identity.description && (
              <FieldDescription id={`${id}-identity-hint`}>{identity.description}</FieldDescription>
            )}
          </Field>
          {roles.length > 0 && (
            <FieldSet className="gap-2">
              <FieldLegend>{t(($) => $.settings.teamEditor.roles)}</FieldLegend>
              {roles.map(roleOption)}
              {rolesUnread && <p role="status">{t(($) => $.settings.unread)}</p>}
            </FieldSet>
          )}
          <div>
            <p className="team-effect-heading">{t(($) => $.settings.teamEditor.effects)}</p>
            <ul className="team-effects">
              {effects.map((effect) => (
                <li key={effect}>{effect}</li>
              ))}
            </ul>
          </div>
          {error && (
            <p className="team-warning" role="alert">
              <BanIcon aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button
          type={invite ? "button" : "submit"}
          form={invite ? undefined : `${id}-form`}
          onPress={invite ? onReview : undefined}
          isDisabled={!canSubmit}
        >
          {submitLabel}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
