import { useEffect, useRef, useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentGate } from "../../lib/api-contracts/generated";
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
  FieldSet,
  FieldLegend,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
export interface DocumentDraft {
  name: string;
  versionLabel: string;
  gates: DocumentGate[];
  renewedAcceptance: boolean;
}
export interface DocumentHistoryRow {
  id: string;
  version: string;
  published: string;
  renewal: string;
}
export function DocumentSheet({
  draft,
  onDraft,
  onFile,
  fileLabel,
  mode,
  history,
  preview,
  reviewed,
  onReviewed,
  onPreview,
  onPublish,
  onClose,
  locked = false,
  readOnly = false,
  errors,
  notice,
}: {
  draft: DocumentDraft;
  onDraft: (value: DocumentDraft) => void;
  onFile: (file: File | undefined) => void;
  fileLabel?: string;
  mode: "new" | "draft" | "version";
  history: DocumentHistoryRow[] | null;
  preview?: ReactNode;
  reviewed: boolean;
  onReviewed: (value: boolean) => void;
  onPreview: () => void;
  onPublish: () => void;
  onClose: () => void;
  locked?: boolean;
  readOnly?: boolean;
  errors?: Partial<Record<"name" | "versionLabel" | "file" | "gates", string>>;
  notice?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId(),
    disabled = locked || readOnly;
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (errors && Object.keys(errors).length)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  const set = <K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle>{mode === "new" ? t(($) => $.documents.add) : draft.name}</SheetTitle>
        <SheetDescription>{t(($) => $.documents.editorDescriptions[mode])}</SheetDescription>
      </SheetHeader>
      <form
        ref={form}
        id={id}
        method="post"
        aria-label={t(($) => $.documents.editorTitle)}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onPreview();
        }}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
      >
        {notice}
        {mode === "version" && (
          <FieldSet>
            <FieldLegend>{t(($) => $.documents.history)}</FieldLegend>
            {history === null ? (
              <p>{t(($) => $.documents.historyUnread)}</p>
            ) : (
              <ItemGroup>
                {history.map((row) => (
                  <Item key={row.id} role="listitem" className="px-0">
                    <ItemContent>
                      <ItemTitle>
                        <span className="flex w-full flex-wrap justify-between gap-2">
                          <span>{row.version}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {row.published}
                          </span>
                        </span>
                      </ItemTitle>
                      <ItemDescription>{row.renewal}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </FieldSet>
        )}
        <FieldGroup>
          <Field data-invalid={Boolean(errors?.name)}>
            <FieldLabel htmlFor={`${id}-name`}>{t(($) => $.documents.name)}</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              value={draft.name}
              readOnly={mode === "version"}
              disabled={disabled}
              aria-invalid={Boolean(errors?.name)}
              aria-describedby={errors?.name ? `${id}-name-error` : undefined}
              onChange={(e) => set("name", e.target.value)}
            />
            {mode === "version" && (
              <FieldDescription>{t(($) => $.documents.fixedName)}</FieldDescription>
            )}
            {errors?.name && <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(errors?.versionLabel)}>
            <FieldLabel htmlFor={`${id}-version`}>{t(($) => $.documents.versionLabel)}</FieldLabel>
            <Input
              id={`${id}-version`}
              name="version_label"
              value={draft.versionLabel}
              disabled={disabled}
              aria-invalid={Boolean(errors?.versionLabel)}
              aria-describedby={errors?.versionLabel ? `${id}-version-error` : undefined}
              onChange={(e) => set("versionLabel", e.target.value)}
            />
            {errors?.versionLabel && (
              <FieldError id={`${id}-version-error`}>{errors.versionLabel}</FieldError>
            )}
          </Field>
          <Field data-invalid={Boolean(errors?.file)}>
            <FieldLabel htmlFor={`${id}-file`}>{t(($) => $.documents.file)}</FieldLabel>
            <Input
              id={`${id}-file`}
              name="file"
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              disabled={disabled}
              aria-invalid={Boolean(errors?.file)}
              aria-describedby={`${id}-file-hint${errors?.file ? ` ${id}-file-error` : ""}`}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <FieldDescription id={`${id}-file-hint`}>
              {t(($) => $.documents.fileHint)}
              {fileLabel && <span className="mt-1 block wrap-anywhere">{fileLabel}</span>}
            </FieldDescription>
            {errors?.file && <FieldError id={`${id}-file-error`}>{errors.file}</FieldError>}
          </Field>
          <FieldSet>
            <FieldLegend>{t(($) => $.documents.needTitle)}</FieldLegend>
            {(["sale", "reservation", "attendance", "event_registration"] as const).map((gate) => (
              <Field key={gate} orientation="horizontal" data-invalid={Boolean(errors?.gates)}>
                <Checkbox
                  id={`${id}-${gate}`}
                  aria-invalid={Boolean(errors?.gates)}
                  aria-describedby={errors?.gates ? `${id}-gates-error` : undefined}
                  isSelected={draft.gates.includes(gate)}
                  isDisabled={disabled}
                  onChange={(selected) =>
                    set(
                      "gates",
                      selected
                        ? [...draft.gates, gate]
                        : draft.gates.filter((value) => value !== gate),
                    )
                  }
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={`${id}-${gate}`}>
                    {t(($) => $.documents.gates[gate])}
                  </FieldLabel>
                  <FieldDescription>{t(($) => $.documents.gateHints[gate])}</FieldDescription>
                </div>
              </Field>
            ))}
            {errors?.gates && <FieldError id={`${id}-gates-error`}>{errors.gates}</FieldError>}
          </FieldSet>
          {mode === "version" && (
            <FieldSet>
              <FieldLegend>{t(($) => $.documents.renewal)}</FieldLegend>
              <RadioGroup
                aria-label={t(($) => $.documents.renewal)}
                value={draft.renewedAcceptance ? "yes" : "no"}
                isDisabled={disabled}
                onChange={(value) => set("renewedAcceptance", value === "yes")}
              >
                <RadioGroupItem value="yes" className="h-auto items-start gap-3">
                  <span className="flex flex-col gap-1">
                    <span>{t(($) => $.documents.renewAll)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(($) => $.documents.renewAllHint)}
                    </span>
                  </span>
                </RadioGroupItem>
                <RadioGroupItem value="no" className="h-auto items-start gap-3">
                  <span className="flex flex-col gap-1">
                    <span>{t(($) => $.documents.keepAcceptances)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(($) => $.documents.keepAcceptancesHint)}
                    </span>
                  </span>
                </RadioGroupItem>
              </RadioGroup>
            </FieldSet>
          )}
        </FieldGroup>
        {preview && (
          <FieldSet>
            <FieldLegend>{t(($) => $.documents.impact)}</FieldLegend>
            {preview}
            <Field orientation="horizontal">
              <Checkbox
                id={`${id}-review`}
                isSelected={reviewed}
                isDisabled={disabled}
                onChange={onReviewed}
              />
              <FieldLabel htmlFor={`${id}-review`}>{t(($) => $.documents.review)}</FieldLabel>
            </Field>
            <FieldDescription>{t(($) => $.documents.reviewHint)}</FieldDescription>
          </FieldSet>
        )}
        <Alert>
          <AlertDescription>{t(($) => $.documents.selfOnly)}</AlertDescription>
        </Alert>
      </form>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.documents.cancel)}
        </Button>
        {preview ? (
          <Button isDisabled={disabled || !reviewed} onPress={onPublish}>
            {t(($) => $.documents.publish)}
          </Button>
        ) : (
          <Button form={id} type="submit" variant="outline" isDisabled={disabled}>
            {t(($) => $.documents.preview)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
