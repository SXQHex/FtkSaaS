import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const org = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002";
test("public center calendar preserves scope and pagination with narrow enlarged accessible content", async ({
  page,
}) => {
  const calls: { center_id?: string; cursor?: string }[] = [];
  await page.route("**/api/public/calendar", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        ok: true,
        data: {
          items: [
            {
              publication_id: org,
              kind: "event",
              title: "Sentetik açık etkinlik",
              interval: { starts_at: "2026-11-08T12:00:00Z", ends_at: "2026-11-08T13:00:00Z" },
              discipline_ids: [],
              venue_public_label: "Örnek stüdyo",
              currency: "TRY",
              fee_minor: "10000",
              public_conditions: "Bu yalnız sentetik ekran kabulüdür.",
            },
          ],
          next_cursor: route.request().postDataJSON().cursor ? null : "synthetic-next",
          as_of: "2026-11-07T00:00:00Z",
          center_profile: { name: "Örnek merkez" },
        },
      },
    });
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto(`/p/${org}?center=${center}`);
  await expect(page.getByRole("heading", { name: "Sentetik açık etkinlik" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Örnek merkez" })).toBeVisible();
  expect(calls[0].center_id).toBe(center);
  await page.getByRole("button", { name: "Sonraki yayınlar" }).press("Enter");
  await expect.poll(() => calls.at(-1)?.cursor).toBe("synthetic-next");
  expect(calls.at(-1)).toMatchObject({ center_id: center, cursor: "synthetic-next" });
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("lead deep link requires native login and retains the complete scoped destination", async ({
  page,
}) => {
  const path = `/organizasyon/${org}/merkez/${center}/aday/${org}/${center}`;
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Hesabına giriş yap" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  await page.goto(`/p/${org}?center=invalid`);
  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
});
