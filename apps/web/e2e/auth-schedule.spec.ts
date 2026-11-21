import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  CalendarItem,
  MemberLessonDiscovery,
  RequestSessionChangePreview,
  SchedulePreviewItem,
  SessionView,
} from "@ftksaas/api-contracts";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import { event } from "./events-fixture.js";

async function scheduleFixture(
  page: Page,
  withSession = false,
  verifiedInstructor = false,
  managed = false,
  series = false,
  weekStart: "monday" | "sunday" = "monday",
  withEvent = false,
) {
  const fixture = await mockStudio(page);
  fixture.native.weekStart = weekStart;
  if (verifiedInstructor) fixture.roles[0]!.accountAccessGranted = true;
  let session: SessionView | undefined, future: SessionView | undefined;
  if (series) {
    const personId = "019a7b00-0000-7000-8000-000000000096";
    fixture.people.push({
      ...structuredClone(fixture.people[0]!),
      id: personId,
      display_name: "İkinci sentetik eğitmen",
    });
    fixture.roles.push({
      id: "019a7b00-0000-7000-8000-000000000097",
      personId,
      active: true,
      version: 1,
      accountAccessGranted: true,
    });
  }
  const writes: string[] = [];
  const reads: string[] = [];
  const eventReads: Record<string, unknown>[] = [];
  let eventDenied = false;
  const group = {
    active: false,
    version: 1,
    lostReply: false,
    creates: [] as Record<string, unknown>[],
    cancels: [] as Record<string, unknown>[],
    effects: 0,
  };
  const saleId = "019a7b00-0000-7000-8000-000000000086",
    reservationId = "019a7b00-0000-7000-8000-000000000087";
  const groupKeys = new Set<string>();
  const changes: Record<string, unknown>[] = [];
  const previews: RequestSessionChangePreview[] = [];
  let reviewed: { id: string; token: string; sessions: SchedulePreviewItem[] } | undefined;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (withEvent && operation === "event_get_v1") {
      eventReads.push(request);
      if (eventDenied)
        return route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      return send({ ...event, state: "published" });
    }
    if (managed && operation === "session_change_preview_v1") {
      previews.push(request);
      const affected = [
        session!,
        ...(request.scope === "this_and_future" && future ? [future] : []),
      ];
      const delta = request.patch.interval
        ? Date.parse(request.patch.interval.starts_at) - Date.parse(session!.starts_at)
        : 0;
      const duration = request.patch.interval
        ? Date.parse(request.patch.interval.ends_at) - Date.parse(request.patch.interval.starts_at)
        : 3600000;
      reviewed = {
        id: `019a7b00-0000-7000-8000-${String(900 + previews.length).padStart(12, "0")}`,
        token: `synthetic-change-${previews.length}`,
        sessions: affected.map((row) => ({
          session_id: row.id,
          expected_version: row.version,
          interval: {
            starts_at: new Date(Date.parse(row.starts_at) + delta).toISOString(),
            ends_at: new Date(Date.parse(row.starts_at) + delta + duration).toISOString(),
          },
          resources: request.patch.resources ?? [{ kind: "room", id: I.room }],
          assignments: request.patch.assignments ?? row.assignments,
          capacity: request.patch.capacity ?? { total: row.capacity.total },
        })),
      };
      return send({
        ...reviewed,
        scope_hash: "synthetic",
        expires_at: "2099-01-01T00:00:00Z",
        blockers: [],
        effects: [],
        dependencies: {
          versions: affected.map((row) => ({
            entity: { type: "sessions", id: row.id },
            version: row.version,
          })),
          policy_hashes: [],
          permission_hash: "synthetic",
        },
      });
    }
    if (managed && operation === "session_change_apply_v1") {
      changes.push(request);
      expect(request.preview).toEqual({ id: reviewed!.id, token: reviewed!.token });
      for (const item of reviewed!.sessions) {
        const target = [session, future].find((row) => row?.id === item.session_id)!;
        target.version++;
        target.starts_at = item.interval.starts_at;
        target.ends_at = item.interval.ends_at;
        target.assignments = structuredClone(item.assignments);
        target.capacity.total = item.capacity.total;
        target.capacity.remaining = item.capacity.total - target.capacity.held;
      }
      return send({ primary_id: session!.id, changed: [], jobs: [] });
    }
    if (
      managed &&
      operation === "management_state_get_v1" &&
      request.operation === "replacement_session_create_v1"
    ) {
      expect(request.selector.key.replaces_id).toBe(session!.id);
      return send({
        items: [
          {
            operation: "replacement_session_create_v1",
            entity: { type: "sessions", id: "019a7b00-0000-7000-8000-000000000088" },
            exists: true,
            state: "planned",
            versions: [
              {
                entity: { type: "sessions", id: "019a7b00-0000-7000-8000-000000000088" },
                version: 2,
              },
            ],
            current: {
              operation: "replacement_session_create_v1",
              values: {
                replaces_id: session!.id,
                interval: { starts_at: session!.starts_at, ends_at: session!.ends_at },
                resources: [{ kind: "room", id: I.room }],
                capacity: { total: 12 },
              },
            },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "calendar_get_v1") {
      reads.push(operation);
      if (withSession && !session) {
        const start = Date.parse(request.interval.starts_at) + 9 * 60 * 60 * 1000;
        session = {
          id: "019a7b00-0000-7000-8000-000000000085",
          class_id: I.lesson,
          discipline_id: I.discipline,
          format: "group",
          state: "planned",
          attendance_state: "open",
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(start + 3600000).toISOString(),
          assignments: [
            { person_id: I.instructor, duty: "instructor" },
            ...(series ? [{ person_id: I.self, duty: "assistant" as const }] : []),
          ],
          version: 3,
          capacity: {
            total: 12,
            held: 2,
            remaining: 10,
            category_held: null,
            category_remaining: null,
            room_capacity: 20,
          },
        };
      }
      if (series && session && !future)
        future = {
          ...structuredClone(session),
          id: "019a7b00-0000-7000-8000-000000000095",
          starts_at: new Date(Date.parse(session.starts_at) + 86400000).toISOString(),
          ends_at: new Date(Date.parse(session.ends_at) + 86400000).toISOString(),
        };
      return send({
        items: [
          ...(session
            ? [
                {
                  id: session.id,
                  type: "session",
                  center_id: I.center,
                  starts_at: session.starts_at,
                  ends_at: session.ends_at,
                  title: "Sentetik program seansı",
                  resources: [{ kind: "room", id: I.room }],
                },
                ...(future
                  ? [
                      {
                        id: future.id,
                        type: "session",
                        center_id: I.center,
                        starts_at: future.starts_at,
                        ends_at: future.ends_at,
                        title: "İleri program seansı",
                        resources: [{ kind: "room", id: I.room }],
                      },
                    ]
                  : []),
              ]
            : []),
          ...(withEvent
            ? [
                {
                  id: event.id,
                  type: "event",
                  center_id: I.center,
                  title: event.name,
                  starts_at: event.interval.starts_at,
                  ends_at: event.interval.ends_at,
                  resources: [{ kind: "room", id: I.room }],
                },
              ]
            : []),
        ].filter(
          (item) =>
            Date.parse(item.starts_at) < Date.parse(request.interval.ends_at) &&
            Date.parse(item.ends_at) > Date.parse(request.interval.starts_at),
        ),
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "session_get_v1") {
      reads.push(operation);
      return send(request.session_id === future?.id ? future : session);
    }
    if (
      operation === "management_state_get_v1" &&
      request.operation === "reservation_cancel_v1" &&
      request.selector.key.directory === "class"
    ) {
      expect(request.selector.key.class_id).toBe(I.lesson);
      return send({
        items: group.active
          ? [
              {
                operation: "reservation_cancel_v1",
                entity: { type: "people", id: I.self },
                exists: true,
                state: "active",
                versions: [
                  { entity: { type: "reservations", id: reservationId }, version: group.version },
                ],
                current: null,
                group_student: {
                  person_id: I.self,
                  display_name: "Grup öğrencisi",
                  reservations: [
                    {
                      id: reservationId,
                      version: group.version,
                      session_id: session!.id,
                      starts_at: session!.starts_at,
                      ends_at: session!.ends_at,
                      source_sale_id: saleId,
                      state: "active",
                      mode: "priority",
                    },
                  ],
                },
              },
            ]
          : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (managed && operation === "people_list_v1" && request.student_status === "active")
      return send({
        items: [
          {
            id: I.self,
            display_name: "Grup öğrencisi",
            relationships: [{ kind: "student", center_id: I.center, state: "active" }],
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    if (managed && operation === "entitlements_get_v1")
      return send([
        {
          sale_id: saleId,
          person_id: I.self,
          start_date: "2026-01-01",
          end_date: "2027-12-31",
          timezone: "Europe/Istanbul",
          state: "active",
          available: group.active ? 7 : 8,
          reserved: group.active ? 1 : 0,
          consumed: 0,
          deficit: 0,
          quotas: [],
          deficit_scopes: [],
          booking_mode: "priority",
          kind: "credits",
        },
      ]);
    if (managed && operation === "reservation_list_v1")
      return send({
        items: group.effects
          ? [
              {
                id: reservationId,
                person_id: I.self,
                session_id: session!.id,
                version: group.version,
                state: group.active ? "active" : "cancelled",
                mode: "priority",
                ...(request.include_source_summary
                  ? {
                      source_summary: {
                        status: "available",
                        as_of: new Date().toISOString(),
                        source_sale_id: saleId,
                        product_version_id: "019ab7b0-0000-7000-8000-000000000156",
                        product_name: "Sentetik sabit grup paketi",
                        kind: "credits",
                        booking_mode: "priority",
                        sale_state: "active",
                        state: "active",
                        start_date: "2026-01-01",
                        end_date: "2027-12-31",
                        timezone: "Europe/Istanbul",
                        available_credits: group.active ? "7" : "8",
                        reserved: group.active ? "1" : "0",
                        consumed: "0",
                        sale_version: 1,
                      },
                    }
                  : {}),
              },
            ]
          : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    if (managed && operation === "reservation_create_v1") {
      group.creates.push(request);
      expect(request).toMatchObject({
        person_id: I.self,
        session_id: session!.id,
        source_sale_id: saleId,
        mode: "priority",
      });
      if (!groupKeys.has(request.operation_key)) {
        groupKeys.add(request.operation_key);
        group.active = true;
        group.effects++;
        session!.version++;
        session!.capacity.held++;
        session!.capacity.remaining--;
        if (group.lostReply) {
          group.lostReply = false;
          return route.abort();
        }
      }
      return send({ primary_id: reservationId, changed: [], jobs: [] });
    }
    if (
      managed &&
      operation === "operation_status_get_v1" &&
      request.operation === "reservation_create_v1"
    ) {
      expect(request.key).toBe(group.creates[0]!.operation_key);
      return send({
        operation: "reservation_create_v1",
        key: request.key,
        status: "succeeded",
        result_reference: { type: "reservations", id: reservationId },
      });
    }
    if (
      managed &&
      operation === "management_state_get_v1" &&
      request.operation === "reservation_cancel_v1"
    )
      return send({
        items: [
          {
            operation: "reservation_cancel_v1",
            entity: { type: "reservations", id: reservationId },
            exists: true,
            state: group.active ? "active" : "cancelled",
            versions: [
              { entity: { type: "reservations", id: reservationId }, version: group.version },
            ],
            current: {
              operation: "reservation_cancel_v1",
              values: { reservation_id: reservationId },
            },
            as_of: new Date().toISOString(),
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    if (managed && operation === "reservation_cancel_v1") {
      group.cancels.push(request);
      expect(request).toMatchObject({
        reservation_id: reservationId,
        expected_version: group.version,
      });
      expect(request).not.toHaveProperty("person_id");
      group.active = false;
      group.version++;
      session!.version++;
      session!.capacity.held--;
      session!.capacity.remaining++;
      return send({ primary_id: reservationId, changed: [], jobs: [] });
    }
    if (
      operation === "management_state_get_v1" &&
      request.operation === "session_change_preview_v1"
    ) {
      if (managed) {
        const target = request.selector.key.session_id === future?.id ? future! : session!;
        return send({
          items: [
            {
              operation: "session_change_preview_v1",
              entity: { type: "sessions", id: target.id },
              exists: true,
              state: target.state,
              versions: [{ entity: { type: "sessions", id: target.id }, version: target.version }],
              current: {
                operation: "session_change_preview_v1",
                values: {
                  session_id: target.id,
                  scope: "single",
                  patch: {
                    interval: { starts_at: target.starts_at, ends_at: target.ends_at },
                    resources: [{ kind: "room", id: I.room }],
                    capacity: { total: target.capacity.total },
                  },
                },
              },
              as_of: new Date().toISOString(),
            },
          ],
          next_cursor: null,
          as_of: new Date().toISOString(),
        });
      }
      reads.push("editor-policy-rejection");
      return route.fulfill({
        json: {
          ok: false,
          error: { code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: I.role },
        },
      });
    }
    if (
      [
        "session_create_v1",
        "program_apply_v1",
        "session_change_apply_v1",
        "session_cancel_apply_v1",
        "replacement_session_create_v1",
      ].includes(operation)
    ) {
      writes.push(operation);
      return route.abort();
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith("/calendar_get_v1") && response.status() === 200,
    ),
    page.goto(`${origin}/o/${I.org}/c/${I.center}/schedule`),
  ]);
  await expect(page.getByRole("button", { name: "Seans ekle", exact: true })).toBeEnabled();
  await expect.poll(() => reads.includes("calendar_get_v1")).toBe(true);
  return {
    writes,
    reads,
    fixture,
    group,
    changes,
    previews,
    eventReads,
    denyEvent() {
      eventDenied = true;
    },
    get future() {
      return future;
    },
    saleId,
    get session() {
      return session;
    },
  };
}

test("management calendar reads the Sunday week selected in account settings", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-18T12:00:00Z"));
  const intervals: { starts_at: string; ends_at: string }[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/calendar_get_v1"))
      intervals.push(request.postDataJSON().interval);
  });
  const state = await scheduleFixture(page, false, false, false, false, "sunday");
  const days = page.getByRole("region", { name: "Program günleri", exact: true });
  await expect(days.getByText("Paz", { exact: true })).toBeVisible();
  await expect
    .poll(() => intervals.at(-1))
    .toEqual({
      starts_at: "2026-11-14T21:00:00.000Z",
      ends_at: "2026-11-21T21:00:00.000Z",
    });
  expect(state.writes).toEqual([]);
});

test("empty mobile week supports native horizontal scrolling and keyboard vertical scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await scheduleFixture(page);
  const scroll = page.getByRole("region", { name: "Program günleri", exact: true });
  await expect(scroll).toBeVisible();
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
  // Enter from the adjacent ready toolbar. Focusing it can naturally reveal the header.
  await page.getByRole("radio", { name: "Hafta", exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(scroll).toBeFocused();
  const before = await scroll.evaluate((el) => ({
    left: el.scrollLeft,
    top: el.scrollTop,
    outline: el.ownerDocument.defaultView!.getComputedStyle(el).outlineStyle,
  }));
  expect(before.outline).not.toBe("none");
  // Horizontal overflow is native. On mobile WebKit, ArrowRight does not
  // consistently map to horizontal scrolling; use native horizontal wheel
  // input rather than installing an application-specific keyboard handler.
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeGreaterThan(0);
  // Playwright's iPhone/WebKit device does not support mouse.wheel and does
  // not expose a native swipe API. Verify the browser's real scroll container
  // and overflow via its native scrolling API, without synthesizing wheel or
  // trusted touch events. A physical swipe needs a separate device test.
  await scroll.evaluate((element) => {
    element.scrollTo({ left: element.scrollWidth - element.clientWidth, behavior: "instant" });
  });
  await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before.left);
  await scroll.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(before.top);
  expect((await scanAccessibility(page, "empty-mobile-week")).violations).toEqual([]);
  await page.getByRole("radio", { name: "Gün", exact: true }).click();
  await expect
    .poll(() => scroll.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThanOrEqual(1);
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  expect(state.writes).toEqual([]);
});

test("calendar distinguishes an event from a session and opens its live detail by keyboard", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-18T12:00:00Z"));
  const state = await scheduleFixture(page, true, false, false, false, "monday", true);
  const eventCard = page.getByRole("button", { name: /Etkinlik Tango atölyesi/ });
  await expect(eventCard).toContainText("Etkinlik");
  await expect(page.getByText("Sentetik program seansı", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Gün", exact: true }).click();
  await expect(eventCard).toHaveCount(0);
  await page.getByRole("button", { name: "Sonraki dönem", exact: true }).click();
  await page.getByRole("button", { name: "Sonraki dönem", exact: true }).click();
  await expect(eventCard).toBeVisible();
  await expect(page.getByText("Sentetik program seansı", { exact: true })).toHaveCount(0);
  await eventCard.press("Enter");
  const url = `${origin}/o/${I.org}/c/${I.center}/events/${event.id}`;
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { name: event.name, exact: true })).toBeVisible();
  expect(state.eventReads).toHaveLength(1);
  expect(state.eventReads[0]).toMatchObject({
    event_id: event.id,
    center_id: I.center,
    org_id: I.org,
  });
  await page.goBack();
  await expect(eventCard).toBeVisible();
  state.denyEvent();
  await eventCard.press("Enter");
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { name: "Etkinlik detayı", exact: true })).toBeVisible();
  await expect(
    page.getByText("Etkinlik kaynağı okunamadı. Güncel yetkili kaynağı yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: event.name, exact: true })).toHaveCount(0);
  await expect.poll(() => state.eventReads.length).toBe(2);
  expect(state.writes).toHaveLength(0);
});

test("missing editor policy keeps session details and independent cancellation accessible", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true);
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "Sentetik program seansı", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "Seans ayrıntıları okunabiliyor; düzenleme için gereken güncel kaynak şu anda alınamıyor.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "Seansı düzenle", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Seansı iptal et", exact: true })).toBeEnabled();
  await expect(panel.getByText(state.fixture.rooms[0]!.name, { exact: true })).toBeVisible();
  await expect(panel.getByText("Tango", { exact: true })).toBeVisible();
  expect(state.reads).toContain("editor-policy-rejection");
  expect(state.writes).toEqual([]);
  expect((await scanAccessibility(page, "read-only-session-policy-rejection")).violations).toEqual(
    [],
  );
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("fixed group uses explicit priority sale and lesson, recovers its ACK, and cancels the reservation root", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true, false, true);
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("button", { name: "Seansı düzenle", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Üyeleri düzenle", exact: true }).click();
  await panel.getByRole("button", { name: "Kişileri ara", exact: true }).click();
  await panel.locator("#group-person").selectOption(I.self);
  await panel.locator("#group-sale").selectOption(state.saleId);
  await panel.locator("#group-session").selectOption(state.session!.id);
  const beforeCapacity = { ...state.session!.capacity };
  await panel.getByRole("button", { name: "Seçilen dersi ve kaynağı incele", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Üye ekle", exact: true })).toBeDisabled();
  expect(state.group.creates).toHaveLength(0);
  await panel
    .getByRole("checkbox", { name: /Bu kişi, satış kaynağı ve somut ders/ })
    .press("Space");
  state.group.lostReply = true;
  await panel.getByRole("button", { name: "Üye ekle", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Güncel kaydı oku", exact: true }).click();
  await expect(
    panel.getByText("Öncelikli rezervasyon, güncel haklar ve ders okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.group.creates).toHaveLength(1);
  expect(state.group.effects).toBe(1);
  expect(state.session?.capacity).toMatchObject({
    held: beforeCapacity.held + 1,
    remaining: beforeCapacity.remaining - 1,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
  expect(
    (await scanAccessibility(page, "fixed-group-priority-recovered-mobile")).violations,
  ).toEqual([]);
  await panel.getByRole("button", { name: /Bu dersten çıkar — Grup öğrencisi/ }).click();
  const cancel = page.getByRole("alertdialog");
  await cancel.locator("#member-state-reason").fill("Kontrollü ders kaydı iptali");
  await cancel.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    cancel.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.group.cancels).toHaveLength(1);
  expect(state.group.cancels[0]!.reservation_id).not.toBe(I.self);
  await cancel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /Bu dersten çıkar —/ })).toHaveCount(0);
  await panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
});

test("managed session edits invalidate the old review and apply the newly reviewed capacity", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true, false, true);
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Seansı düzenle", exact: true }).click();
  await panel.locator("#schedule-session-capacity").fill("13");
  await panel.locator("#schedule-session-reason").fill("Kontrollü kapasite düzenlemesi");
  await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Onayla ve uygula", exact: true })).toBeVisible();
  expect(state.changes).toHaveLength(0);
  await panel.locator("#schedule-session-capacity").fill("14");
  await expect(panel.getByRole("button", { name: "Onayla ve uygula", exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await panel.getByRole("button", { name: "Onayla ve uygula", exact: true }).click();
  await expect(
    panel.getByText("İşlem kaydedildi ve güncel kaynak okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.changes).toHaveLength(1);
  expect(state.session!.version).toBe(4);
  expect(state.session!.capacity.total).toBe(14);
  await expect(panel.getByText("2 / 14", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
});

test("cancelled session shows its native durable replacement relation", async ({ page }) => {
  const state = await scheduleFixture(page, true, false, true);
  state.session!.state = "cancelled";
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  const history = panel.getByRole("region", { name: "Bağlı telafi seansları", exact: true });
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await expect(history.getByText("Planlandı", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.reload();
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Bağlı telafi seansları", exact: true }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
});

test("weekly preparation resolves the current scoped template without writing and preserves program preview guards", async ({
  page,
}) => {
  const state = await scheduleFixture(page, false, true);
  let previews = 0;
  let version = 1;
  const defaults = {
    weekdays: [2],
    local_start: "11:17:30",
    duration_minutes: 30,
    capacity: { total: 2, categories: { male: 1, female: 1 } },
  };
  const source = () => ({ scope: "center", center_id: I.center, key: "weekly", version });
  await page.route("**/functions/v1/backend-v1/settings_catalog_get_v1", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      scope: "center",
    });
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          scope: "center",
          catalog_version: 24,
          fields: [],
          defaults: {},
          brand_packages: [],
          limitations: [],
          preparation_templates: {
            availability: [],
            packages: [],
            package_currency_suggestion: "TRY",
            programs: [
              {
                source: source(),
                template: { key: "weekly", name: `Haftalık örnek v${version}`, defaults },
              },
            ],
          },
        },
      },
    });
  });
  await page.route("**/functions/v1/backend-v1/settings_preparation_resolve_v1", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      kind: "program",
      source: source(),
    });
    if (version === 1) {
      version++;
      return route.fulfill({
        status: 409,
        json: {
          ok: false,
          error: { code: "VERSION_CONFLICT", trace_id: I.role, retryable: false },
        },
      });
    }
    return route.fulfill({
      json: { ok: true, trace_id: I.role, data: { kind: "program", source: source(), defaults } },
    });
  });
  await page.route("**/functions/v1/backend-v1/program_preview_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.class_id).toBe(I.lesson);
    expect(request.schedule.room_id).toBe(I.room);
    expect(request.schedule).toMatchObject(defaults);
    previews++;
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          id: "019a7b00-0000-7000-8000-000000000093",
          token: "synthetic-preview-token",
          scope_hash: "synthetic-preview-scope",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          dependencies: { versions: [] },
          effects: [],
          blockers: [{ code: "RESOURCE_CONFLICT", retryable: false, trace_id: I.role }],
          sessions: [
            {
              session_id: "019a7b00-0000-7000-8000-000000000094",
              interval: {
                starts_at: "2026-11-17T08:17:00Z",
                ends_at: "2026-11-17T08:47:00Z",
              },
            },
          ],
        },
      },
    });
  });
  await page.getByRole("button", { name: "Seans ekle", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("radio", { name: "Haftalık seri", exact: true }).click();
  const template = panel.getByRole("combobox", { name: "Hazırlık şablonu" });
  await template.selectOption({ label: "Haftalık örnek v1 · Merkez" });
  await expect(panel.getByText("Şablonun güncel sürümü okunamadı.", { exact: true })).toBeVisible();
  await expect(panel.locator("#schedule-create-duration")).toHaveValue("");
  await panel.getByRole("button", { name: "Güncel verileri yükle", exact: true }).click();
  await template.selectOption({ label: "Haftalık örnek v2 · Merkez" });
  await panel.getByRole("button", { name: "Taslağa uygula", exact: true }).click();
  await expect(panel.getByText("Şablon taslağa uygulandı.", { exact: true })).toBeVisible();
  expect(previews).toBe(0);
  expect(state.writes).toEqual([]);
  await expect(panel.locator("#schedule-create-class")).toHaveValue("");
  await panel.locator("#schedule-create-class").selectOption(I.lesson);
  await panel.locator("#schedule-create-instructor").selectOption(I.instructor);
  await panel.locator("#schedule-create-room").selectOption(I.room);
  await panel.locator("#schedule-create-date").fill("2026-11-17");
  await panel.locator("#schedule-create-weeks").fill("1");
  await panel.getByRole("button", { name: "Seansları önizle", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText(
    "Seçilen saat, salon veya eğitmen uygunluk kurallarını karşılamıyor ya da başka bir kayıtla çakışıyor.",
  );
  await expect(panel.getByRole("button", { name: "Seriyi oluştur", exact: true })).toHaveCount(0);
  expect(previews).toBe(1);
  expect(state.writes).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "blocked-program-preview")).violations).toEqual([]);
  await panel.locator("#schedule-create-time").fill("12:17");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("region", { name: "Oluşacak seanslar", exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});

test("a blocked cancellation explains its reason inside the active session sheet", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true);
  await page.route("**/functions/v1/backend-v1/session_cancel_preview_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.reason).toBe("Sentetik iptal gerekçesi");
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          id: "019a7b00-0000-7000-8000-000000000095",
          token: "synthetic-cancel-preview",
          scope_hash: "synthetic-cancel-scope",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          dependencies: {
            versions: [{ entity: { type: "sessions", id: request.session_id }, version: 3 }],
          },
          effects: [{ entity: { type: "sessions", id: request.session_id }, action: "cancel" }],
          blockers: [{ code: "RESERVATION_EXISTS", retryable: false, trace_id: I.role }],
        },
      },
    });
  });
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Seansı iptal et", exact: true }).click();
  await panel.locator("#schedule-session-reason").fill("Sentetik iptal gerekçesi");
  await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText(
    "Mevcut rezervasyonlar bu değişikliği engelliyor. Güncel etkiyi incele.",
  );
  await expect(panel.getByRole("button", { name: "Onayla ve uygula", exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("a newer detail version does not borrow resources from a stale calendar row", async ({
  page,
}) => {
  const state = await scheduleFixture(page, true);
  expect(state.session).toBeDefined();
  state.session!.version = 4;
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.getByRole("heading", { name: "Sentetik program seansı", exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(state.fixture.rooms[0]!.name, { exact: true })).toHaveCount(0);
  await expect(panel.getByText("Tango", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Seansı düzenle", exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test("time and instructor changes apply an explicitly reviewed future scope and reread both occurrences", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-16T06:00:00Z"));
  const f = await scheduleFixture(page, true, true, true, true);
  const future = f.future!;
  const nextInstructor = "019a7b00-0000-7000-8000-000000000096";
  const preservedAssistant = { person_id: I.self, duty: "assistant" };
  await page.getByText("Sentetik program seansı", { exact: true }).click();
  let panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Seansı düzenle", exact: true }).click();
  await panel.locator("#schedule-session-time").fill("15:20");
  await panel.locator("#schedule-session-duration").fill("45");
  await panel.locator('input[value="this_and_future"]').press("Space");
  await panel.locator("#schedule-session-reason").fill("Kontrollü ileri oluşum saat düzenlemesi");
  await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  expect(f.changes).toHaveLength(0);
  await panel.getByRole("button", { name: "Onayla ve uygula", exact: true }).click();
  await expect(
    panel.getByText("İşlem kaydedildi ve güncel kaynak okundu.", { exact: true }),
  ).toBeVisible();
  expect(f.previews[0]).toMatchObject({
    scope: "this_and_future",
    patch: { interval: { starts_at: "2026-11-16T12:20:00Z", ends_at: "2026-11-16T13:05:00Z" } },
  });
  expect(f.session!.starts_at).toBe("2026-11-16T12:20:00.000Z");
  expect(future.starts_at).toBe("2026-11-17T12:20:00.000Z");
  expect(f.session!.version).toBe(4);
  expect(future.version).toBe(4);
  await expect(panel).toContainText("15:20");
  await panel.getByRole("button", { name: "Eğitmeni değiştir", exact: true }).click();
  await panel.locator("#schedule-session-instructor").selectOption(nextInstructor);
  await panel.locator('input[value="this_and_future"]').press("Space");
  await panel.locator("#schedule-session-reason").fill("Kontrollü ileri oluşum eğitmen değişimi");
  await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
  expect(f.changes).toHaveLength(1);
  await panel.getByRole("button", { name: "Onayla ve uygula", exact: true }).click();
  await expect(
    panel.getByText("İşlem kaydedildi ve güncel kaynak okundu.", { exact: true }),
  ).toBeVisible();
  await expect(panel).toContainText("İkinci sentetik eğitmen");
  for (const row of [f.session!, future]) {
    expect(row.version).toBe(5);
    expect(row.assignments).toEqual([
      preservedAssistant,
      { person_id: nextInstructor, duty: "instructor" },
    ]);
  }
  expect(f.previews[1]).toMatchObject({
    scope: "this_and_future",
    patch: { assignments: [preservedAssistant, { person_id: nextInstructor, duty: "instructor" }] },
  });
  await panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.reload();
  await page.getByText("İleri program seansı", { exact: true }).click();
  panel = page.getByRole("dialog");
  await expect(panel).toContainText("15:20");
  await expect(panel).toContainText("İkinci sentetik eğitmen");
  expect(f.changes).toHaveLength(2);
  expect(f.writes).toEqual([]);
  await panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
});

async function verifyNativeScheduleScope(page: Page, scenario: "single" | "this_and_future") {
  await page.clock.setFixedTime(new Date("2026-11-16T06:00:00Z"));
  const f = await scheduleFixture(page, true, true, true, true);
  const occurrences = [f.session!, f.future!];
  const originalFutureStart = Date.parse(occurrences[1]!.starts_at);
  const localTime = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const titles = ["Sentetik program seansı", "İleri program seansı"];
  const scope = `?org=${I.org}&center=${I.center}`;
  const instructorReads: string[] = [];
  let reader: "instructor" | "member" | undefined;
  const policy = {
    status: "not_configured",
    source: "current_policy",
    policy_version_id: null,
    terms: null,
    cutoff_at: null,
  } satisfies MemberLessonDiscovery["cancellation"];
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    if (!reader) return route.fallback();
    const operation = new URL(route.request().url()).pathname.split("/").at(-1);
    const request = route.request().postDataJSON();
    const personId = reader === "member" ? I.self : I.instructor;
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const list = (items: unknown[]) => ({
      items,
      next_cursor: null,
      as_of: new Date().toISOString(),
    });
    if (operation === "organizations_list_v1")
      return send(
        list([
          {
            id: I.org,
            name: "Fixture Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
            self_management_scope: null,
            self_context: {
              person_id: personId,
              subscriber_number: null,
              centers: [
                {
                  center_id: I.center,
                  student: reader === "member",
                  instructor: reader === "instructor",
                  assistant: false,
                },
              ],
            },
          },
        ]),
      );
    if (operation === "roles_list_v1") {
      expect(request.person_id).toBe(personId);
      return send(list([]));
    }
    if (operation === "session_get_v1" && reader === "instructor") {
      expect(request).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        include_room_labels: true,
      });
      const row = occurrences.find(({ id }) => id === request.session_id);
      expect(row?.assignments).toContainEqual({ person_id: personId, duty: "instructor" });
      instructorReads.push(request.session_id);
      return send({ ...row, room_labels: [{ room_id: I.room, name: f.fixture.rooms[0]!.name }] });
    }
    if (operation !== "calendar_get_v1") return route.fallback();
    expect(request).toMatchObject({ org_id: I.org, center_id: I.center });
    if (reader === "member") {
      expect(request.member_discovery).toBe(true);
      expect(request).not.toHaveProperty("resource");
    } else {
      expect(request.resource).toEqual({ kind: "person", id: personId });
      expect(request.include_room_labels).toBe(true);
    }
    const items = occurrences.flatMap((row, index) => {
      if (
        Date.parse(row.starts_at) >= Date.parse(request.interval.ends_at) ||
        Date.parse(row.ends_at) <= Date.parse(request.interval.starts_at)
      )
        return [];
      const item: CalendarItem = {
        id: row.id,
        type: "session",
        center_id: I.center,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        title: titles[index]!,
        resources: [{ kind: "room", id: I.room }],
      };
      if (reader === "instructor")
        return row.assignments.some((assignment) => assignment.person_id === personId)
          ? [item]
          : [];
      return [
        {
          ...item,
          capacity: row.capacity,
          member_lesson: {
            version: row.version,
            format: "group",
            state: "planned",
            attendance_state: row.attendance_state,
            instructor_labels: [f.fixture.people[0]!.display_name],
            room_labels: [f.fixture.rooms[0]!.name],
            booking_window: {
              state: "not_configured",
              policy_version_id: null,
              opens_at: null,
              closes_at: null,
            },
            cancellation: policy,
            own_reservation: null,
            waitlist_enabled: false,
            own_waitlist: null,
          } satisfies MemberLessonDiscovery,
        },
      ];
    });
    return send(list(items));
  });

  async function changeTime(time: string, changeScope: "single" | "this_and_future") {
    reader = undefined;
    await page.goto(`${origin}/o/${I.org}/c/${I.center}/schedule`);
    await page.getByText(titles[0]!, { exact: true }).click();
    const panel = page.getByRole("dialog");
    await panel.getByRole("button", { name: "Seansı düzenle", exact: true }).click();
    await panel.locator("#schedule-session-time").fill(time);
    await panel.locator(`input[value="${changeScope}"]`).press("Space");
    await panel.locator("#schedule-session-reason").fill("Sentetik seans saati düzeltmesi");
    const previous = f.changes.length;
    await panel.getByRole("button", { name: "Etkiyi önizle", exact: true }).click();
    expect(f.changes).toHaveLength(previous);
    await panel.getByRole("button", { name: "Onayla ve uygula", exact: true }).click();
    await expect(
      panel.getByText("İşlem kaydedildi ve güncel kaynak okundu.", { exact: true }),
    ).toBeVisible();
    expect(f.changes).toHaveLength(previous + 1);
    expect(f.previews.at(-1)).toMatchObject({ scope: changeScope, session_id: occurrences[0]!.id });
  }

  async function observeTimes(times: readonly [string, string]) {
    reader = "member";
    await page.goto(`${origin}/member/classes${scope}`);
    const monday = page.locator(`#member-class-${occurrences[0]!.id}`);
    await expect(monday.locator("xpath=ancestor::*[@role='listitem'][1]")).toContainText(times[0]);
    await page.getByRole("radio", { name: "17 Kasım 2026 Salı", exact: true }).click();
    const tuesday = page.locator(`#member-class-${occurrences[1]!.id}`);
    await expect(tuesday.locator("xpath=ancestor::*[@role='listitem'][1]")).toContainText(times[1]);

    reader = "instructor";
    const beforeRead = instructorReads.length;
    await page.goto(`${origin}/instructor/schedule${scope}`);
    await page.getByRole("radio", { name: "Ajanda", exact: true }).click();
    for (const [index, title] of titles.entries()) {
      const item = page.getByRole("button", { name: new RegExp(title) });
      await expect(item).toHaveCount(1);
      await expect(item).toContainText(times[index]!);
    }
    expect(instructorReads.slice(beforeRead).sort()).toEqual(
      occurrences.map(({ id }) => id).sort(),
    );
  }

  if (scenario === "single") {
    await changeTime("15:20", "single");
    expect(occurrences.map(({ version }) => version)).toEqual([4, 3]);
    expect(Date.parse(occurrences[1]!.starts_at)).toBe(originalFutureStart);
    await observeTimes(["15:20", localTime.format(originalFutureStart)]);
  } else {
    // The single-edit behavior has its own full UI acceptance above.
    // Begin this independent native workflow from its already-committed
    // source state, then test the future edit through the UI and both readers.
    const existing = occurrences[0]!;
    // The single edit previously committed 15:20 Europe/Istanbul (12:20 UTC),
    // a six-hour move from the fixture's original 09:20 local start.
    const committedStart = Date.parse("2026-11-16T12:20:00.000Z");
    const committedDelta = committedStart - Date.parse(existing.starts_at);
    existing.starts_at = new Date(committedStart).toISOString();
    existing.ends_at = new Date(Date.parse(existing.ends_at) + committedDelta).toISOString();
    existing.version = 4;
    expect(occurrences.map(({ version }) => version)).toEqual([4, 3]);
    expect(Date.parse(occurrences[1]!.starts_at)).toBe(originalFutureStart);
    await changeTime("15:40", "this_and_future");
    expect(occurrences.map(({ version }) => version)).toEqual([5, 4]);
    const movedFutureStart = originalFutureStart + 20 * 60_000;
    expect(Date.parse(occurrences[1]!.starts_at)).toBe(movedFutureStart);
    await observeTimes(["15:40", localTime.format(movedFutureStart)]);
  }
  expect(f.writes).toEqual([]);
}

test("single schedule change reaches instructor and member", async ({ page }) => {
  await verifyNativeScheduleScope(page, "single");
});

test("future schedule change reaches instructor and member", async ({ page }) => {
  await verifyNativeScheduleScope(page, "this_and_future");
});
