import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";

import type {
  ReservationView,
  WaitlistEntryView,
  CalendarItem,
  MemberLessonDiscovery,
  SessionCapacityView,
} from "../src/lib/api-contracts/generated.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
type MemberClass = CalendarItem & {
  member_lesson: MemberLessonDiscovery;
  capacity: SessionCapacityView;
};
const review = "Hak kaynağını ve iptal koşullarını inceledim, işlemi onaylıyorum.";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
async function fixture(
  page: Page,
  options: {
    full?: boolean;
    category?: boolean;
    offer?: boolean;
    unknown?: boolean;
    stale?: boolean;
    denied?: boolean;
    noStudent?: boolean;
    ackUnread?: boolean;
  } = {},
) {
  await mockOwnReservations(page, { noStudent: options.noStudent });
  await page.goto("about:blank");
  const row: MemberClass = {
    id: id(1),
    type: "session",
    center_id: I.center,
    starts_at: "2026-11-16T15:00:00Z",
    ends_at: "2026-11-16T16:00:00Z",
    title: "Öğrenciye açık tango",
    capacity: {
      total: 12,
      held: options.full ? 12 : 2,
      remaining: options.full ? 0 : 10,
      category_held: options.category ? { male: 6, female: 2 } : null,
      category_remaining: options.category ? { male: 0, female: 4 } : null,
      categories: options.category ? { male: 6, female: 6 } : null,
      room_capacity: 20,
    },
    member_lesson: {
      version: 7,
      format: "group",
      state: "planned",
      attendance_state: "open",
      instructor_labels: ["Görünür eğitmen"],
      room_labels: ["Görünür salon"],
      booking_window: {
        state: "open",
        policy_version_id: id(2),
        opens_at: "2026-11-01T00:00:00Z",
        closes_at: "2026-11-16T14:30:00Z",
      },
      cancellation: {
        status: "available",
        source: "current_policy",
        policy_version_id: id(3),
        terms: {
          cutoff_minutes: 60,
          before_cutoff: "release",
          after_cutoff: "consume",
          no_show: "consume",
        },
        cutoff_at: "2026-11-16T14:00:00Z",
      },
      own_reservation: null,
      waitlist_enabled: true,
      own_waitlist: null,
    },
  };
  const right = {
    sale_id: id(4),
    person_id: I.self,
    start_date: "2026-11-01",
    end_date: "2026-12-01",
    timezone: "Europe/Istanbul",
    state: "active",
    available: 4,
    reserved: 0,
    consumed: 0,
    deficit: 0,
    quotas: [],
    deficit_scopes: [],
    kind: "credits",
    booking_mode: "priority",
    available_at_session: 4,
  };
  const state = {
    row,
    entry: undefined as WaitlistEntryView | undefined,
    reservation: undefined as ReservationView | undefined,
    writes: [] as { op: string; request: Record<string, unknown> }[],
    reads: [] as { op: string; request: Record<string, unknown> }[],
    denied: !!options.denied,
    unread: false,
  };
  if (options.offer) {
    state.entry = {
      id: id(6),
      created_at: "2026-11-16T12:00:00Z",
      joined_at: "2026-11-16T12:00:00Z",
      version: 3,
      center_id: I.center,
      session_id: row.id,
      person_id: I.self,
      state: "offered",
      offers: [
        {
          id: id(7),
          created_at: "2026-11-16T12:00:00Z",
          version: 4,
          entry_id: id(6),
          session_id: row.id,
          person_id: I.self,
          state: "active",
          expires_at: "2026-11-16T13:00:00Z",
        },
      ],
    };
  }
  const sync = () => {
    row.member_lesson.own_waitlist =
      state.entry && ["waiting", "offered"].includes(state.entry.state)
        ? {
            id: state.entry.id,
            version: state.entry.version,
            state: state.entry.state,
            offer: state.entry.offers[0]
              ? {
                  id: state.entry.offers[0].id,
                  version: state.entry.offers[0].version,
                  state: state.entry.offers[0].state,
                  expires_at: state.entry.offers[0].expires_at,
                }
              : null,
          }
        : null;
    row.member_lesson.own_reservation =
      state.reservation?.state === "active"
        ? {
            id: state.reservation.id,
            version: state.reservation.version,
            state: state.reservation.state,
            mode: state.reservation.mode,
            cancellation: { ...row.member_lesson.cancellation, source: "reservation_policy" },
          }
        : null;
  };
  sync();
  const receipts = new Map<string, { op: string; type: string; id: string }>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    state.reads.push({ op, request: r });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code = "FORBIDDEN", retryable = false) =>
      route.fulfill({
        status: retryable ? 503 : 403,
        json: { ok: false, error: { code, retryable, trace_id: I.role } },
      });
    if (op === "calendar_get_v1") {
      expect(r.member_discovery).toBe(true);
      expect(r.center_id).toBe(I.center);
      expect(r).not.toHaveProperty("resource");
      if (state.denied) return reject();
      if (options.stale && r.interval.starts_at === row.starts_at) row.member_lesson.version = 8;
      sync();
      return send({ items: [row], next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    }
    if (op === "entitlements_get_v1") {
      expect(r.person_id).toBe(I.self);
      return send(r.booking_mode && r.booking_mode !== "priority" ? [] : [right]);
    }
    if (op === "session_get_v1") {
      expect(state.reservation).toBeDefined();
      return send({
        id: row.id,
        class_id: null,
        discipline_id: I.discipline,
        format: "group",
        state: "planned",
        attendance_state: "open",
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        version: 7,
        assignments: [],
        capacity: row.capacity,
      });
    }
    if (op === "reservation_list_v1") {
      expect(r.person_id).toBe(I.self);
      expect(r.session_id).toBe(row.id);
      if (state.unread) {
        state.unread = false;
        return reject("SERVICE_UNAVAILABLE", true);
      }
      return send({
        items: state.reservation ? [state.reservation] : [],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (op === "person_get_v1") return reject();
    if (
      op === "management_state_get_v1" &&
      ["waitlist_join_v1", "waitlist_leave_v1"].includes(r.operation)
    ) {
      expect(r.selector.key.person_id ?? I.self).toBe(I.self);
      const entry = state.entry;
      return send({
        items: entry
          ? [
              {
                operation: r.operation,
                exists: true,
                entity: { type: "waitlist_entries", id: entry.id },
                state: entry.state,
                versions: [
                  { entity: { type: "waitlist_entries", id: entry.id }, version: entry.version },
                  ...entry.offers.map((offer) => ({
                    entity: { type: "seat_offers", id: offer.id },
                    version: offer.version,
                  })),
                ],
                waitlist_detail: entry,
              },
            ]
          : [],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (op === "management_state_get_v1" && r.operation === "reservation_cancel_v1")
      return send({
        items: [
          {
            exists: true,
            entity: { type: "reservations", id: state.reservation!.id },
            versions: [
              {
                entity: { type: "reservations", id: state.reservation!.id },
                version: state.reservation!.version,
              },
            ],
            current: { operation: r.operation, values: { reservation_id: state.reservation!.id } },
          },
        ],
        next_cursor: null,
      });
    if (
      [
        "reservation_create_v1",
        "reservation_cancel_v1",
        "waitlist_join_v1",
        "waitlist_leave_v1",
        "seat_offer_accept_v1",
        "seat_offer_reject_v1",
      ].includes(op)
    ) {
      state.writes.push({ op, request: r });
      let type = "reservations",
        primary = id(5);
      if (op === "reservation_create_v1") {
        expect(r.person_id).toBe(I.self);
        expect(r.source_sale_id).toBe(right.sale_id);
        state.reservation = {
          id: primary,
          session_id: row.id,
          person_id: I.self,
          state: "active",
          mode: r.mode,
          version: 2,
        };
        state.unread = !!options.ackUnread;
      }
      if (op === "reservation_cancel_v1") {
        expect(r.expected_version).toBe(2);
        state.reservation = { ...state.reservation!, state: "cancelled", version: 3 };
      }
      if (op === "waitlist_join_v1") {
        type = "waitlist_entries";
        primary = id(6);
        state.entry = {
          id: primary,
          created_at: "2026-11-16T12:00:00Z",
          joined_at: "2026-11-16T12:00:00Z",
          center_id: I.center,
          person_id: I.self,
          session_id: row.id,
          version: 3,
          state: "waiting",
          offers: [],
          booking_category: r.booking_category ?? null,
        };
      }
      if (op === "waitlist_leave_v1") {
        type = "waitlist_entries";
        primary = state.entry!.id;
        expect(r.expected_version).toBe(3);
        state.entry = { ...state.entry!, version: 4, state: "left" };
      }
      if (op.startsWith("seat_offer_")) {
        type = "seat_offers";
        primary = id(7);
        expect(r.expected_version).toBe(4);
        const accepted = op === "seat_offer_accept_v1";
        state.entry = {
          ...state.entry!,
          version: 4,
          state: accepted ? "converted" : "closed",
          offers: [
            { ...state.entry!.offers[0]!, version: 5, state: accepted ? "accepted" : "rejected" },
          ],
        };
        if (accepted)
          state.reservation = {
            id: id(5),
            session_id: row.id,
            person_id: I.self,
            state: "active",
            mode: "flexible",
            version: 2,
          };
      }
      receipts.set(r.operation_key, { op, type, id: primary });
      sync();
      if (options.unknown && state.writes.length === 1) return route.abort("failed");
      return send({ primary_id: primary, versions: [], job_ids: [] });
    }
    if (op === "operation_status_get_v1") {
      const receipt = receipts.get(r.key)!;
      expect(r.operation).toBe(receipt.op);
      return send({
        operation: receipt.op,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: receipt.type, id: receipt.id },
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/member/classes?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("heading", { name: "Dersler", exact: true })).toBeVisible();
  return state;
}
async function book(page: Page) {
  await page.getByRole("button", { name: "Kayıt ol", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("radio").first().press("Space");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Kaydı onayla", exact: true }).click();
  return d;
}
test("member discovery shows safe labels and one semantic menu across a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page);
  await expect(page.getByText(/Görünür eğitmen · Görünür salon · Grup dersi/)).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Dersler", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(state.writes).toHaveLength(0);
  expect(state.reads.filter((row) => row.op === "calendar_get_v1")).toHaveLength(1);
  await page.getByRole("button", { name: "Sonraki hafta", exact: true }).click();
  await expect.poll(() => state.reads.filter((row) => row.op === "calendar_get_v1").length).toBe(2);
});
test("member booking requires an explicit right and review, then rereads native reservation and rights", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Kayıt ol", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Kaydı onayla", exact: true }).click();
  await expect(d.getByRole("alert")).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await d.getByRole("radio").first().press("Space");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Kaydı onayla", exact: true }).click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.op).toBe("reservation_create_v1");
  await expect(d.getByRole("button", { name: "Kaydı onayla", exact: true })).toBeDisabled();
  await d.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(
    page.getByText("Kayıtlısın", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});
test("member unknown booking recovers from the same receipt and never repeats the write", async ({
  page,
}) => {
  const state = await fixture(page, { unknown: true });
  await book(page);
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("member acknowledged booking retries only the unread result", async ({ page }) => {
  const state = await fixture(page, { ackUnread: true });
  await book(page);
  await expect(
    page.getByText("İşlem kaydedildi, güncel sonuç henüz okunamadı. Yalnız sonucu yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("member stale lesson preflight prevents booking without inventing capacity override", async ({
  page,
}) => {
  const state = await fixture(page, { stale: true });
  await book(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("member category-full waitlist uses its native category, then supports explicit leave", async ({
  page,
}) => {
  const state = await fixture(page, { category: true });
  await page.getByRole("button", { name: "Kayıt ol", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Rezervasyon kategorisi", { exact: true }).selectOption("male");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Sıraya gir", exact: true }).click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    op: "waitlist_join_v1",
    request: { booking_category: "male" },
  });
  await d.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "Sıradan çık", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Sıradan çık", exact: true }).click();
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.entry!.state).toBe("left");
});
for (const accept of [true, false])
  test(`member seat offer ${accept ? "acceptance" : "rejection"} uses the real offer identity and version`, async ({
    page,
  }) => {
    const state = await fixture(page, { full: true, offer: true });
    await page.getByRole("button", { name: "Teklifi gör", exact: true }).click();
    const d = page.getByRole("dialog");
    await expect(d.getByText(/Teklifin son geçerlilik zamanı/)).toBeVisible();
    await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
    await d
      .getByRole("button", { name: accept ? "Teklifi kabul et" : "Teklifi reddet", exact: true })
      .click();
    await expect(page.getByText(saved, { exact: true })).toBeVisible();
    expect(state.writes[0]).toMatchObject({
      op: accept ? "seat_offer_accept_v1" : "seat_offer_reject_v1",
      request: { offer_id: id(7), expected_version: 4 },
    });
    expect(state.entry!.state).toBe(accept ? "converted" : "closed");
  });
test("member reservation cancellation keeps its native reason/version and refreshes discovery", async ({
  page,
}) => {
  const state = await fixture(page);
  let d = await book(page);
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "İptal et", exact: true }).click();
  const a = page.getByRole("alertdialog");
  await a.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await a.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    page.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.reservation!.state).toBe("cancelled");
});
test("member discovery denial stays unknown until explicit retry", async ({ page }) => {
  const state = await fixture(page, { denied: true });
  await expect(
    page.getByText("Güncel ders kaynağı okunamadı. Yeniden dene.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bu gün ders yok.", { exact: true })).toHaveCount(0);
  state.denied = false;
  await page.getByRole("button", { name: "Listeyi yenile", exact: true }).click();
  await expect(page.getByText("Öğrenciye açık tango", { exact: true })).toBeVisible();
});
