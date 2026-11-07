"use client";
import { useCallback, useId, useState } from "react";
import { useTranslations, useFormatter, useLocale, useTimeZone } from "next-intl";
import type { Page_PublicCalendarItem } from "@ftksaas/api-contracts";
import { validate } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { useRemote } from "../../lib/use-remote";
import { calendarInterval, dateInZone } from "../../lib/schedule";
import { effectMoney } from "../../lib/effect-money";
import { money } from "../../lib/collection-command";
import { PublicBusinessCard } from "./public-business-card";
import { PublicApplication } from "./public-application";
import { FlowError } from "../bookings/flow-controls";
import { Preferences } from "../preferences";
import { button } from "../crm/fields";
export function PublicSchedule({
  slug,
  centerId,
  siteKey,
}: {
  slug: string;
  centerId?: string;
  siteKey?: string;
}) {
  const t = useTranslations("publicSchedule"),
    f = useFormatter(),
    locale = useLocale(),
    timeZone = useTimeZone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    id = useId(),
    [date, setDate] = useState(() => dateInZone(new Date(), timeZone)),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/public/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        ...(centerId ? { center_id: centerId } : {}),
        interval: calendarInterval(date, "week", timeZone),
        ...(cursor ? { cursor } : {}),
      }),
      cache: "no-store",
    });
    const out = await r.json();
    if (!out.ok) throw Error(out.error?.code ?? "TEMPORARY_FAILURE");
    const p = out.data as Page_PublicCalendarItem;
    if (
      p.items.some(
        (row) =>
          !validate(row.publication_id) ||
          !money(row.fee_minor) ||
          !Number.isFinite(Date.parse(row.interval.starts_at)) ||
          !Number.isFinite(Date.parse(row.interval.ends_at)),
      ) ||
      (cursor && p.next_cursor === cursor)
    )
      throw Error("INTEGRITY_VIOLATION");
    return p;
  }, [slug, centerId, date, cursor, timeZone]);
  const result = useRemote(load, JSON.stringify([slug, centerId, date, cursor, revision]));
  const publication = result?.data?.items.find((p) => p.publication_id === selected);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh max-w-4xl space-y-6 p-4 sm:p-8"
    >
      <header className="flex flex-wrap justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Preferences />
      </header>
      <p>{t("hint")}</p>
      <p>{timeZone}</p>
      {result?.data?.organization_profile && (
        <PublicBusinessCard profile={result.data.organization_profile} />
      )}
      {result?.data?.center_profile && <PublicBusinessCard profile={result.data.center_profile} />}
      <Label htmlFor={id}>{t("date")}</Label>
      <Input
        id={id}
        type="date"
        value={date}
        onChange={(e) => {
          if (e.target.value) {
            setDate(e.target.value);
            setCursor(undefined);
            setSelected("");
          }
        }}
      />
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setCursor(undefined);
          setSelected("");
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <>
          <ul className="space-y-4">
            {result.data.items.map((p) => (
              <li className="rounded-lg border bg-card p-4" key={p.publication_id}>
                <h2 className="text-lg font-semibold">{p.title}</h2>
                <p>
                  {f.dateTime(new Date(p.interval.starts_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  —{" "}
                  {f.dateTime(new Date(p.interval.ends_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <p>{p.venue_public_label}</p>
                <p>{effectMoney(p.fee_minor, p.currency, locale)}</p>
                <p className="whitespace-pre-wrap">{p.public_conditions}</p>
                <Button
                  className={button}
                  variant="outline"
                  onClick={() => setSelected(p.publication_id)}
                >
                  {t("apply")}
                </Button>
              </li>
            ))}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => {
                setCursor(result.data!.next_cursor!);
                setSelected("");
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      {publication &&
        (siteKey ? (
          <PublicApplication
            key={publication.publication_id}
            publication={publication}
            siteKey={siteKey}
          />
        ) : (
          <output>{t("notReady")}</output>
        ))}
    </main>
  );
}
