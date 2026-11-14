import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import { Button, LinkButton } from "../../components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Progress } from "../../components/ui/progress";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { StudioSheets, type StudioSheetSelection } from "./studio-sheets";
import { AvailabilityPanel, type AvailabilityDraft } from "./availability-panel";

export interface StudioInstructor {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  classes: string[];
  weeklySessions: number | null;
  classIds: string[];
}
export interface StudioRoom {
  id: string;
  name: string;
  capacity: number | null;
  usage: string | null;
  active: boolean;
  classes: string[];
}
export interface StudioClass {
  id: string;
  name: string;
  duration: number | null;
  capacity: number | null;
  room: string | null;
  instructor: string | null;
  weeklySessions: number | null;
  active: boolean;
  disciplineId: string | null;
  externalOpen: boolean;
  waitlist: boolean;
}
export interface StudioClosure {
  id: string;
  period: string;
  scope: string;
  reason: string;
  affectedSessions: number | null;
  status: string;
  past: boolean;
}
export interface StudioAgreement {
  id: string;
  instructorId: string;
  instructor: string;
  model: string;
  fee: string;
  effective: string;
  version: string;
  weeklyEstimate: string | null;
}
export interface StudioViewData {
  instructors: StudioInstructor[];
  rooms: StudioRoom[];
  roomLimit: number | null;
  classes: StudioClass[];
  closures: StudioClosure[];
  agreements: StudioAgreement[];
  disciplines: { id: string; name: string }[];
  compatibility: { classId: string; roomId: string; allowed: boolean; writable: boolean }[];
  availability: Record<string, AvailabilityDraft>;
  setup: { key: string; label: string; description?: string; complete: boolean; href?: string }[];
}

// Domain composition only: all controls, tables, tabs and overlays use the installed registry.
// Writes remain unavailable until their canonical read/permission/version context is supplied.
export function StudioView({
  data,
  state,
  settingsHref,
  earningsHref,
  onRetry,
  renderEditor,
  availabilityContent,
  editorControl,
  noticeContent,
}: {
  data: StudioViewData;
  state: "loading" | "ready" | "error";
  settingsHref: string;
  earningsHref: string;
  onRetry: () => void;
  availabilityContent?: ReactNode;
  noticeContent?: ReactNode;
  editorControl?: {
    selection?: StudioSheetSelection;
    onChange: (selection?: StudioSheetSelection) => void;
  };
  renderEditor?: (selection: StudioSheetSelection, onClose: () => void) => ReactNode;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("all");
  const [setupHidden, setSetupHidden] = useState(false);
  const [localSelection, setLocalSelection] = useState<StudioSheetSelection>();
  const selection = editorControl ? editorControl.selection : localSelection;
  const setSelection = editorControl ? editorControl.onChange : setLocalSelection;
  const [compatibility, setCompatibility] = useState<Record<string, boolean>>({});
  const instructors = data.instructors.filter(
    (item) => filter === "all" || item.active === (filter === "active"),
  );
  const completed = data.setup.filter((item) => item.complete).length;
  const empty =
    state === "loading"
      ? t(($) => $.studio.loading)
      : state === "error"
        ? t(($) => $.studio.readError)
        : t(($) => $.studio.empty);
  const status = (active: boolean, resource = false) => (
    <Badge variant={active ? "outline" : "secondary"}>
      {resource
        ? active
          ? t(($) => $.studio.open)
          : t(($) => $.studio.closed)
        : active
          ? t(($) => $.studio.active)
          : t(($) => $.studio.inactive)}
    </Badge>
  );
  return (
    <main
      className="studio-view flex min-w-0 w-full max-w-[76rem] flex-col gap-4 px-4 pt-5 pb-12 min-[901px]:px-8"
      aria-busy={state === "loading"}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{t(($) => $.studio.title)}</h1>
          <p className="text-muted-foreground">
            {t(($) => $.studio.description)}{" "}
            <a className="underline underline-offset-2" href={settingsHref}>
              {t(($) => $.studio.settings)}
            </a>
            {t(($) => $.studio.settingsSuffix)}
          </p>
        </div>
        <Button isDisabled={state !== "ready"} onPress={() => setSelection({ kind: "instructor" })}>
          <UserPlusIcon />
          {t(($) => $.studio.addInstructor)}
        </Button>
      </header>
      {noticeContent}
      {state === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {t(($) => $.studio.readError)}
            <Button variant="outline" onPress={onRetry}>
              {t(($) => $.studio.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!setupHidden && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center gap-3">
            <div className="mr-auto">
              <h2 className="text-base font-semibold">{t(($) => $.studio.setup)}</h2>
              <p className="text-[13px] text-muted-foreground">
                {t(($) => $.studio.setupDescription)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {data.setup.length ? `${completed}/${data.setup.length}` : "—"}
            </span>
            {data.setup.length > 0 && completed === data.setup.length && (
              <Button variant="ghost" size="sm" onPress={() => setSetupHidden(true)}>
                {t(($) => $.studio.hide)}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Progress
              aria-label={t(($) => $.studio.setup)}
              isIndeterminate={!data.setup.length}
              value={data.setup.length ? (completed / data.setup.length) * 100 : undefined}
            />
            <ul className="mt-3.5 grid gap-x-6 min-[721px]:grid-cols-2">
              {data.setup.map((item) => (
                <li
                  key={item.key}
                  className="flex min-h-14 items-center gap-2.5 border-t border-border py-2 text-[13px]"
                >
                  <Badge
                    aria-hidden="true"
                    variant={item.complete ? "default" : "outline"}
                    className="size-4.5 shrink-0 rounded-full p-0"
                  >
                    {item.complete && <CheckIcon />}
                  </Badge>
                  <span className="mr-auto grid min-w-0 gap-0.5">
                    <span
                      className={
                        item.complete ? "font-medium text-muted-foreground" : "font-semibold"
                      }
                    >
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </span>
                  {!item.complete && item.href && (
                    <LinkButton href={item.href} variant="outline" size="sm">
                      {t(($) => $.studio.finishSetup)}
                    </LinkButton>
                  )}
                  <span className="sr-only">
                    {item.complete ? t(($) => $.studio.complete) : t(($) => $.studio.pending)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Tabs defaultSelectedKey="instructors" keyboardActivation="manual" className="min-w-0 gap-4">
        <div className="-m-1 min-w-0 overflow-x-auto p-1">
          <TabsList
            aria-label={t(($) => $.studio.sections)}
            className="h-9! gap-0.5 rounded-lg [&_[data-slot=tabs-trigger]]:flex-none [&_[data-slot=tabs-trigger]]:rounded-md [&_[data-slot=tabs-trigger]]:px-3 [&_[data-slot=tabs-trigger]]:data-selected:after:bottom-0 [&_[data-slot=tabs-trigger]]:data-selected:after:border-b-2 [&_[data-slot=tabs-trigger]]:data-selected:after:opacity-0 [&_[data-slot=tabs-trigger]]:forced-colors:data-selected:after:opacity-100"
          >
            <TabsTrigger id="instructors">{t(($) => $.studio.instructors)}</TabsTrigger>
            <TabsTrigger id="resources">{t(($) => $.studio.resources)}</TabsTrigger>
            <TabsTrigger id="availability">{t(($) => $.studio.availability)}</TabsTrigger>
            <TabsTrigger id="closures">{t(($) => $.studio.closures)}</TabsTrigger>
            <TabsTrigger id="agreements">{t(($) => $.studio.agreements)}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent id="instructors">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{t(($) => $.studio.instructors)}</h2>
              <ToggleGroup
                variant="segmented"
                size="segmented"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set([filter])}
                aria-label={t(($) => $.studio.status)}
                onSelectionChange={(keys) => setFilter(String([...keys][0]))}
              >
                <ToggleGroupItem id="all">{t(($) => $.studio.all)}</ToggleGroupItem>
                <ToggleGroupItem id="active">{t(($) => $.studio.active)}</ToggleGroupItem>
                <ToggleGroupItem id="inactive">{t(($) => $.studio.inactive)}</ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              <Table
                aria-label={t(($) => $.studio.instructors)}
                className="[&_[data-slot=table-cell]]:py-2.5"
              >
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.studio.instructor)}</TableHead>
                  <TableHead>{t(($) => $.studio.classes)}</TableHead>
                  <TableHead className="text-right">{t(($) => $.studio.weeklySessions)}</TableHead>
                  <TableHead className="last:text-left">{t(($) => $.studio.status)}</TableHead>
                </TableHeader>
                <TableBody items={instructors} renderEmptyState={() => empty}>
                  {(item) => (
                    <TableRow id={item.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          className="h-auto justify-start gap-2.5 px-0 py-0 text-left"
                          onPress={() => setSelection({ kind: "instructor", id: item.id })}
                        >
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px]">
                              {item.name
                                .trim()
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toLocaleUpperCase("tr")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="grid gap-0.5 text-[13px] font-normal">
                            <span>{item.name}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {item.email ?? "—"}
                            </span>
                          </span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.classes.length
                            ? item.classes.map((name) => (
                                <Badge key={name} variant="secondary">
                                  {name}
                                </Badge>
                              ))
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.weeklySessions ?? "—"}
                      </TableCell>
                      <TableCell className="last:text-left">{status(item.active)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {state === "ready"
                  ? t(($) => $.studio.instructorCount, {
                      count: instructors.length,
                      active: instructors.filter((item) => item.active).length,
                    })
                  : empty}
              </span>
              <span>{t(($) => $.studio.editHint)}</span>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent id="resources">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{t(($) => $.studio.classTypes)}</h2>
                  <p className="text-[13px] text-muted-foreground">
                    {t(($) => $.studio.classDescription)}
                  </p>
                </div>
                <Button
                  isDisabled={state !== "ready"}
                  variant="outline"
                  size="sm"
                  onPress={() => setSelection({ kind: "class" })}
                >
                  <PlusIcon />
                  {t(($) => $.studio.addClass)}
                </Button>
              </CardHeader>
              <CardContent>
                <Table aria-label={t(($) => $.studio.classTypes)}>
                  <TableHeader>
                    <TableHead isRowHeader>{t(($) => $.studio.lesson)}</TableHead>
                    <TableHead>{t(($) => $.studio.duration)}</TableHead>
                    <TableHead className="text-right">{t(($) => $.studio.capacity)}</TableHead>
                    <TableHead>{t(($) => $.studio.room)}</TableHead>
                    <TableHead>{t(($) => $.studio.instructor)}</TableHead>
                    <TableHead className="text-right">
                      {t(($) => $.studio.weeklySessions)}
                    </TableHead>
                    <TableHead className="last:text-left">{t(($) => $.studio.status)}</TableHead>
                  </TableHeader>
                  <TableBody items={data.classes} renderEmptyState={() => empty}>
                    {(item) => (
                      <TableRow id={item.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-auto px-0 py-0 text-sm font-normal"
                            onPress={() => setSelection({ kind: "class", id: item.id })}
                          >
                            {item.name}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {item.duration === null
                            ? "—"
                            : t(($) => $.studio.minutes, { count: item.duration })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.capacity ?? "—"}
                        </TableCell>
                        <TableCell>{item.room ?? "—"}</TableCell>
                        <TableCell>{item.instructor ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.weeklySessions ?? "—"}
                        </TableCell>
                        <TableCell className="last:text-left">
                          {status(item.active, true)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                {t(($) => $.studio.editHint)}
              </CardFooter>
            </Card>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{t(($) => $.studio.rooms)}</h2>
                  <p className="text-[13px] text-muted-foreground">
                    {data.roomLimit === null
                      ? t(($) => $.studio.roomCount, {
                          count: data.rooms.filter((item) => item.active).length,
                        })
                      : t(($) => $.studio.roomUsageCount, {
                          count: data.rooms.filter((item) => item.active).length,
                          limit: data.roomLimit,
                        })}
                  </p>
                </div>
                <Button
                  isDisabled={state !== "ready"}
                  variant="outline"
                  size="sm"
                  onPress={() => setSelection({ kind: "room" })}
                >
                  <PlusIcon />
                  {t(($) => $.studio.addRoom)}
                </Button>
              </CardHeader>
              <CardContent>
                <Table aria-label={t(($) => $.studio.rooms)}>
                  <TableHeader>
                    <TableHead isRowHeader>{t(($) => $.studio.room)}</TableHead>
                    <TableHead>{t(($) => $.studio.usage)}</TableHead>
                    <TableHead className="text-right">{t(($) => $.studio.capacity)}</TableHead>
                    <TableHead>{t(($) => $.studio.classes)}</TableHead>
                    <TableHead className="last:text-left">{t(($) => $.studio.status)}</TableHead>
                  </TableHeader>
                  <TableBody items={data.rooms} renderEmptyState={() => empty}>
                    {(item) => (
                      <TableRow id={item.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-auto px-0 py-0 text-sm font-normal"
                            onPress={() => setSelection({ kind: "room", id: item.id })}
                          >
                            {item.name}
                          </Button>
                        </TableCell>
                        <TableCell>{item.usage ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.capacity ?? "—"}
                        </TableCell>
                        <TableCell>{item.classes.join(", ") || "—"}</TableCell>
                        <TableCell className="last:text-left">
                          {status(item.active, true)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">{t(($) => $.studio.compatibility)}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {t(($) => $.studio.compatibilityDescription)}
                </p>
              </CardHeader>
              <CardContent>
                <Table aria-label={t(($) => $.studio.compatibility)}>
                  <TableHeader>
                    <TableHead isRowHeader>{t(($) => $.studio.lesson)}</TableHead>
                    {data.rooms.map((room) => (
                      <TableHead key={room.id} className="w-[17%] text-center last:text-center">
                        <span className="grid gap-1">
                          <span>{room.name}</span>
                          <span className="text-[10px] font-normal">
                            {room.capacity === null
                              ? "—"
                              : t(($) => $.studio.peopleCount, { count: room.capacity })}
                          </span>
                        </span>
                      </TableHead>
                    ))}
                  </TableHeader>
                  <TableBody items={data.classes} renderEmptyState={() => empty}>
                    {(item) => (
                      <TableRow id={item.id}>
                        <TableCell>
                          <span className="grid gap-1">
                            <span>{item.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.capacity === null
                                ? "—"
                                : t(($) => $.studio.peopleCount, { count: item.capacity })}
                            </span>
                          </span>
                        </TableCell>
                        {data.rooms.map((room) => {
                          const pair = data.compatibility.find(
                            (entry) => entry.classId === item.id && entry.roomId === room.id,
                          );
                          const key = `${item.id}:${room.id}`;
                          return (
                            <TableCell key={room.id} className="text-center last:text-center">
                              {pair ? (
                                <Checkbox
                                  className="mx-auto"
                                  aria-label={`${item.name}, ${room.name}`}
                                  isDisabled={
                                    !pair?.writable ||
                                    (item.capacity !== null &&
                                      room.capacity !== null &&
                                      item.capacity > room.capacity)
                                  }
                                  isSelected={compatibility[key] ?? pair?.allowed ?? false}
                                  onChange={(value) =>
                                    setCompatibility((current) => ({ ...current, [key]: value }))
                                  }
                                />
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="flex-wrap justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {Object.keys(compatibility).length
                    ? t(($) => $.studio.unsaved)
                    : t(($) => $.studio.unchanged)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={!Object.keys(compatibility).length}
                    onPress={() => setCompatibility({})}
                  >
                    {t(($) => $.studio.undo)}
                  </Button>
                  <Button size="sm" isDisabled>
                    {t(($) => $.studio.save)}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        <TabsContent id="availability">
          {availabilityContent ?? (
            <AvailabilityPanel
              instructors={data.instructors}
              initialByInstructor={data.availability}
            />
          )}
        </TabsContent>
        <TabsContent id="closures">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{t(($) => $.studio.closuresTitle)}</h2>
                <p className="text-[13px] text-muted-foreground">
                  {t(($) => $.studio.closuresDescription)}
                </p>
              </div>
              <Button
                isDisabled={state !== "ready"}
                onPress={() => setSelection({ kind: "closure" })}
              >
                <PlusIcon />
                {t(($) => $.studio.addClosure)}
              </Button>
            </CardHeader>
            <CardContent>
              <Table aria-label={t(($) => $.studio.closuresTitle)}>
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.studio.period)}</TableHead>
                  <TableHead>{t(($) => $.studio.scope)}</TableHead>
                  <TableHead>{t(($) => $.studio.reason)}</TableHead>
                  <TableHead className="text-right">
                    {t(($) => $.studio.affectedSessions)}
                  </TableHead>
                  <TableHead className="last:text-left">{t(($) => $.studio.status)}</TableHead>
                </TableHeader>
                <TableBody items={data.closures} renderEmptyState={() => empty}>
                  {(item) => (
                    <TableRow id={item.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-auto px-0 py-0 text-sm font-normal"
                          onPress={() => setSelection({ kind: "closure", id: item.id })}
                        >
                          {item.period}
                        </Button>
                      </TableCell>
                      <TableCell>{item.scope}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.affectedSessions ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.past ? "secondary" : "outline"}>{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {state === "ready"
                  ? t(($) => $.studio.closureCount, {
                      count: data.closures.filter((item) => !item.past).length,
                      past: data.closures.filter((item) => item.past).length,
                    })
                  : empty}
              </span>
              <span>{t(($) => $.studio.detailHint)}</span>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent id="agreements">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">{t(($) => $.studio.agreementsTitle)}</h2>
              <p className="text-[13px] text-muted-foreground">
                {t(($) => $.studio.agreementsDescription)}{" "}
                <a href={earningsHref} className="underline underline-offset-2">
                  {t(($) => $.studio.earnings)}
                </a>
                {t(($) => $.studio.settingsSuffix)}
              </p>
            </CardHeader>
            <CardContent>
              <Table aria-label={t(($) => $.studio.agreementsTitle)}>
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.studio.instructor)}</TableHead>
                  <TableHead>{t(($) => $.studio.model)}</TableHead>
                  <TableHead>{t(($) => $.studio.fee)}</TableHead>
                  <TableHead>{t(($) => $.studio.effective)}</TableHead>
                  <TableHead>{t(($) => $.studio.version)}</TableHead>
                  <TableHead>{t(($) => $.studio.weeklyEstimate)}</TableHead>
                </TableHeader>
                <TableBody items={data.agreements} renderEmptyState={() => empty}>
                  {(item) => (
                    <TableRow id={item.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-auto px-0 py-0 text-sm font-normal"
                          onPress={() => setSelection({ kind: "agreement", id: item.id })}
                        >
                          <span className="grid gap-0.5 text-left">
                            <span>{item.instructor}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.instructor.trim().split(/\s+/).length > 1
                                ? `${item.instructor.trim().split(/\s+/)[0]} ${item.instructor.trim().split(/\s+/).at(-1)?.[0] ?? ""}.`
                                : item.instructor}
                            </span>
                          </span>
                        </Button>
                      </TableCell>
                      <TableCell>{item.model}</TableCell>
                      <TableCell>{item.fee}</TableCell>
                      <TableCell>{item.effective}</TableCell>
                      <TableCell>{item.version}</TableCell>
                      <TableCell>{item.weeklyEstimate ?? "—"}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {t(($) => $.studio.newVersionHint)}
              </span>
              <Button
                variant="outline"
                size="sm"
                isDisabled={state !== "ready"}
                onPress={() => setSelection({ kind: "agreement" })}
              >
                {t(($) => $.studio.prepareAgreement)}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      {selection && renderEditor ? (
        renderEditor(selection, () => setSelection(undefined))
      ) : (
        <StudioSheets selection={selection} onClose={() => setSelection(undefined)} data={data} />
      )}
    </main>
  );
}
