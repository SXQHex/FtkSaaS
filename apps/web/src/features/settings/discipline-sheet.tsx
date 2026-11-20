import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import type { RecordState } from "@ftksaas/api-contracts";
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
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldDescription,
  FieldContent,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { Switch } from "@ftksaas/ui/components/switch";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";

export interface DisciplineDraft {
  name: string;
  state: RecordState;
  description: string | null;
  publicVisible: boolean;
  color: string | null;
  icon: string | null;
  displayOrder: string;
  allowCenterDescription: boolean;
}
export function DisciplineSheet({
  open,
  scope,
  scopeLabel,
  version,
  draft,
  writable = false,
  descriptionWritable = false,
  locked = false,
  notice,
  error,
  onDraft,
  onSubmit,
  onClose,
  submitLabel,
  recoveryActions,
  loaded = true,
}: {
  open: boolean;
  scope: "organization" | "center";
  scopeLabel: string;
  version: number | null;
  draft: DisciplineDraft;
  writable?: boolean;
  descriptionWritable?: boolean;
  locked?: boolean;
  notice?: string;
  error?: string;
  onDraft?: (draft: DisciplineDraft) => void;
  onSubmit?: () => void;
  onClose: () => void;
  submitLabel?: string;
  recoveryActions?: ReactNode;
  loaded?: boolean;
}) {
  const { t } = useTranslation(),
    id = useId();
  const disabled = locked || !loaded || !writable || !onDraft;
  const change = (patch: Partial<DisciplineDraft>) => onDraft?.({ ...draft, ...patch });
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
        <SheetTitle>{t(($) => $.settings.disciplineEditor.title)}</SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{t(($) => $.settings.disciplineEditor.description)}</SheetDescription>
        </Text>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{scopeLabel}</Badge>
          <Badge variant="outline">
            {version === null
              ? t(($) => $.settings.disciplineEditor.newRecord)
              : t(($) => $.settings.disciplineEditor.version, { version })}
          </Badge>
        </div>
      </SheetHeader>
      <form
        id={`${id}-form`}
        method="post"
        aria-label={t(($) => $.settings.disciplineEditor.title)}
        tabIndex={locked || !writable ? 0 : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && onSubmit) onSubmit();
        }}
      >
        {!loaded ? (
          <Empty role={error ? "alert" : "status"}>
            <EmptyDescription>{error ?? notice ?? t(($) => $.settings.unread)}</EmptyDescription>
            {recoveryActions}
          </Empty>
        ) : (
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>
                {t(($) => $.settings.disciplineEditor.name)}
              </FieldLabel>
              <Input
                id={`${id}-name`}
                name="name"
                autoFocus
                required
                value={draft.name}
                readOnly={scope === "center"}
                disabled={locked || (scope === "organization" && disabled)}
                onChange={(event) => change({ name: event.target.value })}
              />
              {scope === "center" && (
                <FieldDescription>
                  {t(($) => $.settings.disciplineEditor.organizationName)}
                </FieldDescription>
              )}
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel id={`${id}-state-label`}>
                  {scope === "organization"
                    ? t(($) => $.settings.disciplineEditor.organizationActive)
                    : t(($) => $.settings.disciplineEditor.centerActive)}
                </FieldLabel>
                <FieldDescription>
                  {t(($) => $.settings.disciplineEditor.stateHint)}
                </FieldDescription>
              </FieldContent>
              <Switch
                name="state"
                aria-labelledby={`${id}-state-label`}
                isSelected={draft.state === "active"}
                isDisabled={disabled}
                onChange={(active) => change({ state: active ? "active" : "inactive" })}
              />
            </Field>
            <FieldSet>
              <FieldLegend>{t(($) => $.settings.disciplineEditor.presentation)}</FieldLegend>
              <FieldDescription>
                {t(($) => $.settings.disciplineEditor.presentationHint)}
              </FieldDescription>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel id={`${id}-description-label`}>
                    {scope === "center"
                      ? t(($) => $.settings.disciplineEditor.localDescription)
                      : t(($) => $.settings.disciplineEditor.useDescription)}
                  </FieldLabel>
                  <FieldDescription>
                    {scope === "center"
                      ? t(($) => $.settings.disciplineEditor.inheritHint)
                      : t(($) => $.settings.disciplineEditor.clearHint)}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  name="description_enabled"
                  aria-labelledby={`${id}-description-label`}
                  isSelected={draft.description !== null}
                  isDisabled={disabled || !descriptionWritable}
                  onChange={(enabled) => change({ description: enabled ? "" : null })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-description`}>
                  {t(($) => $.settings.disciplineEditor.descriptionField)}
                </FieldLabel>
                <Textarea
                  id={`${id}-description`}
                  name="description"
                  maxLength={2000}
                  value={draft.description ?? ""}
                  disabled={disabled || !descriptionWritable || draft.description === null}
                  onChange={(event) => change({ description: event.target.value })}
                />
              </Field>
              {scope === "organization" && (
                <>
                  <Field>
                    <FieldLabel htmlFor={`${id}-color`}>
                      {t(($) => $.settings.disciplineEditor.color)}
                    </FieldLabel>
                    <FieldDescription id={`${id}-color-hint`}>
                      {t(($) => $.settings.disciplineEditor.colorHint)}
                    </FieldDescription>
                    <Input
                      id={`${id}-color`}
                      name="color"
                      value={draft.color ?? ""}
                      pattern="#[0-9a-fA-F]{6}"
                      aria-describedby={`${id}-color-hint`}
                      placeholder="#RRGGBB"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={disabled}
                      onChange={(event) => change({ color: event.target.value || null })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-icon`}>
                      {t(($) => $.settings.disciplineEditor.icon)}
                    </FieldLabel>
                    <FieldDescription id={`${id}-icon-hint`}>
                      {t(($) => $.settings.disciplineEditor.iconHint)}
                    </FieldDescription>
                    <Input
                      id={`${id}-icon`}
                      name="icon"
                      maxLength={64}
                      pattern={"[a-z][a-z0-9_\\-]*"}
                      aria-describedby={`${id}-icon-hint`}
                      value={draft.icon ?? ""}
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={disabled}
                      onChange={(event) => change({ icon: event.target.value || null })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-order`}>
                      {t(($) => $.settings.disciplineEditor.order)}
                    </FieldLabel>
                    <Input
                      id={`${id}-order`}
                      name="display_order"
                      value={draft.displayOrder}
                      type="number"
                      min={0}
                      max={2147483647}
                      step={1}
                      inputMode="numeric"
                      required
                      disabled={disabled}
                      onChange={(event) => change({ displayOrder: event.target.value })}
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel id={`${id}-allow-label`}>
                        {t(($) => $.settings.disciplineEditor.allowLocal)}
                      </FieldLabel>
                      <FieldDescription>
                        {t(($) => $.settings.disciplineEditor.allowLocalHint)}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      name="allow_center_description"
                      aria-labelledby={`${id}-allow-label`}
                      isSelected={draft.allowCenterDescription}
                      isDisabled={disabled}
                      onChange={(value) => change({ allowCenterDescription: value })}
                    />
                  </Field>
                </>
              )}
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel id={`${id}-public-label`}>
                    {t(($) => $.settings.disciplineEditor.publicVisible)}
                  </FieldLabel>
                  <FieldDescription>
                    {t(($) => $.settings.disciplineEditor.publicHint)}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  name="public_visible"
                  aria-labelledby={`${id}-public-label`}
                  isSelected={draft.publicVisible}
                  isDisabled={disabled}
                  onChange={(value) => change({ publicVisible: value })}
                />
              </Field>
            </FieldSet>
            {(notice || error) && (
              <Alert role={error ? "alert" : "status"}>
                <AlertDescription>{error ?? notice}</AlertDescription>
              </Alert>
            )}
            {recoveryActions}
          </FieldGroup>
        )}
      </form>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" type="button" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button type="submit" form={`${id}-form`} isDisabled={disabled || !onSubmit}>
          {submitLabel ?? t(($) => $.settings.save)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
