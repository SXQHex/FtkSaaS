import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import { Textarea } from "@ftksaas/ui/components/textarea";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardHeader, CardTitle, CardContent } from "@ftksaas/ui/components/card";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Badge } from "@ftksaas/ui/components/badge";

export interface TemplateDraft {
  subject: string;
  body: string;
}

/** Presentation only. Tokens, preview and write permissions come from the native consumer. */
export function TemplateSheet({
  open,
  title,
  description,
  draft,
  variables,
  preview,
  stateLabel,
  writable = false,
  dirty = false,
  locked = false,
  error,
  notice,
  onDraft,
  onInsertVariable,
  onSubmit,
  onClose,
  lifecycleAction,
  recoveryActions,
}: {
  open: boolean;
  title: string;
  description: string;
  draft: TemplateDraft;
  variables: { key: string; label: string }[] | null;
  preview: TemplateDraft | null;
  stateLabel?: string;
  writable?: boolean;
  dirty?: boolean;
  locked?: boolean;
  error?: string;
  notice?: string;
  onDraft?: (draft: TemplateDraft) => void;
  onInsertVariable?: (key: string) => void;
  onSubmit?: () => void;
  onClose: () => void;
  lifecycleAction?: { label: string; reason?: string; onPress?: () => void };
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  const disabled = locked || !writable || !onDraft;
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
        {stateLabel && <Badge variant="secondary">{stateLabel}</Badge>}
      </SheetHeader>
      <form
        id={`${id}-form`}
        method="post"
        aria-labelledby={`${id}-title`}
        tabIndex={disabled ? 0 : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && dirty) onSubmit?.();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-subject`}>
              {t(($) => $.settings.templateEditor.subject)}
            </FieldLabel>
            <Input
              autoFocus
              id={`${id}-subject`}
              name="subject"
              required
              value={draft.subject}
              readOnly={!writable || !onDraft}
              disabled={locked}
              onChange={(event) => onDraft?.({ ...draft, subject: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-body`}>
              {t(($) => $.settings.templateEditor.body)}
            </FieldLabel>
            <Textarea
              id={`${id}-body`}
              name="body"
              required
              rows={8}
              value={draft.body}
              readOnly={!writable || !onDraft}
              disabled={locked}
              onChange={(event) => onDraft?.({ ...draft, body: event.target.value })}
            />
          </Field>
          <FieldSet>
            <FieldLegend>{t(($) => $.settings.templateEditor.variables)}</FieldLegend>
            <FieldDescription>{t(($) => $.settings.templateEditor.variablesHint)}</FieldDescription>
            {variables === null ? (
              <p>{t(($) => $.settings.unread)}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={disabled || !onInsertVariable}
                    onPress={() => onInsertVariable?.(variable.key)}
                  >
                    {variable.label}
                  </Button>
                ))}
              </div>
            )}
          </FieldSet>
          <Card>
            <CardHeader>
              <CardTitle>{t(($) => $.settings.templateEditor.preview)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 break-words">
              {preview === null ? (
                <p>{t(($) => $.settings.unread)}</p>
              ) : (
                <>
                  <p className="font-medium">{preview.subject}</p>
                  <p className="whitespace-pre-wrap">{preview.body}</p>
                </>
              )}
            </CardContent>
          </Card>
          {lifecycleAction && (
            <Field>
              <Button
                type="button"
                variant="outline"
                isDisabled={locked || !lifecycleAction.onPress}
                onPress={lifecycleAction.onPress}
              >
                {lifecycleAction.label}
              </Button>
              {lifecycleAction.reason && (
                <FieldDescription>{lifecycleAction.reason}</FieldDescription>
              )}
            </Field>
          )}
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
        <Button type="submit" form={`${id}-form`} isDisabled={disabled || !dirty || !onSubmit}>
          {t(($) => $.settings.templateEditor.save)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
