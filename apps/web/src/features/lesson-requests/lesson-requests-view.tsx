import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "@ftksaas/ui/components/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@ftksaas/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Badge } from "@ftksaas/ui/components/badge";
import { Avatar, AvatarFallback } from "@ftksaas/ui/components/avatar";
import { Button } from "@ftksaas/ui/components/button";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import { Field, FieldLabel, FieldError, FieldDescription } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import type { RequestState } from "@ftksaas/api-contracts";
export type RequestFilter = "pending" | "alternative_offered" | "resolved" | "all";
export interface RequestRow {
  id: string;
  name: string;
  initials: string;
  rights: string;
  requested: string;
  duration: string;
  instructor: string;
  created: string;
  state: RequestState;
}
export function LessonRequestsView({
  filter,
  onFilter,
  filtersAvailable,
  counts,
  rows,
  onOpen,
  notice,
  pagination,
  locked = false,
}: {
  filter: RequestFilter;
  onFilter: (filter: RequestFilter) => void;
  filtersAvailable: boolean;
  counts: {
    pending: string | null;
    alternative_offered: string | null;
    approved: string | null;
    rejected: string | null;
  };
  rows: RequestRow[] | null;
  onOpen: (id: string) => void;
  notice?: ReactNode;
  pagination?: ReactNode;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(($) => $.lessonRequests.title)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(($) => $.lessonRequests.description)}
        </p>
      </header>
      <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4">
        {(["pending", "alternative_offered", "approved", "rejected"] as const).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{t(($) => $.lessonRequests.states[key])}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{counts[key] ?? "—"}</CardTitle>
              <CardDescription>{t(($) => $.lessonRequests.metricHints[key])}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      {notice}
      <Card className="min-w-0">
        <CardContent className="pt-5">
          <ToggleGroup
            selectionMode="single"
            disallowEmptySelection
            aria-label={t(($) => $.lessonRequests.filter)}
            variant="segmented"
            className="max-w-full overflow-x-auto"
            selectedKeys={[filter]}
            onSelectionChange={(keys) => {
              if (locked) return;
              const value = [...keys][0];
              if (["pending", "alternative_offered", "resolved", "all"].includes(String(value)))
                onFilter(value as RequestFilter);
            }}
          >
            {(["pending", "alternative_offered", "resolved", "all"] as const).map((key) => (
              <ToggleGroupItem key={key} id={key} isDisabled={locked || !filtersAvailable}>
                {t(($) => $.lessonRequests.filters[key])}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
        <CardContent
          role="region"
          tabIndex={0}
          aria-label={t(($) => $.lessonRequests.title)}
          className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring [&_[data-slot=table-container]]:max-h-[min(65vh,32rem)]"
        >
          {rows === null ? (
            <p role="status" className="py-8 text-sm text-muted-foreground">
              {t(($) => $.lessonRequests.unread)}
            </p>
          ) : (
            <Table aria-label={t(($) => $.lessonRequests.title)} className="min-w-[43rem]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                  {t(($) => $.lessonRequests.person)}
                </TableHead>
                <TableHead>{t(($) => $.lessonRequests.requested)}</TableHead>
                <TableHead>{t(($) => $.lessonRequests.instructor)}</TableHead>
                <TableHead>{t(($) => $.lessonRequests.created)}</TableHead>
                <TableHead>{t(($) => $.lessonRequests.state)}</TableHead>
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <Empty>
                    <EmptyDescription>{t(($) => $.lessonRequests.empty)}</EmptyDescription>
                  </Empty>
                )}
              >
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    id={row.id}
                    onAction={() => {
                      if (!locked) onOpen(row.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="sticky start-0 z-10 bg-card">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback>{row.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.rights}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <p>{row.requested}</p>
                      <p className="text-xs text-muted-foreground">{row.duration}</p>
                    </TableCell>
                    <TableCell>{row.instructor}</TableCell>
                    <TableCell className="tabular-nums">{row.created}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(($) => $.lessonRequests.states[row.state])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-3">
          <CardDescription>{t(($) => $.lessonRequests.openHint)}</CardDescription>
          <div className="flex flex-wrap gap-2">{pagination}</div>
        </CardFooter>
      </Card>
    </div>
  );
}
export type RequestStage = "view" | "reject" | "alternative" | "approve";
export interface RequestDraft {
  reason: string;
  day: string;
  time: string;
  instructorId: string;
  roomId: string;
  sessionId: string;
  mode: "existing" | "create";
  capacity: string;
  accepted: boolean;
  windowException: boolean;
  offset: string;
}
export function LessonRequestSheet({
  name,
  subtitle,
  state,
  stage,
  onStage,
  draft,
  onDraft,
  eligibility,
  note,
  rooms,
  instructors,
  sessions,
  offsets = [],
  instructorFixed = false,
  notice,
  recovery,
  onClose,
  onSubmit,
  locked = false,
  canResolve = false,
  canApprove = canResolve,
  errors = {},
}: {
  name: string;
  subtitle: string;
  state?: RequestState;
  stage: RequestStage;
  onStage: (stage: RequestStage) => void;
  draft: RequestDraft;
  onDraft: (draft: RequestDraft) => void;
  eligibility: { id: string; label: string; value: string; detail?: string }[] | null;
  note?: string;
  rooms: { id: string; name: string }[];
  instructors: { id: string; name: string }[];
  sessions: { id: string; name: string }[];
  offsets?: { id: string; label: string }[];
  instructorFixed?: boolean;
  notice?: ReactNode;
  recovery?: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  locked?: boolean;
  canResolve?: boolean;
  canApprove?: boolean;
  errors?: Partial<Record<keyof RequestDraft, string>>;
}) {
  const { t } = useTranslation(),
    form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (Object.keys(errors).length)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  const stageTitles = {
    reject: t(($) => $.lessonRequests.stageTitles.reject),
    alternative: t(($) => $.lessonRequests.stageTitles.alternative),
    approve: t(($) => $.lessonRequests.stageTitles.approve),
  };
  const submitLabels = {
    reject: t(($) => $.lessonRequests.submit.reject),
    alternative: t(($) => $.lessonRequests.submit.alternative),
    approve: t(($) => $.lessonRequests.submit.approve),
  };
  const change = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) =>
    onDraft({
      ...draft,
      [key]: value,
      accepted: false,
      ...(["day", "time"].includes(key) ? { offset: "" } : {}),
    });
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
      <SheetHeader className="relative pe-14">
        <SheetTitle>
          {stage === "view" ? t(($) => $.lessonRequests.detailTitle, { name }) : stageTitles[stage]}
        </SheetTitle>
        <SheetDescription>{subtitle}</SheetDescription>
        <Button
          className="absolute end-4 top-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.lessonRequests.close)}
          isDisabled={locked}
          onPress={onClose}
        >
          <XIcon />
        </Button>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 [overscroll-behavior:contain]">
        {notice}
        <Badge variant="outline">
          {state ? t(($) => $.lessonRequests.states[state]) : t(($) => $.lessonRequests.unknown)}
        </Badge>
        {stage === "view" ? (
          <>
            <p className="text-sm text-muted-foreground">{t(($) => $.lessonRequests.intentNote)}</p>
            <p className="rounded-lg border p-3 text-sm wrap-anywhere whitespace-pre-wrap">
              {note ?? t(($) => $.lessonRequests.noteUnavailable)}
            </p>
            <section>
              <h3 className="mb-3 text-sm font-medium">{t(($) => $.lessonRequests.eligibility)}</h3>
              <ItemGroup>
                {eligibility?.map((row) => (
                  <Item key={row.id} role="listitem" variant="outline">
                    <ItemContent>
                      <ItemTitle>{row.label}</ItemTitle>
                      <p className="text-sm">{row.value}</p>
                      {row.detail && <ItemDescription>{row.detail}</ItemDescription>}
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
              {eligibility === null && (
                <p className="text-sm text-muted-foreground">{t(($) => $.lessonRequests.unread)}</p>
              )}
            </section>
          </>
        ) : (
          <form
            ref={form}
            id="lesson-request-action"
            method="post"
            noValidate
            className="flex flex-col gap-4"
            aria-label={stageTitles[stage]}
            onSubmit={(event) => {
              event.preventDefault();
              if (!locked) onSubmit?.();
            }}
          >
            {stage === "reject" && (
              <Field data-invalid={Boolean(errors.reason)}>
                <FieldLabel htmlFor="request-reason">
                  {t(($) => $.lessonRequests.rejectReason)}
                </FieldLabel>
                <Textarea
                  id="request-reason"
                  name="reason"
                  value={draft.reason}
                  required
                  disabled={locked}
                  aria-invalid={Boolean(errors.reason)}
                  aria-describedby={
                    errors.reason
                      ? "request-reason-hint request-reason-error"
                      : "request-reason-hint"
                  }
                  onChange={(event) => change("reason", event.target.value)}
                />
                <FieldDescription id="request-reason-hint">
                  {t(($) => $.lessonRequests.rejectHint)}
                </FieldDescription>
                <FieldError id="request-reason-error">{errors.reason}</FieldError>
              </Field>
            )}
            {stage === "alternative" && (
              <>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  {(["day", "time"] as const).map((key) => (
                    <Field key={key} data-invalid={Boolean(errors[key])}>
                      <FieldLabel htmlFor={`request-${key}`}>
                        {t(($) => $.lessonRequests.fields[key])}
                      </FieldLabel>
                      <Input
                        id={`request-${key}`}
                        name={key}
                        type={key === "day" ? "date" : "time"}
                        value={draft[key]}
                        required
                        disabled={locked}
                        aria-invalid={Boolean(errors[key])}
                        aria-describedby={errors[key] ? `request-${key}-error` : undefined}
                        onChange={(event) => change(key, event.target.value)}
                      />
                      <FieldError id={`request-${key}-error`}>{errors[key]}</FieldError>
                    </Field>
                  ))}
                </div>
                <Field>
                  <FieldLabel htmlFor="request-instructor">
                    {t(($) => $.lessonRequests.instructor)}
                  </FieldLabel>
                  <NativeSelect
                    id="request-instructor"
                    name="instructorId"
                    value={draft.instructorId}
                    disabled={locked}
                    onChange={(event) => change("instructorId", event.target.value)}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.lessonRequests.choose)}
                    </NativeSelectOption>
                    {instructors.map((row) => (
                      <NativeSelectOption key={row.id} value={row.id}>
                        {row.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                {offsets.length > 0 && (
                  <Field>
                    <FieldLabel htmlFor="request-offset">
                      {t(($) => $.lessonRequests.offset)}
                    </FieldLabel>
                    <NativeSelect
                      id="request-offset"
                      name="offset"
                      value={draft.offset}
                      disabled={locked}
                      onChange={(event) => change("offset", event.target.value)}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.lessonRequests.choose)}
                      </NativeSelectOption>
                      {offsets.map((row) => (
                        <NativeSelectOption key={row.id} value={row.id}>
                          {row.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <Field orientation="horizontal">
                  <Checkbox
                    id="request-window"
                    aria-labelledby="request-window-label"
                    isSelected={draft.windowException}
                    isDisabled={locked}
                    onChange={(value) => change("windowException", value)}
                  />
                  <FieldLabel id="request-window-label" htmlFor="request-window">
                    {t(($) => $.lessonRequests.windowException)}
                  </FieldLabel>
                </Field>
                {draft.windowException && (
                  <Field data-invalid={Boolean(errors.reason)}>
                    <FieldLabel htmlFor="request-window-reason">
                      {t(($) => $.lessonRequests.windowReason)}
                    </FieldLabel>
                    <Textarea
                      id="request-window-reason"
                      name="reason"
                      value={draft.reason}
                      disabled={locked}
                      required
                      aria-invalid={Boolean(errors.reason)}
                      aria-describedby={errors.reason ? "request-window-error" : undefined}
                      onChange={(event) => change("reason", event.target.value)}
                    />
                    <FieldError id="request-window-error">{errors.reason}</FieldError>
                  </Field>
                )}
              </>
            )}
            {stage === "alternative" && (
              <Field>
                <FieldLabel htmlFor="request-note">
                  {t(($) => $.lessonRequests.optionalNote)}
                </FieldLabel>
                <Textarea
                  id="request-note"
                  name="note"
                  disabled
                  value=""
                  aria-describedby="request-note-hint"
                />
                <FieldDescription id="request-note-hint">
                  {t(($) => $.lessonRequests.noteUnavailable)}
                </FieldDescription>
              </Field>
            )}
            {stage === "approve" && (
              <>
                <Field>
                  <FieldLabel htmlFor="request-mode">
                    {t(($) => $.lessonRequests.fields.mode)}
                  </FieldLabel>
                  <NativeSelect
                    id="request-mode"
                    name="mode"
                    value={draft.mode}
                    disabled={locked}
                    onChange={(event) =>
                      change("mode", event.target.value as "existing" | "create")
                    }
                  >
                    <NativeSelectOption value="existing">
                      {t(($) => $.lessonRequests.existingSession)}
                    </NativeSelectOption>
                    <NativeSelectOption value="create">
                      {t(($) => $.lessonRequests.createSession)}
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                {draft.mode === "existing" ? (
                  <Field data-invalid={Boolean(errors.sessionId)}>
                    <FieldLabel htmlFor="request-session">
                      {t(($) => $.lessonRequests.fields.sessionId)}
                    </FieldLabel>
                    <NativeSelect
                      id="request-session"
                      name="sessionId"
                      value={draft.sessionId}
                      required
                      disabled={locked}
                      aria-invalid={Boolean(errors.sessionId)}
                      aria-describedby={errors.sessionId ? "request-session-error" : undefined}
                      onChange={(event) => change("sessionId", event.target.value)}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.lessonRequests.choose)}
                      </NativeSelectOption>
                      {sessions.map((row) => (
                        <NativeSelectOption key={row.id} value={row.id}>
                          {row.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError id="request-session-error">{errors.sessionId}</FieldError>
                  </Field>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="request-room">
                        {t(($) => $.lessonRequests.fields.roomId)}
                      </FieldLabel>
                      <NativeSelect
                        id="request-room"
                        name="roomId"
                        value={draft.roomId}
                        required
                        disabled={locked}
                        aria-invalid={Boolean(errors.roomId)}
                        aria-describedby={errors.roomId ? "request-room-error" : undefined}
                        onChange={(event) => change("roomId", event.target.value)}
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.lessonRequests.choose)}
                        </NativeSelectOption>
                        {rooms.map((row) => (
                          <NativeSelectOption key={row.id} value={row.id}>
                            {row.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldError id="request-room-error">{errors.roomId}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.instructorId)}>
                      <FieldLabel htmlFor="request-create-instructor">
                        {t(($) => $.lessonRequests.instructor)}
                      </FieldLabel>
                      <NativeSelect
                        id="request-create-instructor"
                        name="instructorId"
                        value={draft.instructorId}
                        disabled={locked || instructorFixed}
                        required
                        aria-invalid={Boolean(errors.instructorId)}
                        aria-describedby={
                          errors.instructorId ? "request-create-instructor-error" : undefined
                        }
                        onChange={(event) => change("instructorId", event.target.value)}
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.lessonRequests.choose)}
                        </NativeSelectOption>
                        {instructors.map((row) => (
                          <NativeSelectOption key={row.id} value={row.id}>
                            {row.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldError id="request-create-instructor-error">
                        {errors.instructorId}
                      </FieldError>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="request-capacity">
                        {t(($) => $.lessonRequests.fields.capacity)}
                      </FieldLabel>
                      <Input
                        id="request-capacity"
                        name="capacity"
                        value={draft.capacity}
                        inputMode="numeric"
                        required
                        disabled={locked}
                        aria-invalid={Boolean(errors.capacity)}
                        aria-describedby={errors.capacity ? "request-capacity-error" : undefined}
                        onChange={(event) => change("capacity", event.target.value)}
                      />
                      <FieldError id="request-capacity-error">{errors.capacity}</FieldError>
                    </Field>
                  </>
                )}
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.lessonRequests.approveNote)}
                </p>
                <Field orientation="horizontal">
                  <Checkbox
                    id="request-review"
                    aria-labelledby="request-review-label"
                    isSelected={draft.accepted}
                    isDisabled={locked}
                    onChange={(value) => onDraft({ ...draft, accepted: value })}
                  />
                  <FieldLabel id="request-review-label" htmlFor="request-review">
                    {t(($) => $.lessonRequests.approveReview)}
                  </FieldLabel>
                </Field>
              </>
            )}
          </form>
        )}
        {recovery}
      </div>
      <SheetFooter key={stage} className="flex-wrap">
        {stage === "view" ? (
          <>
            <Button
              variant="ghost"
              isDisabled={locked || !canResolve}
              onPress={() => onStage("reject")}
            >
              {t(($) => $.lessonRequests.reject)}
            </Button>
            <Button
              variant="outline"
              isDisabled={locked || !canResolve}
              onPress={() => onStage("alternative")}
            >
              {t(($) => $.lessonRequests.alternative)}
            </Button>
            <Button isDisabled={locked || !canApprove} onPress={() => onStage("approve")}>
              {t(($) => $.lessonRequests.approve)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" isDisabled={locked} onPress={() => onStage("view")}>
              {t(($) => $.lessonRequests.back)}
            </Button>
            <Button
              type="submit"
              form="lesson-request-action"
              isDisabled={locked || !onSubmit || (stage === "approve" && !draft.accepted)}
            >
              {submitLabels[stage]}
            </Button>
          </>
        )}
      </SheetFooter>
    </Sheet>
  );
}
