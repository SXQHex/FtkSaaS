import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
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
import { Textarea } from "../../components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../../components/ui/alert-dialog";
import { Checkbox } from "../../components/ui/checkbox";
import type { FinanceAction } from "./finance-view";

export interface FinanceDraft {
  personId: string;
  currency: string;
  amount: string;
  method: "" | "cash" | "card_pos" | "bank_transfer";
  reference: string;
  occurredAt: string;
  note: string;
  reason: string;
  direction: "increase" | "decrease";
  debtId: string;
}
export interface FinanceEffect {
  id: string;
  label: string;
  detail: string;
}
export function FinanceActionSheet({
  open,
  action,
  sourceLabel,
  draft,
  people,
  debts,
  effects,
  stage,
  accepted,
  errors,
  notice,
  pending = false,
  readOnly = false,
  pinnedSelection = false,
  onClose,
  onDraft,
  onReview,
  onConfirm,
  onBack,
  onAccepted,
}: {
  open: boolean;
  action: Exclude<FinanceAction, "cancel">;
  sourceLabel: string;
  draft: FinanceDraft;
  people: { id: string; label: string }[];
  debts: { id: string; label: string }[];
  effects: FinanceEffect[];
  stage: "edit" | "review";
  accepted: boolean;
  errors?: Partial<Record<keyof FinanceDraft, string>>;
  notice?: ReactNode;
  pending?: boolean;
  readOnly?: boolean;
  pinnedSelection?: boolean;
  onClose: () => void;
  onDraft: (draft: FinanceDraft) => void;
  onReview?: () => void;
  onConfirm?: () => void;
  onBack: () => void;
  onAccepted: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (errors && Object.keys(errors).length)
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [errors]);
  const set = <K extends keyof FinanceDraft>(key: K, value: FinanceDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  const collect = action === "collect",
    correction = action === "correct",
    offset = action === "offset",
    adjust = action === "adjust";
  const submitLabel = collect
    ? t(($) => $.finance.saveCollection)
    : correction
      ? t(($) => $.finance.applyCorrection)
      : action === "sale-refund"
        ? t(($) => $.finance.applyRefund)
        : action === "credit-refund"
          ? t(($) => $.finance.recordRefund)
          : offset
            ? t(($) => $.finance.applyOffset)
            : t(($) => $.finance.saveAdjustment);
  const invalid = (key: keyof FinanceDraft) => Boolean(errors?.[key]);
  return (
    <Sheet
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      showCloseButton={false}
    >
      <SheetHeader className="relative pe-14">
        <SheetTitle>{t(($) => $.finance.titles[action])}</SheetTitle>
        <SheetDescription>
          {collect ? t(($) => $.finance.collectDescription) : sourceLabel}
        </SheetDescription>
        <Button
          className="absolute end-4 top-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.finance.close)}
          isDisabled={pending}
          onPress={onClose}
        >
          <XIcon />
        </Button>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 [scrollbar-gutter:stable] [overscroll-behavior:contain]">
        {notice}
        {stage === "edit" ? (
          <form
            id="finance-command"
            ref={formRef}
            aria-label={t(($) => $.finance.titles[action])}
            method="post"
            onSubmit={(event) => {
              event.preventDefault();
              onReview?.();
            }}
          >
            <FieldGroup>
              {collect && (
                <Field data-invalid={invalid("personId")}>
                  <FieldLabel htmlFor="finance-person">{t(($) => $.finance.member)}</FieldLabel>
                  <NativeSelect
                    id="finance-person"
                    name="personId"
                    required
                    value={draft.personId}
                    disabled={pending || readOnly || pinnedSelection}
                    aria-invalid={invalid("personId")}
                    aria-describedby={errors?.personId ? "finance-person-error" : undefined}
                    onChange={(event) => set("personId", event.target.value)}
                  >
                    <NativeSelectOption value="">{t(($) => $.finance.choose)}</NativeSelectOption>
                    {people.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError id="finance-person-error">{errors?.personId}</FieldError>
                </Field>
              )}
              {offset && (
                <Field data-invalid={invalid("debtId")}>
                  <FieldLabel htmlFor="finance-debt">{t(($) => $.finance.debtChoice)}</FieldLabel>
                  <NativeSelect
                    id="finance-debt"
                    name="debtId"
                    required
                    value={draft.debtId}
                    disabled={pending || readOnly}
                    aria-invalid={invalid("debtId")}
                    aria-describedby={errors?.debtId ? "finance-debt-error" : undefined}
                    onChange={(event) => set("debtId", event.target.value)}
                  >
                    <NativeSelectOption value="">{t(($) => $.finance.choose)}</NativeSelectOption>
                    {debts.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError id="finance-debt-error">{errors?.debtId}</FieldError>
                </Field>
              )}
              <Field data-invalid={invalid("amount")}>
                <FieldLabel htmlFor="finance-amount">
                  {correction
                    ? t(($) => $.finance.correctionAmount)
                    : t(($) => $.finance.amountMinor)}
                </FieldLabel>
                <FieldDescription id="finance-money-hint">
                  {correction ? t(($) => $.finance.correctionHint) : t(($) => $.finance.moneyHint)}
                </FieldDescription>
                <Input
                  id="finance-amount"
                  name="amount"
                  required
                  inputMode="numeric"
                  value={draft.amount}
                  disabled={pending || readOnly}
                  aria-invalid={invalid("amount")}
                  aria-describedby={
                    errors?.amount
                      ? "finance-money-hint finance-amount-error"
                      : "finance-money-hint"
                  }
                  onChange={(event) => set("amount", event.target.value)}
                />
                <FieldError id="finance-amount-error">{errors?.amount}</FieldError>
              </Field>
              <Field data-invalid={invalid("currency")}>
                <FieldLabel htmlFor="finance-currency">{t(($) => $.finance.currency)}</FieldLabel>
                <Input
                  id="finance-currency"
                  name="currency"
                  required
                  value={draft.currency}
                  readOnly={!collect || pinnedSelection}
                  disabled={pending || readOnly}
                  autoComplete="off"
                  aria-invalid={invalid("currency")}
                  aria-describedby={errors?.currency ? "finance-currency-error" : undefined}
                  onChange={(event) => set("currency", event.target.value)}
                />
                <FieldError id="finance-currency-error">{errors?.currency}</FieldError>
              </Field>
              {(collect || correction || action === "credit-refund") && (
                <FieldSet>
                  <FieldLegend>{t(($) => $.finance.method)}</FieldLegend>
                  <ToggleGroup
                    variant="segmented"
                    size="segmented"
                    selectionMode="single"
                    selectedKeys={new Set(draft.method ? [draft.method] : [])}
                    isDisabled={pending || readOnly || !collect}
                    className="max-w-full flex-wrap"
                    aria-label={t(($) => $.finance.method)}
                    aria-invalid={invalid("method")}
                    aria-describedby={errors?.method ? "finance-method-error" : undefined}
                    onSelectionChange={(keys) =>
                      set("method", String([...keys][0] ?? "") as FinanceDraft["method"])
                    }
                  >
                    <ToggleGroupItem id="cash">{t(($) => $.finance.cash)}</ToggleGroupItem>
                    <ToggleGroupItem id="card_pos" isDisabled={action === "credit-refund"}>
                      {t(($) => $.finance.card)}
                    </ToggleGroupItem>
                    <ToggleGroupItem id="bank_transfer">{t(($) => $.finance.bank)}</ToggleGroupItem>
                  </ToggleGroup>
                  <FieldError id="finance-method-error">{errors?.method}</FieldError>
                </FieldSet>
              )}
              {collect && (draft.method === "card_pos" || draft.method === "bank_transfer") && (
                <Field data-invalid={invalid("reference")}>
                  <FieldLabel htmlFor="finance-reference">
                    {t(($) => $.finance.reference)}
                  </FieldLabel>
                  <FieldDescription id="finance-reference-hint">
                    {t(($) => $.finance.referenceHint)}
                  </FieldDescription>
                  <Input
                    id="finance-reference"
                    name="reference"
                    required
                    value={draft.reference}
                    autoComplete="off"
                    disabled={pending || readOnly}
                    aria-invalid={invalid("reference")}
                    aria-describedby={
                      errors?.reference
                        ? "finance-reference-hint finance-reference-error"
                        : "finance-reference-hint"
                    }
                    onChange={(event) => set("reference", event.target.value)}
                  />
                  <FieldError id="finance-reference-error">{errors?.reference}</FieldError>
                </Field>
              )}
              {(collect || correction || action === "credit-refund") && (
                <Field data-invalid={invalid("occurredAt")}>
                  <FieldLabel htmlFor="finance-occurred">
                    {t(($) => $.finance.occurredAt)}
                  </FieldLabel>
                  <Input
                    id="finance-occurred"
                    name="occurredAt"
                    type="datetime-local"
                    required
                    value={draft.occurredAt}
                    disabled={pending || readOnly}
                    aria-invalid={invalid("occurredAt")}
                    aria-describedby={errors?.occurredAt ? "finance-occurred-error" : undefined}
                    onChange={(event) => set("occurredAt", event.target.value)}
                  />
                  <FieldError id="finance-occurred-error">{errors?.occurredAt}</FieldError>
                </Field>
              )}
              {(adjust || correction) && (
                <FieldSet>
                  <FieldLegend>{t(($) => $.finance.direction)}</FieldLegend>
                  <ToggleGroup
                    variant="segmented"
                    size="segmented"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([draft.direction])}
                    isDisabled={pending || readOnly}
                    aria-label={t(($) => $.finance.direction)}
                    onSelectionChange={(keys) =>
                      set("direction", [...keys][0] === "decrease" ? "decrease" : "increase")
                    }
                  >
                    <ToggleGroupItem id="decrease">{t(($) => $.finance.decrease)}</ToggleGroupItem>
                    <ToggleGroupItem id="increase">{t(($) => $.finance.increase)}</ToggleGroupItem>
                  </ToggleGroup>
                </FieldSet>
              )}
              {collect || offset ? (
                <Field>
                  <FieldLabel htmlFor="finance-note">{t(($) => $.finance.note)}</FieldLabel>
                  <Input
                    id="finance-note"
                    name="note"
                    value={draft.note}
                    disabled={pending || readOnly}
                    onChange={(event) => set("note", event.target.value)}
                  />
                  <FieldDescription>{t(($) => $.finance.optional)}</FieldDescription>
                </Field>
              ) : (
                <Field data-invalid={invalid("reason")}>
                  <FieldLabel htmlFor="finance-reason">{t(($) => $.finance.reason)}</FieldLabel>
                  <Textarea
                    id="finance-reason"
                    name="reason"
                    required
                    value={draft.reason}
                    disabled={pending || readOnly}
                    aria-invalid={invalid("reason")}
                    aria-describedby={
                      errors?.reason
                        ? "finance-reason-hint finance-reason-error"
                        : "finance-reason-hint"
                    }
                    onChange={(event) => set("reason", event.target.value)}
                  />
                  <FieldDescription id="finance-reason-hint">
                    {t(($) => $.finance.reasonHint)}
                  </FieldDescription>
                  <FieldError id="finance-reason-error">{errors?.reason}</FieldError>
                </Field>
              )}
            </FieldGroup>
          </form>
        ) : (
          <>
            <section aria-label={t(($) => $.finance.effects)} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t(($) => $.finance.effects)}</h3>
              {effects.length > 0 ? (
                <ItemGroup>
                  {effects.map((effect) => (
                    <Item key={effect.id} role="listitem" variant="outline" size="sm">
                      <ItemContent>
                        <ItemTitle>{effect.label}</ItemTitle>
                        <ItemDescription>{effect.detail}</ItemDescription>
                      </ItemContent>
                    </Item>
                  ))}
                </ItemGroup>
              ) : (
                <p className="text-sm text-muted-foreground">{t(($) => $.finance.noEffects)}</p>
              )}
            </section>
            <Field orientation="horizontal">
              <Checkbox
                id="finance-accepted"
                name="accepted"
                aria-labelledby="finance-accepted-label"
                isSelected={accepted}
                isDisabled={pending || readOnly}
                onChange={onAccepted}
              />
              <FieldLabel id="finance-accepted-label" htmlFor="finance-accepted">
                {t(($) => $.finance.accepted)}
              </FieldLabel>
            </Field>
          </>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          variant="outline"
          onPress={stage === "review" ? onBack : onClose}
          isDisabled={pending}
        >
          {stage === "review" ? t(($) => $.finance.back) : t(($) => $.finance.cancel)}
        </Button>
        {stage === "edit" ? (
          <Button
            type="submit"
            form="finance-command"
            isDisabled={!onReview || pending || readOnly}
          >
            {t(($) => $.finance.review)}
          </Button>
        ) : (
          <Button onPress={onConfirm} isDisabled={!accepted || !onConfirm || pending || readOnly}>
            {submitLabel}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
export function FinanceCancelDialog({
  open,
  sourceLabel,
  reason,
  onReason,
  pending = false,
  onClose,
  onReview,
  notice,
}: {
  open: boolean;
  sourceLabel: string;
  reason: string;
  onReason: (value: string) => void;
  pending?: boolean;
  onClose: () => void;
  onReview?: () => void;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      isKeyboardDismissDisabled={pending}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t(($) => $.finance.cancelCollection)}</AlertDialogTitle>
        <AlertDialogDescription>
          {sourceLabel}
          <p className="mt-2">{t(($) => $.finance.cancelDescription)}</p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      {notice}
      <form
        id="finance-cancel"
        aria-label={t(($) => $.finance.cancelCollection)}
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          onReview?.();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="finance-cancel-reason">{t(($) => $.finance.reason)}</FieldLabel>
            <Textarea
              id="finance-cancel-reason"
              name="reason"
              required
              value={reason}
              disabled={pending}
              onChange={(event) => onReason(event.target.value)}
            />
            <FieldDescription>{t(($) => $.finance.reasonHint)}</FieldDescription>
          </Field>
        </FieldGroup>
      </form>
      <AlertDialogFooter>
        <Button variant="outline" onPress={onClose} isDisabled={pending}>
          {t(($) => $.finance.cancel)}
        </Button>
        <Button
          type="submit"
          form="finance-cancel"
          variant="destructive"
          isDisabled={!onReview || pending}
        >
          {t(($) => $.finance.review)}
        </Button>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
