import { useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
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
  AlertDialogCancel,
} from "../../components/ui/alert-dialog";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import type { BookingCategory, BookingMode } from "../../lib/api-contracts/generated";

export interface SessionBookingDraft {
  query: string;
  personId: string;
  saleId: string;
  mode: BookingMode;
  category: BookingCategory | "";
  override: boolean;
  reason: string;
  reviewed: boolean;
}
export function SessionBookingSheet({
  open,
  waitlist,
  title,
  draft,
  people,
  sales,
  canOverride,
  onDraft,
  onSearch,
  onClose,
  onSubmit,
  locked,
  notice,
  recovery,
  peoplePagination,
}: {
  open: boolean;
  waitlist: boolean;
  title: string;
  draft: SessionBookingDraft;
  people: { id: string; label: string }[];
  sales: { id: string; label: string }[];
  canOverride: boolean;
  onDraft: (draft: SessionBookingDraft) => void;
  onSearch: () => void;
  onClose: () => void;
  onSubmit?: () => void;
  locked?: boolean;
  notice?: ReactNode;
  recovery?: ReactNode;
  peoplePagination?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  function set<K extends keyof SessionBookingDraft>(key: K, value: SessionBookingDraft[K]) {
    onDraft({ ...draft, [key]: value, reviewed: key === "reviewed" ? Boolean(value) : false });
  }
  return (
    <Sheet
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      isKeyboardDismissDisabled={locked}
      isDismissable={!locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle>
          {t(($) => (waitlist ? $.sessionDetail.addWaitlist : $.sessionDetail.addParticipant))}
        </SheetTitle>
        <SheetDescription>
          {title} · {t(($) => $.sessionDetail.addDescription)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <form
          aria-label={t(($) => $.sessionDetail.personSearch)}
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-query`}>
                {t(($) => $.sessionDetail.personSearch)}
              </FieldLabel>
              <Input
                id={`${id}-query`}
                name="query"
                type="search"
                autoCapitalize="none"
                spellCheck={false}
                value={draft.query}
                onChange={(event) => set("query", event.target.value)}
                disabled={locked}
              />
            </Field>
            <Button type="submit" variant="outline" isDisabled={locked}>
              {t(($) => $.sessionDetail.search)}
            </Button>
          </FieldGroup>
        </form>
        {peoplePagination}
        {notice}
        <form
          id={`${id}-booking`}
          aria-label={t(($) =>
            waitlist ? $.sessionDetail.addWaitlist : $.sessionDetail.addParticipant,
          )}
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked) onSubmit?.();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-person`}>{t(($) => $.sessionDetail.person)}</FieldLabel>
              <NativeSelect
                id={`${id}-person`}
                className="w-full"
                value={draft.personId}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    personId: event.target.value,
                    saleId: "",
                    override: false,
                    reason: "",
                    reviewed: false,
                  })
                }
                disabled={locked}
              >
                <NativeSelectOption value="">
                  {t(($) => $.sessionDetail.choosePerson)}
                </NativeSelectOption>
                {people.map((person) => (
                  <NativeSelectOption key={person.id} value={person.id}>
                    {person.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {!waitlist && (
              <>
                <Field>
                  <FieldLabel htmlFor={`${id}-sale`}>{t(($) => $.sessionDetail.sale)}</FieldLabel>
                  <NativeSelect
                    id={`${id}-sale`}
                    className="w-full"
                    value={draft.saleId}
                    onChange={(event) => set("saleId", event.target.value)}
                    disabled={locked || !draft.personId}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.sessionDetail.chooseSale)}
                    </NativeSelectOption>
                    {sales.map((sale) => (
                      <NativeSelectOption key={sale.id} value={sale.id}>
                        {sale.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-mode`}>{t(($) => $.sessionDetail.mode)}</FieldLabel>
                  <NativeSelect
                    id={`${id}-mode`}
                    value={draft.mode}
                    disabled={locked}
                    onChange={(event) => {
                      if (event.target.value === "flexible" || event.target.value === "priority")
                        set("mode", event.target.value);
                    }}
                  >
                    <NativeSelectOption value="flexible">
                      {t(($) => $.sessionDetail.flexible)}
                    </NativeSelectOption>
                    <NativeSelectOption value="priority">
                      {t(($) => $.sessionDetail.priority)}
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor={`${id}-category`}>
                {t(($) => $.sessionDetail.category)}
              </FieldLabel>
              <NativeSelect
                id={`${id}-category`}
                value={draft.category}
                disabled={locked}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "" || value === "male" || value === "female")
                    set("category", value);
                }}
              >
                <NativeSelectOption value="">
                  {t(($) => $.sessionDetail.noCategory)}
                </NativeSelectOption>
                <NativeSelectOption value="male">
                  {t(($) => $.sessionDetail.male)}
                </NativeSelectOption>
                <NativeSelectOption value="female">
                  {t(($) => $.sessionDetail.female)}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            {!waitlist && canOverride && (
              <FieldSet>
                <FieldLegend>{t(($) => $.sessionDetail.capacity)}</FieldLegend>
                <Field orientation="horizontal">
                  <Checkbox
                    id={`${id}-override`}
                    isSelected={draft.override}
                    isDisabled={locked}
                    onChange={(value) => set("override", value)}
                  />
                  <FieldLabel htmlFor={`${id}-override`}>
                    {t(($) => $.sessionDetail.capacityOverride)}
                  </FieldLabel>
                </Field>
                <FieldDescription>{t(($) => $.sessionDetail.overrideHint)}</FieldDescription>
                {draft.override && (
                  <Field>
                    <FieldLabel htmlFor={`${id}-reason`}>
                      {t(($) => $.sessionDetail.reason)}
                    </FieldLabel>
                    <Textarea
                      id={`${id}-reason`}
                      value={draft.reason}
                      disabled={locked}
                      onChange={(event) => set("reason", event.target.value)}
                    />
                  </Field>
                )}
              </FieldSet>
            )}
            <Field orientation="horizontal">
              <Checkbox
                id={`${id}-review`}
                isSelected={draft.reviewed}
                isDisabled={locked || !draft.personId || (!waitlist && !draft.saleId)}
                onChange={(value) => set("reviewed", value)}
              />
              <FieldLabel htmlFor={`${id}-review`}>
                {t(($) => (waitlist ? $.sessionDetail.waitlistReview : $.sessionDetail.review))}
              </FieldLabel>
            </Field>
          </FieldGroup>
        </form>
        {recovery}
      </div>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.sessionDetail.cancel)}
        </Button>
        <Button
          type="submit"
          form={`${id}-booking`}
          isDisabled={
            locked ||
            !onSubmit ||
            !draft.reviewed ||
            !draft.personId ||
            (!waitlist && !draft.saleId) ||
            (!waitlist && draft.override && (!canOverride || !draft.reason.trim()))
          }
        >
          {t(($) => (waitlist ? $.sessionDetail.joinWaitlist : $.sessionDetail.createReservation))}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

export function SessionAttendanceClose({
  open,
  performed,
  instructors,
  selectedInstructors,
  reviewed,
  onPerformed,
  onInstructors,
  onReviewed,
  onClose,
  onSubmit,
  locked,
  notice,
  recovery,
}: {
  open: boolean;
  performed: boolean;
  instructors: { id: string; name: string }[];
  selectedInstructors: string[];
  reviewed: boolean;
  onPerformed: (value: boolean) => void;
  onInstructors: (ids: string[]) => void;
  onReviewed: (value: boolean) => void;
  onClose: () => void;
  onSubmit?: () => void;
  locked?: boolean;
  notice?: ReactNode;
  recovery?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId(),
    safe = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onEnter={() => safe.current?.focus()}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t(($) => $.sessionDetail.closeTitle)}</AlertDialogTitle>
        <AlertDialogDescription>
          {t(($) => $.sessionDetail.closeDescription)}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id={`${id}-performed`}
            isSelected={performed}
            isDisabled={locked}
            onChange={onPerformed}
          />
          <FieldLabel htmlFor={`${id}-performed`}>{t(($) => $.sessionDetail.performed)}</FieldLabel>
        </Field>
        {performed && (
          <FieldSet>
            <FieldLegend>{t(($) => $.sessionDetail.performedTeachers)}</FieldLegend>
            {instructors.map((person) => (
              <Field key={person.id} orientation="horizontal">
                <Checkbox
                  id={`${id}-${person.id}`}
                  isSelected={selectedInstructors.includes(person.id)}
                  isDisabled={locked}
                  onChange={(value) =>
                    onInstructors(
                      value
                        ? [...selectedInstructors, person.id]
                        : selectedInstructors.filter((item) => item !== person.id),
                    )
                  }
                />
                <FieldLabel htmlFor={`${id}-${person.id}`}>{person.name}</FieldLabel>
              </Field>
            ))}
          </FieldSet>
        )}
        <Field orientation="horizontal">
          <Checkbox
            id={`${id}-review`}
            isSelected={reviewed}
            isDisabled={locked}
            onChange={onReviewed}
          />
          <FieldLabel htmlFor={`${id}-review`}>{t(($) => $.sessionDetail.closeReview)}</FieldLabel>
        </Field>
      </FieldGroup>
      {notice}
      {recovery}
      <AlertDialogFooter>
        <AlertDialogCancel ref={safe} autoFocus isDisabled={locked} onPress={onClose}>
          {t(($) => $.sessionDetail.cancel)}
        </AlertDialogCancel>
        <Button isDisabled={locked || !reviewed || !onSubmit} onPress={onSubmit}>
          {t(($) => $.sessionDetail.closeAttendance)}
        </Button>
      </AlertDialogFooter>
    </AlertDialog>
  );
}

export function SessionAttendanceStart({
  open,
  reason,
  accepted,
  locked,
  onReason,
  onAccepted,
  onClose,
  onSubmit,
  notice,
  recovery,
}: {
  open: boolean;
  reason: string;
  accepted: boolean;
  locked: boolean;
  onReason: (value: string) => void;
  onAccepted: (value: boolean) => void;
  onClose: () => void;
  onSubmit?: () => void;
  notice?: ReactNode;
  recovery?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId(),
    safe = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      isOpen={open}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
      onEnter={() => safe.current?.focus()}
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{t(($) => $.sessionDetail.startAttendance)}</AlertDialogTitle>
        <AlertDialogDescription>
          {t(($) => $.sessionDetail.startDescription)}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <form
        id={`${id}-start`}
        method="post"
        aria-label={t(($) => $.sessionDetail.startAttendance)}
        onSubmit={(event) => {
          event.preventDefault();
          if (!locked && accepted && reason.trim()) onSubmit?.();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-reason`}>{t(($) => $.sessionDetail.reason)}</FieldLabel>
            <Textarea
              id={`${id}-reason`}
              name="reason"
              required
              value={reason}
              disabled={locked}
              onChange={(event) => onReason(event.target.value)}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id={`${id}-review`}
              isSelected={accepted}
              isDisabled={locked}
              onChange={onAccepted}
            />
            <FieldLabel htmlFor={`${id}-review`}>
              {t(($) => $.sessionDetail.startReview)}
            </FieldLabel>
          </Field>
        </FieldGroup>
      </form>
      {notice}
      {recovery}
      <AlertDialogFooter>
        <AlertDialogCancel ref={safe} autoFocus isDisabled={locked} onPress={onClose}>
          {t(($) => $.sessionDetail.cancel)}
        </AlertDialogCancel>
        <Button
          type="submit"
          form={`${id}-start`}
          isDisabled={locked || !accepted || !reason.trim() || !onSubmit}
        >
          {t(($) => $.sessionDetail.startAttendance)}
        </Button>
      </AlertDialogFooter>
    </AlertDialog>
  );
}
