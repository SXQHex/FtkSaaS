"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PersonSummary } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { bookingApi, type BookingApi } from "../../lib/bookings";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { PersonChooser } from "./person-chooser";
import { RequestForm } from "./request-form";
import { RequestActions } from "./request-actions";
import { FlowError, flowError } from "./flow-controls";
export function LessonRequests({
  scope,
  timeZone,
  api = bookingApi,
  onChanged,
}: {
  scope: SetupScope;
  timeZone: string;
  api?: BookingApi;
  onChanged?: () => void;
}) {
  return (
    <RequestConnection
      key={JSON.stringify(scope)}
      scope={scope}
      timeZone={timeZone}
      api={api}
      onChanged={onChanged}
    />
  );
}
function RequestConnection({
  scope: initialScope,
  timeZone,
  api,
  onChanged,
}: {
  scope: SetupScope;
  timeZone: string;
  api: BookingApi;
  onChanged?: () => void;
}) {
  const [scope] = useState(initialScope);
  const t = useTranslations("flows"),
    [open, setOpen] = useState(false),
    [person, setPerson] = useState<PersonSummary | null>(null),
    [revision, setRevision] = useState(0),
    heading = useRef<HTMLHeadingElement>(null);
  const command = useSetupCommand(
    scope,
    "lesson-requests",
    () => {
      setRevision((n) => n + 1);
      onChanged?.();
    },
    () => setRevision((n) => n + 1),
  );
  useEffect(() => {
    if (command.message) heading.current?.focus();
  }, [command.message]);
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t("requests")}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("requests")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("requestHint")}</p>
      <SetupFeedback command={command} />
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? "hide" : "openRequests")}
      </Button>
      {open && (
        <>
          <PersonChooser
            scope={scope}
            disabled={command.busy || !!command.pending}
            read={api.people}
            onSelect={setPerson}
          />
          {person && (
            <RequestList
              key={`${person.id}:${revision}`}
              scope={scope}
              person={person}
              timeZone={timeZone}
              api={api}
              command={command}
            />
          )}
        </>
      )}
    </section>
  );
}
export function RequestList({
  scope,
  person,
  timeZone,
  api,
  command,
}: {
  scope: SetupScope;
  person: PersonSummary;
  timeZone: string;
  api: BookingApi;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("flows"),
    format = useFormatter(),
    [page, setPage] = useState<Awaited<ReturnType<BookingApi["requests"]>> | null>(null),
    [error, setError] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .requests(scope, person.id, cursor)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, person.id, api, cursor, attempt]);
  return (
    <div className="min-w-0 space-y-5">
      <h4 className="font-semibold">{person.display_name}</h4>
      {error ? (
        <FlowError code={error} />
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {!page.items.length && <p>{t("noRequests")}</p>}
          <ul className="space-y-5">
            {page.items.map((row) => (
              <li key={row.id} className="min-w-0 space-y-4 rounded-md border p-4">
                <p>
                  {format.dateTime(new Date(row.requested_start), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  · {t("duration", { count: row.duration_minutes })}
                </p>
                <p>{t(`requestStates.${row.state}`)}</p>
                {row.expires_at && (
                  <p>
                    {t("expires", {
                      date: format.dateTime(new Date(row.expires_at), {
                        dateStyle: "short",
                        timeStyle: "short",
                      }),
                    })}
                  </p>
                )}
                <RequestActions
                  key={`${row.id}:${row.version}`}
                  scope={scope}
                  row={row}
                  timeZone={timeZone}
                  api={api}
                  command={command}
                />
              </li>
            ))}
          </ul>
          {page.next_cursor && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              disabled={command.busy || !!command.pending}
              onClick={() => {
                setPage(null);
                setCreating(false);
                setCursor(page.next_cursor ?? undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={command.busy || !!command.pending}
        onClick={() => {
          setPage(null);
          setError("");
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        disabled={command.busy || !!command.pending}
        aria-expanded={creating}
        onClick={() => setCreating((value) => !value)}
      >
        {t("newRequest")}
      </Button>
      {creating && (
        <RequestForm
          scope={scope}
          personId={person.id}
          timeZone={timeZone}
          api={api}
          command={command}
        />
      )}
    </div>
  );
}
