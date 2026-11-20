import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardFooter } from "@ftksaas/ui/components/card";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Field, FieldLabel, FieldDescription, FieldError } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Button } from "@ftksaas/ui/components/button";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Badge } from "@ftksaas/ui/components/badge";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import { PlusIcon } from "lucide-react";
import { MemberReadSkeleton } from "../member/member-read-skeleton";
export interface PrivateLessonRow {
  id: string;
  time: string;
  duration: string;
  title: string;
  metadata: string;
  studentNote?: string;
  hint: string;
  state: string;
  actions?: ReactNode;
}
export function MemberPrivateLessonsView({
  rows,
  pending,
  onCreate,
  disabled,
  notice,
  pagination,
}: {
  rows: PrivateLessonRow[] | null;
  pending: boolean;
  onCreate: () => void;
  disabled: boolean;
  notice?: ReactNode;
  pagination?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="@container mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.02em]">
            {t(($) => $.memberPrivateLessons.title)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(($) => $.memberPrivateLessons.description)}
          </p>
        </div>
        <Button onPress={onCreate} isDisabled={disabled}>
          <PlusIcon aria-hidden="true" />
          {t(($) => $.memberPrivateLessons.newRequest)}
        </Button>
      </header>
      {notice}
      <Card className="min-w-0">
        <CardContent>
          {pending ? (
            <MemberReadSkeleton label={t(($) => $.memberPrivateLessons.loading)} />
          ) : rows === null ? (
            <p className="py-5 text-sm text-muted-foreground">
              {t(($) => $.memberPrivateLessons.unread)}
            </p>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyDescription>{t(($) => $.memberPrivateLessons.empty)}</EmptyDescription>
            </Empty>
          ) : (
            <ItemGroup className="gap-0 divide-y">
              {rows.map((row) => (
                <Item
                  role="listitem"
                  key={row.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-none border-0 px-0 py-4 @lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,14rem)]"
                >
                  <div className="w-14 shrink-0 text-sm tabular-nums">
                    <p className="font-semibold">{row.time}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.duration}</p>
                  </div>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="wrap-anywhere">{row.title}</ItemTitle>
                    <ItemDescription className="line-clamp-none break-words">
                      {row.metadata}
                    </ItemDescription>
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                    {row.studentNote && (
                      <p className="text-sm wrap-anywhere whitespace-pre-wrap">{row.studentNote}</p>
                    )}
                  </ItemContent>
                  <ItemActions className="col-start-2 min-w-0 flex-wrap gap-2 @lg:col-start-3 @lg:flex-col @lg:items-end">
                    <Badge variant="outline" className="h-auto max-w-full whitespace-normal">
                      {row.state}
                    </Badge>
                    {row.actions}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
        {pagination && <CardFooter>{pagination}</CardFooter>}
      </Card>
    </div>
  );
}
export interface OwnRequestDraft {
  disciplineId: string;
  instructorId: string;
  day: string;
  time: string;
  duration: string;
  offset: string;
  studentNote: string;
  alternativeId: string;
  reviewed: boolean;
}
export function OwnRequestSheet({
  mode,
  draft,
  onDraft,
  disciplines,
  instructors,
  alternatives,
  offsets,
  errors,
  locked,
  readOnly,
  notice,
  recovery,
  onClose,
  onSubmit,
  timezone,
}: {
  mode: "create" | "withdraw" | "accept";
  draft: OwnRequestDraft;
  onDraft: (draft: OwnRequestDraft) => void;
  disciplines: { id: string; name: string }[];
  instructors: { id: string; name: string }[];
  alternatives: { id: string; name: string }[];
  offsets: { id: string; label: string }[];
  errors?: Partial<Record<keyof OwnRequestDraft, string>>;
  locked: boolean;
  readOnly: boolean;
  notice?: ReactNode;
  recovery?: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  timezone: string;
}) {
  const { t } = useTranslation(),
    form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (errors && Object.keys(errors).length)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  const set = <K extends keyof OwnRequestDraft>(key: K, value: OwnRequestDraft[K]) =>
    onDraft({ ...draft, [key]: value });
  return (
    <Sheet
      isOpen
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.memberPrivateLessons.actions[mode])}</SheetTitle>
        <SheetDescription>
          {t(($) => $.memberPrivateLessons.formHint, { timezone })}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 [overscroll-behavior:contain]">
        {notice}
        <form
          ref={form}
          id="own-request-form"
          method="post"
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked) onSubmit?.();
          }}
        >
          {mode === "create" ? (
            <>
              <Field data-invalid={Boolean(errors?.disciplineId)}>
                <FieldLabel htmlFor="own-request-discipline">
                  {t(($) => $.memberPrivateLessons.discipline)}
                </FieldLabel>
                <NativeSelect
                  id="own-request-discipline"
                  required
                  value={draft.disciplineId}
                  disabled={locked || readOnly}
                  aria-invalid={Boolean(errors?.disciplineId)}
                  aria-describedby={errors?.disciplineId ? "own-discipline-error" : undefined}
                  onChange={(event) => set("disciplineId", event.target.value)}
                >
                  <NativeSelectOption value="">
                    {t(($) => $.memberPrivateLessons.chooseDiscipline)}
                  </NativeSelectOption>
                  {disciplines.map((row) => (
                    <NativeSelectOption key={row.id} value={row.id}>
                      {row.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id="own-discipline-error">{errors?.disciplineId}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="own-request-instructor">
                  {t(($) => $.memberPrivateLessons.instructor)}
                </FieldLabel>
                <NativeSelect
                  id="own-request-instructor"
                  value={draft.instructorId}
                  disabled={locked || readOnly}
                  onChange={(event) => set("instructorId", event.target.value)}
                >
                  <NativeSelectOption value="">
                    {t(($) => $.memberPrivateLessons.noPreference)}
                  </NativeSelectOption>
                  {instructors.map((row) => (
                    <NativeSelectOption key={row.id} value={row.id}>
                      {row.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors?.day)}>
                  <FieldLabel htmlFor="own-request-day">
                    {t(($) => $.memberPrivateLessons.day)}
                  </FieldLabel>
                  <Input
                    id="own-request-day"
                    required
                    type="date"
                    value={draft.day}
                    disabled={locked || readOnly}
                    aria-invalid={Boolean(errors?.day)}
                    aria-describedby={errors?.day ? "own-day-error" : undefined}
                    onChange={(event) => set("day", event.target.value)}
                  />
                  <FieldError id="own-day-error">{errors?.day}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors?.time)}>
                  <FieldLabel htmlFor="own-request-time">
                    {t(($) => $.memberPrivateLessons.time)}
                  </FieldLabel>
                  <Input
                    id="own-request-time"
                    required
                    type="time"
                    step="60"
                    value={draft.time}
                    disabled={locked || readOnly}
                    aria-invalid={Boolean(errors?.time)}
                    aria-describedby={errors?.time ? "own-time-error" : undefined}
                    onChange={(event) => set("time", event.target.value)}
                  />
                  <FieldError id="own-time-error">{errors?.time}</FieldError>
                </Field>
              </div>
              {offsets.length > 0 && (
                <Field>
                  <FieldLabel htmlFor="own-request-offset">
                    {t(($) => $.memberPrivateLessons.offset)}
                  </FieldLabel>
                  <NativeSelect
                    id="own-request-offset"
                    value={draft.offset}
                    disabled={locked || readOnly}
                    onChange={(event) => set("offset", event.target.value)}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.memberPrivateLessons.chooseOffset)}
                    </NativeSelectOption>
                    {offsets.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field>
                <FieldLabel>{t(($) => $.memberPrivateLessons.duration)}</FieldLabel>
                <ToggleGroup
                  aria-label={t(($) => $.memberPrivateLessons.duration)}
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([draft.duration])}
                  isDisabled={locked || readOnly}
                  onSelectionChange={(keys) => {
                    const value = [...keys][0];
                    if (typeof value === "string") set("duration", value);
                  }}
                  variant="outline"
                >
                  {["45", "60"].map((value) => (
                    <ToggleGroupItem key={value} id={value}>
                      {t(($) => $.memberReservations.duration, { minutes: value })}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <Field data-invalid={Boolean(errors?.studentNote)}>
                <FieldLabel htmlFor="own-request-note">
                  {t(($) => $.memberPrivateLessons.noteOptional)}
                </FieldLabel>
                <Textarea
                  id="own-request-note"
                  name="student_note"
                  value={draft.studentNote}
                  disabled={locked || readOnly}
                  aria-invalid={Boolean(errors?.studentNote)}
                  aria-describedby={
                    errors?.studentNote ? "own-note-hint own-note-error" : "own-note-hint"
                  }
                  onChange={(event) => set("studentNote", event.target.value)}
                />
                <FieldDescription id="own-note-hint">
                  {t(($) => $.memberPrivateLessons.noteHint)}
                </FieldDescription>
                <FieldError id="own-note-error">{errors?.studentNote}</FieldError>
              </Field>
            </>
          ) : (
            <>
              {mode === "accept" && (
                <Field data-invalid={Boolean(errors?.alternativeId)}>
                  <FieldLabel htmlFor="own-request-alternative">
                    {t(($) => $.memberPrivateLessons.alternative)}
                  </FieldLabel>
                  <NativeSelect
                    id="own-request-alternative"
                    value={draft.alternativeId}
                    disabled={locked || readOnly}
                    aria-invalid={Boolean(errors?.alternativeId)}
                    aria-describedby={errors?.alternativeId ? "own-alternative-error" : undefined}
                    onChange={(event) => set("alternativeId", event.target.value)}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.memberPrivateLessons.chooseAlternative)}
                    </NativeSelectOption>
                    {alternatives.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError id="own-alternative-error">{errors?.alternativeId}</FieldError>
                </Field>
              )}
              <p className="text-sm">
                {t(($) =>
                  mode === "accept"
                    ? $.memberPrivateLessons.acceptHint
                    : $.memberPrivateLessons.withdrawHint,
                )}
              </p>
              <Checkbox
                isSelected={draft.reviewed}
                isDisabled={locked || readOnly}
                onChange={(value) => set("reviewed", value)}
              >
                {t(($) => $.memberPrivateLessons.review)}
              </Checkbox>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            {t(($) => $.memberPrivateLessons.noReservation)}
          </p>
        </form>
        {recovery}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          variant="outline"
          autoFocus={mode === "withdraw"}
          isDisabled={locked}
          onPress={onClose}
        >
          {t(($) => (readOnly ? $.memberPrivateLessons.close : $.memberPrivateLessons.cancel))}
        </Button>
        {!readOnly && (
          <Button
            type="submit"
            form="own-request-form"
            variant={mode === "withdraw" ? "destructive" : "default"}
            isDisabled={locked || !onSubmit || (mode !== "create" && !draft.reviewed)}
          >
            {t(($) => $.memberPrivateLessons.submit[mode])}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
