"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { BookingApi } from "../../lib/bookings";
import type { SalesApi } from "../../lib/sales";
import type {
  PersonSummary,
  LessonRequestView,
  ReservationView,
  SessionView,
  ProductView,
  EntitlementView,
} from "@ftksaas/api-contracts";
import type { useSetupCommand } from "../setup/setup-command";
import { SetupFeedback } from "../setup/setup-command";
import { BookingPanel } from "../bookings/session-bookings";
import { RequestList } from "../bookings/lesson-requests";
import { RenewalForm } from "../products/person-sales";
import { Preferences } from "../preferences";
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081",
  personId = "019a2b3c-4d5e-7000-8000-000000000082";
const scope = { actorId: id, orgId: other, centerId: id },
  person = { id: personId, display_name: "Sentetik Öğrenci", relationships: [] };
const session: SessionView = {
  id,
  class_id: null,
  discipline_id: id,
  format: "private",
  starts_at: "2027-01-01T10:00:00Z",
  ends_at: "2027-01-01T11:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  version: 1,
  capacity: {
    total: 8,
    held: 0,
    remaining: 8,
    room_capacity: 8,
    category_held: null,
    category_remaining: null,
  },
};
const rights: EntitlementView[] = [
  {
    sale_id: other,
    person_id: personId,
    kind: "credits",
    state: "active",
    start_date: "2026-11-01",
    end_date: "2027-02-01",
    timezone: "Europe/Istanbul",
    available: 5,
    available_at_session: 5,
    reserved: 0,
    consumed: 3,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
  },
];
const product: ProductView = {
  id,
  version_id: id,
  terms: {
    name: "Salsa Yeni",
    kind: "credits",
    credits: 8,
    price_minor: "12345",
    currency: "TRY",
    booking_mode: "flexible",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "none" },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: id,
        discipline_id: id,
        usage_targets: ["lesson"],
      },
    ],
  },
};
const request: LessonRequestView = {
  id: other,
  person_id: personId,
  center_id: id,
  discipline_id: id,
  format: "private",
  state: "pending",
  requested_start: session.starts_at,
  duration_minutes: 60,
  version: 1,
  created_at: "2026-11-01T00:00:00Z",
  alternatives: [],
};
const asOf = "2026-11-05T00:00:00Z";
export function FlowsPreview() {
  const t = useTranslations("flows"),
    [revision, setRevision] = useState(0),
    [reservations, setReservations] = useState<ReservationView[]>([]),
    [requests, setRequests] = useState([request]),
    [chosen, setChosen] = useState<PersonSummary | null>(null);
  const api = useMemo<BookingApi>(
    () => ({
      capacity: async () => true,
      requestActions: async () => [
        "withdraw",
        "reject",
        "offer_alternative",
        "accept_alternative",
        "approve",
      ],
      documents: {
        person: async () => ({ ...person, version: 1, discipline_relationships: [] }),
        read: async () => [],
        file: async () => {
          throw Error("No synthetic document content");
        },
      },
      people: async () => ({ items: [person], next_cursor: null, as_of: asOf }),
      rights: async () => rights,
      reservations: async () => ({ items: reservations, next_cursor: null, as_of: asOf }),
      requests: async () => ({ items: requests, next_cursor: null, as_of: asOf }),
      catalog: async () => ({ disciplines: [{ id, name: "Salsa" }], instructors: [] }),
      disciplines: async () => [{ id, name: "Salsa", state: "active", version: 1 }],
      calendar: async () => [
        {
          id,
          type: "session",
          center_id: id,
          title: "Sentetik",
          starts_at: session.starts_at,
          ends_at: session.ends_at,
        },
      ],
      session: async () => session,
    }),
    [requests, reservations],
  );
  const sales = useMemo<SalesApi>(
    () => ({
      documents: api.documents,
      products: async () => ({ items: [product], next_cursor: null, as_of: asOf }),
      rights: async () => rights,
      finance: async () => ({
        person_id: personId,
        currency: "TRY",
        credit_available_minor: "0",
        debts: [],
        movements: { items: [], next_cursor: null, as_of: asOf },
      }),
      preview: async (_scope, input) => ({
        id,
        token: "synthetic-preview",
        expires_at: new Date(Date.now() + 900000).toISOString(),
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [
          {
            entity: { type: "sales", id: other },
            action: "create",
            amount_minor: "12345",
            currency: "TRY",
          },
        ],
        blockers: [],
        sale_lifecycle: {
          ...input,
          previous_end_date: "2027-02-01",
          gap_days: 0,
          overlap_days: 0,
          refund: null,
          offset_minor: "0",
        },
      }),
    }),
    [api.documents],
  );
  const command: ReturnType<typeof useSetupCommand> = {
    pending: null,
    busy: false,
    message: revision ? "saved" : "",
    check: async () => {
      throw Error("No pending synthetic command");
    },
    run: async (command) => {
      if (!command) throw Error("Missing synthetic command");
      if (
        command.operation === "reservation_create_v1" ||
        command.operation === "reservation_capacity_override_v1"
      )
        setReservations([
          {
            id: other,
            session_id: id,
            person_id: personId,
            state: "active",
            version: 1,
            mode: command.input.mode,
          },
        ]);
      else if (command.operation === "reservation_cancel_v1")
        setReservations((old) =>
          old.map((row) => ({ ...row, state: "cancelled", version: row.version + 1 })),
        );
      else if (command.operation === "lesson_request_create_v1") {
        const input = command.input;
        setRequests((old) => [
          ...old,
          {
            ...request,
            id: personId,
            requested_start: input.requested_start,
            duration_minutes: input.duration_minutes,
          },
        ]);
      } else if (command.operation === "lesson_request_offer_alternative_v1") {
        const input = command.input;
        setRequests((old) =>
          old.map((row) => ({
            ...row,
            state: "alternative_offered",
            version: row.version + 1,
            alternatives: input.alternatives.map((alt) => ({
              id: personId,
              request_id: row.id,
              created_at: asOf,
              version: 1,
              state: "offered",
              starts_at: alt.interval.starts_at,
              ends_at: alt.interval.ends_at,
            })),
          })),
        );
      } else if (command.operation === "lesson_request_withdraw_v1")
        setRequests((old) =>
          old.map((row) => ({ ...row, state: "withdrawn", version: row.version + 1 })),
        );
      else if (command.operation === "lesson_request_reject_v1")
        setRequests((old) =>
          old.map((row) => ({ ...row, state: "rejected", version: row.version + 1 })),
        );
      else if (command.operation === "lesson_request_accept_alternative_v1")
        setRequests((old) =>
          old.map((row) => ({
            ...row,
            version: row.version + 1,
            alternatives: row.alternatives.map((alt) => ({ ...alt, state: "accepted" })),
          })),
        );
      else if (command.operation === "lesson_request_approve_v1")
        setRequests((old) =>
          old.map((row) => ({ ...row, state: "approved", version: row.version + 1 })),
        );
      else if (command.operation !== "sale_renew_apply_v1")
        throw Error("Unexpected synthetic command");
      setRevision((n) => n + 1);
    },
  };
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-screen w-full min-w-0 max-w-3xl wrap-anywhere space-y-7 p-5 pb-24"
    >
      <Preferences />
      <h1 className="text-2xl font-semibold">{t("demoTitle")}</h1>
      <p>{t("demoHint")}</p>
      <SetupFeedback command={command} />
      <h2 className="text-lg font-semibold">{t("review")}</h2>
      <section aria-label={t("bookings")} className="min-w-0 space-y-4">
        <h3 className="font-semibold">{t("bookings")}</h3>
        <BookingPanel
          key={`book:${revision}`}
          scope={scope}
          session={session}
          api={api}
          command={command}
          initialPerson={chosen}
          onPerson={(value) => setChosen(value ? { ...person, ...value } : null)}
        />
      </section>
      <section aria-label={t("requests")} className="min-w-0 space-y-4">
        <h3 className="font-semibold">{t("requests")}</h3>
        <RequestList
          key={`request:${revision}`}
          scope={scope}
          person={person}
          timeZone="Europe/Istanbul"
          api={api}
          command={command}
        />
      </section>
      <section aria-label={t("renewal")} className="min-w-0 space-y-4">
        <h3 className="font-semibold">{t("renewal")}</h3>
        <RenewalForm
          key={`sale:${revision}`}
          scope={scope}
          personId={personId}
          api={sales}
          command={command}
        />
      </section>
    </main>
  );
}
