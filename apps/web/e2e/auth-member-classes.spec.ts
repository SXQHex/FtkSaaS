import { activate } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";

import type {
  ReservationView,
  WaitlistEntryView,
  CalendarItem,
  MemberLessonDiscovery,
  SessionCapacityView,
  DocumentView,
} from "@ftksaas/api-contracts";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
type MemberClass = CalendarItem & {
  member_lesson: MemberLessonDiscovery;
  capacity: SessionCapacityView;
};
const review = "Hak kaynağını ve iptal koşullarını inceledim, işlemi onaylıyorum.";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
const initialDocumentText = "Sentetik belge metni <script>window.documentExecuted=true</script>";
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
    weekStart?: "monday" | "sunday";
    ackUnread?: boolean;
    documents?: boolean;
    documentUnknown?: boolean;
    documentAckUnread?: boolean;
    documentContentFailure?: boolean;
    bookingRejection?: "ENTITLEMENT_UNAVAILABLE" | "DOCUMENT_REQUIRED" | "DEBT_BOOKING_BLOCKED";
  } = {},
) {
  await mockOwnReservations(page, { noStudent: options.noStudent, weekStart: options.weekStart });
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
    product_version_id: id(24),
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
    booking_mode: options.offer ? "flexible" : "priority",
    available_at_session: 4,
  };
  const state = {
    row,
    right,
    entry: undefined as WaitlistEntryView | undefined,
    reservation: undefined as ReservationView | undefined,
    writes: [] as { op: string; request: Record<string, unknown> }[],
    reads: [] as { op: string; request: Record<string, unknown> }[],
    denied: !!options.denied,
    unread: false,
    documentAccepted: false,
    documentUnread: false,
    documentSummaryDenied: false,
    documentContentFailed: false,
    documentContentGate: undefined as Promise<void> | undefined,
    documentText: initialDocumentText,
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
    if (op === "document_requirements_get_v1") {
      expect(r.person_id).toBe(I.self);
      expect(r.center_id).toBe(I.center);
      expect(r.context).toMatchObject({
        gate: "reservation",
        subject: { type: "sessions", id: row.id },
      });
      if (!options.documents) return send([]);
      if (!r.context.product_version_id) return send([]);
      expect(r.context.product_version_id).toBe(right.product_version_id);
      if (!r.content_file_id && state.documentSummaryDenied) return reject();
      if (r.content_file_id && options.documentContentFailure && !state.documentContentFailed) {
        state.documentContentFailed = true;
        return reject("SERVICE_UNAVAILABLE", true);
      }
      if (state.documentUnread) {
        state.documentUnread = false;
        return reject("SERVICE_UNAVAILABLE", true);
      }
      const doc: DocumentView = {
        id: id(20),
        version_id: id(21),
        file: { type: "files", id: id(22) },
        name: "Ders koşulları",
        required_at: "reservation",
        accepted: state.documentAccepted,
        content_kind: "digital",
        content_hash: r.content_file_id ? "rendered-hash" : "source-hash",
      };
      if (r.content_file_id) {
        expect(r.content_file_id).toBe(id(22));
        await state.documentContentGate;
        doc.rendered_document = {
          id: id(23),
          language: "tr",
          source_version: id(21),
          content_hash: "rendered-hash",
          source_content_hash: "source-hash",
          created_at: "2026-11-16T12:00:00Z",
          content: {
            name: "Ders koşulları",
            language: "tr",
            template_id: "document.synthetic",
            template_version: "1",
            text: state.documentText,
          },
        };
        if (state.documentAccepted)
          doc.digital_acceptance = {
            id: id(25),
            account_id: I.account,
            person_id: I.self,
            accepted_at: "2026-11-16T12:01:00Z",
            content_hash: "rendered-hash",
            source_content_hash: "source-hash",
            displayed_content: doc.rendered_document.content,
            rendered_document_id: id(23),
            evidence_kind: "server_document",
          };
      }
      return send([doc]);
    }
    if (op === "document_accept_v1") {
      expect(r.context).toEqual({
        gate: "reservation",
        subject: { type: "sessions", id: row.id },
        product_version_id: right.product_version_id,
      });
      expect(r.rendered_document_id).toBe(id(23));
      expect(r).not.toHaveProperty("displayed_content");
      expect(r).not.toHaveProperty("document_version_id");
      state.writes.push({ op, request: r });
      state.documentAccepted = true;
      state.documentUnread = !!options.documentAckUnread;
      receipts.set(r.operation_key, { op, type: "document_acceptances", id: id(25) });
      if (options.documentUnknown) return route.abort("failed");
      return send({ operation_id: id(26), primary_id: id(25), replayed: false, related: [] });
    }
    if (op === "calendar_get_v1") {
      expect(r.member_discovery).toBe(true);
      expect(r.center_id).toBe(I.center);
      expect(r).not.toHaveProperty("resource");
      if (state.denied) return reject();
      if (options.stale && r.interval.starts_at === row.starts_at) row.member_lesson.version = 8;
      sync();
      const inRange =
        Date.parse(row.starts_at) < Date.parse(r.interval.ends_at) &&
        Date.parse(row.ends_at) > Date.parse(r.interval.starts_at);
      return send({
        items: inRange ? [row] : [],
        next_cursor: null,
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (op === "entitlements_get_v1") {
      expect(r.person_id).toBe(I.self);
      return send(r.booking_mode && r.booking_mode !== right.booking_mode ? [] : [right]);
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
      const sourceSale = state.unread ? id(99) : right.sale_id;
      state.unread = false;
      return send({
        items: state.reservation
          ? [
              {
                ...state.reservation,
                ...(r.include_source_summary
                  ? {
                      source_summary: {
                        status: "available",
                        as_of: "2026-11-16T12:00:00Z",
                        source_sale_id: sourceSale,
                        product_version_id: right.product_version_id,
                        product_name: "Sentetik ders paketi",
                        kind: "credits",
                        booking_mode: right.booking_mode,
                        sale_state: "active",
                        state: "active",
                        start_date: right.start_date,
                        end_date: right.end_date,
                        timezone: right.timezone,
                        available_credits: String(right.available),
                        reserved: String(right.reserved),
                        consumed: "0",
                        sale_version: 2,
                      },
                    }
                  : {}),
              },
            ]
          : [],
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
        if (options.documents) expect(state.documentAccepted).toBe(true);
        expect(r.person_id).toBe(I.self);
        expect(r.source_sale_id).toBe(right.sale_id);
        if (options.bookingRejection) return reject(options.bookingRejection);
        state.reservation = {
          id: primary,
          session_id: row.id,
          person_id: I.self,
          state: "active",
          mode: r.mode,
          version: 2,
        };
        right.available--;
        right.reserved++;
        row.capacity.held++;
        row.capacity.remaining--;
        state.unread = !!options.ackUnread;
      }
      if (op === "reservation_cancel_v1") {
        expect(r.expected_version).toBe(2);
        state.reservation = { ...state.reservation!, state: "cancelled", version: 3 };
        right.available++;
        right.reserved--;
        row.capacity.held--;
        row.capacity.remaining++;
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
  await activate(page.getByRole("button", { name: "Kayıt ol", exact: true }));
  const d = page.getByRole("dialog");
  await activate(d.getByRole("radio").first(), "Space");
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Kaydı onayla", exact: true }));
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
  await activate(page.getByRole("button", { name: "Sonraki hafta", exact: true }));
  await expect.poll(() => state.reads.filter((row) => row.op === "calendar_get_v1").length).toBe(2);
});
test("member navigation keeps the header, navigation and organization controls on the same document", async ({
  page,
}) => {
  await fixture(page);
  const header = await page.locator("header").first().elementHandle();
  const navigation = page.getByRole("navigation");
  const navNode = await navigation.elementHandle();
  const scope = page.getByRole("combobox", { name: common.memberReservations.chooseOrg });
  const scopeNode = await scope.elementHandle();
  const assertPanel = async () => {
    expect(
      await header.evaluate((node) => node === node.ownerDocument.querySelector("header")),
    ).toBe(true);
    expect(await navNode.evaluate((node) => node === node.ownerDocument.querySelector("nav"))).toBe(
      true,
    );
    expect(await scopeNode.evaluate((node) => node.isConnected)).toBe(true);
  };

  await activate(
    navigation.getByRole("link", {
      name: common.memberReservations.links.entitlements,
      exact: true,
    }),
  );
  await expect(
    navigation.getByRole("link", {
      name: common.memberReservations.links.entitlements,
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await assertPanel();

  await page.goBack();
  await expect(navigation.getByRole("link", { name: "Dersler", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await assertPanel();
});
test("member classes use the saved Sunday week and move the same native session after reread", async ({
  page,
}) => {
  const state = await fixture(page, { weekStart: "sunday" });
  const days = page.getByRole("radiogroup", { name: "Gün seç", exact: true });
  await expect(days.getByRole("radio").first()).toHaveAccessibleName("15 Kasım 2026 Pazar");
  await expect(page.getByRole("button", { name: "Kayıt ol", exact: true })).toHaveCount(1);
  const original = page.locator(`#member-class-${state.row.id}`);
  await expect(original).toBeVisible();
  const [first] = state.reads.filter((row) => row.op === "calendar_get_v1");
  expect(first?.request.interval).toEqual({
    starts_at: "2026-11-14T21:00:00Z",
    ends_at: "2026-11-21T21:00:00Z",
  });
  state.row.starts_at = "2026-11-17T16:00:00Z";
  state.row.ends_at = "2026-11-17T17:00:00Z";
  state.row.member_lesson.version += 1;
  state.row.member_lesson.room_labels = ["Yeni salon"];
  await activate(page.getByRole("button", { name: "Listeyi yenile", exact: true }));
  await expect(original).toHaveCount(0);
  await activate(days.getByRole("radio", { name: "17 Kasım 2026 Salı", exact: true }));
  await expect(original).toHaveCount(1);
  const card = page.getByRole("listitem").filter({ hasText: state.row.title });
  await expect(card.getByText("19:00", { exact: true })).toBeVisible();
  await expect(card.getByText(/Yeni salon/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Kayıt ol", exact: true })).toHaveCount(1);
  expect(state.writes).toHaveLength(0);
});
test("member booking requires an explicit right and review, then rereads native reservation and rights", async ({
  page,
}) => {
  const state = await fixture(page);
  await activate(page.getByRole("button", { name: "Kayıt ol", exact: true }));
  const d = page.getByRole("dialog");
  await activate(d.getByRole("button", { name: "Kaydı onayla", exact: true }));
  await expect(d.getByRole("alert")).toBeFocused();
  expect(state.writes).toHaveLength(0);
  await activate(d.getByRole("radio").first(), "Space");
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Kaydı onayla", exact: true }));
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.op).toBe("reservation_create_v1");
  await expect(d.getByRole("button", { name: "Kaydı onayla", exact: true })).toBeDisabled();
  await activate(d.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(
    page.getByText("Kayıtlısın", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});
test("closing an unsubmitted booking leaves the warm weekly class list alone", async ({ page }) => {
  const state = await fixture(page);
  await activate(page.getByRole("button", { name: "Kayıt ol", exact: true }));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio").first()).toBeVisible();
  const calendarReads = () => state.reads.filter(({ op }) => op === "calendar_get_v1").length;
  const readsBeforeClose = calendarReads();
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kayıt ol", exact: true })).toBeVisible();
  expect(calendarReads()).toBe(readsBeforeClose);
  expect(state.writes).toHaveLength(0);
});
test("member unknown booking recovers from the same receipt and never repeats the write", async ({
  page,
}) => {
  const state = await fixture(page, { unknown: true });
  await book(page);
  await activate(page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("member acknowledged booking with a different package link retries only the result read", async ({
  page,
}) => {
  const state = await fixture(page, { ackUnread: true });
  await book(page);
  await expect(
    page.getByText("İşlem kaydedildi, güncel sonuç henüz okunamadı. Yalnız sonucu yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await activate(page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
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
for (const [bookingRejection, message] of [
  ["ENTITLEMENT_UNAVAILABLE", "Hak veya kredi koşulu bu işleme izin vermiyor."],
  ["DOCUMENT_REQUIRED", "Gerekli belge koşulu karşılanmıyor."],
  ["DEBT_BOOKING_BLOCKED", "Ödenmemiş borç nedeniyle rezervasyon yapılamıyor."],
] as const)
  test(`member booking shows ${bookingRejection} without allocating a right or seat`, async ({
    page,
  }) => {
    const state = await fixture(page, { bookingRejection });
    const right = { ...state.right };
    const capacity = { ...state.row.capacity };
    const panel = await book(page);
    const error = panel.getByRole("alert").filter({ hasText: message });
    await expect(error).toBeFocused();
    await expect(panel.getByText(saved, { exact: true })).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.reservation).toBeUndefined();
    expect(state.right).toEqual(right);
    expect(state.row.capacity).toEqual(capacity);
  });
test("member category-full waitlist uses its native category, then supports explicit leave", async ({
  page,
}) => {
  const state = await fixture(page, { category: true });
  await activate(page.getByRole("button", { name: "Kayıt ol", exact: true }));
  let d = page.getByRole("dialog");
  await d.getByLabel("Rezervasyon kategorisi", { exact: true }).selectOption("male");
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Sıraya gir", exact: true }));
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    op: "waitlist_join_v1",
    request: { booking_category: "male" },
  });
  await activate(d.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("button", { name: "Sıradan çık", exact: true }));
  d = page.getByRole("dialog");
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Sıradan çık", exact: true }));
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.entry!.state).toBe("left");
});
for (const accept of [true, false])
  test(`member seat offer ${accept ? "acceptance" : "rejection"} uses the real offer identity and version`, async ({
    page,
  }) => {
    const state = await fixture(page, { full: true, offer: true });
    await activate(page.getByRole("button", { name: "Teklifi gör", exact: true }));
    const d = page.getByRole("dialog");
    await expect(d.getByText(/Teklifin son geçerlilik zamanı/)).toBeVisible();
    await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
    await activate(
      d.getByRole("button", { name: accept ? "Teklifi kabul et" : "Teklifi reddet", exact: true }),
    );
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
  const remaining = state.row.capacity.remaining;
  let d = await book(page);
  await expect(page.getByText(saved, { exact: true })).toBeVisible();
  expect(state.row.capacity.remaining).toBe(remaining - 1);
  await activate(d.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("button", { name: "İptal et", exact: true }));
  const a = page.getByRole("alertdialog");
  await a.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await activate(a.getByRole("button", { name: "İptal et", exact: true }));
  await expect(
    page.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.reservation!.state).toBe("cancelled");
  expect(state.row.capacity.remaining).toBe(remaining);
});
test("member discovery denial stays unknown until explicit retry", async ({ page }) => {
  const state = await fixture(page, { denied: true });
  await expect(
    page.getByText("Güncel ders kaynağı okunamadı. Yeniden dene.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bu gün ders yok.", { exact: true })).toHaveCount(0);
  state.denied = false;
  await activate(page.getByRole("button", { name: "Listeyi yenile", exact: true }));
  await expect(page.getByText("Öğrenciye açık tango", { exact: true })).toBeVisible();
});

const documentReview = "Belgeyi okudum, bu işlem için kabul ediyorum.";
async function openDocument(page: Page, options: Parameters<typeof fixture>[1] = {}) {
  const state = await fixture(page, { documents: true, ...options });
  await activate(page.getByRole("button", { name: "Kayıt ol", exact: true }));
  const d = page.getByRole("dialog");
  await activate(d.getByRole("radio").first(), "Space");
  await activate(d.getByRole("button", { name: "Ders koşulları belgesini oku", exact: true }));
  return { state, d };
}
test("member document acceptance reads stored text and requires a new booking review without auto booking", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { state, d } = await openDocument(page);
  await expect(
    d.getByText("Sentetik belge metni <script>window.documentExecuted=true</script>", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(globalThis, "documentExecuted"))).toBe(false);
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Kaydı onayla", exact: true }));
  expect(state.writes).toHaveLength(0);
  await activate(d.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  await expect(d.getByRole("checkbox", { name: documentReview, exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await activate(d.getByRole("checkbox", { name: documentReview, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  await expect(d.getByText("Kabul edildi", { exact: true })).toBeVisible();
  await expect(d.getByRole("checkbox", { name: review, exact: true })).not.toBeChecked();
  expect(state.writes.map((r) => r.op)).toEqual(["document_accept_v1"]);
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Kaydı onayla", exact: true }));
  await expect.poll(() => state.reservation?.state).toBe("active");
  expect(state.writes.map((r) => r.op)).toEqual(["document_accept_v1", "reservation_create_v1"]);
});
test("member unknown document acceptance locks context and recovers the native receipt with one write", async ({
  page,
}) => {
  const { state, d } = await openDocument(page, { documentUnknown: true });
  await activate(d.getByRole("checkbox", { name: documentReview, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  await expect(
    d.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  await expect(d.getByLabel("Kayıt türü", { exact: true })).toBeDisabled();
  await expect(d.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await expect(d.getByRole("button", { name: "Kaydı onayla", exact: true })).toBeDisabled();
  await activate(d.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(d.getByText("Kabul edildi", { exact: true })).toBeVisible();
  expect(state.writes.map((r) => r.op)).toEqual(["document_accept_v1"]);
});
test("member acknowledged document acceptance rereads only its result", async ({ page }) => {
  const { state, d } = await openDocument(page, { documentAckUnread: true });
  await activate(d.getByRole("checkbox", { name: documentReview, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  await expect(
    d.getByText("İşlem kaydedildi, güncel sonuç henüz okunamadı. Yalnız sonucu yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await activate(d.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(d.getByText("Kabul edildi", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.reads.filter((r) => r.op === "operation_status_get_v1")).toHaveLength(0);
});
test("a denied requirements refresh hides the document but preserves acceptance recovery", async ({
  page,
}) => {
  const { state, d } = await openDocument(page);
  const body = d.getByText(initialDocumentText, { exact: true });
  await expect(body).toBeVisible();
  state.documentSummaryDenied = true;
  await activate(d.getByRole("checkbox", { name: documentReview, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  const retry = d.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true });
  await expect(retry).toBeVisible();
  await expect(body).toHaveCount(0);
  await expect(d.getByRole("button", { name: "Belgeyi kabul et", exact: true })).toHaveCount(0);
  state.documentSummaryDenied = false;
  await activate(retry);
  await expect(d.getByText("Kabul edildi", { exact: true })).toBeVisible();
  expect(state.writes.map(({ op }) => op)).toEqual(["document_accept_v1"]);
});
test("member document content failure exposes explicit retry and never offers acceptance of stale content", async ({
  page,
}) => {
  const { state, d } = await openDocument(page, { documentContentFailure: true });
  await expect(
    d.getByText("Belge okunamadı. Güncel içeriği yeniden yükle.", { exact: true }),
  ).toBeVisible();
  await expect(d.getByRole("button", { name: "Belgeyi kabul et", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await activate(d.getByRole("button", { name: "Belgeleri yeniden yükle", exact: true }));
  await expect(d.getByRole("button", { name: "Belgeyi kabul et", exact: true })).toBeVisible();
});

test("reopening a member document waits for a fresh body before offering acceptance", async ({
  page,
}) => {
  const { state, d } = await openDocument(page);
  const original = d.getByText(initialDocumentText, { exact: true });
  const acceptDocument = d.getByRole("button", { name: "Belgeyi kabul et", exact: true });
  const reviewDocument = d.getByRole("checkbox", { name: documentReview, exact: true });
  const contentReads = () =>
    state.reads.filter(
      ({ op, request }) => op === "document_requirements_get_v1" && request.content_file_id,
    ).length;
  await expect(original).toBeVisible();
  await activate(reviewDocument, "Space");
  await activate(d.getByRole("button", { name: "Belgeyi kapat", exact: true }));
  await expect(original).toHaveCount(0);
  const previousReads = contentReads();
  state.documentText = "Yeniden açılan belge için güncel sentetik metin.";
  let release!: () => void;
  state.documentContentGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await activate(d.getByRole("button", { name: "Ders koşulları belgesini oku", exact: true }));
    await expect.poll(contentReads).toBeGreaterThan(previousReads);
    await expect(d.getByText("Belgeler yükleniyor…", { exact: true })).toBeVisible();
    await expect(original).toHaveCount(0);
    await expect(acceptDocument).toHaveCount(0);
    await expect(reviewDocument).toHaveCount(0);
  } finally {
    release();
  }
  await expect(d.getByText(state.documentText, { exact: true })).toBeVisible();
  await expect(acceptDocument).toBeEnabled();
  await expect(reviewDocument).not.toBeChecked();
  expect(state.writes).toHaveLength(0);
});

test("member offer exposes actual flexible-right document contexts without changing the native offer payload", async ({
  page,
}) => {
  const state = await fixture(page, { offer: true, full: true, documents: true });
  await activate(page.getByRole("button", { name: "Teklifi gör", exact: true }));
  const d = page.getByRole("dialog");
  await activate(d.getByRole("radio").first(), "Space");
  await activate(d.getByRole("button", { name: "Ders koşulları belgesini oku", exact: true }));
  await activate(d.getByRole("checkbox", { name: documentReview, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  await expect(d.getByText("Kabul edildi", { exact: true })).toBeVisible();
  await activate(d.getByRole("checkbox", { name: review, exact: true }), "Space");
  await activate(d.getByRole("button", { name: "Teklifi kabul et", exact: true }));
  await expect.poll(() => state.entry?.state).toBe("converted");
  const write = state.writes.find((r) => r.op === "seat_offer_accept_v1")!;
  expect(write.request).not.toHaveProperty("source_sale_id");
  expect(write.request).not.toHaveProperty("product_version_id");
  expect(state.writes.map((r) => r.op)).toEqual(["document_accept_v1", "seat_offer_accept_v1"]);
});
