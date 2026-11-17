import { useRef } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { resourceSchema, type ResourceDraft, type ResourceKind } from "./studio";
import type { StudioClass } from "./studio-view";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "../../components/ui/sheet";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect } from "../../components/ui/native-select";
import { Switch } from "../../components/ui/switch";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export interface ResourceSelection {
  kind: ResourceKind;
  id?: string;
}
export function StudioResourceForm({
  selection,
  initial,
  disciplines,
  classMeta,
  busy = false,
  locked = false,
  preventClose = false,
  message,
  messageTone = "error",
  recovery,
  effects,
  onSubmit,
  onClose,
}: {
  selection: ResourceSelection;
  initial: ResourceDraft;
  disciplines: { id: string; name: string; disabled?: boolean }[];
  classMeta?: StudioClass;
  busy?: boolean;
  locked?: boolean;
  preventClose?: boolean;
  message?: string;
  messageTone?: "info" | "error";
  recovery?: { label: string; onPress: () => void };
  effects?: number;
  onSubmit?: (value: ResourceDraft) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const formElement = useRef<HTMLFormElement>(null);
  const kind = selection.kind;
  const disabled = busy || locked;
  const form = useForm({
    formId: `studio-${kind}`,
    defaultValues: initial,
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: resourceSchema(kind, {
        name: t(($) => $.studio.nameRequired),
        capacity: t(($) => $.studio.capacityInvalid),
        discipline: t(($) => $.studio.disciplineRequired),
      }),
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async ({ value }) => {
      if (!disabled && onSubmit) await onSubmit(value);
    },
  });
  const title =
    kind === "room"
      ? selection.id
        ? t(($) => $.studio.editRoom)
        : t(($) => $.studio.addRoom)
      : selection.id
        ? t(($) => $.studio.editClass)
        : t(($) => $.studio.addClass);
  return (
    <Sheet
      isOpen
      isDismissable={!preventClose}
      isKeyboardDismissDisabled={preventClose}
      onOpenChange={(open) => {
        if (!open && !preventClose) onClose();
      }}
      showCloseButton={false}
    >
      <SheetHeader className="relative pr-14">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{t(($) => $.studio.sheetDescription)}</SheetDescription>
        <SheetClose
          className="absolute top-4 right-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.studio.close)}
          isDisabled={preventClose}
        >
          <XIcon />
        </SheetClose>
      </SheetHeader>
      <form
        ref={formElement}
        id="studio-resource-editor"
        aria-label={title}
        aria-busy={busy}
        noValidate
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup className="gap-4">
          <p className="text-xs text-muted-foreground">{t(($) => $.studio.requiredFields)}</p>
          <form.Field name="name">
            {(field) => (
              <Field
                className="gap-1.5"
                data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              >
                <FieldLabel htmlFor={`${kind}-name`}>
                  {kind === "room" ? t(($) => $.studio.roomName) : t(($) => $.studio.className)}{" "}
                  <span aria-hidden="true">*</span>
                </FieldLabel>
                <Input
                  id={`${kind}-name`}
                  name="name"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="off"
                  required
                  disabled={disabled}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  aria-describedby={
                    field.state.meta.isTouched && !field.state.meta.isValid
                      ? `${kind}-name-error`
                      : undefined
                  }
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <FieldError id={`${kind}-name-error`} errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          </form.Field>
          {kind === "room" ? (
            <>
              <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
                <form.Field name="capacity">
                  {(field) => (
                    <Field
                      className="gap-1.5"
                      data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    >
                      <FieldLabel htmlFor="room-capacity">
                        {t(($) => $.studio.capacity)} <span aria-hidden="true">*</span>
                      </FieldLabel>
                      <Input
                        type="number"
                        min={0}
                        id="room-capacity"
                        name="capacity"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        required
                        disabled={disabled}
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        aria-describedby={
                          field.state.meta.isTouched && !field.state.meta.isValid
                            ? "room-capacity-error"
                            : undefined
                        }
                      />
                      {field.state.meta.isTouched && !field.state.meta.isValid && (
                        <FieldError id="room-capacity-error" errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )}
                </form.Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="room-usage">{t(($) => $.studio.usage)}</FieldLabel>
                  <NativeSelect id="room-usage" className="w-full" disabled>
                    <option>—</option>
                  </NativeSelect>
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.roomUsageHint)}
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <form.Field name="active">
                {(field) => (
                  <Field orientation="horizontal">
                    <div className="flex-1">
                      <FieldLabel id="room-active-label">{t(($) => $.studio.open)}</FieldLabel>
                      <FieldDescription variant="hint">
                        {t(($) => $.studio.roomActiveDescription)}
                      </FieldDescription>
                    </div>
                    <Switch
                      name="active"
                      aria-labelledby="room-active-label"
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      isDisabled={disabled}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.active}>
                {(active) =>
                  !active &&
                  !!effects && (
                    <Alert>
                      <AlertDescription>
                        {t(($) => $.studio.roomEffects, { count: effects })}
                      </AlertDescription>
                    </Alert>
                  )
                }
              </form.Subscribe>
            </>
          ) : (
            <>
              <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="class-duration">{t(($) => $.studio.duration)}</FieldLabel>
                  <NativeSelect
                    id="class-duration"
                    className="w-full"
                    value={classMeta?.duration ?? ""}
                    disabled
                  >
                    <option value="">—</option>
                    {[
                      ...new Set([
                        45,
                        60,
                        75,
                        90,
                        120,
                        ...(classMeta?.duration ? [classMeta.duration] : []),
                      ]),
                    ]
                      .sort((a, b) => a - b)
                      .map((value) => (
                        <option key={value} value={value}>
                          {t(($) => $.studio.minutes, { count: value })}
                        </option>
                      ))}
                  </NativeSelect>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="class-capacity">{t(($) => $.studio.capacity)}</FieldLabel>
                  <Input
                    id="class-capacity"
                    type="number"
                    value={classMeta?.capacity ?? ""}
                    disabled
                  />
                </Field>
              </FieldGroup>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="class-room">{t(($) => $.studio.defaultRoom)}</FieldLabel>
                <NativeSelect className="w-full" id="class-room" disabled>
                  <option>{classMeta?.room ?? t(($) => $.studio.chooseRoom)}</option>
                </NativeSelect>
                <FieldDescription variant="hint">
                  {t(($) => $.studio.programFieldsHint)}
                </FieldDescription>
              </Field>
              <form.Field name="disciplineId">
                {(field) => (
                  <Field
                    className="gap-1.5"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="class-discipline">
                      {t(($) => $.studio.discipline)} <span aria-hidden="true">*</span>
                    </FieldLabel>
                    <NativeSelect
                      id="class-discipline"
                      name="discipline"
                      className="w-full"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      disabled={disabled}
                      required
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.isTouched && !field.state.meta.isValid
                          ? "class-discipline-error"
                          : undefined
                      }
                    >
                      <option value="">{t(($) => $.studio.chooseDiscipline)}</option>
                      {disciplines.map((item) => (
                        <option value={item.id} key={item.id} disabled={item.disabled}>
                          {item.name}
                        </option>
                      ))}
                    </NativeSelect>
                    {field.state.meta.isTouched && !field.state.meta.isValid && (
                      <FieldError id="class-discipline-error" errors={field.state.meta.errors} />
                    )}
                  </Field>
                )}
              </form.Field>
              <form.Field name="externalOpen">
                {(field) => (
                  <Field orientation="horizontal">
                    <div className="flex-1">
                      <FieldLabel id="class-external-label">
                        {t(($) => $.studio.externalOpen)}
                      </FieldLabel>
                      <FieldDescription variant="hint">
                        {t(($) => $.studio.externalOpenDescription)}
                      </FieldDescription>
                    </div>
                    <Switch
                      name="externalOpen"
                      aria-labelledby="class-external-label"
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      isDisabled={disabled}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="waitlist">
                {(field) => (
                  <Field orientation="horizontal">
                    <div className="flex-1">
                      <FieldLabel id="class-waitlist-label">
                        {t(($) => $.studio.waitlist)}
                      </FieldLabel>
                      <FieldDescription variant="hint">
                        {t(($) => $.studio.waitlistDescription)}
                      </FieldDescription>
                    </div>
                    <Switch
                      name="waitlist"
                      aria-labelledby="class-waitlist-label"
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      isDisabled={disabled}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.waitlist}>
                {(enabled) =>
                  !enabled &&
                  !!effects && (
                    <Alert>
                      <AlertDescription>
                        {t(($) => $.studio.waitlistEffects, { count: effects })}
                      </AlertDescription>
                    </Alert>
                  )
                }
              </form.Subscribe>
            </>
          )}
          {message && (
            <Alert role="status" variant={messageTone === "error" ? "destructive" : "default"}>
              <AlertDescription className="flex flex-col items-start gap-3">
                {message}
                {recovery && (
                  <Button variant="outline" isDisabled={busy} onPress={recovery.onPress}>
                    {recovery.label}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" isDisabled={preventClose} onPress={onClose}>
          {t(($) => $.studio.cancel)}
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              form="studio-resource-editor"
              isDisabled={!onSubmit || disabled || submitting}
            >
              {selection.id
                ? t(($) => $.studio.save)
                : kind === "room"
                  ? t(($) => $.studio.createRoom)
                  : t(($) => $.studio.createClass)}
            </Button>
          )}
        </form.Subscribe>
      </SheetFooter>
    </Sheet>
  );
}
