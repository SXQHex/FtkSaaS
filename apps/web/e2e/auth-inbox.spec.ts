import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { mockOwnPrivateLessons } from "./member-private-lessons-fixture.js";
const secondId = "019ab7b0-0000-7000-8000-000000000202";
const sourceId = "019ab7b0-0000-7000-8000-000000000203";
const sourceCenter = "019ab7b0-0000-7000-8000-000000000204";
const id = "019ab7b0-0000-7000-8000-000000000201";
const changeTitle = "Ders değişikliği";
const changeBody = "Yeni işlem bildiriminizi uygulamadan görüntüleyebilirsiniz:";
async function fixture(
  page: Page,
  mode:
    | "normal"
    | "unknown"
    | "unread"
    | "denied"
    | "stale"
    | "batch"
    | "source"
    | "member-offer"
    | "member-request"
    | "participant" = "normal",
  options: { crossCenter?: boolean; allUnreadUnknown?: boolean; secondRead?: boolean } = {},
) {
  const participantCenter = options.crossCenter ? sourceCenter : I.center;
  const privateLessons = mode === "member-request" ? await mockOwnPrivateLessons(page) : undefined;
  const participant =
    mode === "participant" || mode === "member-offer"
      ? await mockOwnReservations(
          page,
          mode === "participant" && options.crossCenter
            ? { secondSessionCenter: participantCenter }
            : {},
        )
      : undefined;
  const member = Boolean(participant || privateLessons);
  if (!member) await mockStudio(page);
  const offerId = sourceId;
  const requestId = privateLessons?.requests[1]?.id;
  const memberTitle =
    mode === "participant" ? changeTitle : requestId ? "Özel ders yanıtı" : "Yeni yer teklifi";
  const state = {
    read: false,
    version: 7,
    writes: [] as Record<string, unknown>[],
    lists: [] as Record<string, unknown>[],
    effects: 0,
    failResult: false,
    denied: mode === "denied",
    advanced: false,
    secondRead: options.secondRead ?? false,
    secondVersion: 9,
    visibility: "inbox",
    secondVisibility: "inbox",
    keys: new Set<string>(),
    sourceReads: [] as Record<string, unknown>[],
    sourceDenied: false,
    participantTargetUnavailable: false,
    foreignOffer: false,
    participant,
    privateLessons,
  };
  const row = () => ({
    id,
    kind: mode === "participant" ? "session_changed_for_participant" : "private_native_kind",
    version: state.version,
    work:
      mode === "source"
        ? {
            state: "pending",
            center_id: sourceCenter,
            selector: {
              operation: "crm_activity_save_v1",
              key: { activity_id: sourceId, person_id: I.self },
            },
          }
        : mode === "member-offer"
          ? {
              state: "pending",
              center_id: I.center,
              selector: { operation: "seat_offer_accept_v1", key: { offer_id: offerId } },
            }
          : requestId
            ? {
                state: "pending",
                center_id: I.center,
                selector: {
                  operation: "lesson_request_create_v1",
                  key: { lesson_request_id: requestId },
                },
              }
            : {
                state: "informational",
                center_id: null,
                selector: null,
                ...(mode === "participant" && !state.participantTargetUnavailable
                  ? {
                      reservation_target: {
                        operation: "reservation_list_v1",
                        center_id: participantCenter,
                        key: { session_id: participant!.reservations[1]!.session_id },
                      },
                    }
                  : {}),
              },
    payload:
      mode === "participant"
        ? {
            template_key: "session_changed_for_participant",
            subject: { type: "sessions", id: participant!.reservations[1]!.session_id },
            title: changeTitle,
            body: changeBody,
            language: "tr",
          }
        : {
            template_key: "private_native_template",
            subject:
              mode === "member-offer"
                ? { type: "seat_offers", id: offerId }
                : requestId
                  ? { type: "lesson_requests", id: requestId }
                  : { type: "notifications", id },
            title: member ? memberTitle : "Örnek bildirim",
            body: '<img src=x onerror="alert(1)"> Gönderim durumu güncellendi.',
            language: "tr",
          },
    created_at: "2026-11-16T12:00:00Z",
    read_at: state.read ? "2026-11-16T12:05:00Z" : null,
    email_job:
      mode === "participant"
        ? null
        : {
            id: I.role,
            state: "succeeded",
            progress_count: 1,
            total_count: 1,
            result_reference: null,
            safe_error_code: null,
            email_delivery: { state: "delayed", occurred_at: "2026-11-16T12:02:00Z" },
          },
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string, retryable = false) =>
      route.fulfill({
        status: retryable ? 503 : 403,
        json: { ok: false, error: { code, retryable, trace_id: I.role } },
      });
    if (op === "notifications_list_v1") {
      expect(r.org_id).toBe(I.org);
      expect(r).not.toHaveProperty("person_id");
      state.lists.push(r);
      if (state.denied) return reject("FORBIDDEN");
      return send({
        items: (r.work_state === "pending" && mode !== "source"
          ? []
          : [
              { ...row(), ...(r.visibility ? { visibility: state.visibility } : {}) },
              ...(mode === "batch"
                ? [
                    {
                      ...row(),
                      id: secondId,
                      payload: { ...row().payload, title: "İkinci bildirim" },
                      version: state.secondVersion,
                      read_at: state.secondRead ? "2026-11-16T12:05:00Z" : null,
                      ...(r.visibility ? { visibility: state.secondVisibility } : {}),
                    },
                  ]
                : []),
            ]
        ).filter(
          (n) =>
            (n.id === secondId ? state.secondVisibility : state.visibility) ===
              (r.visibility ?? "inbox") &&
            (!r.unread_only || !n.read_at) &&
            (!r.query || n.payload.title.toLowerCase().includes(r.query.toLowerCase())),
        ),
        summary: member
          ? {
              total: options.allUnreadUnknown ? 2 : 1,
              unread: Number(!state.read) + Number(!!options.allUnreadUnknown && !state.secondRead),
              pending: 0,
              completed: 0,
              informational: options.allUnreadUnknown ? 2 : 1,
              unavailable: 0,
            }
          : {
              total: 90,
              unread: 20,
              pending: 10,
              completed: 30,
              informational: 40,
              unavailable: 10,
            },
        next_cursor: null,
        as_of: "2026-11-16T12:05:00Z",
      });
    }
    if (
      op === "management_state_get_v1" &&
      (r.operation === "seat_offer_accept_v1" ||
        (r.operation === "waitlist_join_v1" && r.entity?.type === "seat_offers")) &&
      mode === "member-offer"
    ) {
      state.sourceReads.push(r);
      if (state.sourceDenied) return reject("FORBIDDEN");
      if (r.operation === "seat_offer_accept_v1")
        expect(r.selector.key).toEqual({ offer_id: offerId });
      else {
        expect(r.entity).toEqual({ type: "seat_offers", id: offerId });
        expect(r.selector.key).toEqual({ directory: "self", view: "offers", status: "all" });
      }
      expect(r.center_id).toBe(I.center);
      const person = state.foreignOffer ? I.role : I.self;
      const sessionId = participant!.reservations[1]!.session_id;
      return send({
        next_cursor: null,
        as_of: "2026-11-16T12:05:00Z",
        items: [
          {
            operation: r.operation,
            exists: true,
            entity: { type: "seat_offers", id: offerId },
            versions: [
              { entity: { type: "seat_offers", id: offerId }, version: 2 },
              { entity: { type: "waitlist_entries", id: secondId }, version: 2 },
            ],
            waitlist_session: {
              id: sessionId,
              title: "Teklifin gerçek seansı",
              state: "planned",
              version: 3,
              timezone: "Europe/Istanbul",
              interval: { starts_at: "2026-11-18T15:00:00Z", ends_at: "2026-11-18T16:00:00Z" },
            },
            waitlist_detail: {
              id: secondId,
              center_id: I.center,
              session_id: sessionId,
              person_id: person,
              state: "offered",
              version: 2,
              offers: [
                {
                  id: offerId,
                  state: "active",
                  version: 2,
                  entry_id: secondId,
                  person_id: person,
                  session_id: sessionId,
                  expires_at: "2026-11-17T12:00:00Z",
                },
              ],
            },
          },
        ],
      });
    }
    if (op === "management_state_get_v1" && r.operation === "crm_activity_save_v1") {
      state.sourceReads.push(r);
      if (state.sourceDenied) return reject("FORBIDDEN");
      expect(r.center_id).toBe(sourceCenter);
      expect(r.selector).toEqual({
        operation: "crm_activity_save_v1",
        key: { activity_id: sourceId, person_id: I.self },
      });
      return send({
        items: [
          {
            operation: r.operation,
            exists: true,
            entity: { type: "crm_activities", id: sourceId },
            state: "completed",
            versions: [{ entity: { type: "crm_activities", id: sourceId }, version: 11 }],
            current: {
              operation: r.operation,
              values: {
                activity_id: sourceId,
                person_id: I.self,
                kind: "followup",
                note: "<img> kaynak metni",
                due_at: null,
              },
            },
          },
        ],
        next_cursor: null,
        as_of: "2026-11-16T12:05:00Z",
      });
    }
    if (
      op === "management_state_get_v1" &&
      ["notification_mark_read_v1", "notifications_read_set_v1"].includes(r.operation)
    ) {
      if (state.failResult) {
        state.failResult = false;
        return reject("SERVICE_UNAVAILABLE", true);
      }
      if (mode === "stale" && !state.advanced && state.lists.length) {
        state.advanced = true;
      } else if (mode === "stale" && state.advanced && !state.writes.length) state.version = 8;
      return send({
        items: (r.operation === "notification_mark_read_v1"
          ? [id]
          : r.selector.key.notification_ids
        )
          .map((notificationId: string) => ({
            operation: r.operation,
            exists: true,
            entity: { type: "notifications", id: notificationId },
            state: (notificationId === id ? state.read : state.secondRead) ? "read" : "unread",
            versions: [
              {
                entity: { type: "notifications", id: notificationId },
                version: notificationId === id ? state.version : state.secondVersion,
              },
            ],
            current:
              r.operation === "notification_mark_read_v1"
                ? { operation: r.operation, values: { notification_id: notificationId } }
                : null,
          }))
          .reverse(),
        next_cursor: null,
        as_of: "2026-11-16T12:05:00Z",
      });
    }
    if (op === "notifications_read_set_v1") {
      state.writes.push(r);
      if (r.all_unread) {
        expect(r).not.toHaveProperty("center_id");
        expect(r).not.toHaveProperty("notifications");
        if (!state.keys.has(r.operation_key)) {
          state.keys.add(r.operation_key);
          state.effects++;
          state.read = true;
          state.secondRead = true;
          state.version++;
          if (options.allUnreadUnknown) return route.abort("failed");
        }
        return send({ operation_id: I.role, primary_id: I.self, replayed: true, related: [] });
      }
      if (!state.keys.has(r.operation_key)) {
        for (const selected of r.notifications)
          expect(selected.expected_version).toBe(
            selected.id === id ? state.version : state.secondVersion,
          );
        state.keys.add(r.operation_key);
        state.effects++;
        for (const selected of r.notifications) {
          if (selected.id === id) {
            state.version++;
            if (r.visibility) state.visibility = r.visibility;
            else state.read = r.read;
          } else {
            state.secondVersion++;
            if (r.visibility) state.secondVisibility = r.visibility;
            else state.secondRead = r.read;
          }
        }
        if (mode === "unknown") return route.abort("failed");
        if (mode === "unread") state.failResult = true;
      }
      return send({
        operation_id: I.role,
        primary_id: r.notifications[0].id,
        version: state.version,
        replayed: false,
        related: [],
      });
    }
    if (op === "operation_status_get_v1" && r.operation === "notifications_read_set_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: options.allUnreadUnknown
          ? { type: "people", id: I.self }
          : { type: "notifications", id },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  if (member) {
    await page.goto(`${origin}/member/reservations?org=${I.org}&center=${I.center}`);
    const bell = page.getByRole("link", { name: "Bildirimler", exact: true });
    await expect(bell).toHaveAccessibleDescription(
      options.allUnreadUnknown ? "2 okunmamış bildirim" : "1 okunmamış bildirim",
    );
    const initialReads = state.lists.length;
    await page.evaluate("document.documentElement.dataset.inboxNavigationProbe='member'");
    await bell.press("Enter");
    await expect(page).toHaveURL(`${origin}/inbox?org=${I.org}&center=${I.center}&view=member`);
    await expect(page.getByRole("button", { name: memberTitle, exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-inbox-navigation-probe", "member");
    expect(state.lists).toHaveLength(initialReads);
  } else {
    await page.goto(`${origin}/inbox?org=${I.org}&center=${I.center}`);
  }
  await expect(
    page.getByRole("heading", {
      name: member ? "Bildirimler" : "Gelen kutusu",
      exact: true,
    }),
  ).toBeVisible();
  return state;
}
test("inbox shows native copy safely, enables native discovery, and restores mobile list focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page);
  await expect(page.getByRole("searchbox", { name: "İletilerde ara", exact: true })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Seçilenleri okundu yap", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Örnek bildirim", exact: true })).toBeFocused();
  await expect(page.locator("aside img")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "İleti ayrıntısı" })).toContainText(
    "Gecikti",
  );
  await expect(page.getByRole("button", { name: "Yanıtla", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Gelen kutusu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Örnek bildirim", exact: true })).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("participant sees a native session change notice and retains its exact read state after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 840 });
  const state = await fixture(page, "participant");
  await expect(page.getByRole("navigation", { name: "Üye menüsü", exact: true })).toBeVisible();
  const bell = page.getByRole("link", { name: "Bildirimler", exact: true });
  await expect(bell).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: changeTitle, exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Okunmamış", exact: true }).click();
  await page.getByRole("button", { name: changeTitle, exact: true }).click();
  await expect(page.getByRole("complementary", { name: "İleti ayrıntısı" })).toContainText(
    changeBody,
  );
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    read: true,
    notifications: [{ expected_version: 7, id }],
  });
  expect(state.lists.some((r) => r.unread_only === true)).toBe(true);
  await expect(page.getByRole("button", { name: "Okunmadı yap", exact: true })).toBeDisabled();
  await expect(bell).toHaveAccessibleDescription("0 okunmamış bildirim");
  await expect(bell.locator("..").locator('[data-slot="badge"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
  await expect(page.getByText("Bu kapsamda görünür ileti yok.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: changeTitle, exact: true }).click();
  await expect(page.getByRole("button", { name: "Okunmadı yap", exact: true })).toBeEnabled();
  expect(state.writes).toHaveLength(1);
  const listsBefore = state.lists.length;
  await page.goto(`${origin}/inbox?org=${I.org}&center=${sourceCenter}&view=member`);
  await expect(page.getByText("Organizasyon ve merkez seç.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: changeTitle, exact: true })).toHaveCount(0);
  expect(state.lists).toHaveLength(listsBefore);
});
test("member all-read covers the entire inbox and recovers the receipt without a second write", async ({
  page,
}) => {
  const state = await fixture(page, "participant", { allUnreadUnknown: true });
  await page.getByRole("radio", { name: "Okunmamış", exact: true }).click();
  await page.getByRole("button", { name: "Tümünü okundu yap", exact: true }).click();
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bu kapsamda görünür ileti yok.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Bildirimler", exact: true }),
  ).toHaveAccessibleDescription("0 okunmamış bildirim");
  expect(state.secondRead).toBe(true);
  expect(state.effects).toBe(1);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ org_id: I.org, read: true, all_unread: true });
});
test("member change notice opens the exact reservation and rechecks access on reload", async ({
  page,
}) => {
  const state = await fixture(page, "participant", { crossCenter: true });
  const participant = state.participant!;
  const sessionId = participant.reservations[1]!.session_id;
  await page.getByRole("button", { name: changeTitle, exact: true }).click();
  const target = page.getByRole("link", { name: "Kaynak işlemine git", exact: true });
  await expect(target).toHaveCount(0);
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  const path = `/member/reservations?org=${I.org}&center=${sourceCenter}&session=${sessionId}`;
  await expect(target).toHaveAttribute("href", path);
  expect(participant.reads).toContainEqual(
    expect.objectContaining({
      operation: "reservation_list_v1",
      request: expect.objectContaining({
        center_id: sourceCenter,
        person_id: I.self,
        session_id: sessionId,
        time_filter: "all",
      }),
    }),
  );
  await target.press("Enter");
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  await expect(page.getByText(/18 Kas 2026/).first()).toBeVisible();
  await expect(page.getByText(/^17 Kas 2026/)).toHaveCount(0);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Tüm rezervasyonlarım", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Bildirimler", exact: true })).toBeVisible();
  participant.setDenied(true);
  await page.goForward();
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(page.getByText("Yaklaşan rezervasyonlar okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Yaklaşan rezervasyonlar okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toHaveCount(0);
  expect(participant.writes).toHaveLength(0);
  expect(state.writes).toHaveLength(0);
  state.participantTargetUnavailable = true;
  // This scenario must discard the cached reservation read before rechecking
  // the native source. Reload the document and wait for DOM readiness; the
  // visible inbox assertions below remain responsible for data readiness.
  await page.goto(`${origin}/inbox?org=${I.org}&center=${I.center}&view=member`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "Bildirimler", exact: true })).toBeVisible();
  const readCount = participant.reads.filter(
    (row) => row.operation === "reservation_list_v1",
  ).length;
  await page.getByRole("button", { name: changeTitle, exact: true }).click();
  await expect(page.getByText("Kaynak şu anda erişilebilir değil.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kaynağı aç", exact: true })).toHaveCount(0);
  expect(participant.reads.filter((row) => row.operation === "reservation_list_v1")).toHaveLength(
    readCount,
  );
});
test("member offer notice opens only the exact offer and rejects a foreign owner on return", async ({
  page,
}) => {
  const state = await fixture(page, "member-offer");
  await page.getByRole("button", { name: "Yeni yer teklifi", exact: true }).click();
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  const target = page.getByRole("link", { name: "Kaynak işlemine git", exact: true });
  const path = `/member/reservations?org=${I.org}&center=${I.center}&offer=${sourceId}`;
  await expect(target).toHaveAttribute("href", path);
  await target.press("Enter");
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(page.getByRole("button", { name: "Teklifi kabul et", exact: true })).toBeEnabled();
  await expect(page.getByText("Teklifin gerçek seansı", { exact: true })).toBeVisible();
  expect(state.sourceReads).toHaveLength(2);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Bildirimler", exact: true })).toBeVisible();
  state.foreignOffer = true;
  await page.getByRole("button", { name: "Yeni yer teklifi", exact: true }).click();
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  await expect(page.getByText("Kaynak şu anda erişilebilir değil.", { exact: true })).toBeVisible();
  await expect(target).toHaveCount(0);
  await page.goForward();
  await expect(
    page.getByText("Güncel bekleme listesi ve teklifler okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Teklifi kabul et", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  expect(state.participant!.writes).toHaveLength(0);
});

test("member private lesson response opens only its request and rereads after reload", async ({
  page,
}) => {
  const state = await fixture(page, "member-request");
  const lessons = state.privateLessons!;
  const requestId = lessons.requests[1]!.id;
  await page.getByRole("button", { name: "Özel ders yanıtı", exact: true }).click();
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  const target = page.getByRole("link", { name: "Kaynak işlemine git", exact: true });
  const path = `/member/private-lessons?org=${I.org}&center=${I.center}&request=${requestId}`;
  await expect(target).toHaveAttribute("href", path);
  await target.press("Enter");
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(page.getByText("Özel ders · Örnek Eğitmen", { exact: true })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Alternatifi kabul et", exact: true }),
  ).toBeEnabled();
  lessons.requests[1]!.person_id = I.role;
  await page.reload();
  await expect(
    page.getByText("Güncel özel ders talepleri okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Alternatifi kabul et", exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toHaveLength(0);
  expect(lessons.writes).toHaveLength(0);
});

test("inbox unknown write recovers its exact receipt and never marks twice", async ({ page }) => {
  const state = await fixture(page, "unknown");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(page.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  const all = page.getByRole("radio", { name: "Tümü", exact: true, includeHidden: true });
  await expect(all).toBeDisabled();
  if (await all.isVisible()) {
    await expect(page.getByRole("radio", { name: "Tümü", exact: true })).toBeDisabled();
  } else {
    await expect(all).toBeHidden();
  }
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toBe(1);
});
test("inbox acknowledged result failure retries only the original result read", async ({
  page,
}) => {
  const state = await fixture(page, "unread");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(page.getByText(/güncel sonuç henüz okunamadı/)).toBeVisible();
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("inbox source denial remains unknown and recovers only on explicit retry", async ({
  page,
}) => {
  const state = await fixture(page, "denied");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Bildirim kaynağı okunamadı. Güncel yetkili kaynağı yeniden oku." }),
  ).toBeVisible();
  await expect(page.getByText("Bu kapsamda görünür ileti yok.", { exact: true })).toHaveCount(0);
  state.denied = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Örnek bildirim", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("inbox changed native version is reread before any new writer", async ({ page }) => {
  const state = await fixture(page, "stale");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okundu yap", exact: true }).click();
  await expect(page.getByText(/Önizleme veya kaynak değişti/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("inbox global entry resolves its native workspace before enabling the scoped content", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`${origin}/inbox`);
  await expect(page).toHaveURL(`${origin}/inbox?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("button", { name: "Örnek bildirim", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("inbox explicit selection uses atomic batch and reverse read remains a separate reviewed command", async ({
  page,
}) => {
  const state = await fixture(page, "batch");
  await page.getByRole("checkbox", { name: "Seç: Örnek bildirim", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("checkbox", { name: "Seç: İkinci bildirim", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Seçilenleri okundu yap/ }).click();
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    read: true,
    notifications: [
      { id, expected_version: 7 },
      { id: secondId, expected_version: 9 },
    ],
  });
  await expect(
    page.getByRole("checkbox", { name: "Seç: Örnek bildirim", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Okunmadı yap", exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[1]).toMatchObject({
    read: false,
    notifications: [{ id, expected_version: 8 }],
  });
  expect(state.writes[1]!.operation_key).not.toBe(state.writes[0]!.operation_key);
  expect(state.effects).toBe(2);
});
test("inbox archives, deletes with confirmation, and restores the exact selected notification", async ({
  page,
}) => {
  const state = await fixture(page, "batch");
  const message = page.getByRole("button", { name: "Örnek bildirim", exact: true });
  const select = page.getByRole("checkbox", { name: "Seç: Örnek bildirim", exact: true });
  const saved = page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true });

  await select.press("Space");
  await page.getByRole("button", { name: "Seçilenleri arşivle", exact: true }).click();
  await expect(saved).toBeVisible();
  await expect(message).toHaveCount(0);
  expect(state.writes[0]).toMatchObject({
    visibility: "archived",
    notifications: [{ id, expected_version: 7 }],
  });
  expect(state.writes[0]).not.toHaveProperty("read");
  await page.getByRole("radio", { name: "Arşiv", exact: true }).click();
  await expect(message).toBeVisible();
  await select.press("Space");
  await page.getByRole("button", { name: "Seçilenleri sil", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  const cancel = dialog.getByRole("button", { name: "Vazgeç", exact: true });
  await expect(cancel).toBeFocused();
  await cancel.click();
  expect(state.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Seçilenleri sil", exact: true }).click();
  await dialog.getByRole("button", { name: "Silinenler’e taşı", exact: true }).click();
  await expect(saved).toBeVisible();
  await expect(message).toHaveCount(0);
  await page.getByRole("radio", { name: "Silinenler", exact: true }).click();
  await expect(message).toBeVisible();
  await page.getByRole("button", { name: "Taşımayı geri al", exact: true }).click();
  await expect(message).toHaveCount(0);
  await page.getByRole("radio", { name: "Arşiv", exact: true }).click();
  await expect(message).toBeVisible();
  expect(state.writes[2]).toMatchObject({
    visibility: "archived",
    notifications: [{ id, expected_version: 9 }],
  });
  await select.press("Space");
  await page.getByRole("button", { name: "Gelen kutusuna taşı", exact: true }).click();
  await expect(message).toHaveCount(0);
  await page.getByRole("radio", { name: "Silinenler", exact: true }).click();
  await expect(message).toHaveCount(0);
  await page.getByRole("radio", { name: "Okunmamış", exact: true }).click();
  await expect(message).toBeVisible();
  expect(state.read).toBe(false);
  expect(state.secondVisibility).toBe("inbox");
  expect(state.writes.map((write) => write.visibility)).toEqual([
    "archived",
    "deleted",
    "archived",
    "inbox",
  ]);
});
test("inbox bulk selection undoes only changed read states using confirmed versions", async ({
  page,
}) => {
  const state = await fixture(page, "batch", { secondRead: true });
  const selectPage = page.getByRole("checkbox", {
    name: "Görünen iletilerin tümünü seç",
    exact: true,
  });
  await expect(
    page.getByRole("checkbox", { name: "Seç: İkinci bildirim", exact: true }),
  ).toBeVisible();
  await expect(selectPage).toBeEnabled();
  await selectPage.press("Space");
  await expect(
    page.getByRole("checkbox", { name: "Seç: İkinci bildirim", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: /Seçilenleri okundu yap/ }).click();
  const undo = page.getByRole("button", { name: "Okuma değişikliğini geri al", exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect.poll(() => state.writes.length).toBe(2);
  await expect(
    page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[1]).toMatchObject({
    read: false,
    notifications: [{ id, expected_version: 8 }],
  });
  expect(state.writes[1]!.operation_key).not.toBe(state.writes[0]!.operation_key);
  expect(state.secondRead).toBe(true);
  await expect(undo).toHaveCount(0);

  await expect(selectPage).toBeEnabled();
  await selectPage.press("Space");
  await page.getByRole("button", { name: "Seçilenleri okunmadı yap", exact: true }).click();
  await expect(undo).toBeEnabled();
  expect(state.writes[2]).toMatchObject({
    read: false,
    notifications: [
      { id, expected_version: 9 },
      { id: secondId, expected_version: 10 },
    ],
  });
  state.secondVersion++;
  await undo.click();
  await expect(undo).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: /değişti/i })).toBeVisible();
  expect(state.writes).toHaveLength(3);
  expect(state.secondRead).toBe(false);
});
test("inbox native search and pending filter reset explicit selection and preserve authoritative summary", async ({
  page,
}) => {
  const state = await fixture(page, "batch");
  await page.getByRole("checkbox", { name: "Seç: Örnek bildirim", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("searchbox", { name: "İletilerde ara", exact: true }).fill("İkinci");
  expect(state.lists.some((r) => r.query === "İkinci")).toBe(false);
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await expect(page.getByRole("button", { name: "İkinci bildirim", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seçilenleri okundu yap/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Tümü", exact: true })).toContainText("90");
  await page.getByRole("radio", { name: "İşlem bekleyen", exact: true }).click();
  await expect.poll(() => state.lists.at(-1)?.work_state).toBe("pending");
  expect(state.lists.at(-1)).toMatchObject({
    query: "İkinci",
    include_work: true,
    include_summary: true,
    page: { limit: 20, sort: "created_at_asc" },
  });
  expect(state.writes).toHaveLength(0);
});
test("inbox reads exact live source in returned center before offering existing flow without writing", async ({
  page,
}) => {
  const state = await fixture(page, "source");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  expect(state.sourceReads).toHaveLength(0);
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  const source = page.getByRole("region", { name: "Kaynak ayrıntısı", exact: true });
  await expect(source).toContainText("Tamamlandı");
  await expect(source).toContainText("<img> kaynak metni");
  await expect(source.locator("img")).toHaveCount(0);
  await expect(
    source.getByRole("link", { name: "Kaynak işlemine git", exact: true }),
  ).toHaveAttribute("href", `/o/${I.org}/c/${sourceCenter}/people/${I.self}`);
  expect(state.sourceReads).toHaveLength(1);
  expect(state.writes).toHaveLength(0);
});

test("inbox hides a previously available source flow when its explicit reread loses permission", async ({
  page,
}) => {
  const state = await fixture(page, "source");
  await page.getByRole("button", { name: "Örnek bildirim", exact: true }).click();
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  await expect(page.getByRole("link", { name: "Kaynak işlemine git", exact: true })).toBeVisible();
  state.sourceDenied = true;
  await page.getByRole("button", { name: "Kaynağı aç", exact: true }).click();
  await expect(page.getByText("Kaynak şu anda erişilebilir değil.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kaynak işlemine git", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
