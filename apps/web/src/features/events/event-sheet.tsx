import { useId, useRef, useEffect, type ReactNode } from "react";
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
  FieldSet,
  FieldLegend,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Switch } from "@ftksaas/ui/components/switch";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { EventTermsFields, type EventChoice } from "./event-terms-fields";
import type { EventDraft } from "./event-draft";

export function EventSheet({
  draft,
  onDraft,
  onClose,
  onSubmit,
  rooms,
  products,
  people,
  disciplines,
  editing = false,
  locked = false,
  notice,
  startOffsets = [],
  endOffsets = [],
  errors,
  readOnly = false,
  productsFooter,
  preparationPicker,
}: {
  draft: EventDraft;
  onDraft: (value: EventDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
  rooms: EventChoice[];
  products: EventChoice[];
  people: EventChoice[];
  disciplines: EventChoice[];
  editing?: boolean;
  locked?: boolean;
  notice?: ReactNode;
  startOffsets?: EventChoice[];
  endOffsets?: EventChoice[];
  errors?: string;
  readOnly?: boolean;
  productsFooter?: ReactNode;
  preparationPicker?: ReactNode;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const disabled = locked || readOnly;
  useEffect(() => {
    if (errors) errorRef.current?.focus();
  }, [errors]);
  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    onDraft({ ...draft, [key]: value, reviewed: false });
  }
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
    >
      <SheetHeader>
        <SheetTitle>{editing ? t(($) => $.events.editor.edit) : t(($) => $.events.add)}</SheetTitle>
        <SheetDescription>{t(($) => $.events.editor.description)}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {notice}
        {preparationPicker}
        <form
          id={formId}
          method="post"
          noValidate
          aria-label={t(($) => $.events.editor.form)}
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled) onSubmit();
          }}
          className="flex flex-col gap-5"
        >
          <Field>
            <FieldLabel htmlFor="event-name">{t(($) => $.events.editor.name)}</FieldLabel>
            <Input
              id="event-name"
              name="name"
              autoComplete="off"
              value={draft.name}
              disabled={disabled}
              onChange={(event) => set("name", event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel>{t(($) => $.events.editor.kind)}</FieldLabel>
            <ToggleGroup
              selectionMode="single"
              disallowEmptySelection
              aria-label={t(($) => $.events.editor.kind)}
              variant="segmented"
              selectedKeys={[draft.kind]}
              onSelectionChange={(keys) => {
                const kind = [...keys][0];
                if (kind === "workshop" || kind === "practice")
                  onDraft({
                    ...draft,
                    kind,
                    ...(kind === "practice" ? { fee: "0" } : {}),
                    reviewed: false,
                  });
              }}
            >
              <ToggleGroupItem id="workshop" isDisabled={disabled}>
                {t(($) => $.events.editor.workshop)}
              </ToggleGroupItem>
              <ToggleGroupItem id="practice" isDisabled={disabled}>
                {t(($) => $.events.editor.practice)}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <FieldSet>
            <FieldLegend variant="label">{t(($) => $.events.editor.disciplines)}</FieldLegend>
            {disciplines.map((row) => (
              <Field key={row.id} orientation="horizontal">
                <Checkbox
                  id={`event-discipline-${row.id}`}
                  name="discipline_ids"
                  value={row.id}
                  isSelected={draft.disciplineIds.includes(row.id)}
                  isDisabled={disabled}
                  onChange={(value) =>
                    set(
                      "disciplineIds",
                      value
                        ? [...draft.disciplineIds, row.id]
                        : draft.disciplineIds.filter((id) => id !== row.id),
                    )
                  }
                />
                <FieldLabel htmlFor={`event-discipline-${row.id}`}>{row.name}</FieldLabel>
              </Field>
            ))}
          </FieldSet>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["starts", "ends"] as const).map((key) => (
              <Field key={key}>
                <FieldLabel htmlFor={`event-${key}`}>{t(($) => $.events.editor[key])}</FieldLabel>
                <Input
                  id={`event-${key}`}
                  name={key}
                  type="datetime-local"
                  value={draft[key]}
                  disabled={disabled}
                  onChange={(event) =>
                    onDraft({
                      ...draft,
                      [key]: event.target.value,
                      [key === "starts" ? "startOffset" : "endOffset"]: "",
                      reviewed: false,
                    })
                  }
                  required
                />
              </Field>
            ))}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="event-timezone">{t(($) => $.events.editor.timezone)}</FieldLabel>
              <Input
                id="event-timezone"
                name="timezone"
                autoCapitalize="none"
                spellCheck={false}
                value={draft.timezone}
                disabled={disabled}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    timezone: event.target.value,
                    startOffset: "",
                    endOffset: "",
                    reviewed: false,
                  })
                }
                required
              />
              <FieldDescription>{t(($) => $.events.editor.timezoneHint)}</FieldDescription>
            </Field>
            {(
              [
                { key: "startOffset", choices: startOffsets },
                { key: "endOffset", choices: endOffsets },
              ] as const
            )
              .filter((row) => row.choices.length > 0)
              .map((row) => (
                <Field key={row.key}>
                  <FieldLabel htmlFor={`event-${row.key}`}>
                    {t(($) => $.events.editor[row.key])}
                  </FieldLabel>
                  <NativeSelect
                    id={`event-${row.key}`}
                    name={row.key}
                    value={draft[row.key]}
                    disabled={disabled}
                    onChange={(event) => set(row.key, event.target.value)}
                    className="w-full"
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.events.editor.choose)}
                    </NativeSelectOption>
                    {row.choices.map((choice) => (
                      <NativeSelectOption key={choice.id} value={choice.id}>
                        {choice.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ))}
          </FieldGroup>
          <Field>
            <FieldLabel>{t(($) => $.events.editor.venue)}</FieldLabel>
            <ToggleGroup
              selectionMode="single"
              disallowEmptySelection
              aria-label={t(($) => $.events.editor.venue)}
              variant="segmented"
              selectedKeys={[draft.venueKind]}
              onSelectionChange={(keys) => {
                const venueKind = [...keys][0];
                if (venueKind === "internal" || venueKind === "external")
                  onDraft({
                    ...draft,
                    venueKind,
                    ...(venueKind === "internal" ? { unlimited: false } : {}),
                    reviewed: false,
                  });
              }}
            >
              <ToggleGroupItem id="internal" isDisabled={disabled}>
                {t(($) => $.events.editor.internal)}
              </ToggleGroupItem>
              <ToggleGroupItem id="external" isDisabled={disabled}>
                {t(($) => $.events.editor.external)}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          {draft.venueKind === "internal" ? (
            <Field>
              <FieldLabel htmlFor="event-room">{t(($) => $.events.editor.internal)}</FieldLabel>
              <NativeSelect
                id="event-room"
                name="room_id"
                value={draft.roomId}
                disabled={disabled}
                onChange={(event) => set("roomId", event.target.value)}
                className="w-full"
              >
                <NativeSelectOption value="">{t(($) => $.events.editor.choose)}</NativeSelectOption>
                {rooms.map((room) => (
                  <NativeSelectOption key={room.id} value={room.id}>
                    {room.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="event-venue-name">
                  {t(($) => $.events.editor.venueName)}
                </FieldLabel>
                <Input
                  id="event-venue-name"
                  name="venue_name"
                  value={draft.venueName}
                  disabled={disabled}
                  onChange={(event) => set("venueName", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="event-address">{t(($) => $.events.editor.address)}</FieldLabel>
                <Textarea
                  id="event-address"
                  name="address"
                  value={draft.address}
                  disabled={disabled}
                  onChange={(event) => set("address", event.target.value)}
                />
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id="event-unlimited"
                  name="unlimited"
                  isSelected={draft.unlimited}
                  isDisabled={disabled}
                  onChange={(value) => set("unlimited", value)}
                  aria-label={t(($) => $.events.editor.unlimited)}
                />
                <FieldLabel htmlFor="event-unlimited">
                  {t(($) => $.events.editor.unlimited)}
                </FieldLabel>
              </Field>
            </>
          )}
          {!draft.unlimited && (
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(["nominal", "maximum"] as const).map((key) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`event-${key}`}>{t(($) => $.events.editor[key])}</FieldLabel>
                  <Input
                    id={`event-${key}`}
                    name={key}
                    inputMode="numeric"
                    value={draft[key]}
                    disabled={disabled}
                    onChange={(event) => set(key, event.target.value)}
                    required
                  />
                </Field>
              ))}
            </FieldGroup>
          )}
          <EventTermsFields
            draft={draft}
            onDraft={onDraft}
            products={products}
            people={people}
            disabled={disabled}
            productsFooter={productsFooter}
          />
          <Alert>
            <AlertDescription>{t(($) => $.events.editor.effect)}</AlertDescription>
          </Alert>
          <Field orientation="horizontal">
            <Checkbox
              id="event-reviewed"
              name="reviewed"
              isSelected={draft.reviewed}
              isDisabled={disabled}
              onChange={(value) => onDraft({ ...draft, reviewed: value })}
            />
            <FieldLabel htmlFor="event-reviewed">{t(($) => $.events.editor.review)}</FieldLabel>
          </Field>
          {errors && (
            <Alert ref={errorRef} variant="destructive" tabIndex={-1}>
              <AlertDescription>{errors}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
      <SheetFooter className="flex-wrap">
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.events.editor.cancel)}
        </Button>
        <Button type="submit" form={formId} isDisabled={disabled || !draft.reviewed}>
          {t(($) => $.events.editor.save)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
