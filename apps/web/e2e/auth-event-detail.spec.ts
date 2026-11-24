import { activate, closeWithDevice } from "./device-input.js";
import { test, expect } from "./test.js";
import { mockEventDetail, detailIds as D } from "./event-detail-fixture.js";
import { mockSessionDetail } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { clickWorkspaceLink, origin } from "./auth-fixture.js";
import type { Page } from "@playwright/test";
import type {
  EventView,
  FinanceDirectoryEntry,
  InstructorFinanceEarning,
} from "@ftksaas/api-contracts";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
test("event detail uses the active room projection and respects an inactive room", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  state.event.venue = { kind: "internal", room_id: I.room, timezone: state.event.timezone };
  state.event.venue_active_room_name = "Sentetik etkinlik salonu";
  const roomReads: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/management_state_get_v1") &&
      request.postDataJSON().operation === "room_save_v1"
    )
      roomReads.push(request.url());
  });
  await page.reload();
  await expect(page.getByText("Sentetik etkinlik salonu", { exact: true })).toBeVisible();
  expect(roomReads).toHaveLength(0);

  state.event.venue_active_room_name = null;
  await page.reload();
  await expect(page.getByRole("heading", { name: state.event.name })).toBeVisible();
  await expect(page.getByText("Sentetik etkinlik salonu", { exact: true })).toHaveCount(0);
  expect(roomReads).toHaveLength(0);
});
test("event detail displays the authorized duty name without a separate profile read", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  state.event.duties = [
    {
      id: D.debt,
      person_id: I.instructor,
      person_display_name: "Sentetik yetkili eğitmen",
      duty: "instructor",
      fee_minor: "12000",
      currency: "TRY",
      performed: null,
      verified_at: null,
      version: 1,
    },
  ];
  state.reads.length = 0;
  await page.reload();
  await expect(page.getByText("Sentetik yetkili eğitmen", { exact: true })).toBeVisible();
  expect(state.reads.find(({ op }) => op === "event_get_v1")?.request).toMatchObject({
    center_id: I.center,
    include_management_labels: true,
  });
  expect(
    state.reads.filter(
      ({ op, request }) => op === "person_get_v1" && request.person_id === I.instructor,
    ),
  ).toHaveLength(0);
});
test("event registration reads and accepts only the chosen member's own document before renewed review", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "normal", { documents: true });
  await activate(page.getByRole("button", { name: "Katılımcı ekle", exact: true }));
  const sheet = page.getByRole("dialog");
  const next = sheet.getByRole("button", { name: "Devam", exact: true });
  const person = sheet.getByLabel("Kişi", { exact: true });
  const read = sheet.getByRole("button", { name: "Etkinlik koşulları belgesini oku", exact: true });
  await person.selectOption(I.instructor);
  await activate(next);
  const back = sheet.getByRole("button", { name: "Geri", exact: true });
  await expect(back).toBeVisible();
  await expect(read).toHaveCount(0);
  expect(state.reads.some(({ op }) => op === "document_requirements_get_v1")).toBe(false);
  await activate(next);
  await activate(sheet.getByRole("checkbox", { name: "Kaydı onaylıyorum", exact: true }), "Space");
  await activate(sheet.getByRole("button", { name: "Kaydı onayla", exact: true }));
  await expect(
    sheet.getByText(
      "Üye, kaydı tamamlamadan önce kendi hesabından etkinlik belgesini kabul etmeli.",
    ),
  ).toBeVisible();
  expect(state.event.registrations).toEqual([]);
  expect(state.writes).toEqual([]);
  await activate(back);
  await activate(back);
  await person.selectOption(I.self);
  await activate(next);
  await activate(read);
  await expect(sheet.getByText("Sentetik etkinlik koşulları", { exact: true })).toBeVisible();
  await activate(
    sheet.getByRole("checkbox", {
      name: "Belgeyi okudum, bu işlem için kabul ediyorum.",
      exact: true,
    }),
    "Space",
  );
  await activate(sheet.getByRole("button", { name: "Belgeyi kabul et", exact: true }));
  await expect(sheet.getByText("Kabul edildi", { exact: true })).toBeVisible();
  expect(state.writes.map(({ op }) => op)).toEqual(["document_accept_v1"]);
  expect(state.writes[0]?.request.context).toMatchObject({
    gate: "event_registration",
    event_registration_preview_id: D.preview,
  });
  const previews = () =>
    state.reads.filter(({ op }) => op === "event_registration_preview_v1").length;
  const before = previews();
  await activate(next);
  const save = sheet.getByRole("button", { name: "Kaydı onayla", exact: true });
  await expect(save).toBeDisabled();
  expect(previews()).toBe(before + 1);
  await activate(sheet.getByRole("checkbox", { name: "Kaydı onaylıyorum", exact: true }), "Space");
  await activate(save);
  await expect(sheet.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes.map(({ op }) => op)).toEqual(["document_accept_v1", "event_register_v1"]);
  expect(state.event.registrations?.[0]?.person_id).toBe(I.self);
});
async function accept(page: Page, button: string, options?: { dialogAlreadyOpen: true }) {
  const dialog = page.getByRole("alertdialog");
  const acknowledgement = dialog.getByRole("checkbox", {
    name: "İşlemi ve etkilerini inceledim, onaylıyorum.",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  // React Aria places initial focus after mounting the modal and its enter state.
  await page.evaluate(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
  );
  if (!options?.dialogAlreadyOpen) {
    await expect(dialog.and(page.locator(":focus-within"))).toBeVisible();
  }
  await acknowledgement.focus();
  await expect(acknowledgement).toBeFocused();
  await activate(acknowledgement, "Space");
  await expect(acknowledgement).toBeChecked();
  await activate(dialog.getByRole("button", { name: button, exact: true }));
  return dialog;
}
test("event detail shows native unknown payment and requires reviewed actual start and one-person attendance", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  state.event.registrations!.push({
    id: D.registration,
    person_id: I.self,
    display_name: "Örnek kişi",
    state: "active",
    attendance_result: "unmarked",
    version: 1,
  });
  await page.reload();
  await expect(page.getByRole("row", { name: /Örnek kişi/ })).toContainText(
    "Ödeme kaynağı paylaşılmıyor",
  );
  await activate(page.getByRole("tab", { name: "Yoklama", exact: true }));
  await page.getByLabel("Fiilî başlangıç", { exact: true }).fill("2026-11-15T18:05");
  await page.getByLabel("Gerekçe", { exact: true }).fill("Müzik sistemi geç açıldı");
  await activate(page.getByRole("button", { name: "Fiilî başlangıcı kaydet", exact: true }));
  const start = await accept(page, "Fiilî başlangıcı kaydet");
  await expect(start.getByText(saved, { exact: true })).toBeVisible();
  await activate(start.getByRole("button", { name: "Vazgeç", exact: true }));
  expect(state.event.actual_started_at).toBe("2026-11-15T15:05:00Z");
  await activate(page.getByRole("radio", { name: "Geldi", exact: true }));
  const mark = await accept(page, "Örnek kişi için yoklama");
  await expect(mark.getByText(saved, { exact: true })).toBeVisible();
  await activate(mark.getByRole("button", { name: "Vazgeç", exact: true }));
  expect(state.event.registrations![0]!.attendance_result).toBe("attended");
  await activate(page.getByRole("button", { name: "Yoklamayı kapat", exact: true }));
  const close = await accept(page, "Yoklamayı kapat");
  await expect(close.getByText(saved, { exact: true })).toBeVisible();
  await activate(close.getByRole("button", { name: "Vazgeç", exact: true }));
  expect(state.event.attendance_state).toBe("closed");
});

test("event details never pair a new revision with the previous times while duty names load", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  await activate(page.getByRole("tab", { name: "Yoklama", exact: true }));
  const planned = page.getByLabel("Planlanan başlangıç", { exact: true });
  const actual = page.getByLabel("Fiilî başlangıç", { exact: true });
  await expect(planned).toHaveValue(/18:00/);
  await actual.fill("2026-11-15T18:05");
  await page.getByLabel("Gerekçe", { exact: true }).fill("Sentetik fiilî başlangıç");

  let release!: () => void;
  const waitForDuty = new Promise<void>((resolve) => (release = resolve));
  const dutyPath = "**/functions/v1/backend-v1/person_get_v1";
  await page.route(dutyPath, async (route) => {
    if (route.request().postDataJSON().person_id === I.instructor) await waitForDuty;
    await route.fallback();
  });
  const dutyRead = page.waitForRequest(
    (request) =>
      request.url().endsWith("/person_get_v1") && request.postDataJSON().person_id === I.instructor,
  );
  await page.route("**/functions/v1/backend-v1/event_get_v1", async (route) => {
    if (state.effects && !state.event.duties?.length) {
      state.event.name = "Güncellenen sentetik etkinlik";
      state.event.interval = {
        starts_at: "2026-11-15T14:30:00Z",
        ends_at: "2026-11-15T16:30:00Z",
      };
      state.event.duties = [
        {
          id: D.debt,
          person_id: I.instructor,
          duty: "instructor",
          fee_minor: "12000",
          currency: "TRY",
          performed: null,
          verified_at: null,
          version: 1,
        },
      ];
    }
    await route.fallback();
  });

  try {
    await activate(page.getByRole("button", { name: "Fiilî başlangıcı kaydet", exact: true }));
    const dialog = await accept(page, "Fiilî başlangıcı kaydet");
    await dutyRead;
    await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
    await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
    await expect(planned.and(page.locator('input[value$="18:00"]'))).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole("heading", { name: "Güncellenen sentetik etkinlik" })).toBeVisible();
  await expect(planned).toHaveValue(/17:30/);
  await expect(actual).toHaveValue("2026-11-15T18:05");
});

test("package practice uses the selected right for eligibility and closes without a payment command", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "normal", { practice: true });
  await activate(page.getByRole("button", { name: "Katılımcı ekle", exact: true }));
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Kişi", { exact: true }).selectOption(I.instructor);
  await sheet
    .getByLabel("Kayıt için paket", { exact: true })
    .selectOption(state.practiceRight.sale_id);
  const next = sheet.getByRole("button", { name: "Devam", exact: true });
  await activate(next);
  await activate(next);
  await activate(sheet.getByRole("checkbox", { name: "Kaydı onaylıyorum", exact: true }), "Space");
  await activate(sheet.getByRole("button", { name: "Kaydı onayla", exact: true }));
  await expect(sheet.getByText(saved, { exact: true })).toBeVisible();
  await activate(sheet.getByRole("button", { name: "Güncel verileri yükle", exact: true }));
  await expect(page.getByRole("row", { name: /Örnek Eğitmen/ })).toContainText("Paket uygun");
  await activate(page.getByRole("tab", { name: "Yoklama", exact: true }));
  await page.getByLabel("Fiilî başlangıç", { exact: true }).fill("2026-11-15T18:05");
  await page.getByLabel("Gerekçe", { exact: true }).fill("Sentetik Pratik başladı");
  await activate(page.getByRole("button", { name: "Fiilî başlangıcı kaydet", exact: true }));
  const start = await accept(page, "Fiilî başlangıcı kaydet");
  await expect(start.getByText(saved, { exact: true })).toBeVisible();
  await activate(start.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("radio", { name: "Geldi", exact: true }));
  const mark = await accept(page, "Örnek Eğitmen için yoklama");
  await expect(mark.getByText(saved, { exact: true })).toBeVisible();
  await activate(mark.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("button", { name: "Yoklamayı kapat", exact: true }));
  const close = await accept(page, "Yoklamayı kapat");
  await expect(close.getByText(saved, { exact: true })).toBeVisible();
  await activate(close.getByRole("button", { name: "Vazgeç", exact: true }));
  expect(state.event.attendance_state).toBe("closed");
  expect(state.event.registrations?.[0]).toMatchObject({
    person_id: I.instructor,
    attendance_result: "attended",
    state: "completed",
  });
  expect(state.writes.map(({ op }) => op)).toEqual([
    "event_register_v1",
    "event_actual_start_record_v1",
    "event_attendance_mark_v1",
    "event_attendance_close_v1",
  ]);
});
test("event unknown result keeps the frozen action and recovers its exact receipt without another write", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "unknown");
  await activate(page.getByRole("button", { name: "Etkinliği tamamla", exact: true }));
  const dialog = await accept(page, "Etkinliği tamamla");
  await expect(dialog.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toBe(1);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
});
test("event acknowledged write retries result reads and never repeats the command", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "unread");
  await activate(page.getByRole("button", { name: "Etkinliği tamamla", exact: true }));
  const dialog = await accept(page, "Etkinliği tamamla");
  await expect(dialog.getByText(/güncel sonuç henüz okunamadı/)).toBeVisible();
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
});
test("event native authority denial does not manufacture a successful mutation", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "denied");
  await activate(page.getByRole("button", { name: "Etkinliği tamamla", exact: true }));
  const dialog = await accept(page, "Etkinliği tamamla");
  await expect(dialog.getByRole("alert").last()).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.event.state).toBe("published");
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
});
test("event cancellation exposes server effects before its separately reviewed apply", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "normal", { existing: "available" });
  await page.clock.setFixedTime(new Date("2026-11-15T19:00:00Z"));
  await mockCalendarEvent(page, state.event);
  const participant = state.event.registrations![0]!;
  const debt = participant.payment_summary!.debts[0]!;
  const timestamp = "2026-11-15T18:00:00Z";
  const financeReads: string[] = [];
  await page.route("**/functions/v1/backend-v1/finance_directory_get_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({ org_id: I.org, center_id: I.center });
    const { view } = request;
    const remaining = debt.remaining_minor;
    const credit = debt.credited_minor;
    const items: FinanceDirectoryEntry[] = [];
    const row = {
      person_id: participant.person_id,
      display_name: participant.display_name,
      version: debt.version,
      created_at: timestamp,
      occurred_at: timestamp,
      currency: debt.currency,
      source_sale_id: null,
      product_name: null,
      due_at: null,
      method: null,
    };
    if (view === "debts" && remaining !== "0")
      items.push({
        ...row,
        id: debt.id,
        entity: { type: "debts", id: debt.id },
        kind: "debt",
        amount_minor: remaining,
      });
    if (view === "credits" && credit !== "0")
      items.push({
        ...row,
        id: row.person_id,
        entity: { type: "people", id: row.person_id },
        kind: "credit",
        amount_minor: credit,
      });
    if (view === "movements")
      items.push({
        ...row,
        id: D.cash,
        entity: { type: "cash_movements", id: D.cash },
        version: 1,
        kind: "collection",
        amount_minor: debt.paid_minor,
        method: "bank_transfer",
      });
    financeReads.push(
      `${view}:${items.map(({ id, amount_minor }) => `${id}:${amount_minor}`).join(",")}`,
    );
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          view,
          items,
          next_cursor: null,
          as_of: timestamp,
          totals: [
            {
              currency: debt.currency,
              sales_minor: "0",
              collections_minor: debt.paid_minor,
              refunds_minor: "0",
              debt_minor: remaining,
              credit_minor: credit,
              debt_people: Number(remaining !== "0"),
              credit_people: Number(credit !== "0"),
            },
          ],
        },
      },
    });
  });
  await page.route("**/functions/v1/backend-v1/finance_get_v1", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      center_id: I.center,
      person_id: participant.person_id,
      currency: debt.currency,
    });
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          person_id: participant.person_id,
          currency: debt.currency,
          credit_available_minor: debt.credited_minor,
          debts: [],
          movements: { items: [], next_cursor: null, as_of: timestamp },
        },
      },
    });
  });
  const credits = page.getByRole("grid", { name: "Alacaklar", exact: true });
  const debts = page.getByRole("grid", { name: "Açık borçlar", exact: true });
  const debtTab = page.getByRole("tab", { name: /Açık borçlar/ });
  const movements = page.getByRole("grid", { name: "Hareketler", exact: true });
  await clickWorkspaceLink(page, "Finans");
  await expect(movements.getByRole("gridcell", { name: "TRY ₺100,00", exact: true })).toBeVisible();
  await activate(debtTab);
  await expect(debts.getByRole("gridcell", { name: "TRY ₺400,00", exact: true })).toBeVisible();
  await activate(page.getByRole("tab", { name: /Alacaklar/ }));
  await expect.poll(() => financeReads.at(-1)).toBe("credits:");
  const calendarEvent = page.getByRole("button", { name: /Etkinlik Tango atölyesi/ });
  await clickWorkspaceLink(page, "Ders programı");
  await activate(calendarEvent, "Enter");
  await activate(page.getByRole("button", { name: "Etkinliği iptal et", exact: true }));
  const dialog = page.getByRole("alertdialog");
  await dialog
    .getByLabel("Gerekçe (zorunlu, geçmişe yazılır)", { exact: true })
    .fill("Salon kullanılamıyor");
  await accept(page, "İptal etkilerini oku");
  expect(state.writes).toHaveLength(0);
  await expect(dialog.getByText(/sunucunun güncel önizlemesidir/)).toBeVisible();
  await expect(dialog.getByText(/₺400,00/)).toBeVisible();
  await expect(dialog.getByText(/₺100,00/)).toBeVisible();
  await accept(page, "Etkinliği iptal et", { dialogAlreadyOpen: true });
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.event.state).toBe("cancelled");
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await clickWorkspaceLink(page, "Finans");
  await expect(movements.getByRole("gridcell", { name: "TRY ₺100,00", exact: true })).toBeVisible();
  await expect
    .poll(() => financeReads.filter((read) => read.startsWith("movements:")).length)
    .toBe(2);
  await activate(page.getByRole("tab", { name: /Alacaklar/ }));
  const creditRow = credits.getByRole("row").filter({ hasText: participant.display_name! });
  await expect(creditRow).toContainText("₺100,00");
  await activate(debtTab);
  await expect
    .poll(() => financeReads.filter((read) => read.startsWith("debts:")).at(-1))
    .toBe("debts:");
  await expect(debts.getByText(participant.display_name!, { exact: true })).toHaveCount(0);
  expect(financeReads).toContain(`debts:${debt.id}:40000`);
  expect(financeReads).toContain(`credits:${participant.person_id}:10000`);
  expect(financeReads.filter((read) => read.startsWith("movements:"))).toEqual([
    `movements:${D.cash}:10000`,
    `movements:${D.cash}:10000`,
  ]);
  const calendarRead = page.waitForResponse((response) =>
    response.url().endsWith("/calendar_get_v1"),
  );
  await clickWorkspaceLink(page, "Ders programı");
  const calendar = await (await calendarRead).json();
  expect(calendar.data.items).toMatchObject([{ id: state.event.id, resources: [] }]);
  const eventRead = page.waitForResponse(
    (response) =>
      response.url().endsWith("/event_get_v1") &&
      response.request().postDataJSON().include_payment_summary === true,
  );
  await activate(calendarEvent, "Enter");
  const result = await (await eventRead).json();
  expect(result.data).toMatchObject({
    id: state.event.id,
    state: "cancelled",
    registrations: [
      {
        id: participant.id,
        payment_summary: { net_minor: "0", credited_minor: "10000", debts: [{ id: debt.id }] },
      },
    ],
  });
  await expect(page.getByRole("heading", { name: state.event.name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Etkinliği iptal et", exact: true }),
  ).toBeDisabled();
  expect(state.writes.map(({ op }) => op)).toEqual(["event_cancel_apply_v1"]);
});
async function mockCalendarEvent(page: Page, row: EventView) {
  await page.route("**/functions/v1/backend-v1/calendar_get_v1", async (route) => {
    const { interval: range } = route.request().postDataJSON();
    const included =
      Date.parse(row.interval.starts_at) < Date.parse(range.ends_at) &&
      Date.parse(row.interval.ends_at) > Date.parse(range.starts_at);
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: included
            ? [
                {
                  id: row.id,
                  type: "event",
                  center_id: I.center,
                  title: row.name,
                  starts_at: row.interval.starts_at,
                  ends_at: row.interval.ends_at,
                  resources: row.state === "cancelled" ? [] : [{ kind: "room", id: I.room }],
                },
              ]
            : [],
          next_cursor: null,
          as_of: "2026-11-16T12:00:00Z",
        },
      },
    });
  });
}
async function paidRegistration(page: Page) {
  await activate(page.getByRole("button", { name: "Katılımcı ekle", exact: true }));
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Kişi", { exact: true }).selectOption(I.instructor);
  await activate(sheet.getByRole("button", { name: "Devam", exact: true }));
  await activate(sheet.getByRole("button", { name: "Ödeme hazırlığını oluştur", exact: true }));
  const prepare = await accept(page, "Ödeme hazırlığını oluştur");
  await expect(prepare.getByText(saved, { exact: true })).toBeVisible();
  await activate(prepare.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(sheet.getByRole("radio", { name: "Şimdi tahsil edilecek", exact: true }));
  await sheet.getByLabel("Tutar (alt birim)", { exact: true }).fill("45000");
  await sheet.getByLabel("Yöntem", { exact: true }).selectOption("bank_transfer");
  await sheet.getByLabel("Referans", { exact: true }).fill("SENTETIK-ODEME");
  await sheet.getByLabel("Tahsilat tarihi ve saati", { exact: true }).fill("2026-11-16T15:00");
  await activate(sheet.getByRole("button", { name: "Tahsilatı incele", exact: true }));
  const collect = await accept(page, "Tahsilatı kaydet");
  await expect(collect.getByText(saved, { exact: true })).toBeVisible();
  await activate(collect.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(sheet.getByRole("button", { name: "Devam", exact: true }));
  await activate(sheet.getByRole("checkbox", { name: "Kaydı onaylıyorum", exact: true }), "Space");
  await activate(sheet.getByRole("button", { name: "Kaydı onayla", exact: true }));
  return sheet;
}
test("reopening an event payment never offers a warm balance after a failed read", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  async function selectPerson() {
    await activate(page.getByRole("button", { name: "Katılımcı ekle", exact: true }));
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Kişi", { exact: true }).selectOption(I.instructor);
    return sheet;
  }
  let sheet = await selectPerson();
  await activate(sheet.getByRole("button", { name: "Devam", exact: true }));
  const discoveryReads = state.reads.filter(
    ({ op, request }) => op === "event_payment_get_v1" && request.selection,
  );
  expect(discoveryReads).toHaveLength(1);
  expect(discoveryReads[0]?.request).toMatchObject({
    org_id: I.org,
    center_id: I.center,
    selection: { event_id: state.event.id, person_id: I.instructor },
  });
  await activate(sheet.getByRole("button", { name: "Ödeme hazırlığını oluştur", exact: true }));
  const preparation = await accept(page, "Ödeme hazırlığını oluştur");
  await expect(preparation.getByText(saved, { exact: true })).toBeVisible();
  await activate(preparation.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(sheet.getByRole("button", { name: "Close", exact: true }));
  await expect(sheet).toHaveCount(0);

  let rejectedReads = 0;
  let denyPayment = true;
  await page.route("**/functions/v1/backend-v1/event_payment_get_v1", async (route) => {
    if (!denyPayment) return route.fallback();
    rejectedReads++;
    return route.abort("failed");
  });
  sheet = await selectPerson();
  await expect(
    sheet.getByRole("alert").filter({ hasText: "Ödeme kaynağı paylaşılmıyor" }),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Devam", exact: true })).toBeDisabled();
  await expect(sheet.getByText("Kalan borç", { exact: true })).toHaveCount(0);
  expect(rejectedReads).toBe(1);

  denyPayment = false;
  await activate(sheet.getByRole("button", { name: "Yeniden dene", exact: true }));
  await activate(sheet.getByRole("button", { name: "Devam", exact: true }));
  await expect(sheet.getByText("Kalan borç", { exact: true })).toBeVisible();
  expect(state.writes.map(({ op }) => op)).toEqual(["event_payment_prepare_v1"]);
});
test("event paid registration separates reviewed debt preparation, targeted bank collection and final native registration", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  state.event.interval = { starts_at: "2026-11-18T15:00:00Z", ends_at: "2026-11-18T16:00:00Z" };
  const financeSnapshots: string[][] = [];
  await page.route("**/functions/v1/backend-v1/finance_directory_get_v1", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      view: "movements",
    });
    const cash = state.cash;
    const items = cash
      ? [
          {
            id: cash.id,
            entity: { type: "cash_movements", id: cash.id },
            person_id: I.instructor,
            display_name: "Örnek Eğitmen",
            created_at: cash.occurred_at,
            occurred_at: cash.occurred_at,
            version: 1,
            kind: "collection",
            amount_minor: cash.amount_minor,
            currency: cash.currency,
            method: "bank_transfer",
            source_sale_id: null,
            product_name: null,
            due_at: null,
          },
        ]
      : [];
    financeSnapshots.push(items.map((item) => String(item.id)));
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          view: "movements",
          items,
          next_cursor: null,
          as_of: "2026-11-16T12:00:00Z",
          totals: [
            {
              currency: "TRY",
              sales_minor: "0",
              collections_minor: cash?.amount_minor ?? "0",
              refunds_minor: "0",
              debt_minor: "0",
              credit_minor: "0",
              debt_people: 0,
              credit_people: 0,
            },
          ],
        },
      },
    });
  });
  await mockCalendarEvent(page, state.event);
  const calendarEvent = page.getByRole("button", { name: /Etkinlik Tango atölyesi/ });
  const ledger = page.getByRole("grid", { name: "Hareketler", exact: true });
  const firstLedgerRead = page.waitForResponse(
    "**/functions/v1/backend-v1/finance_directory_get_v1",
  );
  await clickWorkspaceLink(page, "Finans");
  await (await firstLedgerRead).finished();
  await expect(ledger).toBeVisible();
  expect(financeSnapshots).toEqual([[]]);
  await clickWorkspaceLink(page, "Ders programı");
  await activate(calendarEvent, "Enter");
  await expect(page.getByRole("heading", { name: state.event.name, exact: true })).toBeVisible();
  const sheet = await paidRegistration(page);
  await expect(sheet.getByText(saved, { exact: true }).first()).toBeVisible();
  expect(state.writes.map((row) => row.op)).toEqual([
    "event_payment_prepare_v1",
    "collection_record_v1",
    "event_register_v1",
  ]);
  expect(state.writes[1]!.request).toMatchObject({
    person_id: I.instructor,
    currency: "TRY",
    debt_ids: [D.debt],
    payment: { method: "bank_transfer", reference: "SENTETIK-ODEME" },
  });
  expect(state.writes[2]!.request).toMatchObject({
    person_id: I.instructor,
    preparation_id: D.preparation,
    preview: { id: D.preview },
  });
  expect(state.event.registrations).toHaveLength(1);
  await activate(sheet.getByRole("button", { name: "Geri", exact: true }));
  // The registration is already acknowledged; dismiss through the ready sheet's close control.
  await closeWithDevice(sheet.getByRole("button", { name: /^(Close|Kapat|Vazgeç)$/ }).first());
  await expect(page.getByRole("row", { name: /Örnek Eğitmen/ })).toBeVisible();
  await clickWorkspaceLink(page, "Finans");
  await expect(ledger.getByRole("gridcell", { name: "TRY ₺450,00", exact: true })).toBeVisible();
  expect(financeSnapshots).toEqual([[], [D.cash]]);
  await clickWorkspaceLink(page, "Ders programı");
  await activate(calendarEvent, "Enter");
  await expect(page.getByRole("row", { name: /Örnek Eğitmen/ })).toBeVisible();
  expect(state.writes.map(({ op }) => op)).toEqual([
    "event_payment_prepare_v1",
    "collection_record_v1",
    "event_register_v1",
  ]);
});
test("event capacity race reports settled preparation without a participant or duplicate registration", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "capacity");
  const sheet = await paidRegistration(page);
  await expect(sheet.getByText(/Kayıt sırasında kontenjan doldu/)).toBeVisible();
  expect(state.event.registrations).toHaveLength(0);
  expect(state.payment).toMatchObject({
    state: "capacity_closed",
    remaining_minor: "0",
    credited_minor: "45000",
    registration_id: null,
  });
  expect(state.writes.filter((row) => row.op === "event_register_v1")).toHaveLength(1);
  await closeWithDevice(sheet.getByRole("button", { name: /^(Close|Kapat|Vazgeç)$/ }).first());
});
test("event closed attendance correction and performed duty each require a separate reviewed native command", async ({
  page,
  browser,
  browserName,
  isMobile,
}, testInfo) => {
  // The full native flow and the automatic final WCAG/layout scans took 39s
  // on mobile WebKit in CI. Preserve every assertion and scan with a bounded
  // per-scenario teardown budget; other projects retain their default.
  if (browserName === "webkit" && isMobile) testInfo.setTimeout(testInfo.timeout + 20_000);
  const state = await mockEventDetail(page);
  await page.clock.setFixedTime(new Date("2026-11-15T19:00:00Z"));
  await mockCalendarEvent(page, state.event);
  state.event.attendance_state = "closed";
  state.event.registrations!.push({
    id: D.registration,
    person_id: I.self,
    display_name: "Örnek kişi",
    state: "completed",
    attendance_result: "attended",
    version: 2,
  });
  state.event.duties!.push({
    id: D.debt,
    person_id: I.instructor,
    duty: "instructor",
    fee_minor: "12000",
    currency: "TRY",
    performed: null,
    verified_at: null,
    version: 1,
  });
  const assignment = state.event.duties![0]!;
  const earningId = "019ab7b0-0000-7000-8000-000000000105";
  const eventEarning = (): InstructorFinanceEarning["earning"] => ({
    id: earningId,
    person_id: assignment.person_id,
    center_id: I.center,
    session_id: null,
    event_assignment_id: assignment.id,
    amount_minor: "12000",
    currency: "TRY",
    paid_minor: "0",
    remaining_minor: "12000",
    previous_id: null,
    closure_id: null,
    direction: "add",
    created_at: assignment.verified_at!,
    version: 1,
    basis: { source: "event_fee", currency: "TRY", quantity: 1, excluded_blocked: 0 },
  });
  const earningSnapshots: string[][] = [];
  await page.route(
    "**/functions/v1/backend-v1/instructor_finance_directory_get_v1",
    async (route) => {
      const request = route.request().postDataJSON();
      expect(request).toMatchObject({ org_id: I.org, center_id: I.center });
      const items: InstructorFinanceEarning[] =
        request.view === "earnings" && assignment.performed
          ? [
              {
                kind: "earning",
                display_name: "Örnek Eğitmen",
                session_name: state.event.name,
                agreement_id: null,
                agreement_version: null,
                earning: eventEarning(),
              },
            ]
          : [];
      if (request.view === "earnings")
        earningSnapshots.push(
          items.map(({ earning }) => `${earning.id}:${earning.event_assignment_id}`),
        );
      await route.fulfill({
        json: {
          ok: true,
          trace_id: I.role,
          data: {
            view: request.view,
            items,
            next_cursor: null,
            as_of: "2026-11-15T19:00:00Z",
            closed_session_count: 0,
            totals: assignment.performed
              ? [
                  {
                    currency: "TRY",
                    earned_minor: "12000",
                    paid_minor: "0",
                    remaining_minor: "12000",
                    overpaid_minor: "0",
                  },
                ]
              : [],
          },
        },
      });
    },
  );
  const calendarEvent = page.getByRole("button", { name: /Etkinlik Tango atölyesi/ });
  const lines = page.getByRole("tab", { name: "Satırlar", exact: true });
  await clickWorkspaceLink(page, "Hakediş");
  const initialEarnings = page.waitForResponse(
    (response) =>
      response.url().endsWith("/instructor_finance_directory_get_v1") &&
      response.request().postDataJSON().view === "earnings",
  );
  await activate(lines);
  await (await initialEarnings).finished();
  expect(earningSnapshots).toEqual([[]]);
  await clickWorkspaceLink(page, "Ders programı");
  await activate(calendarEvent, "Enter");
  await activate(page.getByRole("tab", { name: "Yoklama", exact: true }));
  await activate(page.getByRole("button", { name: "Yoklamayı düzenle", exact: true }));
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Düzeltilecek katılımcı", { exact: true }).selectOption(D.registration);
  await activate(dialog.getByRole("radio", { name: "Gelmedi", exact: true }));
  await dialog
    .getByLabel("Gerekçe (zorunlu, geçmişe yazılır)", { exact: true })
    .fill("Katılımcı kaydı kontrol edildi");
  await accept(page, "Yoklamayı düzenle");
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  expect(state.event.registrations![0]!.attendance_result).toBe("no_show");
  await activate(page.getByRole("button", { name: "Etkinliği tamamla", exact: true }));
  const complete = await accept(page, "Etkinliği tamamla");
  await expect(complete.getByText(saved, { exact: true })).toBeVisible();
  await activate(complete.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("button", { name: "Doğrula", exact: true }));
  await expect(
    page.getByRole("alertdialog").getByRole("button", { name: "Doğrula", exact: true }),
  ).toBeDisabled();
  await activate(page.getByRole("radio", { name: "Görev yapıldı", exact: true }));
  const duty = await accept(page, "Doğrula");
  await expect(duty.getByText(saved, { exact: true })).toBeVisible();
  expect(state.event.duties![0]!.performed).toBe(true);
  expect(state.writes.map((row) => row.op)).toEqual([
    "event_attendance_correct_v1",
    "event_complete_v1",
    "event_duty_verify_v1",
  ]);
  await activate(duty.getByRole("button", { name: "Vazgeç", exact: true }));
  await clickWorkspaceLink(page, "Hakediş");
  await activate(lines);
  const earningRow = page.getByRole("row").filter({ hasText: state.event.name });
  await expect(earningRow).toContainText("₺120,00");
  expect(earningSnapshots).toEqual([[], [`${earningId}:${assignment.id}`]]);
  await clickWorkspaceLink(page, "Ders programı");
  await activate(calendarEvent, "Enter");
  await expect(page.getByRole("heading", { name: state.event.name, exact: true })).toBeVisible();
  expect(state.writes.filter(({ op }) => op === "event_duty_verify_v1")).toHaveLength(1);

  const instructor = await browser.newPage({ locale: "tr-TR", serviceWorkers: "block" });
  try {
    const self = await mockSessionDetail(instructor, { existing: true, instructor: true });
    await instructor.clock.setFixedTime(new Date("2026-11-15T19:00:00Z"));
    const selfSnapshots: string[] = [];
    await instructor.route("**/functions/v1/backend-v1/instructor_account_get_v1", (route) => {
      const request = route.request().postDataJSON();
      expect(request).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        person_id: I.instructor,
      });
      const row = request.view === "earnings" ? eventEarning() : undefined;
      if (row) selfSnapshots.push(`${row.id}:${row.event_assignment_id}`);
      return route.fulfill({
        json: {
          ok: true,
          trace_id: I.role,
          data: {
            view: request.view,
            items: row ? [row] : [],
            totals: [],
            next_cursor: null,
            as_of: "2026-11-15T19:00:00Z",
          },
        },
      });
    });
    await instructor.goto(`${origin}/instructor/earnings?org=${I.org}&center=${I.center}`);
    const selfRow = instructor.getByRole("row").filter({ hasText: "Etkinlik ücreti" });
    await expect(selfRow).toContainText("₺120,00");
    expect(selfSnapshots).toEqual(earningSnapshots.at(-1));
    expect(self.writes).toHaveLength(0);
  } finally {
    await instructor.close();
  }
});
test("event draft publication and participant cancellation preserve separate reviewed native targets", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  state.event.state = "draft";
  state.event.registrations!.push({
    id: D.registration,
    person_id: I.self,
    display_name: "Örnek kişi",
    state: "active",
    attendance_result: "unmarked",
    version: 1,
  });
  await page.reload();
  await activate(page.getByRole("button", { name: "Yayımla", exact: true }));
  const publish = await accept(page, "Yayımla");
  await expect(publish.getByText(saved, { exact: true })).toBeVisible();
  await activate(publish.getByRole("button", { name: "Vazgeç", exact: true }));
  const row = page.getByRole("row", { name: /Örnek kişi/ });
  await activate(row.getByRole("button", { name: "Kaydı iptal et", exact: true }));
  const cancel = page.getByRole("alertdialog");
  await cancel
    .getByLabel("Gerekçe (zorunlu, geçmişe yazılır)", { exact: true })
    .fill("Katılımcı talebi");
  await accept(page, "Kaydı iptal et");
  await expect(cancel.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes.map((entry) => entry.op)).toEqual([
    "event_publish_v1",
    "event_registration_cancel_v1",
  ]);
  expect(state.writes[1]!.request).toMatchObject({
    registration_id: D.registration,
    expected_version: 1,
    reason: "Katılımcı talebi",
  });
  expect(state.event.registrations![0]!.state).toBe("cancelled");
  await activate(cancel.getByRole("button", { name: "Vazgeç", exact: true }));
});
