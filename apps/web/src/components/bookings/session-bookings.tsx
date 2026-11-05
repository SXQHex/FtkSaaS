"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type {
  BookingMode,
  EntitlementView,
  PersonSummary,
  SessionView,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { bookingApi, type BookingApi } from "../../lib/bookings";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { PersonChooser } from "./person-chooser";
import { ConfirmWrite, FlowError, flowError } from "./flow-controls";
import { ContextDocuments } from "../documents/context-documents";
export function SessionBookings({
  scope,
  session,
  onChanged,
  api = bookingApi,
}: {
  scope: SetupScope;
  session: SessionView;
  onChanged?: (session: SessionView) => void;
  api?: BookingApi;
}) {
  return (
    <BookingConnection
      key={JSON.stringify([scope, session.id])}
      scope={scope}
      session={session}
      api={api}
      onChanged={onChanged}
    />
  );
}
function BookingConnection({
  scope: initialScope,
  session,
  api,
  onChanged,
}: {
  scope: SetupScope;
  session: SessionView;
  api: BookingApi;
  onChanged?: (session: SessionView) => void;
}) {
  const [scope] = useState(initialScope);
  const [revision, setRevision] = useState(0),
    [open, setOpen] = useState(false),
    heading = useRef<HTMLHeadingElement>(null),
    t = useTranslations("flows");
  const [chosen, setChosen] = useState<PersonSummary | null>(null),
    [fresh, setFresh] = useState(session),
    [readRevision, setReadRevision] = useState(0),
    [sessionError, setSessionError] = useState(""),
    [sessionAttempt, setSessionAttempt] = useState(0);
  useEffect(() => {
    if (!revision) return;
    let active = true;
    void api
      .session(scope.orgId, scope.centerId, session.id)
      .then((result) => {
        if (result.id !== session.id) throw Error("invalidForm");
        if (active) {
          setFresh(result);
          setReadRevision(revision);
          setSessionError("");
          onChanged?.(result);
        }
      })
      .catch((cause) => {
        if (active) setSessionError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [api, scope, session.id, revision, sessionAttempt, onChanged]);
  const command = useSetupCommand(
    scope,
    `bookings:${session.id}`,
    () => {
      setOpen(true);
      setRevision((n) => n + 1);
    },
    (code) => {
      if (
        [
          "CAPACITY_FULL",
          "ENTITLEMENT_UNAVAILABLE",
          "CREDIT_LIMIT_EXCEEDED",
          "QUOTA_EXCEEDED",
          "CLASS_ACCESS_DENIED",
          "DOCUMENT_REQUIRED",
          "PARTICIPATION_BLOCKED",
          "RESERVATION_EXISTS",
          "VERSION_CONFLICT",
        ].includes(code)
      )
        setRevision((n) => n + 1);
    },
  );
  useEffect(() => {
    if (command.message) heading.current?.focus();
  }, [command.message]);
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("bookings")}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("bookings")}
      </h3>
      <SetupFeedback command={command} />
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? "hide" : "openBookings")}
      </Button>
      {sessionError && (
        <>
          <FlowError code={sessionError} />
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            variant="outline"
            onClick={() => setSessionAttempt((n) => n + 1)}
          >
            {t("reload")}
          </Button>
        </>
      )}
      {open && readRevision !== revision && !sessionError && <output>{t("loading")}</output>}
      {open && readRevision === revision && (
        <BookingPanel
          key={revision}
          scope={scope}
          session={fresh}
          api={api}
          command={command}
          initialPerson={chosen}
          onPerson={setChosen}
        />
      )}
    </section>
  );
}
export function BookingPanel({
  scope,
  session,
  api,
  command,
  initialPerson,
  onPerson,
}: {
  scope: SetupScope;
  session: SessionView;
  api: BookingApi;
  command: ReturnType<typeof useSetupCommand>;
  initialPerson: PersonSummary | null;
  onPerson: (person: PersonSummary | null) => void;
}) {
  const t = useTranslations("flows"),
    format = useFormatter(),
    id = useId(),
    [page, setPage] = useState<Awaited<ReturnType<BookingApi["reservations"]>> | null>(null),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [person, setPerson] = useState<PersonSummary | null>(initialPerson),
    [draft, setDraft] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const disabled = command.busy || !!command.pending;
  useEffect(() => {
    let active = true;
    void api
      .reservations(scope, session.id, cursor)
      .then((result) => {
        if (result.items.some((row) => row.session_id !== session.id)) throw Error("invalidForm");
        if (active) setPage(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, session.id, api, cursor, attempt]);
  return (
    <div className="space-y-5">
      <p>
        {format.dateTime(new Date(session.starts_at), { dateStyle: "medium", timeStyle: "short" })}{" "}
        · {t("remaining", { count: session.capacity.remaining })}
      </p>
      {error && <FlowError code={error} />}
      {!page && !error && <output>{t("loading")}</output>}
      {page && (
        <ul className="space-y-4">
          {page.items.map((row, index) => (
            <li key={row.id} className="rounded-md border p-3">
              <p>
                {t("participant", { number: index + 1 })}
                {row.subscriber_number ? ` · ${row.subscriber_number}` : ""} ·{" "}
                {t(`reservationStates.${row.state}`)}
              </p>
              {row.state === "active" && (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (disabled) return;
                    const reason = String(
                      new FormData(event.currentTarget).get("reason") ?? "",
                    ).trim();
                    if (!reason) return;
                    setDraft({
                      operation: "reservation_cancel_v1",
                      input: {
                        org_id: scope.orgId,
                        center_id: scope.centerId,
                        operation_key: v7(),
                        reservation_id: row.id,
                        expected_version: row.version,
                        reason,
                      },
                    });
                  }}
                >
                  <Label htmlFor={`${id}-${row.id}`}>{t("cancelReason")}</Label>
                  <Input
                    id={`${id}-${row.id}`}
                    name="reason"
                    required
                    disabled={disabled}
                    onChange={() => setDraft(null)}
                  />
                  <Button
                    className="h-auto min-h-11 max-w-full whitespace-normal"
                    variant="outline"
                    disabled={disabled}
                  >
                    {t("cancelReservation")}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {page?.next_cursor && (
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setPage(null);
            setDraft(null);
            setCursor(page.next_cursor ?? undefined);
          }}
        >
          {t("next")}
        </Button>
      )}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setPage(null);
          setError("");
          setDraft(null);
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {session.state === "planned" && (
        <>
          <PersonChooser
            scope={scope}
            disabled={disabled}
            read={api.people}
            onSelect={(value) => {
              setPerson(value);
              onPerson(value);
              setDraft(null);
            }}
          />
          {person && (
            <BookingForm
              key={person.id}
              scope={scope}
              person={person}
              session={session}
              command={command}
              api={api}
            />
          )}
        </>
      )}
      {draft && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={() => setDraft(null)}
        >
          <p>{t("cancellationHint")}</p>
          <p>{draft.operation === "reservation_cancel_v1" ? draft.input.reason : ""}</p>
        </ConfirmWrite>
      )}
    </div>
  );
}
function BookingForm({
  scope,
  person,
  session,
  api,
  command,
}: {
  scope: SetupScope;
  person: PersonSummary;
  session: SessionView;
  api: BookingApi;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("flows"),
    id = useId(),
    [mode, setMode] = useState<BookingMode>("flexible"),
    [rows, setRows] = useState<EntitlementView[] | null>(null),
    [error, setError] = useState(""),
    [sale, setSale] = useState(""),
    [category, setCategory] = useState(""),
    [override, setOverride] = useState(false),
    [reason, setReason] = useState(""),
    [draft, setDraft] = useState<SetupCommand | null>(null),
    [docs, setDocs] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [canOverride, setCanOverride] = useState(false);
  useEffect(() => {
    let active = true;
    void api
      .capacity(scope, person.id, session.id)
      .then((allowed) => {
        if (active) setCanOverride(allowed);
      })
      .catch(() => {
        if (active) setCanOverride(false);
      });
    return () => {
      active = false;
    };
  }, [api, scope, person.id, session.id]);
  const disabled = command.busy || !!command.pending;
  useEffect(() => {
    let active = true;
    void api
      .rights(scope, person.id, session.id, mode)
      .then((result) => {
        if (
          result.some(
            (row) => row.person_id !== person.id || row.available_at_session === undefined,
          )
        )
          throw Error("invalidForm");
        if (active) setRows(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, person.id, session.id, mode, api, attempt]);
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t("newBooking")}>
      <h4 className="font-semibold">{person.display_name}</h4>
      <p className="text-sm">{t("rightsReadHint")}</p>
      {error && <FlowError code={error} />}
      <form
        className="space-y-3"
        onChange={() => setDraft(null)}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !rows || error || !sale) return;
          const selected = rows.find((row) => row.sale_id === sale);
          if (sale !== "automatic" && (!selected || !selected.available_at_session)) return;
          const input = {
            org_id: scope.orgId,
            center_id: scope.centerId,
            operation_key: v7(),
            person_id: person.id,
            session_id: session.id,
            mode,
            source_sale_id: sale === "automatic" ? null : sale,
            ...(category === "male" || category === "female"
              ? { booking_category: category as "male" | "female" }
              : {}),
          };
          setDraft(
            override
              ? { operation: "reservation_capacity_override_v1", input: { ...input, reason } }
              : { operation: "reservation_create_v1", input },
          );
        }}
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
          <Label htmlFor={`${id}-mode`}>{t("mode")}</Label>
          <select
            id={`${id}-mode`}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as BookingMode);
              setRows(null);
              setSale("");
              setError("");
            }}
          >
            <option value="flexible">{t("flexible")}</option>
            <option value="priority">{t("priority")}</option>
          </select>
          {!rows && !error && <output>{t("loading")}</output>}
          {rows && (
            <>
              <Label htmlFor={`${id}-sale`}>{t("sourceRight")}</Label>
              <select
                id={`${id}-sale`}
                required
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={sale}
                onChange={(event) => setSale(event.target.value)}
              >
                <option value="">{t("choose")}</option>
                {rows.map((row, i) => (
                  <option
                    key={row.sale_id}
                    value={row.sale_id}
                    disabled={!row.available_at_session}
                  >
                    {t(row.kind === "credits" ? "creditRight" : "timedRight", {
                      number: i + 1,
                      count: row.available_at_session ?? 0,
                    })}{" "}
                    · {row.end_date}
                  </option>
                ))}
                <option value="automatic">{t("automaticRights")}</option>
              </select>
            </>
          )}
          <Label htmlFor={`${id}-category`}>{t("category")}</Label>
          <select
            id={`${id}-category`}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("noCategory")}</option>
            <option value="male">{t("male")}</option>
            <option value="female">{t("female")}</option>
          </select>
          {canOverride && (
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={override}
                onChange={(event) => setOverride(event.target.checked)}
              />
              {t("override")}
            </label>
          )}
          <p className="text-sm text-muted-foreground">{t("overrideHint")}</p>
          {override && (
            <>
              <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
              <Input
                id={`${id}-reason`}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </>
          )}
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            disabled={!rows || !!error || !sale}
          >
            {t("inspectBooking")}
          </Button>
        </fieldset>
      </form>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setRows(null);
          setError("");
          setSale("");
          setDraft(null);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reloadRights")}
      </Button>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => setDocs((value) => !value)}
        aria-expanded={docs}
      >
        {t("documents")}
      </Button>
      {docs && (
        <ContextDocuments
          actorId={scope.actorId}
          actions={api.documents}
          query={{
            org_id: scope.orgId,
            center_id: scope.centerId,
            person_id: person.id,
            context: { gate: "reservation", subject: { type: "sessions", id: session.id } },
          }}
        />
      )}
      {draft && (
        <ConfirmWrite
          key={draft.input.operation_key}
          command={draft}
          controller={command}
          onBack={() => setDraft(null)}
        >
          <p>
            {person.display_name} · {t(mode)} ·{" "}
            {sale === "automatic" ? t("automaticRights") : t("selectedRight")}
          </p>
          <p>
            {t("category")}: {category ? t(category) : t("noCategory")}
          </p>
          {override && (
            <p>
              {t("override")}: {reason}
            </p>
          )}
          <p>{t("rightsReadHint")}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
