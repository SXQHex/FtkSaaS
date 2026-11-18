import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { mockOwnPrivateLessons, openOwnRequestForm } from "./member-private-lessons-fixture.js";
const saved = "İşlem kaydedildi; güncel talep yeniden okundu.";
test("member request list shows a skeleton until the private lesson rows arrive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  let release!: () => void;
  const listGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = await mockOwnPrivateLessons(page, { listGate });
  try {
    await expect(page.getByRole("status")).toContainText("Özel ders talepleri okunuyor…");
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(1);
    await expect(page.getByText("Güncel özel ders talepleri okunamadı.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yeni talep", exact: true })).toBeDisabled();
  } finally {
    release();
  }
  const rows = page.getByRole("listitem").filter({ hasText: "Özel ders · Örnek Eğitmen" });
  await expect(rows).toHaveCount(2);
  await expect(rows.getByText("Alternatifi kabul et", { exact: true })).toHaveCount(1);
  await expect(rows.getByText("Talebi geri çek", { exact: true })).toHaveCount(2);
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  expect(state.writes).toHaveLength(0);
});
test("member sends a native private lesson request after validation without reserving rights", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await mockOwnPrivateLessons(page);
  await page.getByRole("button", { name: "Yeni talep", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Talebi gönder", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "Disiplin", exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "member-request-invalid-form")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await openOwnRequestForm(page);
  await dialog.getByLabel("Tarih", { exact: true }).fill("2026-11-15");
  await dialog.getByRole("button", { name: "Talebi gönder", exact: true }).click();
  await expect(dialog.getByText("Geçmiş bir saat seçtin.").first()).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog.getByLabel("Tarih", { exact: true }).fill("2026-11-20");
  await dialog.getByRole("radio", { name: "60 dk", exact: true }).click();
  await expect(dialog.getByLabel("Not (isteğe bağlı)", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Talebi gönder", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.request).toMatchObject({
    requested_start: "2026-11-20T13:00:00Z",
    duration_minutes: 60,
  });
  expect(state.writes[0]!.request).not.toHaveProperty("reason");
  expect(state.writes[0]!.request).not.toHaveProperty("window_exception");
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(
    state.reads.filter((row) =>
      ["reservation_create_v1", "entitlements_get_v1", "lesson_request_approve_v1"].includes(
        row.operation,
      ),
    ),
  ).toHaveLength(0);
});
test("member accepts an alternative but still waits for center approval", async ({ page }) => {
  const state = await mockOwnPrivateLessons(page);
  await page.getByRole("button", { name: "Alternatifi kabul et", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").press("Space");
  expect((await scanAccessibility(page, "member-alternative-review")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Kabul et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Alternatif kabul edildi; merkez onayı bekleniyor.", { exact: true }),
  ).toBeVisible();
  expect(state.requests[1]!.state).toBe("alternative_offered");
  expect(state.writes.map((row) => row.operation)).toEqual([
    "lesson_request_accept_alternative_v1",
  ]);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Alternatifi kabul et", exact: true })).toHaveCount(
    0,
  );
});
test("a fresh backend timestamp closes the offer even when the browser clock lags", async ({
  page,
}) => {
  const state = await mockOwnPrivateLessons(page);
  await page.getByRole("button", { name: "Alternatifi kabul et", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").press("Space");
  state.setAsOf("2026-11-19T14:00:00Z");
  await dialog.getByRole("button", { name: "Kabul et", exact: true }).click();
  await expect(dialog.getByText(/Talep değişti veya işlem artık kullanılamıyor/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.reload();
  await expect(page.getByText("Özel ders · Örnek Eğitmen", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Alternatifi kabul et", exact: true })).toHaveCount(
    0,
  );
});
test("member withdraws the entire request with explicit confirmation", async ({ page }) => {
  const state = await mockOwnPrivateLessons(page);
  await page.getByRole("button", { name: "Talebi geri çek", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Geri çek", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Geri çek", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.requests[0]!.state).toBe("withdrawn");
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("unknown request creation recovers the receipt with no second writer", async ({ page }) => {
  const state = await mockOwnPrivateLessons(page, { unknown: true });
  const dialog = await openOwnRequestForm(page);
  await dialog.getByRole("button", { name: "Talebi gönder", exact: true }).click();
  await expect(
    dialog.getByText("Sonuç bilinmiyor; aynı isteği yeniden dene veya işlem durumunu oku.", {
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
test("acknowledged request creation repeats only result reads", async ({ page }) => {
  const state = await mockOwnPrivateLessons(page, { ackUnread: true });
  const dialog = await openOwnRequestForm(page);
  await dialog.getByRole("button", { name: "Talebi gönder", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("a changed request version clears consent before a fresh withdrawal", async ({ page }) => {
  const state = await mockOwnPrivateLessons(page, { stale: true });
  await page.getByRole("button", { name: "Talebi geri çek", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Geri çek", exact: true }).click();
  await expect(
    dialog.getByText("Talep değişti veya işlem artık kullanılamıyor. Güncel kaydı yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Geri çek", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.request.expected_version).toBe(3);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("list and catalog failures remain readable unknown states until retry", async ({ page }) => {
  const state = await mockOwnPrivateLessons(page, { denied: true, catalogDenied: true });
  await expect(
    page.getByText("Güncel özel ders talepleri okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Henüz talebin yok.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Yeni talep", exact: true })).toBeDisabled();
  state.setDenied(false);
  state.setCatalogDenied(false);
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yeni talep", exact: true })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Talebi geri çek", exact: true }).first(),
  ).toBeVisible();
});
test("member sees native center approval and rejection after reread and reload", async ({
  page,
}) => {
  const state = await mockOwnPrivateLessons(page);
  await expect(
    page.getByRole("button", { name: "Alternatifi kabul et", exact: true }),
  ).toBeVisible();
  state.requests[0]!.state = "approved";
  state.requests[0]!.reservation_id = "019a7b00-0000-7000-8000-000000000399";
  state.requests[0]!.version++;
  state.requests[1]!.state = "rejected";
  state.requests[1]!.version++;
  state.requests[1]!.alternatives[0]!.state = "superseded";
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(
    page.locator('[data-slot="badge"]:visible').filter({ hasText: /^Onaylandı$/ }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="badge"]:visible').filter({ hasText: /^Reddedildi$/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Talebi geri çek", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('[data-slot="badge"]:visible').filter({ hasText: /^Onaylandı$/ }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="badge"]:visible').filter({ hasText: /^Reddedildi$/ }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Temayı değiştir", exact: true }).click();
});
