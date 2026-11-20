import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import type { ScheduleChoice } from "./schedule-view";
import type { ClientScope } from "../../lib/scoped-backend";
import { PreparationPicker } from "../settings/preparation-picker";

export interface ScheduleCreateDraft {
  mode: "single" | "weekly";
  classId: string;
  instructorId: string;
  roomId: string;
  capacity: string;
  capacityCategories?: { male: string; female: string };
  date: string;
  time: string;
  duration: string;
  weeks: string;
  weekdays: string[];
  offset: string;
  format?: "group" | "private";
  offsets?: Record<string, string>;
}
export interface SchedulePreviewRow {
  id: string;
  title: string;
  detail: string;
  blocked: boolean;
}
const weekdays = [
  ["1", "monday"],
  ["2", "tuesday"],
  ["3", "wednesday"],
  ["4", "thursday"],
  ["5", "friday"],
  ["6", "saturday"],
  ["7", "sunday"],
] as const;
export function ScheduleCreateSheet({
  open,
  scope,
  timezone,
  draft,
  classes,
  rooms,
  instructors,
  offsetChoices = [],
  offsetRequests = [],
  preview = [],
  notice,
  error,
  locked = false,
  onClose,
  onDraft,
  onSubmit,
  onApply,
  recoveryActions,
}: {
  open: boolean;
  scope: ClientScope;
  timezone: string;
  draft: ScheduleCreateDraft;
  classes: ScheduleChoice[];
  rooms: ScheduleChoice[];
  instructors: ScheduleChoice[];
  offsetChoices?: ScheduleChoice[];
  offsetRequests?: { date: string; choices: ScheduleChoice[] }[];
  preview?: SchedulePreviewRow[];
  notice?: string;
  error?: string;
  locked?: boolean;
  onClose: () => void;
  onDraft?: (draft: ScheduleCreateDraft) => void;
  onSubmit?: () => void;
  onApply?: () => void;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof ScheduleCreateDraft>(key: K, value: ScheduleCreateDraft[K]) =>
    onDraft?.({ ...draft, [key]: value });
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
        <SheetTitle>
          {draft.mode === "single"
            ? t(($) => $.schedule.singleTitle)
            : t(($) => $.schedule.seriesTitle)}
        </SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{t(($) => $.schedule.timezone, { timezone })}</SheetDescription>
        </Text>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <form
          id="schedule-create"
          method="post"
          aria-label={t(($) => $.schedule.add)}
          aria-busy={locked}
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked) onSubmit?.();
          }}
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>{t(($) => $.schedule.sessionMode)}</FieldLabel>
              <ToggleGroup
                variant="segmented"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[draft.mode]}
                isDisabled={locked || !onDraft}
                aria-label={t(($) => $.schedule.sessionMode)}
                onSelectionChange={(keys) => {
                  const mode = [...keys][0];
                  if (mode === "single" || mode === "weekly") set("mode", mode);
                }}
              >
                <ToggleGroupItem id="single">{t(($) => $.schedule.single)}</ToggleGroupItem>
                <ToggleGroupItem id="weekly">{t(($) => $.schedule.weekly)}</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {draft.mode === "weekly"
                  ? t(($) => $.schedule.seriesHint)
                  : t(($) => $.schedule.singleHint)}
              </FieldDescription>
            </Field>
            {open && draft.mode === "weekly" && (
              <PreparationPicker
                scope={scope}
                kind="program"
                disabled={locked || !onDraft}
                onApply={(preparation) => {
                  if (preparation.kind !== "program") return;
                  const defaults = preparation.defaults;
                  const categories = defaults.capacity.categories;
                  onDraft?.({
                    ...draft,
                    time: defaults.local_start,
                    duration: String(defaults.duration_minutes),
                    weekdays: defaults.weekdays.map(String),
                    capacity: String(defaults.capacity.total),
                    capacityCategories: categories
                      ? { male: String(categories.male), female: String(categories.female) }
                      : undefined,
                  });
                }}
              />
            )}
            <FieldGroup className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="schedule-create-class">
                  {t(($) => $.schedule.classLabel)}
                </FieldLabel>
                <NativeSelect
                  id="schedule-create-class"
                  name="class"
                  required
                  value={draft.classId}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("classId", event.target.value)}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {classes.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-create-instructor">
                  {t(($) => $.schedule.instructor)}
                </FieldLabel>
                <NativeSelect
                  id="schedule-create-instructor"
                  name="instructor"
                  required
                  value={draft.instructorId}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("instructorId", event.target.value)}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {instructors.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-create-room">{t(($) => $.schedule.room)}</FieldLabel>
                <NativeSelect
                  id="schedule-create-room"
                  name="room"
                  required
                  value={draft.roomId}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("roomId", event.target.value)}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {rooms.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              {draft.mode === "single" && (
                <Field>
                  <FieldLabel htmlFor="schedule-create-format">
                    {t(($) => $.schedule.format)}
                  </FieldLabel>
                  <NativeSelect
                    id="schedule-create-format"
                    name="format"
                    required
                    value={draft.format ?? ""}
                    disabled={locked || !onDraft}
                    onChange={(event) => {
                      const format = event.target.value;
                      if (format === "group" || format === "private") set("format", format);
                    }}
                  >
                    <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                    <NativeSelectOption value="group">
                      {t(($) => $.schedule.formats.group)}
                    </NativeSelectOption>
                    <NativeSelectOption value="private">
                      {t(($) => $.schedule.formats.private)}
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="schedule-create-capacity">
                  {t(($) => $.schedule.capacity)}
                </FieldLabel>
                <Input
                  id="schedule-create-capacity"
                  name="capacity"
                  type="number"
                  min={0}
                  required
                  value={draft.capacity}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("capacity", event.target.value)}
                />
              </Field>
              {draft.mode === "weekly" && draft.capacityCategories && (
                <>
                  {(["male", "female"] as const).map((category) => (
                    <Field key={category}>
                      <FieldLabel htmlFor={`schedule-create-capacity-${category}`}>
                        {t(($) => $.schedule.capacityCategories[category])}
                      </FieldLabel>
                      <Input
                        id={`schedule-create-capacity-${category}`}
                        type="number"
                        min={0}
                        required
                        value={draft.capacityCategories?.[category]}
                        disabled={locked || !onDraft}
                        onChange={(event) => {
                          if (draft.capacityCategories)
                            set("capacityCategories", {
                              ...draft.capacityCategories,
                              [category]: event.target.value,
                            });
                        }}
                      />
                    </Field>
                  ))}
                </>
              )}
              <Field>
                <FieldLabel htmlFor="schedule-create-date">
                  {draft.mode === "weekly"
                    ? t(($) => $.schedule.firstDate)
                    : t(($) => $.schedule.date)}
                </FieldLabel>
                <Input
                  id="schedule-create-date"
                  name="date"
                  type="date"
                  required
                  value={draft.date}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("date", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-create-time">{t(($) => $.schedule.start)}</FieldLabel>
                <Input
                  id="schedule-create-time"
                  name="time"
                  type="time"
                  step={draft.mode === "weekly" ? 1 : 60}
                  required
                  value={draft.time}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("time", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-create-duration">
                  {t(($) => $.schedule.duration)}
                </FieldLabel>
                <Input
                  id="schedule-create-duration"
                  name="duration"
                  type="number"
                  min={1}
                  required={draft.mode === "single"}
                  aria-describedby="schedule-create-duration-hint"
                  value={draft.duration}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("duration", event.target.value)}
                />
                <FieldDescription id="schedule-create-duration-hint">
                  {draft.mode === "weekly"
                    ? t(($) => $.schedule.seriesDurationHint)
                    : t(($) => $.schedule.minutes)}
                </FieldDescription>
              </Field>
              {draft.mode === "weekly" && (
                <Field>
                  <FieldLabel htmlFor="schedule-create-weeks">
                    {t(($) => $.schedule.seriesLength)}
                  </FieldLabel>
                  <Input
                    id="schedule-create-weeks"
                    name="weeks"
                    type="number"
                    min={1}
                    required
                    value={draft.weeks}
                    disabled={locked || !onDraft}
                    onChange={(event) => set("weeks", event.target.value)}
                  />
                  <FieldDescription>{t(($) => $.schedule.weeks)}</FieldDescription>
                </Field>
              )}
            </FieldGroup>
            {draft.mode === "weekly" && (
              <Field>
                <FieldLabel>{t(($) => $.schedule.whichDays)}</FieldLabel>
                <ToggleGroup
                  selectionMode="multiple"
                  variant="outline"
                  selectedKeys={draft.weekdays}
                  isDisabled={locked || !onDraft}
                  aria-label={t(($) => $.schedule.whichDays)}
                  className="w-full flex-wrap"
                  onSelectionChange={(keys) => set("weekdays", [...keys].map(String))}
                >
                  {weekdays.map(([id, key]) => (
                    <ToggleGroupItem id={id} key={id}>
                      {t(($) => $.schedule.weekdays[key])}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            )}
            {offsetRequests.map((request) => (
              <Field key={request.date}>
                <FieldLabel htmlFor={`schedule-offset-${request.date}`}>
                  {t(($) => $.schedule.offsetForDate, { date: request.date })}
                </FieldLabel>
                <NativeSelect
                  id={`schedule-offset-${request.date}`}
                  required
                  value={draft.offsets?.[request.date] ?? ""}
                  disabled={locked || !onDraft}
                  onChange={(event) =>
                    set("offsets", { ...draft.offsets, [request.date]: event.target.value })
                  }
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {request.choices.map((choice) => (
                    <NativeSelectOption key={choice.id} value={choice.id}>
                      {choice.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>{t(($) => $.schedule.offsetHint)}</FieldDescription>
              </Field>
            ))}
            {offsetRequests.length === 0 && offsetChoices.length > 0 && (
              <Field>
                <FieldLabel htmlFor="schedule-create-offset">
                  {t(($) => $.schedule.offset)}
                </FieldLabel>
                <NativeSelect
                  id="schedule-create-offset"
                  name="offset"
                  required
                  value={draft.offset}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("offset", event.target.value)}
                >
                  <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                  {offsetChoices.map((offset) => (
                    <NativeSelectOption key={offset.id} value={offset.id}>
                      {offset.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>{t(($) => $.schedule.offsetHint)}</FieldDescription>
              </Field>
            )}
          </FieldGroup>
        </form>
        {preview.length > 0 && (
          <section
            className="mt-4 flex flex-col gap-2"
            aria-label={t(($) => $.schedule.resultingSessions)}
          >
            <h3 className="text-sm font-medium">{t(($) => $.schedule.resultingSessions)}</h3>
            <ItemGroup className="gap-0">
              {preview.map((row) => (
                <Item key={row.id} role="listitem" variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{row.title}</ItemTitle>
                    <ItemDescription className={row.blocked ? "text-destructive" : undefined}>
                      {row.detail}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </section>
        )}
        {recoveryActions}
        {error && (
          <Alert variant="destructive" role="alert" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert role="status" className="mt-4">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t(($) => $.schedule.createNotice)}</p>
      </div>
      <SheetFooter className="flex-row flex-wrap justify-end">
        <Button variant="outline" onPress={onClose} isDisabled={locked}>
          {t(($) => $.people.cancel)}
        </Button>
        <Button type="submit" form="schedule-create" isDisabled={locked || !onSubmit}>
          {draft.mode === "weekly"
            ? t(($) => $.schedule.previewSessions)
            : t(($) => $.schedule.createSingle)}
        </Button>
        {onApply && (
          <Button onPress={onApply} isDisabled={locked || preview.some((row) => row.blocked)}>
            {t(($) => $.schedule.createSeries)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
