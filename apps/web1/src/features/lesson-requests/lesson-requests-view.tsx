import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "../../components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Field, FieldLabel, FieldError, FieldDescription } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Checkbox } from "../../components/ui/checkbox";
import type { RequestState } from "../../lib/api-contracts/generated";
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
        <CardContent className="min-w-0 [&_[data-slot=table-container]]:max-h-[min(65vh,32rem)]">
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
  notice,
  recovery,
  onClose,
  onSubmit,
  locked = false,
  canResolve = false,
  errors = {},
}: {
  name: string;
  subtitle: string;
  state: RequestState;
  stage: RequestStage;
  onStage: (stage: RequestStage) => void;
  draft: RequestDraft;
  onDraft: (draft: RequestDraft) => void;
  eligibility: { id: string; label: string; value: string; detail?: string }[] | null;
  note?: string;
  rooms: { id: string; name: string }[];
  instructors: { id: string; name: string }[];
  sessions: { id: string; name: string }[];
  notice?: ReactNode;
  recovery?: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  locked?: boolean;
  canResolve?: boolean;
  errors?: Partial<Record<keyof RequestDraft, string>>;
}) {
  const { t } = useTranslation();
  const change = <K extends keyof RequestDraft>(key: K, value: RequestDraft[K]) =>
    onDraft({ ...draft, [key]: value, accepted: false });
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
          {stage === "view"
            ? t(($) => $.lessonRequests.detailTitle, { name })
            : t(($) => $.lessonRequests.stageTitles[stage])}
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
        {stage === "view" ? (
          <>
            <Badge variant="outline">{t(($) => $.lessonRequests.states[state])}</Badge>
            <p className="text-sm text-muted-foreground">{t(($) => $.lessonRequests.intentNote)}</p>
            <p className="rounded-lg border p-3 text-sm">
              {note ?? t(($) => $.lessonRequests.noteUnavailable)}
            </p>
            <section>
              <h3 className="mb-3 text-sm font-medium">{t(($) => $.lessonRequests.eligibility)}</h3>
              <ItemGroup>
                {eligibility?.map((row) => (
                  <Item key={row.id} variant="outline">
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
            id="lesson-request-action"
            method="post"
            noValidate
            className="flex flex-col gap-4"
            aria-label={t(($) => $.lessonRequests.stageTitles[stage])}
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
                  aria-describedby="request-reason-hint request-reason-error"
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
                        aria-describedby={`request-${key}-error`}
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
                      aria-describedby="request-session-error"
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
                        onChange={(event) => change("capacity", event.target.value)}
                      />
                    </Field>
                  </>
                )}
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.lessonRequests.approveNote)}
                </p>
                <Checkbox
                  isSelected={draft.accepted}
                  isDisabled={locked}
                  onChange={(value) => onDraft({ ...draft, accepted: value })}
                >
                  {t(($) => $.lessonRequests.approveReview)}
                </Checkbox>
              </>
            )}
          </form>
        )}
        {recovery}
      </div>
      <SheetFooter className="flex-wrap">
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
            <Button isDisabled={locked || !canResolve} onPress={() => onStage("approve")}>
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
              {t(($) => $.lessonRequests.submit[stage])}
            </Button>
          </>
        )}
      </SheetFooter>
    </Sheet>
  );
}
