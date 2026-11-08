"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useState, useCallback, useSyncExternalStore } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { eventDetail } from "../../lib/events";
import { dateInZone, calendarInterval } from "../../lib/schedule";
import { useRemote } from "../../lib/use-remote";
import { FlowError } from "../bookings/flow-controls";
import { EventEditor, control, button } from "./event-editor";
import { EventActions } from "./event-actions";
import { EventRegistration } from "./event-registration";
import { Publication } from "../crm/publication";
function subscribeQuery(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
const browserQuery = () => window.location.search;
const serverQuery = () => "";
export function EventsWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: { organization: OrganizationView; centers: CenterView[] }[];
}) {
  const t = useTranslations("events"),
    [selected, setSelected] = useState("");
  const query = useSyncExternalStore(subscribeQuery, browserQuery, serverQuery),
    q = new URLSearchParams(query);
  const linked =
    q.get("org") && q.get("center") && q.get("event")
      ? {
          org: q.get("org")!,
          center: q.get("center")!,
          event: q.get("event")!,
          date: q.get("eventDate") ?? "",
        }
      : undefined;
  const options = studios
      .filter((s) => ["normal", "grace"].includes(s.organization.access_mode))
      .flatMap((s) =>
        s.centers
          .filter((c) => c.accessible && c.state === "active")
          .map((c) => ({
            orgId: s.organization.id,
            centerId: c.id,
            timeZone: c.timezone,
            selfPersonId: s.organization.self_context?.person_id,
            label: `${s.organization.name} · ${c.name}`,
          })),
      ),
    current =
      options.find((o) => `${o.orgId}:${o.centerId}` === selected) ??
      options.find((o) => o.orgId === linked?.org && o.centerId === linked.center) ??
      options[0];

  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      {!current ? (
        <p>{t("noCenter")}</p>
      ) : (
        <>
          <label>
            {t("center")}
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
          <EventList
            key={JSON.stringify([actorId, current, linked])}
            scope={{ actorId, orgId: current.orgId, centerId: current.centerId }}
            timeZone={current.timeZone}
            selfPersonId={current.selfPersonId}
            linked={
              linked?.org === current.orgId && linked.center === current.centerId
                ? linked
                : undefined
            }
          />
        </>
      )}
    </section>
  );
}
function EventList({
  scope,
  timeZone,
  linked,
  selfPersonId,
}: {
  scope: SetupScope;
  timeZone: string;
  linked?: { event: string; date: string };
  selfPersonId?: string;
}) {
  const t = useTranslations("events"),
    f = useFormatter(),
    [date, setDate] = useState(() =>
      linked && /^\d{4}-\d\d-\d\d$/.test(linked.date)
        ? linked.date
        : dateInZone(new Date(), timeZone),
    ),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [id, setId] = useState(linked?.event ?? ""),
    [create, setCreate] = useState(false);
  const load = useCallback(
      async () =>
        setupCall("event_list_v1", {
          org_id: scope.orgId,
          center_id: scope.centerId,
          interval: calendarInterval(date, "week", timeZone),
          page: { limit: 25, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
        }),
      [scope, date, timeZone, cursor],
    ),
    result = useRemote(load, JSON.stringify([scope, date, cursor, revision]));
  const reload = (createdId?: string) => {
    if (createdId) setId(createdId);
    setRevision((n) => n + 1);
    setCreate(false);
  };
  return (
    <div className="space-y-4">
      <label>
        {t("week")}
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setCursor(undefined);
            setId("");
          }}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button className={button} variant="outline" onClick={() => reload()}>
          {t("reload")}
        </Button>
        <Button
          className={button}
          variant="outline"
          aria-expanded={create}
          onClick={() => {
            setCreate((v) => !v);
            setId("");
          }}
        >
          {t("create")}
        </Button>
      </div>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      <ul className="space-y-3">
        {result?.data?.items.map((e) => (
          <li key={e.id}>
            <Button
              className={button}
              variant="outline"
              onClick={() => {
                setId(e.id);
                setCreate(false);
              }}
            >
              {e.name} ·{" "}
              {f.dateTime(new Date(e.interval.starts_at), {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: e.timezone,
              })}
            </Button>
          </li>
        ))}
      </ul>
      {result?.data?.items.length === 0 && <p>{t("empty")}</p>}
      {result?.data?.next_cursor && (
        <Button
          className={button}
          variant="outline"
          onClick={() => setCursor(result.data!.next_cursor!)}
        >
          {t("next")}
        </Button>
      )}
      {create && <EventEditor scope={scope} timeZone={timeZone} onSaved={reload} />}{" "}
      {id && (
        <EventPanel
          key={`${id}:${revision}`}
          scope={scope}
          id={id}
          onSaved={() => reload()}
          selfPersonId={selfPersonId}
        />
      )}
    </div>
  );
}
function EventPanel({
  scope,
  id,
  onSaved,
  selfPersonId,
}: {
  scope: SetupScope;
  id: string;
  onSaved: () => void;
  selfPersonId?: string;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("events"),
    locale = useLocale(),
    [edit, setEdit] = useState(false),
    load = useCallback(() => eventDetail(scope, id), [scope, id]),
    result = useRemote(load, JSON.stringify([scope, id]));
  const e = result?.data;
  return (
    <section className="space-y-5 border-t pt-5">
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}{" "}
      {e && (
        <>
          <h3 className="text-lg font-semibold">
            {e.name} · {t(`states.${e.state}`)}
          </h3>
          <p>
            {effectMoney(e.terms.fee_minor, e.terms.currency, locale)} · {e.timezone}
          </p>
          <p>
            {"kind" in e.capacity
              ? t("unlimited")
              : `${t("nominal")}: ${e.capacity.nominal} · ${t("maximum")}: ${e.capacity.maximum}`}
          </p>
          {e.terms.package_usage === "eligibility_only" && <p>{t("practiceHint")}</p>}
          <Button className={button} variant="outline" onClick={() => setEdit((v) => !v)}>
            {t("edit")}
          </Button>
          {edit && <EventEditor scope={scope} timeZone={e.timezone} event={e} onSaved={onSaved} />}
          <EventActions scope={scope} event={e} onSaved={onSaved} />
          {e.state === "published" && (
            <EventRegistration
              scope={scope}
              event={e}
              onSaved={onSaved}
              selfPersonId={selfPersonId}
            />
          )}
          <Publication scope={scope} eventId={e.id} onSaved={onSaved} />
        </>
      )}
    </section>
  );
}
