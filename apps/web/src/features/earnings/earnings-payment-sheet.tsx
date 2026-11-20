import { useId, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  FieldError,
  FieldSet,
  FieldLegend,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import { Button } from "@ftksaas/ui/components/button";
export interface EarningsPaymentDraft {
  personId: string;
  amount: string;
  date: string;
  method: "bank_transfer" | "cash" | "card_pos" | "";
  reference: string;
  direction: "increase" | "decrease";
  reason: string;
  earningIds: string[];
}
export function EarningsPaymentSheet({
  mode,
  draft,
  onDraft,
  people,
  currency,
  maxDate,
  remaining,
  history,
  earnings,
  effect,
  notice,
  errors,
  locked = false,
  readOnly = false,
  allowPersonSelection = false,
  onSubmit,
  onClose,
}: {
  mode: "new" | "correct";
  draft: EarningsPaymentDraft;
  onDraft: (value: EarningsPaymentDraft) => void;
  people: { id: string; name: string }[];
  currency?: string;
  maxDate: string;
  remaining?: string;
  history: { id: string; title: string; amount: string; context: string }[];
  earnings: { id: string; title: string; amount: string }[] | null;
  effect?: ReactNode;
  notice?: ReactNode;
  errors?: Partial<
    Record<"personId" | "amount" | "date" | "reference" | "reason" | "earningIds", string>
  >;
  locked?: boolean;
  readOnly?: boolean;
  allowPersonSelection?: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    id = useId(),
    form = useRef<HTMLFormElement>(null),
    disabled = locked || readOnly;
  const set = <K extends keyof EarningsPaymentDraft>(key: K, value: EarningsPaymentDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  useEffect(() => {
    if (errors && Object.keys(errors).length)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
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
        <SheetTitle>
          {mode === "new" ? t(($) => $.earnings.pay) : t(($) => $.earnings.correctTitle)}
        </SheetTitle>
        <SheetDescription>
          {mode === "new"
            ? t(($) => $.earnings.payDescription)
            : t(($) => $.earnings.correctDescription)}
        </SheetDescription>
      </SheetHeader>
      <form
        id={id}
        ref={form}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) onSubmit();
        }}
      >
        <FieldGroup>
          {notice}
          {mode === "new" ? (
            <>
              <Field>
                <FieldLabel htmlFor={`${id}-person`}>{t(($) => $.earnings.instructor)}</FieldLabel>
                <NativeSelect
                  id={`${id}-person`}
                  value={draft.personId}
                  onChange={(event) => set("personId", event.target.value)}
                  disabled={locked || (readOnly && !allowPersonSelection)}
                  aria-invalid={!!errors?.personId}
                  aria-describedby={`${id}-person-help`}
                >
                  <NativeSelectOption value="">
                    {t(($) => $.earnings.selectInstructor)}
                  </NativeSelectOption>
                  {people.map((row) => (
                    <NativeSelectOption key={row.id} value={row.id}>
                      {row.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription id={`${id}-person-help`}>
                  {errors?.personId ?? remaining ?? t(($) => $.earnings.unread)}
                </FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend>{t(($) => $.earnings.selectedEarnings)}</FieldLegend>
                <FieldDescription id={`${id}-earnings-help`}>
                  {errors?.earningIds ?? t(($) => $.earnings.earningSelectionHelp)}
                </FieldDescription>
                <FieldGroup>
                  {earnings === null ? (
                    <FieldDescription>{t(($) => $.earnings.unread)}</FieldDescription>
                  ) : (
                    earnings.map((row) => (
                      <Field key={row.id} orientation="horizontal">
                        <Checkbox
                          id={`${id}-${row.id}`}
                          isSelected={draft.earningIds.includes(row.id)}
                          isDisabled={disabled}
                          onChange={(checked) =>
                            set(
                              "earningIds",
                              checked
                                ? [...draft.earningIds, row.id]
                                : draft.earningIds.filter((value) => value !== row.id),
                            )
                          }
                          aria-describedby={`${id}-earnings-help`}
                        />
                        <FieldLabel htmlFor={`${id}-${row.id}`}>
                          {row.title} · {row.amount}
                        </FieldLabel>
                      </Field>
                    ))
                  )}
                </FieldGroup>
              </FieldSet>
            </>
          ) : (
            <>
              <ItemGroup>
                {history.map((row) => (
                  <Item role="listitem" key={row.id}>
                    <ItemContent>
                      <ItemTitle>
                        {row.title} · {row.amount}
                      </ItemTitle>
                      <ItemDescription>{row.context}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
              <Field>
                <FieldLabel>{t(($) => $.earnings.correction)}</FieldLabel>
                <ToggleGroup
                  aria-label={t(($) => $.earnings.correction)}
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[draft.direction]}
                  isDisabled={disabled}
                  onSelectionChange={(keys) => {
                    const value = [...keys][0];
                    if (value === "increase" || value === "decrease") set("direction", value);
                  }}
                >
                  <ToggleGroupItem id="increase">{t(($) => $.earnings.increase)}</ToggleGroupItem>
                  <ToggleGroupItem id="decrease">{t(($) => $.earnings.decrease)}</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </>
          )}
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            <Field data-invalid={!!errors?.amount}>
              <FieldLabel htmlFor={`${id}-amount`}>
                {mode === "new" ? t(($) => $.earnings.amount) : t(($) => $.earnings.difference)}
                {currency ? ` · ${currency}` : ""}
              </FieldLabel>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                value={draft.amount}
                onChange={(event) => set("amount", event.target.value)}
                disabled={disabled}
                aria-invalid={!!errors?.amount}
                aria-describedby={errors?.amount ? `${id}-amount-error` : undefined}
              />
              {errors?.amount && <FieldError id={`${id}-amount-error`}>{errors.amount}</FieldError>}
            </Field>
            {mode === "new" && (
              <Field>
                <FieldLabel htmlFor={`${id}-date`}>{t(($) => $.earnings.date)}</FieldLabel>
                <Input
                  id={`${id}-date`}
                  type="datetime-local"
                  max={maxDate}
                  value={draft.date}
                  onChange={(event) => set("date", event.target.value)}
                  disabled={disabled}
                  aria-invalid={!!errors?.date}
                  aria-describedby={errors?.date ? `${id}-date-error` : undefined}
                />
                {errors?.date && <FieldError id={`${id}-date-error`}>{errors.date}</FieldError>}
              </Field>
            )}
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-method`}>{t(($) => $.earnings.method)}</FieldLabel>
            <NativeSelect
              id={`${id}-method`}
              value={draft.method}
              disabled={disabled}
              onChange={(event) => {
                const method = event.target.value;
                if (method === "cash" || method === "bank_transfer" || method === "card_pos")
                  set("method", method);
              }}
            >
              <NativeSelectOption value="">{t(($) => $.finance.choose)}</NativeSelectOption>
              <NativeSelectOption value="bank_transfer">
                {t(($) => $.earnings.methods.bank_transfer)}
              </NativeSelectOption>
              <NativeSelectOption value="cash">
                {t(($) => $.earnings.methods.cash)}
              </NativeSelectOption>
              <NativeSelectOption value="card_pos">
                {t(($) => $.earnings.methods.card_pos)}
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          {draft.method !== "cash" && (
            <Field>
              <FieldLabel htmlFor={`${id}-reference`}>{t(($) => $.earnings.reference)}</FieldLabel>
              <Input
                id={`${id}-reference`}
                value={draft.reference}
                onChange={(event) => set("reference", event.target.value)}
                disabled={disabled}
                aria-invalid={!!errors?.reference}
                aria-describedby={`${id}-reference-help`}
              />
              <FieldDescription id={`${id}-reference-help`}>
                {errors?.reference ?? t(($) => $.earnings.referenceHelp)}
              </FieldDescription>
            </Field>
          )}
          {mode === "new" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-note`}>{t(($) => $.earnings.note)}</FieldLabel>
              <Input id={`${id}-note`} value="" disabled aria-describedby={`${id}-note-help`} />
              <FieldDescription id={`${id}-note-help`}>
                {t(($) => $.earnings.noteUnavailable)}
              </FieldDescription>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor={`${id}-reason`}>{t(($) => $.earnings.reason)}</FieldLabel>
              <Textarea
                id={`${id}-reason`}
                rows={2}
                value={draft.reason}
                onChange={(event) => set("reason", event.target.value)}
                disabled={disabled}
                aria-invalid={!!errors?.reason}
                aria-describedby={`${id}-reason-help`}
              />
              <FieldDescription id={`${id}-reason-help`}>
                {errors?.reason ?? t(($) => $.earnings.correctDescription)}
              </FieldDescription>
            </Field>
          )}
          <FieldSet>
            <FieldLegend>{t(($) => $.earnings.effect)}</FieldLegend>
            {effect ?? <FieldDescription>{t(($) => $.earnings.effectUnread)}</FieldDescription>}
          </FieldSet>
        </FieldGroup>
      </form>
      <SheetFooter>
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.earnings.cancel)}
        </Button>
        <Button type="submit" form={id} isDisabled={disabled}>
          {mode === "new" ? t(($) => $.earnings.savePayment) : t(($) => $.earnings.saveCorrection)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
