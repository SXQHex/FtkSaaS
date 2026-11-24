import { activate, closeWithDevice } from "./device-input.js";
import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
test("states unknown URL uses the shared focused not-found page instead of the router default", async ({
  page,
}) => {
  await page.goto("/__web1_missing_page");
  const heading = page.getByRole("heading", { name: "Sayfa bulunamadı", exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("link", { name: "Yardım", exact: true })).toHaveAttribute(
    "href",
    "/help",
  );
});
test("states development gallery has twelve local examples and safe keyboard conflict recovery", async ({
  page,
}) => {
  const backendCalls: string[] = [];
  page.on("request", (request) => {
    if (/\/functions\/v1|\/auth\/v1/.test(request.url())) backendCalls.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("http://127.0.0.1:4174/login?__states_example=1");
  await expect(page.getByRole("heading", { name: "Durum ekranları", exact: true })).toBeVisible();
  await expect(page.locator("[data-state-example]")).toHaveCount(12);
  await activate(page.getByRole("button", { name: "Animasyonu durdur", exact: true }));
  const open = page.getByRole("button", { name: "Çakışmayı aç", exact: true });
  await activate(open, "Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /üzerine yaz/i })).toHaveCount(0);
  expect((await scanAccessibility(page, "states-conflict-dialog")).violations).toEqual([]);
  await closeWithDevice(dialog.getByRole("button", { name: /^(Close|Kapat|Vazgeç)$/ }).first());
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await activate(open);
  await activate(dialog.getByRole("button", { name: "Güncel kaydı yükle", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-state-example=conflict]")).toContainText(
    "Yerel örnek eylemi çalıştı; gerçek kayıt değiştirilmedi.",
  );
  await activate(page.locator("[data-state-example=notFound]").getByRole("button"));
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı", exact: true })).toBeVisible();
  await activate(page.getByRole("button", { name: "Örneklere dön", exact: true }));
  await expect(page.locator("[data-state-example]")).toHaveCount(12);
  expect(backendCalls).toEqual([]);
});
test("states loading is indeterminate and respects reduced motion without false percentage", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:4174/login?__states_example=1");
  const loading = page.locator("[data-state-example=loading]");
  await expect(loading.getByRole("progressbar", { name: "Yükleniyor", exact: true })).toBeVisible();
  await expect(loading.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  await expect(loading.locator("[data-slot=spinner]")).toHaveCSS("animation-duration", "6s");
  await expect(loading.locator("[data-slot=skeleton]").first()).toHaveCSS("animation-name", "none");
  await activate(page.getByRole("button", { name: "Animasyonu durdur", exact: true }));
  await expect(loading.locator("[data-slot=spinner]")).toHaveCSS("animation-play-state", "paused");
  await activate(page.getByRole("button", { name: "Animasyonu sürdür", exact: true }));
  await expect(loading.locator("[data-slot=spinner]")).toHaveCSS("animation-play-state", "running");
  await activate(page.getByRole("button", { name: "Animasyonu durdur", exact: true }));
});
test("states example query is inert outside the development mode", async ({ page }) => {
  await page.goto("/login?__states_example=1");
  await expect(
    page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Durum ekranları", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-state-example]")).toHaveCount(0);
});
