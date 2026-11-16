import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  FieldSet,
  FieldLegend,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Switch } from "../../components/ui/switch";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
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
}) {
  const { t } = useTranslation();
  const formId = useId();
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
        <form
          id={formId}
          method="post"
          noValidate
          aria-label={t(($) => $.events.editor.form)}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
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
              disabled={locked}
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
                    ...(kind === "practice" ? { fee: "0", fullPayment: false } : {}),
                    reviewed: false,
                  });
              }}
            >
              <ToggleGroupItem id="workshop" isDisabled={locked}>
                {t(($) => $.events.editor.workshop)}
              </ToggleGroupItem>
              <ToggleGroupItem id="practice" isDisabled={locked}>
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
                  isDisabled={locked}
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
                  disabled={locked}
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
                disabled={locked}
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
                    disabled={locked}
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
              <ToggleGroupItem id="internal" isDisabled={locked}>
                {t(($) => $.events.editor.internal)}
              </ToggleGroupItem>
              <ToggleGroupItem id="external" isDisabled={locked}>
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
                disabled={locked}
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
                  disabled={locked}
                  onChange={(event) => set("venueName", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="event-address">{t(($) => $.events.editor.address)}</FieldLabel>
                <Textarea
                  id="event-address"
                  name="address"
                  value={draft.address}
                  disabled={locked}
                  onChange={(event) => set("address", event.target.value)}
                />
              </Field>
              <Field orientation="horizontal">
                <Switch
                  id="event-unlimited"
                  name="unlimited"
                  isSelected={draft.unlimited}
                  isDisabled={locked}
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
                    disabled={locked}
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
            disabled={locked}
          />
          <Alert>
            <AlertDescription>{t(($) => $.events.editor.effect)}</AlertDescription>
          </Alert>
          <Field orientation="horizontal">
            <Checkbox
              id="event-reviewed"
              name="reviewed"
              isSelected={draft.reviewed}
              isDisabled={locked}
              onChange={(value) => onDraft({ ...draft, reviewed: value })}
            />
            <FieldLabel htmlFor="event-reviewed">{t(($) => $.events.editor.review)}</FieldLabel>
          </Field>
          {errors && (
            <Alert variant="destructive" tabIndex={-1}>
              <AlertDescription>{errors}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
      <SheetFooter className="flex-wrap">
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.events.editor.cancel)}
        </Button>
        <Button type="submit" form={formId} isDisabled={locked || !draft.reviewed}>
          {t(($) => $.events.editor.save)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
