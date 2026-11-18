import { expect, type Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import type { ReservationView, SessionView } from "../src/lib/api-contracts/generated.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
export async function mockOwnReservations(
  page: Page,
  options: {
    noStudent?: boolean;
    starterRoleGate?: boolean;
    denied?: boolean;
    unknown?: boolean;
    ackUnread?: boolean;
    cancelDenied?: boolean;
    staleLesson?: boolean;
  } = {},
) {
  await mockStudio(page);
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  const reads: { operation: string; request: Record<string, unknown> }[] = [],
    writes: Record<string, unknown>[] = [];
  const sessions: SessionView[] = [0, 1, 2].map((index) => ({
    id: id(950 + index),
    class_id: null,
    discipline_id: I.discipline,
    format: "group",
    starts_at: index === 2 ? "2026-11-15T15:00:00Z" : `2026-11-${17 + index}T15:00:00Z`,
    ends_at: index === 2 ? "2026-11-15T16:00:00Z" : `2026-11-${17 + index}T16:00:00Z`,
    state: index === 2 ? "occurred" : "planned",
    attendance_state: index === 2 ? "closed" : "open",
    assignments: [],
    version: 3,
    capacity: {
      total: 10,
      held: 1,
      remaining: 9,
      category_held: null,
      category_remaining: null,
      room_capacity: 20,
    },
    shared_participants: [
      {
        person_id: I.role,
        display_name: "Başka üyenin gizli adı",
        email: "private@example.invalid",
      },
    ],
  }));
  const reservations: ReservationView[] = sessions.map((session, index) => ({
    id: id(960 + index),
    session_id: session.id,
    person_id: I.self,
    state: index === 2 ? "completed" : "active",
    mode: "flexible",
    version: 2,
    source_summary: {
      status: "available",
      as_of: "2026-11-16T12:00:00Z",
      source_sale_id: id(970),
      product_version_id: id(971),
      product_name: "Sentetik satın alınmış paket",
      kind: "credits",
      booking_mode: "flexible",
      sale_state: "active",
      state: "active",
      start_date: "2026-11-01",
      end_date: "2026-12-01",
      timezone: "Europe/Istanbul",
      available_credits: "4",
      reserved: "2",
      consumed: "2",
      sale_version: 1,
    },
  }));
  let denied = Boolean(options.denied),
    unread = Boolean(options.ackUnread),
    saved = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    reads.push({ operation, request: req });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code = "FORBIDDEN") =>
      route.fulfill({
        status: code === "PLAN_FEATURE_UNAVAILABLE" ? 200 : 403,
        json: { ok: false, error: { code, retryable: false, trace_id: I.role } },
      });
    if (operation === "organizations_list_v1")
      return send({
        items: [
          {
            id: I.org,
            name: "Fixture Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
            self_context: {
              person_id: I.self,
              subscriber_number: null,
              centers: [
                {
                  center_id: I.center,
                  student: !options.noStudent,
                  instructor: false,
                  assistant: false,
                },
              ],
            },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    if (operation === "roles_list_v1")
      return options.noStudent
        ? send({
            items: [
              {
                id: I.role,
                person_id: I.self,
                role: "owner",
                scope_center_id: null,
                state: "active",
                version: 1,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-16T12:00:00Z",
          })
        : reject(options.starterRoleGate ? "PLAN_FEATURE_UNAVAILABLE" : "FORBIDDEN");
    if (
      operation === "management_state_get_v1" &&
      req.operation === "waitlist_join_v1" &&
      req.selector?.key?.directory === "self"
    )
      return send({ items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    if (operation === "reservation_list_v1") {
      expect(req.person_id).toBe(I.self);
      expect(req.center_id).toBe(I.center);
      if (denied) return reject();
      const items = req.session_id
        ? reservations.filter((row) => row.session_id === req.session_id)
        : req.time_filter === "past"
          ? [reservations[2]!]
          : [reservations[req.page.cursor ? 1 : 0]!];
      return send({
        items,
        next_cursor:
          !req.session_id && req.time_filter === "upcoming" && !req.page.cursor ? "own-next" : null,
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (operation === "session_get_v1")
      return send(sessions.find((row) => row.id === req.session_id));
    if (operation === "attendance_get_v1") {
      const session = sessions.find((row) => row.id === req.session_id)!;
      return send({
        session_id: session.id,
        session_version: 3,
        closure_state: session.attendance_state,
        revision: 1,
        entries:
          session.attendance_state === "closed"
            ? [
                {
                  reservation_id: reservations[2]!.id,
                  person_id: I.self,
                  result: "attended",
                  version: 1,
                  protected: false,
                  eligibility_snapshot: null,
                },
                {
                  reservation_id: reservations[2]!.id,
                  person_id: I.role,
                  result: "no_show",
                  version: 1,
                  protected: false,
                  eligibility_snapshot: null,
                },
              ]
            : [],
      });
    }
    if (operation === "calendar_get_v1")
      return send({
        items: sessions
          .filter((row) => row.starts_at === req.interval.starts_at)
          .map((row) => ({
            id: row.id,
            type: "session",
            center_id: I.center,
            title: row.id === sessions[2]!.id ? "Sentetik geçmiş ders" : "Sentetik gelecek ders",
            starts_at: row.starts_at,
            ends_at: row.ends_at,
            ...(req.member_discovery
              ? {
                  capacity: row.capacity,
                  member_lesson: {
                    version: row.version,
                    format: row.format,
                    state: row.state,
                    attendance_state: row.attendance_state,
                    instructor_labels: ["Öğrenciye görünür eğitmen"],
                    room_labels: ["Öğrenciye görünür salon"],
                    booking_window: {
                      state: "open",
                      policy_version_id: id(980),
                      opens_at: "2026-11-01T00:00:00Z",
                      closes_at: row.starts_at,
                    },
                    cancellation: {
                      status: "available",
                      source: "current_policy",
                      policy_version_id: id(981),
                      terms: {
                        cutoff_minutes: 30,
                        before_cutoff: "consume",
                        after_cutoff: "consume",
                        no_show: "consume",
                      },
                      cutoff_at: "2026-11-17T14:30:00Z",
                    },
                    own_reservation: {
                      ...reservations.find((r) => r.session_id === row.id)!,
                      version: options.staleLesson
                        ? 99
                        : reservations.find((r) => r.session_id === row.id)!.version,
                      cancellation: {
                        status: "available",
                        source: "reservation_policy",
                        policy_version_id: id(982),
                        terms: {
                          cutoff_minutes: 120,
                          before_cutoff: "release",
                          after_cutoff: "consume",
                          no_show: "consume",
                        },
                        cutoff_at: "2026-11-17T13:00:00Z",
                      },
                    },
                    waitlist_enabled: true,
                    own_waitlist: null,
                  },
                }
              : {}),
          })),
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    if (operation === "management_state_get_v1" && req.operation === "reservation_cancel_v1") {
      if (options.cancelDenied) return reject();
      const row = reservations.find((row) => row.id === req.selector.key.reservation_id)!;
      return send({
        items: [
          {
            exists: true,
            entity: { type: "reservations", id: row.id },
            versions: [{ entity: { type: "reservations", id: row.id }, version: row.version }],
            current: { operation: "reservation_cancel_v1", values: { reservation_id: row.id } },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (operation === "reservation_cancel_v1") {
      writes.push(req);
      expect(req.reservation_id).toBe(reservations[0]!.id);
      expect(req.expected_version).toBe(2);
      if (!saved) {
        reservations[0]!.state = "cancelled";
        reservations[0]!.version = 3;
        saved = true;
      }
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: reservations[0]!.id, versions: [], job_ids: [] });
    }
    if (operation === "operation_status_get_v1")
      return send({
        operation: "reservation_cancel_v1",
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "reservations", id: reservations[0]!.id },
      });
    if (operation === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.self);
      if (unread && saved) {
        unread = false;
        return route.fulfill({
          status: 500,
          json: {
            ok: false,
            error: { code: "VALIDATION_FAILED", retryable: false, trace_id: I.role },
          },
        });
      }
      return send([]);
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/member/reservations?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("heading", { name: "Rezervasyonlarım", exact: true })).toBeVisible();
  return {
    reads,
    writes,
    reservations,
    setDenied: (value: boolean) => {
      denied = value;
    },
  };
}
