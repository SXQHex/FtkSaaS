import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../../components/ui/alert-dialog";
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
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import type { MemberAction } from "./member-profile-view";
export type LifecycleAction = Exclude<
  MemberAction,
  "collect" | "deactivate" | "activate" | "cancelReservation"
>;
import type { MemberDraft } from "./member-draft";
export interface MemberEffect {
  id: string;
  label: string;
  value: string;
  detail?: string;
}
export function MemberActionSheet({
  action,
  personLabel,
  sourceLabel,
  draft,
  products,
  disciplines,
  reservations,
  inventoryAvailable,
  stage,
  effects,
  accepted,
  errors,
  notice,
  sourceSelection,
  pending = false,
  readOnly = false,
  freezePlanned = false,
  onDraft,
  onClose,
  onReview,
  onBack,
  onConfirm,
  onAccepted,
}: {
  action: LifecycleAction;
  personLabel: string;
  sourceLabel: string;
  draft: MemberDraft;
  products: { id: string; name: string; detail: string }[];
  disciplines: { id: string; name: string }[];
  reservations: { id: string; label: string; detail: string }[];
  inventoryAvailable: boolean;
  stage: "edit" | "review";
  effects: MemberEffect[];
  accepted: boolean;
  errors?: Partial<Record<keyof MemberDraft, string>>;
  notice?: ReactNode;
  sourceSelection?: ReactNode;
  pending?: boolean;
  readOnly?: boolean;
  freezePlanned?: boolean;
  onDraft: (draft: MemberDraft) => void;
  onClose: () => void;
  onReview?: () => void;
  onBack: () => void;
  onConfirm?: () => void;
  onAccepted: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    form = useRef<HTMLFormElement>(null),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage === "review") reviewHeading.current?.focus();
  }, [stage]);
  useEffect(() => {
    if (errors?.productVersionId)
      form.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    else if (errors && Object.keys(errors).length)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  const set = <K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  const sale = action === "allocate" || action === "renew" || action === "change";
  const reason = !(["allocate", "renew"] as LifecycleAction[]).includes(action);
  const dateStart = sale || action === "freeze",
    dateEnd = dateStart || action === "unfreeze" || action === "extend";
  const title = t(($) =>
    action === "unfreeze" && freezePlanned
      ? $.memberProfile.cancelFreeze
      : $.memberProfile.titles[action],
  );
  return (
    <Sheet
      isOpen
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      showCloseButton={false}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <SheetHeader className="relative pe-14">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>
          {personLabel}
          {sourceLabel ? ` · ${sourceLabel}` : ""}
        </SheetDescription>
        <Button
          className="absolute end-4 top-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.memberProfile.close)}
          isDisabled={pending}
          onPress={onClose}
        >
          <XIcon />
        </Button>
      </SheetHeader>
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 [scrollbar-gutter:stable] [overscroll-behavior:contain]"
      >
        {notice}
        {stage === "edit" ? (
          <form
            ref={form}
            id="member-lifecycle-form"
            method="post"
            noValidate
            aria-label={title}
            onSubmit={(event) => {
              event.preventDefault();
              onReview?.();
            }}
          >
            <FieldGroup>
              {sourceSelection}
              {sale && (
                <FieldSet>
                  <FieldLegend>{t(($) => $.memberProfile.product)}</FieldLegend>
                  <RadioGroup
                    aria-label={t(($) => $.memberProfile.product)}
                    value={draft.productVersionId}
                    onChange={(value) => set("productVersionId", value)}
                    isDisabled={pending || readOnly}
                    isInvalid={Boolean(errors?.productVersionId)}
                    aria-describedby={errors?.productVersionId ? "member-product-error" : undefined}
                  >
                    {products.map((row) => (
                      <Field key={row.id} orientation="horizontal">
                        <RadioGroupItem
                          id={`member-product-${row.id}`}
                          value={row.id}
                          aria-labelledby={`member-product-label-${row.id}`}
                          aria-describedby={`member-product-detail-${row.id}`}
                        />
                        <div className="min-w-0">
                          <FieldLabel
                            id={`member-product-label-${row.id}`}
                            htmlFor={`member-product-${row.id}`}
                          >
                            {row.name}
                          </FieldLabel>
                          <FieldDescription id={`member-product-detail-${row.id}`}>
                            {row.detail}
                          </FieldDescription>
                        </div>
                      </Field>
                    ))}
                  </RadioGroup>
                  {products.length === 0 && (
                    <FieldDescription>{t(($) => $.memberProfile.noProducts)}</FieldDescription>
                  )}
                  <FieldError id="member-product-error">{errors?.productVersionId}</FieldError>
                </FieldSet>
              )}
              {action === "allocate" && (
                <Field data-invalid={Boolean(errors?.netMinor)}>
                  <FieldLabel htmlFor="member-netMinor">
                    {t(($) => $.memberProfile.netMinor)}
                  </FieldLabel>
                  <FieldDescription id="member-netMinor-hint">
                    {t(($) => $.memberProfile.netMinorHint)}
                  </FieldDescription>
                  <Input
                    id="member-netMinor"
                    name="netMinor"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]+"
                    maxLength={19}
                    autoComplete="off"
                    value={draft.netMinor}
                    disabled={pending || readOnly}
                    aria-invalid={Boolean(errors?.netMinor)}
                    aria-describedby={`member-netMinor-hint${errors?.netMinor ? " member-netMinor-error" : ""}`}
                    onChange={(event) => set("netMinor", event.target.value)}
                  />
                  <FieldError id="member-netMinor-error">{errors?.netMinor}</FieldError>
                </Field>
              )}
              {(dateStart || dateEnd) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    ...(dateStart ? ["startDate" as const] : []),
                    ...(dateEnd ? ["endDate" as const] : []),
                  ].map((key) => (
                    <Field key={key} data-invalid={Boolean(errors?.[key])}>
                      <FieldLabel htmlFor={`member-${key}`}>
                        {t(($) => $.memberProfile.fields[key])}
                      </FieldLabel>
                      <Input
                        id={`member-${key}`}
                        name={key}
                        type="date"
                        required
                        value={draft[key]}
                        disabled={pending || readOnly}
                        aria-invalid={Boolean(errors?.[key])}
                        aria-describedby={errors?.[key] ? `member-${key}-error` : undefined}
                        onChange={(event) => set(key, event.target.value)}
                      />
                      <FieldError id={`member-${key}-error`}>{errors?.[key]}</FieldError>
                    </Field>
                  ))}
                </div>
              )}
              {dateEnd && (
                <p className="text-xs text-muted-foreground">
                  {t(($) => $.memberProfile.dateHint)}
                </p>
              )}
              {action === "negative" && (
                <Field data-invalid={Boolean(errors?.disciplineId)}>
                  <FieldLabel htmlFor="member-discipline">
                    {t(($) => $.memberProfile.fields.disciplineId)}
                  </FieldLabel>
                  <NativeSelect
                    id="member-discipline"
                    name="disciplineId"
                    value={draft.disciplineId}
                    required
                    disabled={pending || readOnly}
                    aria-invalid={Boolean(errors?.disciplineId)}
                    aria-describedby={errors?.disciplineId ? "member-discipline-error" : undefined}
                    onChange={(event) => set("disciplineId", event.target.value)}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.memberProfile.choose)}
                    </NativeSelectOption>
                    {disciplines.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError id="member-discipline-error">{errors?.disciplineId}</FieldError>
                </Field>
              )}
              {action === "adjust" && (
                <FieldSet>
                  <FieldLegend>{t(($) => $.memberProfile.direction)}</FieldLegend>
                  <ToggleGroup
                    variant="segmented"
                    aria-label={t(($) => $.memberProfile.direction)}
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([draft.direction])}
                    isDisabled={pending || readOnly}
                    onSelectionChange={(keys) => {
                      const key = [...keys][0];
                      if (key === "increase" || key === "decrease") set("direction", key);
                    }}
                  >
                    <ToggleGroupItem id="increase">
                      {t(($) => $.memberProfile.addCredit)}
                    </ToggleGroupItem>
                    <ToggleGroupItem id="decrease">
                      {t(($) => $.memberProfile.removeCredit)}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FieldSet>
              )}
              {(action === "adjust" || action === "negative") && (
                <Field data-invalid={Boolean(errors?.quantity)}>
                  <FieldLabel htmlFor="member-quantity">
                    {t(($) =>
                      action === "negative"
                        ? $.memberProfile.limitLabel
                        : $.memberProfile.quantityLabel,
                    )}
                  </FieldLabel>
                  <Input
                    id="member-quantity"
                    name="quantity"
                    required
                    inputMode="numeric"
                    value={draft.quantity}
                    disabled={pending || readOnly}
                    aria-invalid={Boolean(errors?.quantity)}
                    aria-describedby={errors?.quantity ? "member-quantity-error" : undefined}
                    onChange={(event) => set("quantity", event.target.value)}
                  />
                  <FieldError id="member-quantity-error">{errors?.quantity}</FieldError>
                </Field>
              )}
              {action === "change" && (
                <FieldSet>
                  <FieldLegend>{t(($) => $.memberProfile.reservationChoices)}</FieldLegend>
                  {!inventoryAvailable ? (
                    <FieldDescription>
                      {t(($) => $.memberProfile.inventoryRequired)}
                    </FieldDescription>
                  ) : reservations.length === 0 ? (
                    <FieldDescription>
                      {t(($) => $.memberProfile.noFutureReservations)}
                    </FieldDescription>
                  ) : (
                    reservations.map((row) => (
                      <Field key={row.id}>
                        <FieldLabel htmlFor={`member-reservation-${row.id}`}>
                          {row.label}
                        </FieldLabel>
                        <FieldDescription id={`member-product-detail-${row.id}`}>
                          {row.detail}
                        </FieldDescription>
                        <NativeSelect
                          id={`member-reservation-${row.id}`}
                          value={draft.reservations[row.id] ?? ""}
                          required
                          disabled={pending || readOnly}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === "keep" || value === "cancel")
                              set("reservations", { ...draft.reservations, [row.id]: value });
                          }}
                        >
                          <NativeSelectOption value="">
                            {t(($) => $.memberProfile.choose)}
                          </NativeSelectOption>
                          <NativeSelectOption value="keep">
                            {t(($) => $.memberProfile.keepReservation)}
                          </NativeSelectOption>
                          <NativeSelectOption value="cancel">
                            {t(($) => $.memberProfile.cancelReservation)}
                          </NativeSelectOption>
                        </NativeSelect>
                      </Field>
                    ))
                  )}
                  <FieldError>{errors?.reservations}</FieldError>
                </FieldSet>
              )}
              {reason && (
                <Field data-invalid={Boolean(errors?.reason)}>
                  <FieldLabel htmlFor="member-reason">
                    {t(($) => $.memberProfile.reason)}
                  </FieldLabel>
                  <Textarea
                    id="member-reason"
                    name="reason"
                    required
                    value={draft.reason}
                    disabled={pending || readOnly}
                    aria-invalid={Boolean(errors?.reason)}
                    aria-describedby={
                      errors?.reason
                        ? "member-reason-hint member-reason-error"
                        : "member-reason-hint"
                    }
                    onChange={(event) => set("reason", event.target.value)}
                  />
                  <FieldDescription id="member-reason-hint">
                    {t(($) => $.memberProfile.reasonHint)}
                  </FieldDescription>
                  <FieldError id="member-reason-error">{errors?.reason}</FieldError>
                </Field>
              )}
              {sale && (
                <FieldSet>
                  <FieldLegend>{t(($) => $.memberProfile.paymentPlan)}</FieldLegend>
                  <RadioGroup
                    aria-label={t(($) => $.memberProfile.paymentPlan)}
                    value={draft.collectAfterSale ? "collect" : "debt"}
                    isDisabled={pending || readOnly}
                    onChange={(value) => set("collectAfterSale", value === "collect")}
                  >
                    {(["debt", "collect"] as const).map((key) => (
                      <Field key={key} orientation="horizontal">
                        <RadioGroupItem
                          id={`member-payment-${key}`}
                          value={key}
                          aria-labelledby={`member-payment-label-${key}`}
                        />
                        <div>
                          <FieldLabel
                            id={`member-payment-label-${key}`}
                            htmlFor={`member-payment-${key}`}
                          >
                            {t(($) => $.memberProfile.paymentChoices[key])}
                          </FieldLabel>
                          <FieldDescription>
                            {t(($) => $.memberProfile.paymentDetails[key])}
                          </FieldDescription>
                        </div>
                      </Field>
                    ))}
                  </RadioGroup>
                </FieldSet>
              )}
              <p className="text-xs text-muted-foreground">
                {t(($) => $.memberProfile.nativeEffectsHint)}
              </p>
            </FieldGroup>
          </form>
        ) : (
          <>
            <section aria-label={t(($) => $.memberProfile.effects)}>
              <h3 ref={reviewHeading} tabIndex={-1} className="mb-3 text-sm font-semibold">
                {t(($) => $.memberProfile.effects)}
              </h3>
              <ItemGroup>
                {effects.map((row) => (
                  <Item key={row.id} role="listitem" variant="outline">
                    <ItemContent>
                      <ItemTitle>{row.label}</ItemTitle>
                      {row.detail && <ItemDescription>{row.detail}</ItemDescription>}
                    </ItemContent>
                    <span className="text-sm font-medium tabular-nums">{row.value}</span>
                  </Item>
                ))}
              </ItemGroup>
              {effects.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.memberProfile.effectsRequired)}
                </p>
              )}
            </section>
            <Field orientation="horizontal">
              <Checkbox
                id="member-accepted"
                name="accepted"
                aria-labelledby="member-accepted-label"
                isSelected={accepted}
                isDisabled={pending || readOnly}
                onChange={onAccepted}
              />
              <FieldLabel id="member-accepted-label" htmlFor="member-accepted">
                {t(($) => $.memberProfile.accepted)}
              </FieldLabel>
            </Field>
          </>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          variant="outline"
          isDisabled={pending}
          onPress={stage === "review" ? onBack : onClose}
        >
          {t(($) => (stage === "review" ? $.memberProfile.backToEdit : $.memberProfile.cancel))}
        </Button>
        {stage === "edit" ? (
          <Button
            type="submit"
            form="member-lifecycle-form"
            isDisabled={
              !onReview || pending || readOnly || (action === "change" && !inventoryAvailable)
            }
          >
            {t(($) => $.memberProfile.review)}
          </Button>
        ) : (
          <Button onPress={onConfirm} isDisabled={!onConfirm || !accepted || pending || readOnly}>
            {t(($) => $.memberProfile.confirm)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
export function MemberStateDialog({
  action,
  name,
  reason,
  notice,
  pending,
  readOnly = false,
  completed = false,
  reasonError,
  onReason,
  onClose,
  onConfirm,
}: {
  action: "activate" | "deactivate" | "cancelReservation";
  name: string;
  reason: string;
  notice?: ReactNode;
  pending: boolean;
  readOnly?: boolean;
  completed?: boolean;
  reasonError?: string;
  onReason: (value: string) => void;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const { t } = useTranslation(),
    reasonInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (reasonError) reasonInput.current?.focus();
  }, [reasonError]);
  return (
    <AlertDialog
      isOpen
      className="max-h-[calc(100dvh-2rem)] [grid-template-rows:auto_minmax(0,1fr)_auto]"
      isKeyboardDismissDisabled={pending}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t(($) => $.memberProfile.titles[action])}</AlertDialogTitle>
        <AlertDialogDescription>{name}</AlertDialogDescription>
      </AlertDialogHeader>
      <div
        role="region"
        aria-label={t(($) => $.memberProfile.titles[action])}
        tabIndex={0}
        className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 [overscroll-behavior:contain]"
      >
        <form
          id="member-state-form"
          method="post"
          noValidate
          aria-label={t(($) => $.memberProfile.titles[action])}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending) onConfirm?.();
          }}
        >
          {notice}
          {action !== "activate" && (
            <Field data-invalid={Boolean(reasonError)}>
              <FieldLabel htmlFor="member-state-reason">
                {t(($) => $.memberProfile.reason)}
              </FieldLabel>
              <Textarea
                ref={reasonInput}
                id="member-state-reason"
                name="reason"
                required
                disabled={pending || readOnly}
                aria-invalid={Boolean(reasonError)}
                aria-describedby={
                  reasonError
                    ? "member-state-reason-hint member-state-reason-error"
                    : "member-state-reason-hint"
                }
                value={reason}
                onChange={(event) => onReason(event.target.value)}
              />
              <FieldDescription id="member-state-reason-hint">
                {t(($) => $.memberProfile.stateHint)}
              </FieldDescription>
              <FieldError id="member-state-reason-error">{reasonError}</FieldError>
            </Field>
          )}
        </form>
      </div>
      <AlertDialogFooter>
        <Button variant="outline" autoFocus isDisabled={pending} onPress={onClose}>
          {t(($) => (completed ? $.memberProfile.close : $.memberProfile.cancel))}
        </Button>
        {!completed && (
          <Button
            variant={action === "activate" ? "default" : "destructive"}
            isDisabled={
              !onConfirm ||
              pending ||
              (action !== "activate" && action !== "cancelReservation" && !reason.trim())
            }
            type="submit"
            form="member-state-form"
          >
            {t(($) => $.memberProfile.actions[action])}
          </Button>
        )}
      </AlertDialogFooter>
    </AlertDialog>
  );
}
