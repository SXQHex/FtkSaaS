"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useCallback, useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { OrganizationView, CenterView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { selfChoices, readSelfReservations } from "../../lib/self-dashboard";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { readEntitlements } from "../../lib/products";
import { calendarInterval, dateInZone } from "../../lib/schedule";
import { useRemote } from "../../lib/use-remote";
import { getSession } from "../../lib/api";
import { bookingApi } from "../../lib/bookings";
import { RequestList } from "../bookings/lesson-requests";
import { SessionBookings } from "../bookings/session-bookings";
import { EarningsPanel } from "../earnings/earnings-panel";
import { attendanceTasksApi } from "../../lib/attendance-tasks";
import { AttendancePanel } from "../attendance/attendance-panel";
import { AttendanceTasks } from "../attendance/attendance-tasks";
import { FlowError } from "../bookings/flow-controls";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
const control = "min-h-11 w-full rounded-md border bg-background px-3",
  button = "h-auto min-h-11 max-w-full whitespace-normal";
export function SelfDashboard({
  actorId,
  studios,
}: {
  actorId: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("selfDashboard"),
    options = selfChoices(studios),
    [selected, setSelected] = useState("");
  const current = options.find((o) => `${o.orgId}:${o.centerId}` === selected) ?? options[0];
  return (
    <section className="space-y-5" aria-label={t("title")}>
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      {!current ? (
        <p>{t("noLink")}</p>
      ) : (
        <>
          <label>
            {t("context")}
            <select
              className={control}
              value={`${current.orgId}:${current.centerId}`}
              onChange={(e) => setSelected(e.target.value)}
            >
              {options.map((o) => (
                <option key={`${o.orgId}:${o.centerId}`} value={`${o.orgId}:${o.centerId}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <SelfPanel key={JSON.stringify([actorId, current])} actorId={actorId} choice={current} />
        </>
      )}
    </section>
  );
}
function SelfPanel({
  actorId,
  choice,
}: {
  actorId: string;
  choice: ReturnType<typeof selfChoices>[number];
}) {
  const t = useTranslations("selfDashboard"),
    [scope] = useState<SetupScope>({ actorId, orgId: choice.orgId, centerId: choice.centerId }),
    [revision, setRevision] = useState(0),
    [date, setDate] = useState(() => dateInZone(new Date(), choice.timeZone)),
    [cursor, setCursor] = useState<string>(),
    [sessionId, setSessionId] = useState(""),
    [error, setError] = useState("");
  const f = useFormatter();
  const load = useCallback(async () => {
      const p = await setupCall("person_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: choice.personId,
      });
      if (p.id !== choice.personId) throw Error("invalidSelf");
      return p;
    }, [scope, choice.personId]),
    person = useRemote(load, JSON.stringify([scope, revision]));
  const calendarLoad = useCallback(async () => {
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) throw Error("invalidSelfDate");
    const page = await setupCall("calendar_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      interval: calendarInterval(date, "week", choice.timeZone),
      ...(choice.student ? {} : { resource: { kind: "person", id: choice.personId } }),
      page: { limit: 25, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
    });
    if (
      page.items.some(
        (r) =>
          r.center_id !== scope.centerId ||
          (!choice.student &&
            !r.resources?.some(
              (resource) => resource.kind === "person" && resource.id === choice.personId,
            )),
      )
    )
      throw Error("invalidSelf");
    return page;
  }, [scope, choice, date, cursor]);
  const calendar = useRemote(calendarLoad, JSON.stringify([scope, date, cursor, revision]));
  const sessionLoad = useCallback(async () => {
    if (!sessionId) return null;
    const value = await getSession(scope.orgId, scope.centerId, sessionId);
    if (value.id !== sessionId) throw Error("invalidSelf");
    return value;
  }, [scope, sessionId]);
  const sessionRead = useRemote(sessionLoad, JSON.stringify([scope, sessionId, revision])),
    session = sessionRead?.data;
  const ownTasks = useMemo(
    () => ({
      list: (s: SetupScope, i: Parameters<typeof attendanceTasksApi.list>[1], c?: string) =>
        attendanceTasksApi.list(s, i, c, choice.personId),
    }),
    [choice.personId],
  );
  const command = useSetupCommand(scope, `self-requests:${choice.personId}`, () =>
    setRevision((n) => n + 1),
  );
  return (
    <div className="space-y-5">
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setSessionId("");
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {person?.error && <FlowError code={person.error} />}{" "}
      {person?.data && (
        <h3>
          {person.data.display_name}
          {choice.subscriberNumber ? ` · ${t("subscriber")} ${choice.subscriberNumber}` : ""}
        </h3>
      )}
      <a className="underline" href="#inbox">
        {t("inbox")}
      </a>
      {choice.student && (
        <SelfStudent
          key={revision}
          scope={scope}
          personId={choice.personId}
          timeZone={choice.timeZone}
        />
      )}
      <label className="block">
        {t("week")}
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setCursor(undefined);
            setSessionId("");
          }}
        />
      </label>
      <h3>{t(choice.student ? "available" : "duties")}</h3>
      {!calendar && <output>{t("loading")}</output>}
      {calendar?.error && <FlowError code={calendar.error} />}
      <ul className="space-y-3">
        {calendar?.data?.items.map((item) => (
          <li key={item.id}>
            <span>
              {item.title} ·{" "}
              {f.dateTime(new Date(item.starts_at), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: choice.timeZone,
              })}
            </span>
            {item.type === "session" ? (
              <Button
                className={button}
                variant="outline"
                onClick={() => {
                  setError("");
                  setSessionId(item.id);
                }}
              >
                {t("open")}
              </Button>
            ) : (
              <a
                className="underline"
                href={`/?org=${scope.orgId}&center=${item.center_id}&event=${item.id}&eventDate=${item.starts_at.slice(0, 10)}#events`}
              >
                {t("events")}
              </a>
            )}
          </li>
        ))}
      </ul>
      {calendar?.data?.next_cursor && (
        <Button
          className={button}
          variant="outline"
          onClick={() => setCursor(calendar.data!.next_cursor!)}
        >
          {t("next")}
        </Button>
      )}
      {error && <FlowError code={error} />}
      {sessionRead?.error && <FlowError code={sessionRead.error} />}
      {session && !choice.student && (
        <AttendancePanel
          key={session.id}
          scope={scope}
          sessionId={session.id}
          timeZone={choice.timeZone}
        />
      )}
      {session && person?.data && choice.student && (
        <SessionBookings
          key={session.id}
          scope={scope}
          session={session}
          fixedPerson={person.data}
        />
      )}
      {choice.student && person?.data && (
        <section className="space-y-3">
          <h3>{t("requests")}</h3>
          <SetupFeedback command={command} />
          <RequestList
            key={revision}
            scope={scope}
            person={person.data}
            timeZone={choice.timeZone}
            api={bookingApi}
            command={command}
          />
        </section>
      )}
      {(choice.instructor || choice.assistant) && (
        <>
          <AttendanceTasks scope={scope} timeZone={choice.timeZone} api={ownTasks} />
          <EarningsPanel scope={scope} personId={choice.personId} timeZone={choice.timeZone} />
        </>
      )}
    </div>
  );
}
function SelfStudent({
  scope,
  personId,
  timeZone,
}: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("selfDashboard"),
    [cursor, setCursor] = useState<string>(),
    [currency, setCurrency] = useState(""),
    locale = useLocale();
  const rightsLoad = useCallback(
      () =>
        readEntitlements(scope, personId).then((rows) => {
          if (rows.some((r) => r.person_id !== personId)) throw Error("invalidSelf");
          return rows;
        }),
      [scope, personId],
    ),
    rights = useRemote(rightsLoad, JSON.stringify(scope));
  const reservationLoad = useCallback(
      () => readSelfReservations(scope, personId, cursor),
      [scope, personId, cursor],
    ),
    reservations = useRemote(reservationLoad, JSON.stringify([scope, cursor]));
  const financeLoad = useCallback(
      async () =>
        currency
          ? setupCall("finance_get_v1", {
              org_id: scope.orgId,
              center_id: scope.centerId,
              person_id: personId,
              currency,
              page: { limit: 25, sort: "created_at_asc" },
            })
          : null,
      [scope, personId, currency],
    ),
    finance = useRemote(financeLoad, JSON.stringify([scope, currency]));
  return (
    <section className="space-y-4">
      <h3>{t("rights")}</h3>
      {rights?.error && <FlowError code={rights.error} />}
      <ul>
        {rights?.data?.map((r, i) => (
          <li key={r.sale_id}>
            {t("package", { number: i + 1 })} · {r.start_date}–{r.end_date} ·{" "}
            {r.kind === "timed"
              ? t("timedRights")
              : t("balances", {
                  available: r.available,
                  reserved: r.reserved,
                  consumed: r.consumed,
                })}
          </li>
        ))}
      </ul>
      <h3>{t("reservations")}</h3>
      {reservations?.error && <FlowError code={reservations.error} />}
      <ul>
        {reservations?.data?.items.map((r) => (
          <li key={r.id}>
            {r.state} ·{" "}
            <a
              className="underline"
              href={`/organizasyon/${scope.orgId}/seans/${r.session_id}?center=${scope.centerId}`}
            >
              {t("open")}
            </a>
          </li>
        ))}
      </ul>
      {reservations?.data?.next_cursor && (
        <Button
          className={button}
          variant="outline"
          onClick={() => setCursor(reservations.data!.next_cursor!)}
        >
          {t("next")}
        </Button>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = String(new FormData(e.currentTarget).get("currency")).trim().toUpperCase();
          if (/^[A-Z]{3}$/.test(c)) setCurrency(c);
        }}
      >
        <label>
          {t("currency")}
          <Input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} />
        </label>
        <Button className={button}>{t("finance")}</Button>
      </form>
      {finance?.error && <FlowError code={finance.error} />}{" "}
      {finance?.data &&
        finance.data.person_id === personId &&
        finance.data.currency === currency && (
          <div>
            <p>
              {t("credit")}: {effectMoney(finance.data.credit_available_minor, currency, locale)}
            </p>
            <ul>
              {finance.data.debts.map((d) => (
                <li key={d.id}>{effectMoney(d.remaining_minor, currency, locale)}</li>
              ))}
            </ul>
            {finance.data.movements.next_cursor && <p>{t("moreFinance")}</p>}
          </div>
        )}
      <p className="text-sm text-muted-foreground">{timeZone}</p>
    </section>
  );
}
