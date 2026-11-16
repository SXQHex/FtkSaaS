import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-aria-components";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import type { ScheduleChoice } from "./schedule-view";

export type SchedulePanelMode = "view" | "edit" | "instructor" | "roster" | "cancel";
export interface ScheduleSessionDraft {
  date: string;
  time: string;
  duration: string;
  capacity: string;
  roomId: string;
  instructorId: string;
  scope: "single" | "this_and_future";
  reason: string;
  note: string;
  notify: boolean;
  replacement: boolean;
  replacementDate: string;
  replacementTime: string;
  replacementRoomId: string;
  replacementOffset?: string;
  offset: string;
  selectedPeople: string[];
  addPersonId: string;
}
export interface ScheduleSessionPanel {
  title: string;
  subtitle: string;
  badges: string[];
  facts: { label: string; value: string }[];
  roster: { id: string; name: string; detail: string }[] | null;
  effects: { id: string; title: string; detail: string }[];
}
export function ScheduleSessionSheet({
  open,
  mode,
  panel,
  draft,
  rooms,
  instructors,
  offsetChoices = [],
  rosterCandidates = [],
  onAddMember,
  locked = false,
  notice,
  error,
  canFuture = false,
  canEdit = true,
  onClose,
  onMode,
  onDraft,
  onPreview,
  onApply,
  recoveryActions,
  onDetail,
  onNotify,
  cancelled = false,
  onReplacement,
  rosterContent,
  canRoster = true,
  historyContent,
}: {
  open: boolean;
  mode: SchedulePanelMode;
  panel: ScheduleSessionPanel;
  draft: ScheduleSessionDraft;
  rooms: ScheduleChoice[];
  instructors: ScheduleChoice[];
  offsetChoices?: ScheduleChoice[];
  rosterCandidates?: ScheduleChoice[];
  onAddMember?: () => void;
  locked?: boolean;
  notice?: string;
  error?: string;
  canFuture?: boolean;
  canEdit?: boolean;
  onClose: () => void;
  onMode?: (mode: SchedulePanelMode) => void;
  onDraft?: (draft: ScheduleSessionDraft) => void;
  onPreview?: () => void;
  onApply?: () => void;
  recoveryActions?: ReactNode;
  onDetail?: () => void;
  onNotify?: (notify: boolean) => void;
  cancelled?: boolean;
  onReplacement?: () => void;
  rosterContent?: ReactNode;
  canRoster?: boolean;
  historyContent?: ReactNode;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof ScheduleSessionDraft>(key: K, value: ScheduleSessionDraft[K]) =>
    onDraft?.({ ...draft, [key]: value });
  const inputFields =
    mode === "edit"
      ? ([
          { key: "date", type: "date", label: t(($) => $.schedule.date) },
          { key: "time", type: "time", label: t(($) => $.schedule.start) },
          { key: "duration", type: "number", label: t(($) => $.schedule.duration) },
          { key: "capacity", type: "number", label: t(($) => $.schedule.capacity) },
        ] as const)
      : [];
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
          {mode === "view" ? panel.title : t(($) => $.schedule.panelTitles[mode])}
        </SheetTitle>
        <Text slot="description" elementType="div">
          <SheetDescription>{panel.subtitle}</SheetDescription>
        </Text>
      </SheetHeader>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        role="region"
        aria-label={t(($) => $.schedule.panelTitles[mode])}
        tabIndex={0}
      >
        {mode === "view" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {panel.badges.map((badge, index) => (
                <Badge key={index} variant="secondary">
                  {badge}
                </Badge>
              ))}
            </div>
            <ItemGroup className="gap-0">
              {panel.facts.map((fact, index) => (
                <Item key={index} role="listitem" size="sm" variant="outline">
                  <ItemContent>
                    <ItemDescription>{fact.label}</ItemDescription>
                    <ItemTitle>{fact.value}</ItemTitle>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t(($) => $.schedule.fixedGroup)}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => onMode?.("roster")}
                  isDisabled={locked || !onMode || !canRoster}
                >
                  {t(($) => $.schedule.editRoster)}
                </Button>
              </div>
              {rosterContent ??
                (panel.roster?.length ? (
                  <ItemGroup>
                    {panel.roster.map((person) => (
                      <Item key={person.id} role="listitem" size="sm">
                        <ItemContent>
                          <ItemTitle>{person.name}</ItemTitle>
                          <ItemDescription>{person.detail}</ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                ) : (
                  <Empty>
                    <EmptyDescription>
                      {panel.roster === null
                        ? t(($) => $.schedule.unknown)
                        : t(($) => $.schedule.emptyRoster)}
                    </EmptyDescription>
                  </Empty>
                ))}
            </section>
          </div>
        ) : mode === "roster" && rosterContent ? (
          rosterContent
        ) : (
          <form
            id="schedule-session"
            method="post"
            aria-label={t(($) => $.schedule.panelTitles[mode])}
            aria-busy={locked}
            onSubmit={(event) => {
              event.preventDefault();
              if (!locked) onPreview?.();
            }}
          >
            <FieldGroup className="gap-4">
              {mode === "edit" && (
                <FieldGroup className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                  {inputFields.map((field) => (
                    <Field key={field.key}>
                      <FieldLabel htmlFor={`schedule-session-${field.key}`}>
                        {field.label}
                      </FieldLabel>
                      <Input
                        id={`schedule-session-${field.key}`}
                        name={field.key}
                        type={field.type}
                        min={
                          field.key === "duration" ? 1 : field.key === "capacity" ? 0 : undefined
                        }
                        step={field.type === "time" ? 60 : undefined}
                        required
                        value={draft[field.key]}
                        disabled={locked || !onDraft}
                        onChange={(event) => set(field.key, event.target.value)}
                      />
                    </Field>
                  ))}
                  <Field className="min-[380px]:col-span-2">
                    <FieldLabel htmlFor="schedule-session-room">
                      {t(($) => $.schedule.room)}
                    </FieldLabel>
                    <NativeSelect
                      id="schedule-session-room"
                      name="room"
                      required
                      value={draft.roomId}
                      disabled={locked || !onDraft}
                      onChange={(event) => set("roomId", event.target.value)}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.schedule.choose)}
                      </NativeSelectOption>
                      {rooms.map((room) => (
                        <NativeSelectOption key={room.id} value={room.id}>
                          {room.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  {offsetChoices.length > 0 && (
                    <Field className="min-[380px]:col-span-2">
                      <FieldLabel htmlFor="schedule-session-offset">
                        {t(($) => $.schedule.offset)}
                      </FieldLabel>
                      <NativeSelect
                        id="schedule-session-offset"
                        name="offset"
                        required
                        value={draft.offset}
                        disabled={locked || !onDraft}
                        onChange={(event) => set("offset", event.target.value)}
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.schedule.choose)}
                        </NativeSelectOption>
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
              )}
              {mode === "instructor" && (
                <Field>
                  <FieldLabel htmlFor="schedule-session-instructor">
                    {t(($) => $.schedule.newInstructor)}
                  </FieldLabel>
                  <NativeSelect
                    id="schedule-session-instructor"
                    name="instructor"
                    required
                    value={draft.instructorId}
                    disabled={locked || !onDraft}
                    onChange={(event) => set("instructorId", event.target.value)}
                  >
                    <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                    {instructors.map((person) => (
                      <NativeSelectOption key={person.id} value={person.id}>
                        {person.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              {(mode === "edit" || mode === "instructor" || mode === "cancel") && (
                <FieldSet>
                  <FieldLegend variant="label">
                    {mode === "cancel"
                      ? t(($) => $.schedule.cancelScope)
                      : t(($) => $.schedule.changeScope)}
                  </FieldLegend>
                  <RadioGroup
                    value={mode === "cancel" ? "single" : draft.scope}
                    aria-label={t(($) => $.schedule.changeScope)}
                    isDisabled={locked || !onDraft}
                    onChange={(value) => {
                      if (value === "single" || value === "this_and_future") set("scope", value);
                    }}
                  >
                    {(["single", "this_and_future"] as const).map((scope) => (
                      <Field orientation="horizontal" key={scope}>
                        <RadioGroupItem
                          value={scope}
                          id={`schedule-session-scope-${scope}`}
                          isDisabled={
                            scope === "this_and_future" && (!canFuture || mode === "cancel")
                          }
                        />
                        <FieldLabel
                          htmlFor={`schedule-session-scope-${scope}`}
                          className="py-2 whitespace-normal"
                        >
                          {t(($) => $.schedule.scopes[scope])}
                        </FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                  {mode === "cancel" && (
                    <FieldDescription>{t(($) => $.schedule.cancelSingleHint)}</FieldDescription>
                  )}
                </FieldSet>
              )}
              {mode === "roster" && (
                <FieldSet>
                  <FieldLegend variant="label">{t(($) => $.schedule.fixedGroup)}</FieldLegend>
                  <Field>
                    <FieldLabel htmlFor="schedule-roster-add">
                      {t(($) => $.schedule.addMember)}
                    </FieldLabel>
                    <NativeSelect
                      id="schedule-roster-add"
                      value={draft.addPersonId}
                      disabled={locked || !onDraft}
                      onChange={(event) => set("addPersonId", event.target.value)}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.schedule.choose)}
                      </NativeSelectOption>
                      {rosterCandidates.map((person) => (
                        <NativeSelectOption key={person.id} value={person.id}>
                          {person.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Button
                      type="button"
                      variant="outline"
                      onPress={onAddMember}
                      isDisabled={locked || !onAddMember || !draft.addPersonId}
                    >
                      {t(($) => $.schedule.addMember)}
                    </Button>
                  </Field>
                  {panel.roster?.map((person) => (
                    <Field key={person.id} orientation="horizontal">
                      <Checkbox
                        id={`schedule-roster-${person.id}`}
                        isSelected={draft.selectedPeople.includes(person.id)}
                        isDisabled={locked || !onDraft}
                        onChange={(selected) =>
                          set(
                            "selectedPeople",
                            selected
                              ? [...draft.selectedPeople, person.id]
                              : draft.selectedPeople.filter((id) => id !== person.id),
                          )
                        }
                      />
                      <FieldLabel
                        htmlFor={`schedule-roster-${person.id}`}
                        className="flex min-w-0 flex-col items-start gap-1 py-2 whitespace-normal"
                      >
                        <span>{person.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {person.detail}
                        </span>
                      </FieldLabel>
                    </Field>
                  )) ?? <FieldDescription>{t(($) => $.schedule.unknown)}</FieldDescription>}
                </FieldSet>
              )}
              <Field>
                <FieldLabel htmlFor="schedule-session-reason">
                  {t(($) => $.schedule.reason)} <span aria-hidden="true">*</span>
                </FieldLabel>
                <Textarea
                  id="schedule-session-reason"
                  name="reason"
                  readOnly={cancelled}
                  required
                  value={draft.reason}
                  disabled={locked || !onDraft}
                  onChange={(event) => set("reason", event.target.value)}
                  className="max-h-48 resize-y! rounded-md border-input! bg-transparent!"
                />
              </Field>
              {mode === "cancel" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="schedule-session-note">
                      {t(($) => $.schedule.note)}
                    </FieldLabel>
                    <Textarea
                      id="schedule-session-note"
                      name="note"
                      readOnly
                      value={draft.note}
                      disabled={locked || !onDraft}
                      onChange={(event) => set("note", event.target.value)}
                      className="max-h-48 resize-y! rounded-md border-input! bg-transparent!"
                    />
                    <FieldDescription>{t(($) => $.schedule.noteUnavailable)}</FieldDescription>
                  </Field>
                  <Field orientation="horizontal">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <FieldLabel htmlFor="schedule-replacement">
                        {t(($) => $.schedule.planReplacement)}
                      </FieldLabel>
                      <FieldDescription>{t(($) => $.schedule.replacementHint)}</FieldDescription>
                    </div>
                    <Switch
                      id="schedule-replacement"
                      isSelected={draft.replacement}
                      isDisabled={locked || !onDraft}
                      onChange={(value) => set("replacement", value)}
                    />
                  </Field>
                  {draft.replacement && (
                    <FieldGroup className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="schedule-replacement-date">
                          {t(($) => $.schedule.date)}
                        </FieldLabel>
                        <Input
                          id="schedule-replacement-date"
                          name="replacement-date"
                          type="date"
                          required
                          value={draft.replacementDate}
                          disabled={locked || !onDraft}
                          onChange={(event) => set("replacementDate", event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="schedule-replacement-time">
                          {t(($) => $.schedule.start)}
                        </FieldLabel>
                        <Input
                          id="schedule-replacement-time"
                          name="replacement-time"
                          type="time"
                          required
                          step={60}
                          value={draft.replacementTime}
                          disabled={locked || !onDraft}
                          onChange={(event) => set("replacementTime", event.target.value)}
                        />
                      </Field>
                      <Field className="min-[380px]:col-span-2">
                        <FieldLabel htmlFor="schedule-replacement-room">
                          {t(($) => $.schedule.room)}
                        </FieldLabel>
                        <NativeSelect
                          id="schedule-replacement-room"
                          name="replacement-room"
                          required
                          value={draft.replacementRoomId}
                          disabled={locked || !onDraft}
                          onChange={(event) => set("replacementRoomId", event.target.value)}
                        >
                          {rooms.map((room) => (
                            <NativeSelectOption key={room.id} value={room.id}>
                              {room.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                    </FieldGroup>
                  )}
                  {draft.replacement && offsetChoices.length > 0 && (
                    <Field>
                      <FieldLabel htmlFor="schedule-replacement-offset">
                        {t(($) => $.schedule.offset)}
                      </FieldLabel>
                      <NativeSelect
                        id="schedule-replacement-offset"
                        required
                        value={draft.replacementOffset ?? ""}
                        disabled={locked || !onDraft}
                        onChange={(event) => set("replacementOffset", event.target.value)}
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.schedule.choose)}
                        </NativeSelectOption>
                        {offsetChoices.map((offset) => (
                          <NativeSelectOption key={offset.id} value={offset.id}>
                            {offset.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldDescription>{t(($) => $.schedule.offsetHint)}</FieldDescription>
                    </Field>
                  )}
                </>
              )}
              <Field orientation="horizontal">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <FieldLabel htmlFor="schedule-session-notify">
                    {t(($) => $.schedule.notify)}
                  </FieldLabel>
                  <FieldDescription>
                    {t(($) => $.schedule.notificationUnavailable)}
                  </FieldDescription>
                </div>
                <Switch
                  id="schedule-session-notify"
                  isSelected={draft.notify}
                  isDisabled={locked || !onNotify}
                  onChange={onNotify}
                />
              </Field>
            </FieldGroup>
          </form>
        )}
        {historyContent}
        {panel.effects.length > 0 && (
          <section className="mt-4 flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t(($) => $.schedule.effect)}</h3>
            <ItemGroup>
              {panel.effects.map((effect) => (
                <Item key={effect.id} role="listitem" size="sm" variant="outline">
                  <ItemContent>
                    <ItemTitle>{effect.title}</ItemTitle>
                    <ItemDescription>{effect.detail}</ItemDescription>
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
      </div>
      <SheetFooter className="flex-row flex-wrap gap-2">
        <Button
          variant="outline"
          autoFocus={mode === "cancel"}
          onPress={onClose}
          isDisabled={locked}
        >
          {t(($) => $.people.cancel)}
        </Button>
        {onReplacement && (
          <Button onPress={onReplacement} isDisabled={locked}>
            {t(($) => $.schedule.replacementAction)}
          </Button>
        )}
        {mode === "view" ? (
          <>
            <Button
              variant="outline"
              onPress={() => onMode?.("instructor")}
              isDisabled={locked || !onMode || !canEdit}
            >
              {t(($) => $.schedule.panelTitles.instructor)}
            </Button>
            <Button
              variant="outline"
              onPress={() => onMode?.("edit")}
              isDisabled={locked || !onMode || !canEdit}
            >
              {t(($) => $.schedule.panelTitles.edit)}
            </Button>
            <Button
              variant="destructive"
              onPress={() => onMode?.("cancel")}
              isDisabled={locked || !onMode}
            >
              {t(($) => $.schedule.panelTitles.cancel)}
            </Button>
            {onDetail && (
              <Button onPress={onDetail} isDisabled={locked}>
                {t(($) => $.schedule.openDetail)}
              </Button>
            )}
          </>
        ) : mode !== "roster" ? (
          <>
            <Button type="submit" form="schedule-session" isDisabled={locked || !onPreview}>
              {t(($) => $.schedule.previewEffect)}
            </Button>
            {onApply && (
              <Button
                onPress={onApply}
                variant={mode === "cancel" ? "destructive" : "default"}
                isDisabled={locked}
              >
                {t(($) => $.schedule.apply)}
              </Button>
            )}
          </>
        ) : null}
      </SheetFooter>
    </Sheet>
  );
}
