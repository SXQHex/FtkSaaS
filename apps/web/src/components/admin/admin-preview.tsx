"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DoorOpen,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Card, CardContent, CardHeader } from "@ftksaas/ui/components/card";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import { cn } from "@ftksaas/ui/lib/utils";
import { Preferences } from "../preferences";
import { AdminShell, sections, type AdminSection } from "./admin-shell";
import {
  previewPackages,
  previewSessions,
  previewStudents,
  type PreviewSession,
  type PreviewStudent,
} from "./preview-data";

function subscribeNavigation(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function currentSection(): AdminSection {
  const value = window.location.hash.slice(1);
  return sections.includes(value as AdminSection) ? (value as AdminSection) : "overview";
}
const initialSection = (): AdminSection => "overview";
const dayDate = (offset: number) => new Date(Date.UTC(2026, 9, 26 + offset, 12));

type Detail =
  | { kind: "session"; session: PreviewSession; day: number }
  | { kind: "student"; student: PreviewStudent }
  | { kind: "package"; index: number }
  | { kind: "newStudent" }
  | { kind: "payment"; index: number }
  | null;

// An isolated, in-memory prototype. AdminShell can later receive real authorized content.
export function AdminPreview() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const section = useSyncExternalStore(subscribeNavigation, currentSection, initialSection);
  const [day, setDay] = useState(3);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [students, setStudents] = useState(previewStudents);
  const [detail, setDetail] = useState<Detail>(null);
  const [name, setName] = useState("");
  const [read, setRead] = useState(false);
  const [notice, setNotice] = useState("");
  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(value);
  const date = (offset: number, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(dayDate(offset));
  const filteredStudents = students.filter(
    (student) =>
      student.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale).trim()) &&
      (filter === "all" || student.status === filter),
  );
  function navigate(next: AdminSection) {
    window.location.hash = next;
    setNotice("");
  }
  function open(next: Detail) {
    setNotice("");
    setDetail(next);
  }
  const closeButton = (
    <SheetClose asChild>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2"
        aria-label={t("close")}
      >
        <X />
      </Button>
    </SheetClose>
  );
  const heading = (title: string, subtitle: string, action?: ReactNode) => (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
  const stats = (values: { label: string; value: string; hint: string }[]) => (
    <div className="grid gap-4 sm:grid-cols-3">
      {values.map((item) => (
        <Card key={item.label} className="gap-3 shadow-none">
          <CardHeader className="pb-0">
            <p className="text-sm text-muted-foreground">{item.label}</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{item.value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
  const dayPicker = (
    <div
      aria-label={t("chooseDay")}
      className="grid grid-cols-7 gap-1 rounded-xl border bg-card p-1.5 sm:gap-2 sm:p-2"
    >
      {Array.from({ length: 7 }, (_, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={day === index}
          aria-label={date(index, { weekday: "long", day: "numeric", month: "long" })}
          onClick={() => setDay(index)}
          className={cn(
            "flex min-h-17 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 transition-colors hover:bg-muted",
            day === index && "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          <span className="text-[11px] sm:text-xs">{date(index, { weekday: "short" })}</span>
          <span className="text-base font-semibold tabular-nums">
            {date(index, { day: "numeric" })}
          </span>
        </button>
      ))}
    </div>
  );
  const sessions = day === 6 ? [] : day % 2 === 0 ? previewSessions.slice(2) : previewSessions;
  const sessionCards = (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          historical={day < 3 || (day === 3 && session.completed)}
          onOpen={() => open({ kind: "session", session, day })}
        />
      ))}
      {!sessions.length && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <CalendarDays className="mx-auto mb-4 size-6 text-muted-foreground" />
          <h3 className="font-medium">{t("dayOff")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("dayOffHint")}</p>
        </div>
      )}
    </div>
  );

  return (
    <AdminShell section={section} onNavigate={navigate} accountName={t("sampleManager")} preview>
      {section === "overview" && (
        <>
          {heading(
            t("todayTitle"),
            t("todaySubtitle"),
            <Button onClick={() => open({ kind: "newStudent" })}>
              <Plus />
              {t("addStudent")}
            </Button>,
          )}
          {stats([
            { label: t("activeStudents"), value: "86", hint: t("studentsHint") },
            { label: t("todaySessions"), value: "4", hint: t("sessionsHint") },
            { label: t("monthCollection"), value: money(42800), hint: t("collectionHint") },
          ])}
          <div className="mt-8 grid items-start gap-7 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <section aria-labelledby="daily-flow">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="daily-flow" className="text-lg font-semibold tracking-tight">
                  {t("dailyFlow")}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => navigate("schedule")}>
                  {t("openSchedule")}
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
              {dayPicker}
              <div className="my-5 flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  {date(day, { day: "numeric", month: "long", weekday: "long" })}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {t("sessionCount", { count: sessions.length })}
                </span>
              </div>
              {sessionCards}
            </section>
            <div className="space-y-6">
              <Card className="gap-0 overflow-hidden border-primary bg-primary py-0 text-primary-foreground shadow-none">
                <CardHeader className="gap-5 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium opacity-75">{t("nextSession")}</span>
                    <Badge
                      className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
                      variant="outline"
                    >
                      18:00
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {t("sessions.beginner")}
                    </h2>
                    <p className="mt-2 text-sm opacity-75">
                      {t("coachName")} / {t("roomName")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="flex -space-x-2">
                      {["DY", "MK", "CA"].map((initials) => (
                        <span
                          key={initials}
                          className="flex size-8 items-center justify-center rounded-full border-2 border-primary bg-primary-foreground text-[10px] font-medium text-primary"
                        >
                          {initials}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs opacity-80">{t("reserved", { count: 18 })}</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => open({ kind: "session", session: previewSessions[2], day: 3 })}
                  >
                    {t("viewSession")}
                    <ArrowUpRight className="size-4" />
                  </Button>
                </CardHeader>
              </Card>
              <section aria-labelledby="attention">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="attention" className="text-base font-semibold">
                    {t("attention")}
                  </h2>
                  <Badge variant="secondary">3</Badge>
                </div>
                <div className="divide-y rounded-xl border bg-card px-5">
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 py-5 text-left"
                    onClick={() => {
                      setFilter("renewal");
                      navigate("students");
                    }}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      2
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t("renewalTitle")}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t("renewalHint")}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 py-5 text-left"
                    onClick={() => navigate("finance")}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      1
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t("pendingPayment")}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t("paymentHint")}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </div>
              </section>
              <div className="flex items-start gap-3 px-1">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">{t("dayNote")}</p>
              </div>
            </div>
          </div>
        </>
      )}
      {section === "schedule" && (
        <>
          {heading(t("nav.schedule"), t("scheduleSubtitle"))}
          <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {date(day, { month: "long", year: "numeric" })}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={day === 0}
                    aria-label={t("previousDay")}
                    onClick={() => setDay(day - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button variant="outline" onClick={() => setDay(3)}>
                    {t("today")}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={day === 6}
                    aria-label={t("nextDay")}
                    onClick={() => setDay(day + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
              {dayPicker}
              <h3 className="my-5 text-sm font-medium">
                {date(day, { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {sessionCards}
            </section>
            <Card className="shadow-none">
              <CardHeader>
                <h2 className="font-semibold">{t("weekSummary")}</h2>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("sessionLabel")}</span>
                  <span className="font-medium">18</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("discipline")}</span>
                  <span className="font-medium">Tango</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("room")}</span>
                  <span className="font-medium">{t("roomName")}</span>
                </div>
                <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
                  {t("scheduleNote")}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {section === "students" && (
        <>
          {heading(
            t("nav.students"),
            t("studentsSubtitle"),
            <Button onClick={() => open({ kind: "newStudent" })}>
              <Plus />
              {t("addStudent")}
            </Button>,
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div
              aria-label={t("studentFilter")}
              className="flex flex-wrap gap-1 rounded-lg border bg-card p-1"
            >
              {["all", "active", "renewal"].map((value) => (
                <Button
                  key={value}
                  variant={filter === value ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(`filters.${value}`)}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="min-h-10 pl-9"
                aria-label={t("searchStudents")}
                placeholder={t("searchStudents")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("showingStudents", { count: filteredStudents.length })}
          </p>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="gap-5 shadow-none">
                <CardHeader className="flex flex-row flex-wrap items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {student.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{student.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`levels.${student.level}`)}
                    </p>
                  </div>
                  <Badge
                    className="shrink-0"
                    variant={student.status === "renewal" ? "outline" : "secondary"}
                  >
                    {t(`filters.${student.status}`)}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="mb-5 flex items-end justify-between gap-3 border-t pt-5">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("remainingCredits")}</p>
                      <p className="mt-1 text-xl font-semibold">
                        {student.remaining}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {t("sessionLabel")}
                        </span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{t("regularPackage")}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => open({ kind: "student", student })}
                  >
                    {t("viewProfile")}
                    <ArrowUpRight className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {!filteredStudents.length && (
            <div className="rounded-xl border border-dashed px-6 py-16 text-center">
              <h2 className="font-medium">{t("noStudents")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("noStudentsHint")}</p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                {t("clearFilters")}
              </Button>
            </div>
          )}
        </>
      )}
      {section === "packages" && (
        <>
          {heading(t("nav.packages"), t("packagesSubtitle"))}
          <div className="grid gap-5 md:grid-cols-3">
            {previewPackages.map((item, index) => (
              <Card key={item.id} className="gap-7 shadow-none">
                <CardHeader>
                  <Badge variant="secondary" className="mb-4 w-fit">
                    Tango
                  </Badge>
                  <h2 className="text-lg font-semibold">{t(`packages.${item.id}`)}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("creditCount", { count: item.credits })}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight">{money(item.price)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("samplePrice")}</p>
                  <div className="my-6 space-y-3 border-t pt-5">
                    <p className="flex items-center gap-2 text-sm">
                      <Check className="size-4" />
                      {t("packageScope")}
                    </p>
                    <p className="flex items-center gap-2 text-sm">
                      <Users className="size-4" />
                      {t("packageStudents", { count: item.students })}
                    </p>
                  </div>
                  <Button
                    variant={index === 1 ? "default" : "outline"}
                    className="w-full"
                    onClick={() => open({ kind: "package", index })}
                  >
                    {t("viewPackage")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {section === "finance" && (
        <>
          {heading(t("nav.finance"), t("financeSubtitle"))}
          {stats([
            { label: t("monthCollection"), value: money(42800), hint: t("collectionHint") },
            { label: t("pendingCollection"), value: money(2800), hint: t("pendingCount") },
            { label: t("studentCredit"), value: money(0), hint: t("creditHint") },
          ])}
          <h2 className="mb-4 mt-8 text-lg font-semibold">{t("recentPayments")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <Card key={index} className="shadow-none">
                <CardContent>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <ArrowDownLeft className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium">{previewStudents[index].name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{t("regularPackage")}</p>
                    </div>
                    <Badge variant={index === 1 ? "outline" : "secondary"}>
                      {t(index === 1 ? "pending" : "collected")}
                    </Badge>
                  </div>
                  <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                    <p className="text-2xl font-semibold">{money(2800)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => open({ kind: "payment", index })}
                    >
                      {t("details")}
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {section === "reports" && (
        <>
          {heading(
            t("nav.reports"),
            t("reportsSubtitle"),
            <Button
              variant="outline"
              onClick={() => {
                const csv =
                  "\uFEFF" +
                  `${t("reportMetric")},${t("reportValue")}\n${t("activeStudents")},86\n${t("monthCollection")},42800\n`;
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv;charset=utf-8;" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "ftksaas-design-sample.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download />
              {t("downloadSample")}
            </Button>,
          )}
          {stats([
            { label: t("activeStudents"), value: "86", hint: t("studentsHint") },
            { label: t("monthSessions"), value: "72", hint: t("monthSessionsHint") },
            { label: t("attendanceRate"), value: "%84", hint: t("attendanceHint") },
          ])}
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <h2 className="font-semibold">{t("packageDistribution")}</h2>
              </CardHeader>
              <CardContent className="space-y-6">
                {previewPackages.map((item) => (
                  <div key={item.id}>
                    <div className="mb-2 flex justify-between gap-3 text-sm">
                      <span>{t(`packages.${item.id}`)}</span>
                      <span className="tabular-nums">{item.students}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-foreground/75"
                        style={{ width: `${(item.students / 86) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <h2 className="font-semibold">{t("weekAttendance")}</h2>
                <p className="text-sm text-muted-foreground">{t("weekAttendanceHint")}</p>
              </CardHeader>
              <CardContent className="flex min-h-40 items-end justify-between gap-3">
                {[72, 88, 81, 90, 84].map((value, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs tabular-nums">%{value}</span>
                    <div
                      className="w-full max-w-12 rounded-t-md bg-foreground/75"
                      style={{ height: `${value}px` }}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-muted-foreground">
                      {date(index, { weekday: "short" })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {section === "studio" && (
        <>
          {heading(t("nav.studio"), t("studioSubtitle"))}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader>
                <DoorOpen className="mb-4 size-6" />
                <h2 className="text-xl font-semibold">{t("roomName")}</h2>
                <p className="text-sm text-muted-foreground">{t("roomDescription")}</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge variant="secondary">{t("roomCapacity")}</Badge>
                <Badge variant="outline">Tango</Badge>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted font-medium">
                  AK
                </span>
                <h2 className="text-xl font-semibold">{t("coachName")}</h2>
                <p className="text-sm text-muted-foreground">{t("coachRole")}</p>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => navigate("schedule")}>
                  {t("seeClasses")}
                  <ArrowUpRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {section === "settings" && (
        <>
          {heading(t("nav.settings"), t("settingsSubtitle"))}
          <Card className="max-w-2xl shadow-none">
            <CardHeader>
              <SlidersHorizontal className="mb-3 size-5" />
              <h2 className="font-semibold">{t("appearance")}</h2>
              <p className="text-sm text-muted-foreground">{t("preferencesHint")}</p>
            </CardHeader>
            <CardContent>
              <Preferences />
            </CardContent>
          </Card>
        </>
      )}
      {section === "inbox" && (
        <>
          {heading(
            t("nav.inbox"),
            t("inboxSubtitle"),
            <Button variant="outline" disabled={read} onClick={() => setRead(true)}>
              <Check />
              {t(read ? "allRead" : "markRead")}
            </Button>,
          )}
          <div className="max-w-3xl space-y-3">
            {["renewalTitle", "pendingPayment", "attendanceClosed"].map((key, index) => (
              <Card key={key} className="py-0 shadow-none">
                <CardContent className="flex items-start gap-4 p-5">
                  <span
                    className={cn(
                      "mt-2 size-2 shrink-0 rounded-full",
                      read ? "bg-border" : "bg-foreground",
                    )}
                    aria-label={t(read ? "read" : "unread")}
                  />
                  <div className="flex-1">
                    <h2 className="text-sm font-medium">{t(key)}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t(["renewalHint", "paymentHint", "attendanceClosedHint"][index])}
                    </p>
                    <Button
                      variant="link"
                      className="mt-2 h-auto p-0"
                      onClick={() =>
                        navigate(index === 0 ? "students" : index === 1 ? "finance" : "schedule")
                      }
                    >
                      {t("details")}
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {["14:20", "12:35", "11:10"][index]}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {notice && (
        <output className="mt-5 block rounded-lg border bg-card px-4 py-3 text-sm">{notice}</output>
      )}
      <Sheet
        open={detail !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDetail(null);
            setName("");
          }
        }}
      >
        <SheetContent showCloseButton={false} className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pr-12">
            <SheetTitle>
              {detail?.kind === "session"
                ? t(`sessions.${detail.session.title}`)
                : detail?.kind === "student"
                  ? detail.student.name
                  : detail?.kind === "package"
                    ? t(`packages.${previewPackages[detail.index].id}`)
                    : detail?.kind === "newStudent"
                      ? t("addStudent")
                      : t("paymentDetails")}
            </SheetTitle>
            <SheetDescription>{t("detailNote")}</SheetDescription>
          </SheetHeader>
          {closeButton}
          <div className="space-y-6 px-5 pb-8">
            {detail?.kind === "session" && (
              <>
                <div className="rounded-xl border bg-muted/40 p-5">
                  <p className="text-3xl font-semibold tabular-nums">
                    {detail.session.time}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      – {detail.session.end}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {date(detail.day, {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    })}
                  </p>
                </div>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t("instructor")}</dt>
                    <dd>{t("coachName")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t("room")}</dt>
                    <dd>{t("roomName")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t("capacity")}</dt>
                    <dd>
                      {detail.session.count} / {detail.session.capacity}
                    </dd>
                  </div>
                </dl>
                <div className="border-t pt-5">
                  <h3 className="mb-4 text-sm font-semibold">{t("sampleParticipants")}</h3>
                  <div className="space-y-4">
                    {previewStudents.slice(0, Math.min(3, detail.session.count)).map((student) => (
                      <div key={student.id} className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs">
                          {student.initials}
                        </span>
                        <span className="flex-1 text-sm">{student.name}</span>
                        <Badge variant="secondary">{t("confirmed")}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {detail?.kind === "student" && (
              <>
                <div className="flex items-center gap-4">
                  <span className="flex size-16 items-center justify-center rounded-full bg-muted text-xl">
                    {detail.student.initials}
                  </span>
                  <div>
                    <p className="font-medium">{t(`levels.${detail.student.level}`)}</p>
                    <Badge variant="outline" className="mt-2">
                      {t(`filters.${detail.student.status}`)}
                    </Badge>
                  </div>
                </div>
                <Card className="shadow-none">
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{t("remainingCredits")}</p>
                    <p className="mt-3 text-4xl font-semibold">{detail.student.remaining}</p>
                    <p className="mt-4 text-sm">{t("regularPackage")}</p>
                  </CardContent>
                </Card>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setDetail(null);
                    navigate("schedule");
                  }}
                >
                  {t("seeClasses")}
                  <ArrowUpRight className="size-4" />
                </Button>
              </>
            )}
            {detail?.kind === "package" && (
              <>
                <p className="text-4xl font-semibold">
                  {money(previewPackages[detail.index].price)}
                </p>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("credits")}</dt>
                    <dd>{previewPackages[detail.index].credits}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("discipline")}</dt>
                    <dd>Tango</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("activeStudents")}</dt>
                    <dd>{previewPackages[detail.index].students}</dd>
                  </div>
                </dl>
                <p className="rounded-lg bg-muted p-4 text-sm leading-6 text-muted-foreground">
                  {t("packageNote")}
                </p>
              </>
            )}
            {detail?.kind === "payment" && (
              <>
                <p className="text-4xl font-semibold">{money(2800)}</p>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("student")}</dt>
                    <dd>{previewStudents[detail.index].name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("status")}</dt>
                    <dd>{t(detail.index === 1 ? "pending" : "collected")}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("product")}</dt>
                    <dd>{t("regularPackage")}</dd>
                  </div>
                </dl>
                <p className="rounded-lg bg-muted p-4 text-sm leading-6 text-muted-foreground">
                  {t("paymentNote")}
                </p>
              </>
            )}
            {detail?.kind === "newStudent" && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  setStudents((items) => [
                    ...items,
                    {
                      id: `sample-${crypto.randomUUID()}`,
                      name: trimmed,
                      initials: trimmed
                        .split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join(""),
                      level: "beginner",
                      remaining: 0,
                      status: "active",
                    },
                  ]);
                  setName("");
                  setFilter("all");
                  setQuery("");
                  setDetail(null);
                  navigate("students");
                  setNotice(t("studentAdded"));
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="sample-name">{t("fullName")}</Label>
                  <Input
                    id="sample-name"
                    autoComplete="off"
                    value={name}
                    maxLength={80}
                    required
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("sampleNamePlaceholder")}
                  />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{t("newStudentNote")}</p>
                <Button type="submit" disabled={!name.trim()} className="w-full">
                  <Plus />
                  {t("addToPreview")}
                </Button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}

function SessionCard({
  session,
  historical,
  onOpen,
}: {
  session: PreviewSession;
  historical: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("admin");
  return (
    <Card className="gap-0 py-0 shadow-none">
      <button
        type="button"
        onClick={onOpen}
        className="session-card flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors hover:bg-muted/40 sm:gap-5 sm:p-5"
      >
        <div className="w-13 shrink-0 self-start pt-0.5">
          <p className="text-sm font-semibold tabular-nums">{session.time}</p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">{session.end}</p>
        </div>
        <div className="min-w-0 flex-1 border-l pl-4 sm:pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t(`sessions.${session.title}`)}</h3>
            {historical && (
              <Badge variant="secondary" className="text-[10px]">
                {t("completed")}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {t("coachName")} / {t("roomName")}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              {session.count}/{session.capacity}
            </span>
            <span className="h-1 w-16 rounded-full bg-muted" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-foreground/45"
                style={{ width: `${(session.count / session.capacity) * 100}%` }}
              />
            </span>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </Card>
  );
}
