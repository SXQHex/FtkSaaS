import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  BanIcon,
  PencilIcon,
  PlayIcon,
  UserPlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button, LinkButton } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Progress } from "../../components/ui/progress";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { Field, FieldLabel, FieldGroup } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Textarea } from "../../components/ui/textarea";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import type { AttendanceResult, SessionCapacityView } from "../../lib/api-contracts/generated";

export interface SessionPersonRow {
  id: string;
  name: string;
  category: string;
  rights: string;
  reservation: string;
  attendance: string;
  action?: ReactNode;
}
export interface SessionWaitRow {
  id: string;
  position: string;
  name: string;
  joined: string;
  state: string;
  action?: ReactNode;
}
export interface SessionOfferRow {
  id: string;
  name: string;
  state: string;
  expires: string;
}
export function SessionDetailView({
  title,
  badges,
  facts,
  capacity,
  instructors,
  scheduleHref,
  actions,
  participants,
  attendance,
  waitlist,
  overlays,
}: {
  title: string;
  badges: string[];
  facts: { label: string; value: string }[];
  capacity: SessionCapacityView;
  instructors: { id: string; name: string }[];
  scheduleHref: string;
  actions?: {
    cancel?: () => void;
    edit?: () => void;
    start?: () => void;
    instructor?: () => void;
    locked?: boolean;
  };
  participants: ReactNode;
  attendance: ReactNode;
  waitlist: ReactNode;
  overlays?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <LinkButton href={scheduleHref} variant="ghost" size="sm" className="self-start">
        <ArrowLeftIcon data-icon="inline-start" />
        {t(($) => $.sessionDetail.back)}
      </LinkButton>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold wrap-anywhere">{title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {badges.map((badge, i) => (
              <Badge key={`${i}:${badge}`} variant={i ? "secondary" : "outline"}>
                {badge}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            isDisabled={actions?.locked || !actions?.cancel}
            onPress={actions?.cancel}
          >
            <BanIcon data-icon="inline-start" />
            {t(($) => $.sessionDetail.cancelSession)}
          </Button>
          <Button
            variant="outline"
            isDisabled={actions?.locked || !actions?.edit}
            onPress={actions?.edit}
          >
            <PencilIcon data-icon="inline-start" />
            {t(($) => $.sessionDetail.editSession)}
          </Button>
          <Button isDisabled={actions?.locked || !actions?.start} onPress={actions?.start}>
            <PlayIcon data-icon="inline-start" />
            {t(($) => $.sessionDetail.startAttendance)}
          </Button>
        </div>
      </header>
      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                <dd className="mt-1 font-medium tabular-nums wrap-anywhere">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="min-w-0">
          <Tabs defaultSelectedKey="participants" keyboardActivation="manual" className="min-w-0">
            <CardHeader className="min-w-0 border-b">
              <div className="max-w-full overflow-x-auto p-1">
                <TabsList
                  aria-label={t(($) => $.sessionDetail.sections)}
                  variant="line"
                  className="min-w-max"
                >
                  <TabsTrigger className="forced-colors:data-selected:outline-2" id="participants">
                    {t(($) => $.sessionDetail.participants)}
                  </TabsTrigger>
                  <TabsTrigger className="forced-colors:data-selected:outline-2" id="attendance">
                    {t(($) => $.sessionDetail.attendance)}
                  </TabsTrigger>
                  <TabsTrigger className="forced-colors:data-selected:outline-2" id="waitlist">
                    {t(($) => $.sessionDetail.waitlist)}
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <TabsContent id="participants">{participants}</TabsContent>
            <TabsContent id="attendance">{attendance}</TabsContent>
            <TabsContent id="waitlist">{waitlist}</TabsContent>
          </Tabs>
        </Card>
        <aside className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.sessionDetail.capacity)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-3xl font-semibold tabular-nums">
                {t(($) => $.sessionDetail.capacityValue, {
                  held: capacity.held,
                  total: capacity.total,
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(($) => $.sessionDetail.remaining, { remaining: capacity.remaining })}
              </p>
              <Progress
                aria-label={t(($) => $.sessionDetail.capacity)}
                value={capacity.held}
                maxValue={Math.max(1, capacity.total)}
              />
              {(["male", "female"] as const).map(
                (category) =>
                  capacity.categories?.[category] != null && (
                    <div key={category} className="flex flex-col gap-2">
                      <div className="flex justify-between gap-2">
                        <span>{t(($) => $.sessionDetail[category])}</span>
                        <span className="tabular-nums">
                          {t(($) => $.sessionDetail.capacityValue, {
                            held:
                              capacity.category_held?.[category] ??
                              t(($) => $.sessionDetail.unknown),
                            total: capacity.categories?.[category],
                          })}
                        </span>
                      </div>
                      {capacity.category_held?.[category] != null && (
                        <Progress
                          aria-label={t(($) => $.sessionDetail[category])}
                          value={capacity.category_held[category]}
                          maxValue={Math.max(1, capacity.categories?.[category] ?? 0)}
                        />
                      )}
                    </div>
                  ),
              )}
              <p className="text-xs text-muted-foreground">
                {t(($) => $.sessionDetail.capacityHint)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.sessionDetail.teacher)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {instructors.map((person) => (
                  <Item key={person.id} role="listitem" size="sm">
                    <Avatar>
                      <AvatarFallback>
                        {person.name.slice(0, 2).toLocaleUpperCase("tr")}
                      </AvatarFallback>
                    </Avatar>
                    <ItemContent>
                      <ItemTitle>{person.name}</ItemTitle>
                      <ItemDescription>{t(($) => $.sessionDetail.teacher)}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
              {!instructors.length && (
                <p className="text-muted-foreground">{t(($) => $.sessionDetail.unknown)}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="ghost"
                size="sm"
                isDisabled={actions?.locked || !actions?.instructor}
                onPress={actions?.instructor}
              >
                {t(($) => $.sessionDetail.changeTeacher)}
              </Button>
            </CardFooter>
          </Card>
        </aside>
      </div>
      {overlays}
    </div>
  );
}

export function SessionParticipants({
  rows,
  search,
  onSearch,
  onQuery,
  onAdd,
  locked,
  notice,
  pagination,
  filteredPerson,
  onClear,
}: {
  rows: SessionPersonRow[];
  search: string;
  onSearch: (value: string) => void;
  onQuery: () => void;
  onAdd?: () => void;
  locked?: boolean;
  notice?: ReactNode;
  pagination?: ReactNode;
  filteredPerson?: string;
  onClear?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CardContent className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onQuery();
          }}
          className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:flex-1 sm:basis-auto"
        >
          <InputGroup className="min-w-0 flex-1 basis-40">
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t(($) => $.sessionDetail.personSearch)}
              placeholder={t(($) => $.sessionDetail.personSearch)}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              disabled={locked}
            />
          </InputGroup>
          <Button type="submit" variant="outline" isDisabled={locked}>
            {t(($) => $.sessionDetail.search)}
          </Button>
        </form>
        <Button variant="outline" size="sm" isDisabled={locked || !onAdd} onPress={onAdd}>
          <UserPlusIcon data-icon="inline-start" />
          {t(($) => $.sessionDetail.addParticipant)}
        </Button>
      </CardContent>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {t(($) => $.sessionDetail.participantScope)}
        </p>
        {filteredPerson && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {t(($) => $.sessionDetail.filteredPerson, { name: filteredPerson })}
            </Badge>
            <Button size="sm" variant="ghost" isDisabled={locked} onPress={onClear}>
              {t(($) => $.sessionDetail.clearPerson)}
            </Button>
          </div>
        )}
        {notice}
        <Table aria-label={t(($) => $.sessionDetail.participants)} className="min-w-[38rem]">
          <TableHeader>
            <TableHead isRowHeader>{t(($) => $.sessionDetail.person)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.category)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.rights)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.reservation)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.attendance)}</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <Empty>
                <EmptyDescription>{t(($) => $.sessionDetail.emptyParticipants)}</EmptyDescription>
              </Empty>
            )}
          >
            {rows.map((row) => (
              <TableRow key={row.id} id={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.rights}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{row.reservation}</Badge>
                    {row.action}
                  </div>
                </TableCell>
                <TableCell>{row.attendance}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {pagination && <CardFooter className="flex-wrap gap-2">{pagination}</CardFooter>}
    </div>
  );
}

export interface SessionAttendanceRow {
  id: string;
  name: string;
  result: AttendanceResult;
  protected: boolean;
  detail?: string;
  canBlock?: boolean;
  readOnly?: boolean;
}
export function SessionAttendance({
  rows,
  startedAt,
  closed,
  editing,
  reason,
  onReason,
  onResult,
  onSaveRow,
  onBlock,
  onEdit,
  onCancel,
  onPreview,
  onClose,
  notice,
  locked,
  correction,
  unavailable = false,
}: {
  rows: SessionAttendanceRow[];
  startedAt?: string;
  closed: boolean;
  editing: boolean;
  reason: string;
  onReason: (reason: string) => void;
  onResult?: (id: string, value: AttendanceResult) => void;
  onSaveRow?: (id: string) => void;
  onBlock?: (id: string) => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onPreview?: () => void;
  onClose?: () => void;
  notice?: ReactNode;
  locked?: boolean;
  correction?: ReactNode;
  unavailable?: boolean;
}) {
  const { t } = useTranslation(),
    reasonId = useId();
  return (
    <div className="flex flex-col gap-4">
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {startedAt
            ? t(($) => $.sessionDetail.attendanceStarted, { date: startedAt })
            : t(($) => $.sessionDetail.attendanceNote)}
        </p>
        {notice}
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.id} role="listitem" size="sm" className="flex-wrap">
              <ItemContent>
                <ItemTitle>{row.name}</ItemTitle>
                {row.detail && <ItemDescription>{row.detail}</ItemDescription>}
                {row.protected && (
                  <ItemDescription>{t(($) => $.sessionDetail.protected)}</ItemDescription>
                )}
              </ItemContent>
              <ItemActions className="max-w-full flex-wrap">
                <NativeSelect
                  aria-label={t(($) => $.sessionDetail.attendanceResult, { name: row.name })}
                  value={row.result}
                  disabled={locked || !onResult || row.readOnly || (closed && !editing)}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "unmarked" ||
                      value === "attended" ||
                      value === "no_show" ||
                      value === "blocked"
                    )
                      onResult?.(row.id, value);
                  }}
                >
                  <NativeSelectOption value="unmarked" disabled>
                    {t(($) => $.sessionDetail.unmarked)}
                  </NativeSelectOption>
                  <NativeSelectOption value="attended">
                    {t(($) => $.sessionDetail.present)}
                  </NativeSelectOption>
                  <NativeSelectOption value="no_show">
                    {t(($) => $.sessionDetail.absent)}
                  </NativeSelectOption>
                  <NativeSelectOption value="blocked" disabled={!row.canBlock}>
                    {t(($) => $.sessionDetail.blocked)}
                  </NativeSelectOption>
                </NativeSelect>
                {!closed && (
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={
                      locked ||
                      !onSaveRow ||
                      row.readOnly ||
                      !["attended", "no_show"].includes(row.result)
                    }
                    onPress={() => onSaveRow?.(row.id)}
                  >
                    {t(($) => $.sessionDetail.mark, { name: row.name })}
                  </Button>
                )}
                {!closed && row.canBlock && (
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={locked || !onBlock || row.readOnly}
                    onPress={() => onBlock?.(row.id)}
                  >
                    {t(($) => $.sessionDetail.blockAttendance)}
                  </Button>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
        {!rows.length && !unavailable && (
          <Empty>
            <EmptyDescription>{t(($) => $.sessionDetail.attendanceEmpty)}</EmptyDescription>
          </Empty>
        )}
        {editing && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={reasonId}>
                {t(($) => $.sessionDetail.correctionReason)}
              </FieldLabel>
              <Textarea
                id={reasonId}
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                disabled={locked}
              />
            </Field>
          </FieldGroup>
        )}
        {correction}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t(($) => $.sessionDetail.attendanceEffect)}
        </p>
        <div className="flex flex-wrap gap-2">
          {closed ? (
            editing ? (
              <>
                <Button variant="outline" isDisabled={locked} onPress={onCancel}>
                  {t(($) => $.sessionDetail.cancel)}
                </Button>
                <Button isDisabled={locked || !onPreview || !reason.trim()} onPress={onPreview}>
                  {t(($) => $.sessionDetail.previewCorrection)}
                </Button>
              </>
            ) : (
              <Button variant="outline" isDisabled={locked || !onEdit} onPress={onEdit}>
                {t(($) => $.sessionDetail.editAttendance)}
              </Button>
            )
          ) : (
            <Button isDisabled={locked || !onClose} onPress={onClose}>
              {t(($) => $.sessionDetail.closeAttendance)}
            </Button>
          )}
        </div>
      </CardFooter>
    </div>
  );
}

export function SessionWaitlist({
  rows,
  offers,
  notice,
  disabled,
  onAdd,
  pagination,
  locked,
}: {
  rows: SessionWaitRow[];
  offers: SessionOfferRow[];
  notice?: ReactNode;
  disabled?: boolean;
  onAdd?: () => void;
  pagination?: ReactNode;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t(($) => $.sessionDetail.waitlist)}</p>
        <Button
          size="sm"
          variant="outline"
          isDisabled={locked || disabled || !onAdd}
          onPress={onAdd}
        >
          <UserPlusIcon data-icon="inline-start" />
          {t(($) => $.sessionDetail.addWaitlist)}
        </Button>
      </CardContent>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {notice}
        {disabled && (
          <Empty>
            <EmptyDescription>
              {t(($) => $.sessionDetail.waitlistDisabled)} —{" "}
              {t(($) => $.sessionDetail.waitlistDisabledHint)}
            </EmptyDescription>
          </Empty>
        )}
        <Table aria-label={t(($) => $.sessionDetail.waitlist)} className="min-w-[35rem]">
          <TableHeader>
            <TableHead>{t(($) => $.sessionDetail.position)}</TableHead>
            <TableHead isRowHeader>{t(($) => $.sessionDetail.person)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.joined)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.state)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.actions)}</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <Empty>
                <EmptyDescription>{t(($) => $.sessionDetail.emptyWaitlist)}</EmptyDescription>
              </Empty>
            )}
          >
            {rows.map((row) => (
              <TableRow key={row.id} id={row.id}>
                <TableCell>{row.position}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.joined}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.state}</Badge>
                </TableCell>
                <TableCell>{row.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pagination && <div className="flex flex-wrap gap-2">{pagination}</div>}
        <h3 className="font-medium">{t(($) => $.sessionDetail.offerHistory)}</h3>
        <Table aria-label={t(($) => $.sessionDetail.offerHistory)} className="min-w-[28rem]">
          <TableHeader>
            <TableHead isRowHeader>{t(($) => $.sessionDetail.person)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.result)}</TableHead>
            <TableHead>{t(($) => $.sessionDetail.expires)}</TableHead>
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <Empty>
                <EmptyDescription>{t(($) => $.sessionDetail.emptyHistory)}</EmptyDescription>
              </Empty>
            )}
          >
            {offers.map((offer) => (
              <TableRow key={offer.id} id={offer.id}>
                <TableCell>{offer.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{offer.state}</Badge>
                </TableCell>
                <TableCell>{offer.expires}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <CardDescription>{t(($) => $.sessionDetail.offerNote)}</CardDescription>
      </CardFooter>
    </div>
  );
}
