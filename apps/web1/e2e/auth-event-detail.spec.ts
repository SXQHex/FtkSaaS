import { test, expect } from "./test.js";
import { mockEventDetail, detailIds as D } from "./event-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
async function accept(page: import("@playwright/test").Page, button: string) {
  const dialog = page.getByRole("alertdialog");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim, onaylıyorum.", exact: true })
    .press("Space");
  await dialog.getByRole("button", { name: button, exact: true }).click();
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
  await page.getByRole("tab", { name: "Yoklama", exact: true }).click();
  await page.getByLabel("Fiilî başlangıç", { exact: true }).fill("2026-11-15T18:05");
  await page.getByLabel("Gerekçe", { exact: true }).fill("Müzik sistemi geç açıldı");
  await page.getByRole("button", { name: "Fiilî başlangıcı kaydet", exact: true }).click();
  const start = await accept(page, "Fiilî başlangıcı kaydet");
  await expect(start.getByText(saved, { exact: true })).toBeVisible();
  await start.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(state.event.actual_started_at).toBe("2026-11-15T15:05:00Z");
  await page.getByRole("radio", { name: "Geldi", exact: true }).click();
  const mark = await accept(page, "Örnek kişi için yoklama");
  await expect(mark.getByText(saved, { exact: true })).toBeVisible();
  await mark.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(state.event.registrations![0]!.attendance_result).toBe("attended");
  await page.getByRole("button", { name: "Yoklamayı kapat", exact: true }).click();
  const close = await accept(page, "Yoklamayı kapat");
  await expect(close.getByText(saved, { exact: true })).toBeVisible();
  await close.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(state.event.attendance_state).toBe("closed");
});
test("event unknown result keeps the frozen action and recovers its exact receipt without another write", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "unknown");
  await page.getByRole("button", { name: "Etkinliği tamamla", exact: true }).click();
  const dialog = await accept(page, "Etkinliği tamamla");
  await expect(dialog.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toBe(1);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
test("event acknowledged write retries result reads and never repeats the command", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "unread");
  await page.getByRole("button", { name: "Etkinliği tamamla", exact: true }).click();
  const dialog = await accept(page, "Etkinliği tamamla");
  await expect(dialog.getByText(/güncel sonuç henüz okunamadı/)).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
test("event native authority denial does not manufacture a successful mutation", async ({
  page,
}) => {
  const state = await mockEventDetail(page, "denied");
  await page.getByRole("button", { name: "Etkinliği tamamla", exact: true }).click();
  const dialog = await accept(page, "Etkinliği tamamla");
  await expect(dialog.getByRole("alert").last()).toBeVisible();
  expect(state.writes).toHaveLength(0);
  expect(state.event.state).toBe("published");
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
test("event cancellation exposes server effects before its separately reviewed apply", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
  await page.getByRole("button", { name: "Etkinliği iptal et", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog
    .getByLabel("Gerekçe (zorunlu, geçmişe yazılır)", { exact: true })
    .fill("Salon kullanılamıyor");
  await accept(page, "İptal etkilerini oku");
  expect(state.writes).toHaveLength(0);
  await expect(dialog.getByText(/sunucunun güncel önizlemesidir/)).toBeVisible();
  await accept(page, "Etkinliği iptal et");
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.event.state).toBe("cancelled");
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
async function paidRegistration(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Katılımcı ekle", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Kişi", { exact: true }).selectOption(I.instructor);
  await sheet.getByRole("button", { name: "Devam", exact: true }).click();
  await sheet.getByRole("button", { name: "Ödeme hazırlığını oluştur", exact: true }).click();
  const prepare = await accept(page, "Ödeme hazırlığını oluştur");
  await expect(prepare.getByText(saved, { exact: true })).toBeVisible();
  await prepare.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await sheet.getByRole("radio", { name: "Şimdi tahsil edilecek", exact: true }).click();
  await sheet.getByLabel("Tutar (alt birim)", { exact: true }).fill("45000");
  await sheet.getByLabel("Yöntem", { exact: true }).selectOption("bank_transfer");
  await sheet.getByLabel("Referans", { exact: true }).fill("SENTETIK-ODEME");
  await sheet.getByLabel("Tahsilat tarihi ve saati", { exact: true }).fill("2026-11-16T15:00");
  await sheet.getByRole("button", { name: "Tahsilatı incele", exact: true }).click();
  const collect = await accept(page, "Tahsilatı kaydet");
  await expect(collect.getByText(saved, { exact: true })).toBeVisible();
  await collect.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await sheet.getByRole("button", { name: "Devam", exact: true }).click();
  await sheet.getByRole("checkbox", { name: "Kaydı onaylıyorum", exact: true }).press("Space");
  await sheet.getByRole("button", { name: "Kaydı onayla", exact: true }).click();
  return sheet;
}
test("event paid registration separates reviewed debt preparation, targeted bank collection and final native registration", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
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
  await sheet.getByRole("button", { name: "Geri", exact: true }).click();
  // The registration is already acknowledged; dismiss through the ready sheet's close control.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("row", { name: /Örnek Eğitmen/ })).toBeVisible();
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
  await page.keyboard.press("Escape");
});
test("event closed attendance correction and performed duty each require a separate reviewed native command", async ({
  page,
}) => {
  const state = await mockEventDetail(page);
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
  await page.reload();
  await page.getByRole("tab", { name: "Yoklama", exact: true }).click();
  await page.getByRole("button", { name: "Yoklamayı düzenle", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Düzeltilecek katılımcı", { exact: true }).selectOption(D.registration);
  await dialog.getByRole("radio", { name: "Gelmedi", exact: true }).click();
  await dialog
    .getByLabel("Gerekçe (zorunlu, geçmişe yazılır)", { exact: true })
    .fill("Katılımcı kaydı kontrol edildi");
  await accept(page, "Yoklamayı düzenle");
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(state.event.registrations![0]!.attendance_result).toBe("no_show");
  await page.getByRole("button", { name: "Etkinliği tamamla", exact: true }).click();
  const complete = await accept(page, "Etkinliği tamamla");
  await expect(complete.getByText(saved, { exact: true })).toBeVisible();
  await complete.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "Doğrula", exact: true }).click();
  await expect(
    page.getByRole("alertdialog").getByRole("button", { name: "Doğrula", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "Görev yapıldı", exact: true }).click();
  const duty = await accept(page, "Doğrula");
  await expect(duty.getByText(saved, { exact: true })).toBeVisible();
  expect(state.event.duties![0]!.performed).toBe(true);
  expect(state.writes.map((row) => row.op)).toEqual([
    "event_attendance_correct_v1",
    "event_complete_v1",
    "event_duty_verify_v1",
  ]);
  await duty.getByRole("button", { name: "Vazgeç", exact: true }).click();
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
  await page.getByRole("button", { name: "Yayımla", exact: true }).click();
  const publish = await accept(page, "Yayımla");
  await expect(publish.getByText(saved, { exact: true })).toBeVisible();
  await publish.getByRole("button", { name: "Vazgeç", exact: true }).click();
  const row = page.getByRole("row", { name: /Örnek kişi/ });
  await row.getByRole("button", { name: "Kaydı iptal et", exact: true }).click();
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
  await cancel.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
