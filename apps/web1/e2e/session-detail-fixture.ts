import { expect, type Page } from "@playwright/test";
import type {
  SessionView,
  ReservationView,
  AttendanceView,
  EntitlementView,
  PersonView,
} from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
export const sessionIds = {
  session: "019a7b00-0000-7000-8000-000000000085",
  sale: "019a7b00-0000-7000-8000-000000000086",
  reservation: "019a7b00-0000-7000-8000-000000000087",
  preview: "019a7b00-0000-7000-8000-000000000090",
};
export async function mockSessionDetail(
  page: Page,
  options: {
    existing?: boolean;
    unknown?: boolean;
    ackUnread?: boolean;
    full?: boolean;
    overrideDenied?: boolean;
    attendanceDenied?: boolean;
    writeDenied?: boolean;
    allowEditor?: boolean;
    instructor?: boolean;
    starterRoleGate?: boolean;
    attendanceUnknown?: boolean;
    attendanceAckUnread?: boolean;
    origins?: Parameters<typeof mockStudio>[1];
  } = {},
) {
  const studio = await mockStudio(page, options.origins);
  const appOrigin = options.origins?.app ?? origin;
  if (options.allowEditor) studio.roles[0]!.accountAccessGranted = true;
  const S = sessionIds,
    writes: { operation: string; request: Record<string, unknown> }[] = [],
    reads: string[] = [],
    receipts = new Map<
      string,
      { operation: string; type: "sessions" | "reservations"; id: string }
    >();
  const calendarReads: Record<string, unknown>[] = [];
  const start = Date.now() + (options.existing ? -20 : 60) * 60000;
  const session: SessionView = {
    id: S.session,
    class_id: I.lesson,
    discipline_id: I.discipline,
    format: "group",
    state: "planned",
    attendance_state: "open",
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + 3600000).toISOString(),
    assignments: [{ person_id: I.instructor, duty: "instructor" }],
    version: 3,
    capacity: {
      total: options.full ? 1 : 12,
      held: options.existing || options.full ? 1 : 0,
      remaining: options.full ? 0 : options.existing ? 11 : 12,
      category_held: null,
      category_remaining: null,
      room_capacity: 20,
    },
  };
  let reservation: ReservationView | undefined = options.existing
    ? {
        id: S.reservation,
        session_id: S.session,
        person_id: I.self,
        state: "active",
        mode: "flexible",
        version: 2,
      }
    : undefined;
  const attendance: AttendanceView = {
    session_id: S.session,
    session_version: 3,
    closure_state: "open",
    revision: 0,
    actual_started_at: null,
    entries: options.existing
      ? [
          {
            reservation_id: S.reservation,
            person_id: I.self,
            result: "unmarked",
            version: 8,
            protected: false,
            eligibility_snapshot: null,
          },
        ]
      : [],
  };
  const person: PersonView = {
    id: I.self,
    display_name: "Örnek öğrenci",
    discipline_relationships: [],
    version: 2,
    contacts: [],
    relationships: [{ center_id: I.center, kind: "student", state: "active" }],
  };
  let attendanceUnread = false;
  let unread = false,
    corrections: Record<string, unknown>[] = [];
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    reads.push(operation);
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      reject = (code: string) =>
        route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (options.instructor && operation === "organizations_list_v1")
      return send({
        items: [
          {
            id: I.org,
            name: "Fixture Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
            self_context: {
              person_id: I.instructor,
              subscriber_number: null,
              centers: [
                { center_id: I.center, instructor: true, student: false, assistant: false },
              ],
            },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    if (options.instructor && operation === "earnings_list_v1") {
      expect(req.person_id).toBe(I.instructor);
      return send({ items: [], next_cursor: null, as_of: new Date().toISOString() });
    }
    if (options.instructor && operation === "roles_list_v1")
      return reject(options.starterRoleGate ? "PLAN_FEATURE_UNAVAILABLE" : "FORBIDDEN");
    if (operation === "session_get_v1") {
      expect(req.session_id).toBe(S.session);
      if (attendanceUnread) {
        attendanceUnread = false;
        return route.abort();
      }
      return send({
        ...session,
        ...(req.include_room_labels
          ? { room_labels: [{ room_id: I.room, name: "Atanmış salon" }] }
          : {}),
      });
    }
    if (operation === "calendar_get_v1") {
      calendarReads.push(req);
      if (options.instructor) expect(req.resource).toEqual({ kind: "person", id: I.instructor });
      const visible =
        !options.instructor ||
        (Date.parse(session.starts_at) < Date.parse(req.interval.ends_at) &&
          Date.parse(session.ends_at) > Date.parse(req.interval.starts_at));
      return send({
        items: visible
          ? [
              {
                id: S.session,
                type: "session",
                center_id: I.center,
                starts_at: session.starts_at,
                ends_at: session.ends_at,
                title: "Sentetik seans",
                ...(req.include_room_labels
                  ? { room_labels: [{ room_id: I.room, name: "Atanmış salon" }] }
                  : {}),
                resources: [{ kind: "room", id: I.room }],
              },
            ]
          : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "person_get_v1" && req.person_id === I.self) return send(person);
    if (operation === "people_list_v1")
      return send({ items: [person], next_cursor: null, as_of: new Date().toISOString() });
    if (operation === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.self);
      const rights: EntitlementView = {
        sale_id: S.sale,
        person_id: I.self,
        start_date: "2026-11-01",
        end_date: "2099-12-01",
        timezone: "Europe/Istanbul",
        state: "active",
        available: reservation ? 7 : 8,
        reserved: reservation?.state === "active" ? 1 : 0,
        consumed:
          attendance.closure_state === "closed" && attendance.entries[0]?.result === "attended"
            ? 1
            : 0,
        deficit: 0,
        quotas: [],
        deficit_scopes: [],
        booking_mode: "flexible",
        kind: "credits",
        available_at_session: reservation ? 7 : 8,
      };
      return send([rights]);
    }
    if (operation === "reservation_list_v1") {
      expect(req.session_id).toBe(S.session);
      if (options.ackUnread && reservation && !options.existing && req.person_id && !unread) {
        unread = true;
        return reject("TEMPORARY_FAILURE");
      }
      return send({
        items: reservation
          ? [
              {
                ...reservation,
                ...(req.include_source_summary
                  ? {
                      source_summary: {
                        status: "available",
                        as_of: new Date().toISOString(),
                        source_sale_id: S.sale,
                        product_version_id: I.lesson,
                        product_name: "Satın alınmış paket",
                        kind: "credits",
                        booking_mode: "flexible",
                        sale_state: "active",
                        state: "active",
                        start_date: "2026-11-01",
                        end_date: "2099-12-01",
                        timezone: "Europe/Istanbul",
                        available_credits: "7",
                        reserved: "1",
                        consumed: "0",
                        sale_version: 2,
                      },
                    }
                  : {}),
              },
            ]
          : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "management_state_get_v1" && req.operation === "waitlist_join_v1")
      return send({ items: [], next_cursor: null, as_of: new Date().toISOString() });
    if (operation === "attendance_get_v1") {
      if (options.attendanceDenied) return reject("FORBIDDEN");
      attendance.session_version = session.version;
      return send(attendance);
    }
    if (
      operation === "management_state_get_v1" &&
      req.operation === "reservation_cancel_v1" &&
      req.selector.key.directory === "class"
    ) {
      expect(req.selector.key.class_id).toBe(I.lesson);
      return send({ items: [], next_cursor: null, as_of: new Date().toISOString() });
    }
    if (operation === "management_state_get_v1" && req.operation === "session_change_preview_v1") {
      if (!options.allowEditor) return reject("POLICY_NOT_CONFIGURED");
      return send({
        items: [
          {
            operation: req.operation,
            entity: { type: "sessions", id: S.session },
            exists: true,
            state: session.state,
            versions: [{ entity: { type: "sessions", id: S.session }, version: session.version }],
            current: {
              operation: req.operation,
              values: {
                session_id: S.session,
                scope: "single",
                patch: { resources: [{ kind: "room", id: I.room }] },
              },
            },
            as_of: new Date().toISOString(),
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (
      operation === "management_state_get_v1" &&
      req.operation === "reservation_capacity_override_v1"
    ) {
      if (options.overrideDenied) return reject("FORBIDDEN");
      expect(req.selector.key).toEqual({
        person_id: I.self,
        session_id: S.session,
        source_sale_id: S.sale,
      });
      return send({
        items: [
          {
            operation: req.operation,
            entity: { type: "sessions", id: S.session },
            exists: true,
            state: session.state,
            versions: [{ entity: { type: "sessions", id: S.session }, version: session.version }],
            as_of: new Date().toISOString(),
            current: { operation: req.operation, values: req.selector.key },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "reservation_create_v1" || operation === "reservation_capacity_override_v1") {
      writes.push({ operation, request: req });
      expect(req).toMatchObject({
        person_id: I.self,
        session_id: S.session,
        source_sale_id: S.sale,
        mode: "flexible",
      });
      expect(req).not.toHaveProperty("expected_version");
      if (operation === "reservation_capacity_override_v1")
        expect(req.reason).toBe("Sentetik kontenjan gerekçesi");
      if (!reservation) {
        reservation = {
          id: S.reservation,
          session_id: S.session,
          person_id: I.self,
          state: "active",
          mode: "flexible",
          version: 2,
          ...(req.booking_category ? { booking_category: req.booking_category } : {}),
        };
        session.capacity.held++;
        session.capacity.remaining = Math.max(0, session.capacity.total - session.capacity.held);
        session.version++;
        attendance.entries = [
          {
            reservation_id: S.reservation,
            person_id: I.self,
            result: "unmarked",
            version: 8,
            protected: false,
            eligibility_snapshot: null,
          },
        ];
      }
      receipts.set(req.operation_key, { operation, type: "reservations", id: S.reservation });
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: S.reservation, changed: [], jobs: [] });
    }
    if (
      operation === "attendance_start_v1" ||
      operation === "attendance_mark_v1" ||
      operation === "attendance_close_v1" ||
      operation === "attendance_correct_apply_v1"
    ) {
      writes.push({ operation, request: req });
      if (options.writeDenied) return reject("FORBIDDEN");
      if (operation === "attendance_start_v1") {
        expect(req.expected_version).toBe(session.version);
        expect(req.reason).toBe("Seans şimdi başladı");
        attendance.actual_started_at = req.actual_started_at;
      }
      if (operation === "attendance_mark_v1") {
        expect(req.expected_version).toBe(reservation!.version);
        expect(req.reservation_id).toBe(S.reservation);
        attendance.entries[0]!.result = req.result;
        attendance.entries[0]!.version++;
        reservation!.version++;
      }
      if (operation === "attendance_close_v1") {
        expect(req.expected_version).toBe(session.version);
        expect(req.performed).toBe(true);
        expect(req.performed_instructor_ids).toEqual([I.instructor]);
        expect(attendance.entries[0]!.result).toBe("attended");
        attendance.closure_state = "closed";
        attendance.revision++;
        session.attendance_state = "closed";
        session.state = "occurred";
        reservation!.state = "completed";
        reservation!.version++;
      }
      if (operation === "attendance_correct_apply_v1") {
        expect(req.preview).toEqual({ id: S.preview, token: "synthetic-attendance-preview" });
        attendance.entries[0]!.result = corrections[0]!.result as "no_show";
        attendance.revision++;
        reservation!.version++;
      }
      session.version++;
      attendance.session_version = session.version;
      const type = operation === "attendance_mark_v1" ? "reservations" : "sessions",
        id = type === "reservations" ? S.reservation : S.session;
      receipts.set(req.operation_key, { operation, type, id });
      if (options.attendanceAckUnread && operation === "attendance_start_v1")
        attendanceUnread = true;
      if (options.attendanceUnknown && operation === "attendance_start_v1")
        return route.abort("failed");
      return send({ primary_id: id, changed: [], jobs: [] });
    }
    if (operation === "attendance_correct_preview_v1") {
      expect(req.reason).toBe("Sentetik yoklama düzeltmesi");
      expect(req.corrections).toEqual([{ reservation_id: S.reservation, result: "no_show" }]);
      corrections = req.corrections;
      return send({
        id: S.preview,
        token: "synthetic-attendance-preview",
        scope_hash: "synthetic",
        expires_at: "2099-01-01T00:00:00Z",
        effects: [
          {
            entity: { type: "reservations", id: S.reservation },
            action: "release",
            quantity: 1,
            reason: options.instructor ? "Sentetik gizli mali açıklama" : req.reason,
            ...(options.instructor ? { amount_minor: "999999", currency: "TRY" } : {}),
          },
        ],
        blockers: [],
        dependencies: {
          versions: [{ entity: { type: "sessions", id: S.session }, version: session.version }],
          policy_hashes: [],
          permission_hash: "synthetic",
        },
      });
    }
    if (operation === "operation_status_get_v1") {
      const receipt = receipts.get(req.key);
      if (!receipt) return reject("NOT_FOUND");
      expect(req.operation).toBe(receipt.operation);
      return send({
        operation: req.operation,
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: receipt.type, id: receipt.id },
      });
    }
    return route.fallback();
  });
  await page.goto(`${appOrigin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${appOrigin}/account`);
  await page.goto(
    options.instructor
      ? `${appOrigin}/instructor/sessions/${S.session}?org=${I.org}&center=${I.center}`
      : `${appOrigin}/o/${I.org}/c/${I.center}/sessions/${S.session}`,
  );
  await expect(page.getByRole("heading", { name: "Sentetik seans", exact: true })).toBeVisible();
  return {
    studio,
    session,
    attendance,
    writes,
    reads,
    calendarReads,
    get reservation() {
      return reservation;
    },
  };
}
