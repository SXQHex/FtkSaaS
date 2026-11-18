import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CrmPipelineStage, CrmTag } from "../../lib/api-contracts/generated";
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
  FieldError,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { LeadMode, LeadDraft } from "./lead-draft";
export function LeadSheet({
  mode,
  advanced = true,
  name,
  draft,
  onDraft,
  stages,
  tags,
  owners,
  products,
  sessions,
  offers,
  personPicker,
  details,
  history,
  recovery,
  errors,
  disabled = false,
  readOnly = false,
  onClose,
  onSubmit,
  onMode,
  offsets = [],
  submitLabel,
  assignmentWritable = false,
  sessionContent,
  trialContent,
}: {
  mode: LeadMode;
  advanced?: boolean;
  offsets?: { id: string; label: string }[];
  submitLabel?: string;
  assignmentWritable?: boolean;
  sessionContent?: ReactNode;
  trialContent?: ReactNode;
  name?: string;
  draft: LeadDraft;
  onDraft?: (draft: LeadDraft) => void;
  stages: CrmPipelineStage[];
  tags: CrmTag[];
  owners: { id: string; name: string }[];
  products: { id: string; name: string }[];
  sessions: { id: string; name: string }[];
  offers: { id: string; name: string }[];
  personPicker?: ReactNode;
  details?: ReactNode;
  history?: ReactNode;
  recovery?: ReactNode;
  errors?: Partial<Record<keyof LeadDraft, string>>;
  disabled?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  onMode?: (mode: LeadMode) => void;
}) {
  const { t } = useTranslation(),
    locked = disabled || readOnly;
  const set = <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) =>
    onDraft?.({ ...draft, [key]: value });
  const stage = stages.find((stage) => stage.key === draft.stageKey);
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open && !disabled) onClose();
      }}
      isDismissable={!disabled}
      isKeyboardDismissDisabled={disabled}
    >
      <SheetHeader>
        <SheetTitle>
          {mode === "edit" ? (name ?? t(($) => $.leads.add)) : t(($) => $.leads.modes[mode])}
        </SheetTitle>
        <SheetDescription>{t(($) => $.leads.sheetDescription)}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <form
          id="lead-form"
          method="post"
          aria-label={t(($) => $.leads.modes[mode])}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
        >
          {mode === "edit" && (
            <>
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">{personPicker ?? details}</div>
                <Field>
                  <FieldLabel htmlFor="lead-source">{t(($) => $.leads.source)}</FieldLabel>
                  <NativeSelect
                    id="lead-source"
                    name="lead-source"
                    value={draft.source}
                    disabled={locked}
                    onChange={(event) => set("source", event.target.value)}
                  >
                    {!["manual", "phone", "whatsapp"].includes(draft.source) && (
                      <NativeSelectOption value={draft.source}>{draft.source}</NativeSelectOption>
                    )}
                    {(["manual", "phone", "whatsapp"] as const).map((source) => (
                      <NativeSelectOption key={source} value={source}>
                        {t(($) => $.leads.sources[source])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field data-invalid={Boolean(errors?.interest)}>
                  <FieldLabel htmlFor="lead-interest">{t(($) => $.leads.interest)}</FieldLabel>
                  <Input
                    id="lead-interest"
                    name="interest"
                    required
                    value={draft.interest}
                    disabled={locked}
                    onChange={(event) => set("interest", event.target.value)}
                    aria-invalid={Boolean(errors?.interest)}
                    aria-describedby={errors?.interest ? "lead-interest-error" : undefined}
                  />
                  <FieldError id="lead-interest-error">{errors?.interest}</FieldError>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="lead-owner">{t(($) => $.leads.owner)}</FieldLabel>
                  <NativeSelect
                    id="lead-owner"
                    name="lead-owner"
                    value={draft.assignedTo}
                    disabled={locked || !assignmentWritable}
                    onChange={(event) => set("assignedTo", event.target.value)}
                  >
                    <NativeSelectOption value="">{t(($) => $.leads.unassigned)}</NativeSelectOption>
                    {owners.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </FieldGroup>
              <Alert>
                <AlertDescription>{t(($) => $.leads.noSideEffects)}</AlertDescription>
              </Alert>
            </>
          )}
          {(mode === "edit" || mode === "stage") && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="lead-stage">{t(($) => $.leads.stage)}</FieldLabel>
                <NativeSelect
                  id="lead-stage"
                  name="lead-stage"
                  value={draft.stageKey}
                  disabled={locked || !stages.length}
                  onChange={(event) =>
                    onDraft?.({
                      ...draft,
                      stageKey: event.target.value,
                      lossReason: "",
                      reviewed: false,
                    })
                  }
                >
                  <NativeSelectOption value="">{t(($) => $.leads.noStage)}</NativeSelectOption>
                  {stages.map((stage) => (
                    <NativeSelectOption key={stage.key} value={stage.key}>
                      {stage.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {tags.length > 0 && (
                <Field>
                  <FieldLabel>{t(($) => $.leads.tags)}</FieldLabel>
                  {tags.map((tag) => (
                    <Checkbox
                      key={tag.key}
                      isDisabled={locked}
                      isSelected={draft.tagKeys.includes(tag.key)}
                      onChange={(selected) =>
                        set(
                          "tagKeys",
                          selected
                            ? [...draft.tagKeys, tag.key]
                            : draft.tagKeys.filter((key) => key !== tag.key),
                        )
                      }
                    >
                      {tag.name}
                    </Checkbox>
                  ))}
                </Field>
              )}
              {stage?.kind === "lost" && (
                <Field data-invalid={Boolean(errors?.lossReason)}>
                  <FieldLabel htmlFor="lead-loss">{t(($) => $.leads.lossReason)}</FieldLabel>
                  <NativeSelect
                    id="lead-loss"
                    name="lead-loss"
                    value={draft.lossReason}
                    required
                    disabled={locked}
                    aria-invalid={Boolean(errors?.lossReason)}
                    aria-describedby={errors?.lossReason ? "lead-loss-error" : undefined}
                    onChange={(event) => set("lossReason", event.target.value)}
                  >
                    <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
                    {(["unreachable", "timing", "price", "alternative", "other"] as const).map(
                      (reason) => (
                        <NativeSelectOption key={reason} value={reason}>
                          {t(($) => $.leads.lossReasons[reason])}
                        </NativeSelectOption>
                      ),
                    )}
                  </NativeSelect>
                  <FieldError id="lead-loss-error">{errors?.lossReason}</FieldError>
                </Field>
              )}
              <FieldDescription>{t(($) => $.leads.stageOnly)}</FieldDescription>
            </FieldGroup>
          )}
          {mode === "activity" && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="lead-kind">{t(($) => $.leads.activityKind)}</FieldLabel>
                <NativeSelect
                  id="lead-kind"
                  name="lead-kind"
                  value={draft.kind}
                  disabled={locked}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "contact" || value === "followup" || value === "outcome")
                      set("kind", value);
                  }}
                >
                  {(["contact", "followup", "outcome"] as const).map((kind) => (
                    <NativeSelectOption key={kind} value={kind}>
                      {t(($) => $.leads.activityKinds[kind])}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={Boolean(errors?.due)}>
                <FieldLabel htmlFor="lead-due">{t(($) => $.leads.when)}</FieldLabel>
                <Input
                  id="lead-due"
                  name="lead-due"
                  type="datetime-local"
                  value={draft.due}
                  disabled={locked}
                  onChange={(event) =>
                    onDraft?.({ ...draft, due: event.target.value, dueOffset: "", reviewed: false })
                  }
                  aria-invalid={Boolean(errors?.due)}
                  aria-describedby={errors?.due ? "lead-due-hint lead-due-error" : "lead-due-hint"}
                />
                <FieldError id="lead-due-error">{errors?.due}</FieldError>
                <FieldDescription id="lead-due-hint">
                  {t(($) => $.leads.timezoneHint)}
                </FieldDescription>
              </Field>
              {offsets.length > 0 && (
                <Field>
                  <FieldLabel htmlFor="lead-offset">{t(($) => $.leads.offset)}</FieldLabel>
                  <NativeSelect
                    id="lead-offset"
                    name="lead-offset"
                    value={draft.dueOffset}
                    disabled={locked}
                    onChange={(event) => set("dueOffset", event.target.value)}
                  >
                    <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
                    {offsets.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="lead-note">{t(($) => $.leads.note)}</FieldLabel>
                <Textarea
                  id="lead-note"
                  name="lead-note"
                  value={draft.note}
                  disabled={locked}
                  onChange={(event) => set("note", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lead-outcome">{t(($) => $.leads.outcome)}</FieldLabel>
                <Input
                  id="lead-outcome"
                  name="lead-outcome"
                  value={draft.outcome}
                  disabled={locked}
                  onChange={(event) => set("outcome", event.target.value)}
                />
              </Field>
            </FieldGroup>
          )}
          {mode === "offer" && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="lead-product">{t(($) => $.leads.trialProduct)}</FieldLabel>
                <NativeSelect
                  id="lead-product"
                  name="lead-product"
                  value={draft.productVersionId}
                  disabled={locked || !products.length}
                  onChange={(event) => set("productVersionId", event.target.value)}
                >
                  <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
                  {products.map((row) => (
                    <NativeSelectOption key={row.id} value={row.id}>
                      {row.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError>{errors?.productVersionId}</FieldError>
              </Field>
              {sessionContent}
              <Field>
                <FieldLabel htmlFor="lead-session">{t(($) => $.leads.trialSession)}</FieldLabel>
                <NativeSelect
                  id="lead-session"
                  name="lead-session"
                  value={draft.sessionId}
                  disabled={locked || !sessions.length}
                  onChange={(event) => set("sessionId", event.target.value)}
                >
                  <NativeSelectOption value="">{t(($) => $.leads.noSession)}</NativeSelectOption>
                  {sessions.map((row) => (
                    <NativeSelectOption key={row.id} value={row.id}>
                      {row.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel>{t(($) => $.leads.trialTerms)}</FieldLabel>
                <FieldDescription>{t(($) => $.leads.trialTermsHint)}</FieldDescription>
                {trialContent}
              </Field>
            </FieldGroup>
          )}
          {mode === "confirm" && (
            <Field>
              <FieldLabel htmlFor="lead-offer">{t(($) => $.leads.selectedOffer)}</FieldLabel>
              <NativeSelect
                id="lead-offer"
                name="lead-offer"
                value={draft.offerId}
                disabled={locked || !offers.length}
                onChange={(event) => set("offerId", event.target.value)}
              >
                <NativeSelectOption value="">{t(($) => $.leads.choose)}</NativeSelectOption>
                {offers.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{errors?.offerId}</FieldError>
              <FieldDescription>{t(($) => $.leads.confirmHint)}</FieldDescription>
              {trialContent}
            </Field>
          )}
          {mode === "convert" && (
            <Alert>
              <AlertDescription>{t(($) => $.leads.convertHint)}</AlertDescription>
            </Alert>
          )}
          {mode !== "edit" && (
            <Checkbox
              isDisabled={locked}
              isSelected={draft.reviewed}
              onChange={(value) => set("reviewed", value)}
            >
              {t(($) => $.leads.review)}
            </Checkbox>
          )}
        </form>
        {(mode === "offer" || mode === "confirm") && history}
        {mode === "edit" && name && (
          <>
            <div className="flex flex-wrap gap-2">
              {(["activity", "offer", "confirm", "convert"] as const)
                .filter((action) => advanced || action === "activity")
                .map((action) => (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    isDisabled={locked || !onMode}
                    onPress={() => onMode?.(action)}
                  >
                    {t(($) => $.leads.modes[action])}
                  </Button>
                ))}
            </div>
            {history}
          </>
        )}
        {recovery}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          variant="outline"
          autoFocus={mode === "convert"}
          isDisabled={disabled}
          onPress={onClose}
        >
          {t(($) => $.leads.close)}
        </Button>
        {!readOnly && (
          <Button
            type="submit"
            form="lead-form"
            isDisabled={disabled || !onSubmit || (mode !== "edit" && !draft.reviewed)}
          >
            {submitLabel ?? t(($) => $.leads.save)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
