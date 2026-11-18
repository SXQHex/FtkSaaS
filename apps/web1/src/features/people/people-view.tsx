import { useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { SearchIcon, LinkIcon, MergeIcon, UploadIcon, UserPlusIcon, XIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "../../components/ui/card";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
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
  FieldError,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { Pagination, PaginationContent, PaginationItem } from "../../components/ui/pagination";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { Alert, AlertDescription } from "../../components/ui/alert";

export interface PeopleRow {
  id: string;
  name: string;
  email: string | null;
  state: "active" | "inactive" | "none" | "unknown";
  entitlement: {
    label: string;
    available?: number;
    total?: number;
    low?: boolean;
    summary?: string;
  } | null;
  nextSession: string | null;
  debt: string | null;
  debtOutstanding?: boolean;
}
export type PeopleFilter = "all" | "active" | "inactive";

// Page composition only. Membership, balances and invitation outcomes are supplied
// by their scoped readers; this view never derives them from fixture/demo rules.
export function PeopleView({
  rows,
  state,
  search,
  filter,
  selectedId,
  activeSummary,
  hasPrevious,
  hasNext,
  onSearch,
  onFilter,
  onSelect,
  onPrevious,
  onNext,
  onRetry,
  actions,
  onInvite,
  mergeCount,
  onProfile,
  onAllocate,
  filterUnavailable = false,
  interactionLocked = false,
  noticeContent,
}: {
  rows: PeopleRow[];
  state: "loading" | "ready" | "error";
  search: string;
  filter: PeopleFilter;
  selectedId?: string;
  activeSummary: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onSearch: (value: string) => void;
  onFilter?: (value: PeopleFilter) => void;
  onSelect: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
  actions: { invitations?: () => void; merge?: () => void; import?: () => void };
  onInvite?: () => void;
  mergeCount?: number;
  onProfile?: (id: string) => void;
  onAllocate?: (id: string) => void;
  filterUnavailable?: boolean;
  interactionLocked?: boolean;
  noticeContent?: ReactNode;
}) {
  const { t } = useTranslation();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const selected = rows.find((row) => row.id === selectedId);
  const unknown = t(($) => $.people.unknown);
  const status = (row: PeopleRow) => t(($) => $.people.states[row.state]);
  const initial = (row: PeopleRow) =>
    row.name
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
  const details = selected && (
    <>
      <div className="flex items-center gap-3">
        <Avatar className="size-16">
          <AvatarFallback>{initial(selected)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="text-base font-semibold break-words">{selected.name}</h2>
          <Badge variant="outline" className="mt-1">
            {status(selected)}
          </Badge>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
        <dt>{t(($) => $.people.entitlement)}</dt>
        <dd>{selected.entitlement?.summary ?? selected.entitlement?.label ?? unknown}</dd>
        <dt>{t(($) => $.people.nextShort)}</dt>
        <dd className="tabular-nums">{selected.nextSession ?? unknown}</dd>
        <dt>{t(($) => $.people.debt)}</dt>
        <dd className="tabular-nums">{selected.debt ?? unknown}</dd>
        <dt>{t(($) => $.people.email)}</dt>
        <dd>{selected.email ?? t(($) => $.people.contactHidden)}</dd>
      </dl>
    </>
  );
  const detailActions = selected && (
    <>
      <Button
        variant="outline"
        size="sm"
        isDisabled={!onAllocate}
        onPress={() => onAllocate?.(selected.id)}
      >
        {t(($) => $.people.allocate)}
      </Button>
      <Button size="sm" isDisabled={!onProfile} onPress={() => onProfile?.(selected.id)}>
        {t(($) => $.people.profile)}
      </Button>
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6" inert={interactionLocked}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.people.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.people.description)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" isDisabled={!actions.invitations} onPress={actions.invitations}>
            <LinkIcon />
            {t(($) => $.people.invitations)}
          </Button>
          <Button variant="outline" isDisabled={!actions.merge} onPress={actions.merge}>
            <MergeIcon />
            {t(($) => $.people.merge)}
            {mergeCount !== undefined && <Badge variant="secondary">{mergeCount}</Badge>}
          </Button>
          <Button variant="outline" isDisabled={!actions.import} onPress={actions.import}>
            <UploadIcon />
            {t(($) => $.people.import)}
          </Button>
          <Button isDisabled={!onInvite} onPress={onInvite}>
            <UserPlusIcon />
            {t(($) => $.people.invite)}
          </Button>
        </div>
      </div>
      {noticeContent}
      {filterUnavailable && (
        <p className="text-xs text-muted-foreground">{t(($) => $.people.filterUnavailable)}</p>
      )}
      {state === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {t(($) => $.people.readError)}
            <Button variant="outline" size="sm" onPress={onRetry}>
              {t(($) => $.people.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid min-w-0 items-start gap-4 min-[1181px]:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 gap-0 pt-3">
          <CardHeader className="flex flex-wrap items-center gap-3 pb-3">
            <InputGroup className="w-full max-w-56 rounded-md border-input bg-transparent">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={t(($) => $.people.search)}
                placeholder={t(($) => $.people.search)}
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                autoComplete="off"
              />
            </InputGroup>
            <ToggleGroup
              variant="segmented"
              size="segmented"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([filter])}
              onSelectionChange={(keys) => onFilter?.(String([...keys][0]) as PeopleFilter)}
              aria-label={t(($) => $.people.status)}
            >
              <ToggleGroupItem id="all">{t(($) => $.people.all)}</ToggleGroupItem>
              <ToggleGroupItem id="active" isDisabled={filterUnavailable}>
                {t(($) => $.people.states.active)}
              </ToggleGroupItem>
              <ToggleGroupItem id="inactive" isDisabled={filterUnavailable}>
                {t(($) => $.people.states.inactive)}
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent className="min-w-0 pb-1">
            <Table
              aria-label={t(($) => $.people.title)}
              aria-busy={state === "loading"}
              className="min-w-[34rem] [&_[data-slot=table-cell]]:py-[11px]"
              selectionMode="single"
              selectionBehavior="replace"
              selectedKeys={selectedId ? new Set([selectedId]) : new Set()}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const id = [...keys][0];
                if (id !== undefined) {
                  onSelect(String(id));
                  if (window.matchMedia("(max-width: 1180px)").matches) setSummaryOpen(true);
                }
              }}
            >
              <TableHeader>
                <TableHead isRowHeader className="w-[34%]">
                  {t(($) => $.people.member)}
                </TableHead>
                <TableHead>{t(($) => $.people.status)}</TableHead>
                <TableHead>{t(($) => $.people.entitlement)}</TableHead>
                <TableHead>{t(($) => $.people.nextSession)}</TableHead>
                <TableHead className="last:text-left">{t(($) => $.people.debt)}</TableHead>
              </TableHeader>
              <TableBody
                items={state === "ready" ? rows : []}
                renderEmptyState={() => (
                  <Empty className="p-5">
                    <EmptyDescription>
                      {t(($) =>
                        state === "loading"
                          ? $.people.loading
                          : state === "error"
                            ? $.people.readError
                            : $.people.empty,
                      )}
                    </EmptyDescription>
                  </Empty>
                )}
              >
                {(row) => (
                  <TableRow id={row.id} textValue={row.name}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-6">
                          <AvatarFallback>{initial(row)}</AvatarFallback>
                        </Avatar>
                        <span className="flex min-w-0 flex-col">
                          <span>{row.name}</span>
                          {row.email && (
                            <span className="text-xs text-muted-foreground">{row.email}</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.state === "active" ? "outline" : "secondary"}>
                        {status(row)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.entitlement ? (
                        <div className="flex items-center gap-2">
                          {row.entitlement.available !== undefined &&
                            row.entitlement.total !== undefined &&
                            row.entitlement.total > 0 && (
                              <Progress
                                className="w-14 shrink-0 [&_[data-slot=progress-track]]:h-1"
                                aria-label={t(($) => $.people.entitlementFor, { name: row.name })}
                                value={row.entitlement.available}
                                maxValue={row.entitlement.total}
                              />
                            )}
                          <span className="tabular-nums">{row.entitlement.label}</span>
                          {row.entitlement.low && (
                            <Badge variant="outline">{t(($) => $.people.low)}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{unknown}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.nextSession ?? unknown}</TableCell>
                    <TableCell
                      data-outstanding={row.debtOutstanding || undefined}
                      className="tabular-nums last:text-left data-[outstanding=true]:text-destructive"
                    >
                      {row.debt ?? unknown}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-between gap-3 border-t py-2.5 pt-2.5!">
            <p className="text-xs text-muted-foreground" role="status">
              {t(($) => $.people.shown, { count: state === "ready" ? rows.length : 0 })}
              {activeSummary && `, ${activeSummary}`}
            </p>
            <Pagination aria-label={t(($) => $.people.pagination)} className="m-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={!hasPrevious || state === "loading"}
                    onPress={onPrevious}
                  >
                    {t(($) => $.people.previous)}
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={!hasNext || state === "loading"}
                    onPress={onNext}
                  >
                    {t(($) => $.people.next)}
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        </Card>
        <aside
          aria-label={t(($) => $.people.summary)}
          className="sticky top-18 hidden min-w-0 min-[1181px]:block"
        >
          <Card>
            <CardContent>
              {details ?? (
                <p className="py-5 text-center text-muted-foreground">
                  {t(($) => $.people.selectPerson)}
                </p>
              )}
            </CardContent>
            {selected && (
              <CardFooter className="flex flex-wrap justify-between gap-2 border-t py-2.5 pt-2.5!">
                {detailActions}
              </CardFooter>
            )}
          </Card>
        </aside>
      </div>
      {selected && (
        <Sheet showCloseButton={false} isOpen={summaryOpen} onOpenChange={setSummaryOpen}>
          <SheetHeader className="relative pr-14">
            <SheetClose
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4"
              aria-label={t(($) => $.studio.close)}
            >
              <XIcon />
            </SheetClose>
            <SheetTitle>{t(($) => $.people.summary)}</SheetTitle>
            <SheetDescription>{t(($) => $.people.summaryDescription)}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{details}</div>
          <SheetFooter className="flex-wrap">{detailActions}</SheetFooter>
        </Sheet>
      )}
    </div>
  );
}

export function PeopleEntrySheet({
  open,
  onClose,
  name,
  email,
  onName,
  onEmail,
  onSubmit,
  busy = false,
  personCreated = false,
  invitationNotice,
  onSendInvitation,
  locked = false,
  nameError,
  emailError,
  onNameBlur,
  onEmailBlur,
  formRef,
  recoveryActions,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onSubmit?: () => void;
  busy?: boolean;
  personCreated?: boolean;
  invitationNotice?: string;
  onSendInvitation?: () => void;
  locked?: boolean;
  nameError?: string;
  emailError?: string;
  onNameBlur?: () => void;
  onEmailBlur?: () => void;
  formRef?: RefObject<HTMLFormElement | null>;
  recoveryActions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      showCloseButton={false}
      isOpen={open}
      onOpenChange={(value) => {
        if (!value && !busy && !locked) onClose();
      }}
      isDismissable={!busy && !locked}
      isKeyboardDismissDisabled={busy || locked}
    >
      <SheetHeader className="relative pr-14">
        <SheetClose
          variant="ghost"
          size="icon-sm"
          className="absolute top-4 right-4"
          isDisabled={busy || locked}
          aria-label={t(($) => $.studio.close)}
        >
          <XIcon />
        </SheetClose>
        <SheetTitle>{t(($) => $.people.invite)}</SheetTitle>
        <SheetDescription>{t(($) => $.people.entryDescription)}</SheetDescription>
      </SheetHeader>
      <form
        id="people-entry"
        ref={formRef}
        aria-label={t(($) => $.people.invite)}
        aria-busy={busy}
        method="post"
        noValidate
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!personCreated && !busy && !locked) onSubmit?.();
        }}
      >
        <FieldGroup className="gap-4">
          {personCreated && (
            <Alert role="status">
              <AlertDescription>{t(($) => $.people.personCreated)}</AlertDescription>
            </Alert>
          )}
          {invitationNotice && (
            <Alert role="status" id="people-entry-notice" tabIndex={-1}>
              <AlertDescription>{invitationNotice}</AlertDescription>
            </Alert>
          )}
          <Field data-invalid={Boolean(nameError)}>
            <FieldLabel htmlFor="people-name">
              {t(($) => $.people.fullName)} <span aria-hidden="true">*</span>
            </FieldLabel>
            <Input
              id="people-name"
              autoFocus
              onBlur={onNameBlur}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "people-name-error" : undefined}
              name="display_name"
              readOnly={personCreated}
              required
              autoComplete="name"
              value={name}
              onChange={(event) => onName(event.target.value)}
              disabled={busy || locked}
            />
            {nameError && <FieldError id="people-name-error">{nameError}</FieldError>}
          </Field>
          <Field data-invalid={Boolean(emailError)}>
            <FieldLabel htmlFor="people-email">
              {t(($) => $.people.email)} <span aria-hidden="true">*</span>
            </FieldLabel>
            <Input
              id="people-email"
              onBlur={onEmailBlur}
              aria-invalid={Boolean(emailError)}
              name="email"
              readOnly={personCreated}
              required
              type="email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => onEmail(event.target.value)}
              disabled={busy || locked}
              aria-describedby={
                emailError ? "people-email-error people-entry-hint" : "people-entry-hint"
              }
            />
            {emailError && <FieldError id="people-email-error">{emailError}</FieldError>}
            <FieldDescription id="people-entry-hint">
              {t(($) => $.people.entryHint)}
            </FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <div className="min-w-0 flex-1">
              <FieldLabel htmlFor="people-activate-later">
                {t(($) => $.people.activateAfterAccept)}
              </FieldLabel>
              <FieldDescription>{t(($) => $.people.activationSeparate)}</FieldDescription>
            </div>
            <Switch
              id="people-activate-later"
              aria-label={t(($) => $.people.activateAfterAccept)}
              isSelected={false}
              isDisabled
            />
          </Field>
        </FieldGroup>
      </form>
      {recoveryActions && <div className="px-5 pb-3">{recoveryActions}</div>}
      <SheetFooter>
        <Button variant="outline" isDisabled={busy || locked} onPress={onClose}>
          {t(($) => $.people.cancel)}
        </Button>
        {personCreated ? (
          <Button
            id="people-send-invitation"
            isDisabled={busy || locked || !onSendInvitation}
            onPress={onSendInvitation}
          >
            {t(($) => $.people.sendInvitation)}
          </Button>
        ) : (
          <Button type="submit" form="people-entry" isDisabled={busy || locked || !onSubmit}>
            {t(($) => $.people.createPerson)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
