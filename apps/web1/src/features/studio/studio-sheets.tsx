import { useState } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
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
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "../../components/ui/field";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { NativeSelect } from "../../components/ui/native-select";
import { Switch } from "../../components/ui/switch";
import { Checkbox } from "../../components/ui/checkbox";
import { Item, ItemGroup, ItemMedia, ItemContent } from "../../components/ui/item";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import type { StudioViewData } from "./studio-view";
import { StudioResourceForm } from "./resource-form";
import { resourceDraft } from "./studio";

export type StudioSheetSelection = {
  kind: "instructor" | "class" | "room" | "closure" | "agreement";
  id?: string;
};

export function StudioSheets({
  selection,
  onClose,
  data,
}: {
  selection?: StudioSheetSelection;
  onClose: () => void;
  data: StudioViewData;
}) {
  if (!selection) return null;
  if (selection.kind === "room" || selection.kind === "class") {
    const room = data.rooms.find((item) => item.id === selection.id);
    const lesson = data.classes.find((item) => item.id === selection.id);
    return (
      <StudioResourceForm
        key={`${selection.kind}:${selection.id ?? "new"}`}
        selection={{ kind: selection.kind, id: selection.id }}
        initial={{
          ...resourceDraft(),
          name: (selection.kind === "room" ? room?.name : lesson?.name) ?? "",
          capacity: room?.capacity == null ? "" : String(room.capacity),
          active: room?.active ?? true,
          disciplineId: lesson?.disciplineId ?? "",
          externalOpen: lesson?.externalOpen ?? false,
          waitlist: lesson?.waitlist ?? false,
        }}
        disciplines={data.disciplines}
        classMeta={lesson}
        onClose={onClose}
      />
    );
  }
  return (
    <StudioSheetForm
      key={`${selection.kind}:${selection.id ?? "new"}`}
      selection={selection}
      onClose={onClose}
      data={data}
    />
  );
}

function StudioSheetForm({
  selection,
  onClose,
  data,
}: {
  selection: StudioSheetSelection;
  onClose: () => void;
  data: StudioViewData;
}) {
  const { t } = useTranslation();
  const [closureScope, setClosureScope] = useState("room");
  const [feeModel, setFeeModel] = useState("session");
  const instructor = data.instructors.find((item) => item.id === selection.id);
  const lesson = data.classes.find((item) => item.id === selection.id);
  const room = data.rooms.find((item) => item.id === selection.id);
  const closure = data.closures.find((item) => item.id === selection.id);
  const agreement = data.agreements.find((item) => item.id === selection.id);
  const titles = {
    instructor: instructor ? t(($) => $.studio.editInstructor) : t(($) => $.studio.addInstructor),
    class: lesson ? t(($) => $.studio.editClass) : t(($) => $.studio.addClass),
    room: room ? t(($) => $.studio.editRoom) : t(($) => $.studio.addRoom),
    closure: closure ? t(($) => $.studio.closureDetails) : t(($) => $.studio.addClosure),
    agreement: t(($) => $.studio.prepareAgreement),
  };
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
      showCloseButton={false}
    >
      <SheetHeader className="relative pr-14">
        <SheetTitle>{titles[selection.kind]}</SheetTitle>
        <SheetDescription>
          {selection.kind === "agreement"
            ? t(($) => $.studio.agreementSheetDescription)
            : t(($) => $.studio.sheetDescription)}
        </SheetDescription>
        <SheetClose
          aria-label={t(($) => $.studio.close)}
          variant="ghost"
          size="icon-sm"
          className="absolute top-4 right-4"
        >
          <XIcon />
        </SheetClose>
      </SheetHeader>
      <form
        id="studio-editor"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
        onSubmit={(event) => event.preventDefault()}
      >
        <FieldGroup className="gap-4">
          {selection.kind === "instructor" && (
            <>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="instructor-name">{t(($) => $.studio.fullName)}</FieldLabel>
                <Input
                  id="instructor-name"
                  name="name"
                  defaultValue={instructor?.name ?? ""}
                  autoComplete="name"
                  required
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="instructor-email">{t(($) => $.studio.email)}</FieldLabel>
                <Input
                  type="email"
                  id="instructor-email"
                  name="email"
                  defaultValue={instructor?.email ?? ""}
                  autoComplete="email"
                  required
                />
              </Field>
              <FieldSet className="gap-3">
                <FieldLegend variant="label">{t(($) => $.studio.teachingDisciplines)}</FieldLegend>
                {data.classes.length ? (
                  <ItemGroup>
                    {data.classes.map((item) => (
                      <Item
                        key={item.id}
                        role="listitem"
                        size="xs"
                        variant="outline"
                        className="rounded-lg px-3.5 py-2.5"
                      >
                        <ItemMedia>
                          <Checkbox
                            name="classes"
                            value={item.id}
                            defaultSelected={instructor?.classIds.includes(item.id) ?? false}
                            aria-labelledby={`instructor-class-${item.id}`}
                          />
                        </ItemMedia>
                        <ItemContent>
                          <FieldLabel id={`instructor-class-${item.id}`}>{item.name}</FieldLabel>
                          <FieldDescription variant="hint">{item.room ?? "—"}</FieldDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    {t(($) => $.studio.noClasses)}
                  </p>
                )}
              </FieldSet>
              <Field orientation="horizontal">
                <div className="flex-1">
                  <FieldLabel id="instructor-active-label">{t(($) => $.studio.active)}</FieldLabel>
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.instructorActiveDescription)}
                  </FieldDescription>
                </div>
                <Switch
                  name="active"
                  aria-labelledby="instructor-active-label"
                  defaultSelected={instructor?.active ?? true}
                />
              </Field>
            </>
          )}
          {selection.kind === "closure" &&
            (closure ? (
              <>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-[13px]">
                  <dt className="text-muted-foreground">{t(($) => $.studio.period)}</dt>
                  <dd>{closure.period}</dd>
                  <dt className="text-muted-foreground">{t(($) => $.studio.scope)}</dt>
                  <dd>{closure.scope}</dd>
                  <dt className="text-muted-foreground">{t(($) => $.studio.reason)}</dt>
                  <dd>{closure.reason}</dd>
                  <dt className="text-muted-foreground">{t(($) => $.studio.status)}</dt>
                  <dd>{closure.status}</dd>
                </dl>
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                    {t(($) => $.studio.affectedSessions)}
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {closure.affectedSessions ?? "—"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Field className="gap-2">
                  <FieldLabel id="closure-scope-label">{t(($) => $.studio.scope)}</FieldLabel>
                  <ToggleGroup
                    variant="segmented"
                    size="segmented"
                    selectionMode="single"
                    disallowEmptySelection
                    aria-labelledby="closure-scope-label"
                    selectedKeys={new Set([closureScope])}
                    onSelectionChange={(keys) => setClosureScope(String([...keys][0]))}
                  >
                    <ToggleGroupItem id="center" isDisabled>
                      {t(($) => $.studio.title)}
                    </ToggleGroupItem>
                    <ToggleGroupItem id="room">{t(($) => $.studio.room)}</ToggleGroupItem>
                    <ToggleGroupItem id="instructor">
                      {t(($) => $.studio.instructorLeave)}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.centerClosureHint)}
                  </FieldDescription>
                </Field>
                {closureScope !== "center" && (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="closure-target">
                      {closureScope === "room"
                        ? t(($) => $.studio.room)
                        : t(($) => $.studio.instructor)}
                    </FieldLabel>
                    <NativeSelect
                      className="w-full"
                      id="closure-target"
                      name="target"
                      defaultValue=""
                      required
                    >
                      <option value="">{t(($) => $.studio.choose)}</option>
                      {(closureScope === "room" ? data.rooms : data.instructors).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="closure-from">{t(($) => $.studio.start)}</FieldLabel>
                    <Input type="date" id="closure-from" name="from" required />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="closure-to">{t(($) => $.studio.endInclusive)}</FieldLabel>
                    <Input type="date" id="closure-to" name="to" required />
                  </Field>
                </FieldGroup>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="closure-reason">{t(($) => $.studio.reason)}</FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="closure-reason"
                    name="reason"
                    defaultValue=""
                    required
                  >
                    <option value="">{t(($) => $.studio.chooseReason)}</option>
                    <option>{t(($) => $.studio.holiday)}</option>
                    <option>{t(($) => $.studio.maintenance)}</option>
                    <option>{t(($) => $.studio.annualLeave)}</option>
                    <option>{t(($) => $.studio.illness)}</option>
                    <option>{t(($) => $.studio.other)}</option>
                  </NativeSelect>
                </Field>
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">{t(($) => $.studio.affectedSessions)}</FieldLegend>
                  <RadioGroup aria-label={t(($) => $.studio.affectedSessions)} defaultValue="keep">
                    <ItemGroup>
                      <Item
                        role="listitem"
                        variant="outline"
                        size="xs"
                        className="rounded-lg p-3 has-data-selected:border-foreground"
                      >
                        <Field orientation="horizontal">
                          <RadioGroupItem
                            value="cancel"
                            aria-labelledby="closure-cancel-label"
                            isDisabled
                          />
                          <div>
                            <FieldLabel id="closure-cancel-label">
                              {t(($) => $.studio.cancelSessions)}
                            </FieldLabel>
                            <FieldDescription variant="hint">
                              {t(($) => $.studio.cancelSessionsDescription)}
                            </FieldDescription>
                          </div>
                        </Field>
                      </Item>
                      <Item
                        role="listitem"
                        variant="outline"
                        size="xs"
                        className="rounded-lg p-3 has-data-selected:border-foreground"
                      >
                        <Field orientation="horizontal">
                          <RadioGroupItem value="keep" aria-labelledby="closure-keep-label" />
                          <div>
                            <FieldLabel id="closure-keep-label">
                              {t(($) => $.studio.keepSessions)}
                            </FieldLabel>
                            <FieldDescription variant="hint">
                              {t(($) => $.studio.keepSessionsDescription)}
                            </FieldDescription>
                          </div>
                        </Field>
                      </Item>
                    </ItemGroup>
                  </RadioGroup>
                </FieldSet>
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                    {t(($) => $.studio.impact)}
                  </h3>
                  <ItemGroup>
                    <Item role="listitem" variant="outline" size="xs" className="rounded-lg">
                      <ItemContent>
                        <FieldDescription variant="hint">
                          {t(($) => $.studio.impactPending)}
                        </FieldDescription>
                      </ItemContent>
                    </Item>
                  </ItemGroup>
                </div>
                <Field orientation="horizontal">
                  <div className="flex-1">
                    <FieldLabel id="closure-notify-label">
                      {t(($) => $.studio.notifyMembers)}
                    </FieldLabel>
                    <FieldDescription variant="hint">
                      {t(($) => $.studio.notificationImpact)}
                    </FieldDescription>
                  </div>
                  <Switch aria-labelledby="closure-notify-label" isDisabled />
                </Field>
              </>
            ))}
          {selection.kind === "agreement" && (
            <>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-instructor">
                  {t(($) => $.studio.instructor)}
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="agreement-instructor"
                  name="instructor"
                  defaultValue={agreement?.instructorId ?? ""}
                  required
                >
                  <option value="">{t(($) => $.studio.chooseInstructor)}</option>
                  {data.instructors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field className="gap-2">
                <FieldLabel id="agreement-model-label">{t(($) => $.studio.feeModel)}</FieldLabel>
                <ToggleGroup
                  variant="segmented"
                  size="segmented"
                  selectionMode="single"
                  disallowEmptySelection
                  aria-labelledby="agreement-model-label"
                  selectedKeys={new Set([feeModel])}
                  onSelectionChange={(keys) => setFeeModel(String([...keys][0]))}
                >
                  <ToggleGroupItem id="session">{t(($) => $.studio.perSession)}</ToggleGroupItem>
                  <ToggleGroupItem id="hour" isDisabled>
                    {t(($) => $.studio.hourly)}
                  </ToggleGroupItem>
                  <ToggleGroupItem id="participant">
                    {t(($) => $.studio.perParticipant)}
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription variant="hint">
                  {t(($) => $.studio.hourlyUnavailable)}
                </FieldDescription>
              </Field>
              <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-fee">{t(($) => $.studio.feeAmount)}</FieldLabel>
                  <Input id="agreement-fee" name="fee" inputMode="decimal" required />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-minimum">
                    {t(($) => $.studio.minimumFee)}
                  </FieldLabel>
                  <Input id="agreement-minimum" name="minimum" inputMode="decimal" disabled />
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.minimumUnavailable)}
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-effective">
                  {t(($) => $.studio.effectiveDate)}
                </FieldLabel>
                <Input
                  type="datetime-local"
                  className="w-full"
                  id="agreement-effective"
                  name="effective"
                  required
                />
                <FieldDescription variant="hint">{t(($) => $.studio.utcValidity)}</FieldDescription>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-end">{t(($) => $.studio.validUntilUtc)}</FieldLabel>
                <Input id="agreement-end" name="effectiveEnd" type="datetime-local" required />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-discipline">
                  {t(($) => $.studio.discipline)}
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="agreement-discipline"
                  name="discipline"
                  defaultValue=""
                  required
                >
                  <option value="">{t(($) => $.studio.chooseDiscipline)}</option>
                  {data.disciplines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-format">
                  {t(($) => $.studio.lessonFormat)}
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="agreement-format"
                  name="format"
                  defaultValue=""
                  required
                >
                  <option value="">{t(($) => $.studio.choose)}</option>
                  <option value="group">{t(($) => $.studio.groupLesson)}</option>
                  <option value="private">{t(($) => $.studio.privateLesson)}</option>
                </NativeSelect>
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-currency">{t(($) => $.studio.currency)}</FieldLabel>
                <Input
                  id="agreement-currency"
                  name="currency"
                  autoComplete="transaction-currency"
                  required
                />
              </Field>
              <FieldSet className="gap-3">
                <FieldLegend variant="label">{t(($) => $.studio.roomShare)}</FieldLegend>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-room-share">
                    {t(($) => $.studio.roomShareKind)}
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="agreement-room-share"
                    name="roomShareKind"
                    defaultValue=""
                    required
                  >
                    <option value="">{t(($) => $.studio.choose)}</option>
                    <option value="free">{t(($) => $.studio.roomShareFree)}</option>
                    <option value="fixed">{t(($) => $.studio.roomShareFixed)}</option>
                    <option value="percentage">{t(($) => $.studio.roomSharePercentage)}</option>
                  </NativeSelect>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-room-amount">
                    {t(($) => $.studio.roomShareAmount)}
                  </FieldLabel>
                  <Input id="agreement-room-amount" name="roomShareAmount" inputMode="decimal" />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-room-order">
                    {t(($) => $.studio.roomShareOrder)}
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="agreement-room-order"
                    name="roomShareOrder"
                    defaultValue=""
                    required
                  >
                    <option value="">{t(($) => $.studio.choose)}</option>
                    <option value="before_instructor_share">
                      {t(($) => $.studio.roomShareBefore)}
                    </option>
                    <option value="after_instructor_share">
                      {t(($) => $.studio.roomShareAfter)}
                    </option>
                  </NativeSelect>
                </Field>
              </FieldSet>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-reason">
                  {t(($) => $.studio.publishReason)}
                </FieldLabel>
                <Input id="agreement-reason" name="reason" required />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-note">{t(($) => $.studio.versionNote)}</FieldLabel>
                <Input id="agreement-note" name="note" />
                <FieldDescription variant="hint">{t(($) => $.studio.optional)}</FieldDescription>
              </Field>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  {t(($) => $.studio.impact)}
                </h3>
                <ItemGroup>
                  <Item role="listitem" variant="outline" size="xs" className="rounded-lg">
                    <ItemContent>
                      <FieldDescription variant="hint">
                        {t(($) => $.studio.impactPending)}
                      </FieldDescription>
                    </ItemContent>
                  </Item>
                </ItemGroup>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  {t(($) => $.studio.versions)}
                </h3>
                <ul className="flex flex-col gap-2 text-[13px]">
                  {data.agreements
                    .filter((item) => item.instructorId === agreement?.instructorId)
                    .map((item) => (
                      <li key={item.id} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {item.version} · {item.effective}
                        </span>
                        <span>{item.fee}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <Field orientation="horizontal">
                <Checkbox name="impactAccepted" aria-labelledby="agreement-impact-label" />
                <div>
                  <FieldLabel id="agreement-impact-label">
                    {t(($) => $.studio.impactAccepted)}
                  </FieldLabel>
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.earningsUnchanged)}
                  </FieldDescription>
                </div>
              </Field>
            </>
          )}
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" onPress={onClose}>
          {t(($) => $.studio.cancel)}
        </Button>
        {!closure && (
          <Button type="submit" form="studio-editor" isDisabled>
            {selection.kind === "agreement"
              ? t(($) => $.studio.publishVersion)
              : selection.kind === "closure"
                ? t(($) => $.studio.saveClosure)
                : !selection.id && selection.kind === "instructor"
                  ? t(($) => $.studio.saveAndInvite)
                  : !selection.id && selection.kind === "class"
                    ? t(($) => $.studio.createClass)
                    : !selection.id && selection.kind === "room"
                      ? t(($) => $.studio.createRoom)
                      : t(($) => $.studio.save)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
