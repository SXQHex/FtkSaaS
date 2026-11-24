import { activate, attemptOutsideDismissal } from "./device-input.js";
import { test, expect } from "./test.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
const saved = "Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.";
test("student own reservations keep separate native cursors, source package and self attendance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await mockOwnReservations(page);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  await expect(page.getByText(/^İptal et — Sentetik gelecek ders$/, { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByText("Sentetik geçmiş ders", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sentetik satın alınmış paket/)).toBeVisible();
  await expect(page.getByText(/Öğrenciye görünür eğitmen · Öğrenciye görünür salon/)).toBeVisible();
  await expect(page.getByText("Sınırdan önce: hak iade edilir", { exact: true })).toBeVisible();
  await expect(page.getByText("Sınırdan önce: hak tüketilir", { exact: true })).toHaveCount(0);
  await expect(page.getByText("İptal sınırı: 17 Kas 2026 16:00", { exact: true })).toBeVisible();
  const discovery = state.reads.filter(
    (row) => row.operation === "calendar_get_v1" && row.request.member_discovery,
  );
  expect(discovery).toHaveLength(1);
  expect(discovery[0]!.request).not.toHaveProperty("resource");
  expect(discovery[0]!.request.interval).toEqual({
    starts_at: "2026-11-17T15:00:00Z",
    ends_at: "2026-11-17T16:00:00Z",
  });
  await expect(page.getByRole("grid", { name: "Geçmiş", exact: true })).toContainText("Geldi");
  await expect(page.getByText("Başka üyenin gizli adı", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("grid", { name: "Geçmiş", exact: true }).getByText(/Gelmedi/),
  ).toHaveCount(0);
  await expect(
    page.getByText("Güncel bekleme listesi ve teklifler okunamadı.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Bekleme listesinde değilsin.", { exact: true })).toBeVisible();
  const initial = state.reads.filter((row) => row.operation === "reservation_list_v1");
  expect(initial).toHaveLength(2);
  expect(
    initial
      .map((row) => row.request.time_filter)
      .sort((a, b) => String(a).localeCompare(String(b))),
  ).toEqual(["past", "upcoming"]);
  expect(initial.find((row) => row.request.time_filter === "upcoming")!.request).toMatchObject({
    include_source_summary: true,
    page: { sort: "starts_at_asc" },
  });
  await activate(page.getByRole("button", { name: "Sonraki", exact: true }).first());
  await expect
    .poll(() => state.reads.filter((row) => row.operation === "reservation_list_v1").length)
    .toBe(3);
  expect(
    state.reads.filter((row) => row.operation === "reservation_list_v1").at(-1)!.request,
  ).toMatchObject({ time_filter: "upcoming", page: { cursor: "own-next" } });
  await expect(page.getByRole("button", { name: "Sonraki", exact: true }).first()).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test("student cancellation validates reason and rereads the actual cancelled reservation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const state = await mockOwnReservations(page);
  await activate(page.getByRole("button", { name: /^İptal et —/ }));
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await activate(dialog.getByRole("button", { name: "İptal et", exact: true }));
  await expect(dialog.getByLabel("Gerekçe", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await activate(dialog.getByRole("button", { name: "İptal et", exact: true }));
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await activate(dialog.getByRole("button", { name: "Kapat", exact: true }));
  await expect(page.getByRole("button", { name: /^İptal et —/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yeniden oku", exact: true })).toBeFocused();
});
test("Starter student keeps their own cancellable reservation after role plan denial", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { starter: true });
  await activate(page.getByRole("button", { name: /^İptal et —/ }));
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await activate(dialog.getByRole("button", { name: "İptal et", exact: true }));
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await activate(dialog.getByRole("button", { name: "Kapat", exact: true }));
  await expect(page.getByRole("button", { name: /^İptal et —/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Stüdyo", exact: true })).toHaveCount(0);
});
test("student cancellation unknown outcome reads receipt without a second writer", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { unknown: true });
  await activate(page.getByRole("button", { name: /^İptal et —/ }));
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await activate(dialog.getByRole("button", { name: "İptal et", exact: true }));
  await expect(
    dialog.getByText("Sonuç henüz doğrulanamadı. Aynı işlemle devam et.", {
      exact: true,
    }),
  ).toBeVisible();
  await attemptOutsideDismissal(dialog);
  await expect(dialog).toBeVisible();
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await activate(dialog.getByRole("button", { name: "Kapat", exact: true }));
});
test("student cancellation ACK recovery repeats only result reads", async ({ page }) => {
  const state = await mockOwnReservations(page, { ackUnread: true });
  await activate(page.getByRole("button", { name: /^İptal et —/ }));
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await activate(dialog.getByRole("button", { name: "İptal et", exact: true }));
  await expect(
    dialog.getByText("İptal alındı; güncel kayıtlar henüz okunamadı.", { exact: true }),
  ).toBeVisible();
  await activate(dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await activate(dialog.getByRole("button", { name: "Kapat", exact: true }));
});
test("a denied own list is unknown until retry and unrelated roles do not grant student scope", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { denied: true });
  await expect(page.getByText("Yaklaşan rezervasyonlar okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByText("Yaklaşan rezervasyonun yok.", { exact: true })).toHaveCount(0);
  state.setDenied(false);
  await activate(page.getByRole("button", { name: "Yeniden oku", exact: true }));
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
});
test("nonstudent cannot read personal reservations even with a valid native account", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { noStudent: true });
  await expect(
    page.getByText("Bu merkezde bağlı öğrencilik kapsamı okunamadı.", { exact: true }),
  ).toBeVisible();
  expect(state.reads.filter((row) => row.operation === "reservation_list_v1")).toHaveLength(0);
});
test("student cancellation action denial leaves the readable reservation intact", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { cancelDenied: true });
  await activate(page.getByRole("button", { name: /^İptal et —/ }));
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByText("Bu rezervasyon için iptal yetkisi veya güncel kaynak doğrulanamadı.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "İptal et", exact: true })).toBeDisabled();
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("student reservation policy stays unknown when discovery refers to another reservation version", async ({
  page,
}) => {
  await mockOwnReservations(page, { staleLesson: true });
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bu rezervasyonun iptal koşulları okunamadı/)).toBeVisible();
  await expect(page.getByText("Sınırdan önce: hak iade edilir", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sınırdan önce: hak tüketilir", { exact: true })).toHaveCount(0);
});
