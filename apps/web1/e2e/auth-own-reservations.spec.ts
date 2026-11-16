import { test, expect } from "./test.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
const saved = "Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.";
test("student own reservations keep separate native cursors, source package and self attendance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await mockOwnReservations(page);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik geçmiş ders", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sentetik satın alınmış paket/)).toBeVisible();
  await expect(page.getByRole("grid", { name: "Geçmiş", exact: true })).toContainText("Geldi");
  await expect(page.getByText("Başka üyenin gizli adı", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Gelmedi/)).toHaveCount(0);
  await expect(
    page.getByText("Güncel bekleme listesi ve teklifler okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bekleme listesinde değilsin.", { exact: true })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Sonraki", exact: true }).first().click();
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
  await page.getByRole("button", { name: /^İptal et —/ }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(dialog.getByLabel("Gerekçe", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("button", { name: /^İptal et —/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yeniden oku", exact: true })).toBeFocused();
});
test("student cancellation unknown outcome reads receipt without a second writer", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { unknown: true });
  await page.getByRole("button", { name: /^İptal et —/ }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    dialog.getByText("Sonuç henüz doğrulanamadı. Aynı işlemle devam et.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("student cancellation ACK recovery repeats only result reads", async ({ page }) => {
  const state = await mockOwnReservations(page, { ackUnread: true });
  await page.getByRole("button", { name: /^İptal et —/ }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Katılamayacağım");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    dialog.getByText("İptal alındı; güncel kayıtlar henüz okunamadı.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("a denied own list is unknown until retry and unrelated roles do not grant student scope", async ({
  page,
}) => {
  const state = await mockOwnReservations(page, { denied: true });
  await expect(page.getByText("Yaklaşan rezervasyonlar okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByText("Yaklaşan rezervasyonun yok.", { exact: true })).toHaveCount(0);
  state.setDenied(false);
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
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
  await page.getByRole("button", { name: /^İptal et —/ }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByText("Bu rezervasyon için iptal yetkisi veya güncel kaynak doğrulanamadı.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "İptal et", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
