import { test, expect } from "./test.js";
import {
  preparePublicCalendar as prepare,
  publicCalendarId as id,
} from "./public-calendar-fixture.js";
test("anonymous public calendar reads published fields and paginates with unchanged interval", async ({
  page,
}) => {
  const state = await prepare(page);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  await expect(page.getByText("18:00", { exact: true })).toBeVisible();
  await expect(page.getByText("Saat dilimi: Europe/Istanbul", { exact: true })).toBeVisible();
  await expect(page.getByText("₺500,00", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Ders türü", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Daha fazla göster", exact: true }).click();
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toBeVisible();
  expect(state.calls).toHaveLength(2);
  expect(state.calls[1]!.interval).toEqual(state.calls[0]!.interval);
  expect(state.calls[1]).toMatchObject({
    slug: "test-studio",
    center_id: id,
    page: { cursor: "next-page", limit: 50, sort: "starts_at_asc" },
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
});
test("public transport failure offers retry and never claims a closed publication", async ({
  page,
}) => {
  const state = await prepare(page, "error");
  await expect(page.getByText("Program yüklenemedi.", { exact: true })).toBeVisible();
  await expect(page.getByText("Bu sayfa şu an yayında değil", { exact: true })).toHaveCount(0);
  state.recover();
  await page.getByRole("button", { name: "Tekrar dene", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
});
test("next page failure preserves loaded rows and retries only the missing page", async ({
  page,
}) => {
  const state = await prepare(page);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  state.failNext();
  await page.getByRole("button", { name: "Daha fazla göster", exact: true }).click();
  await expect(
    page.getByText("Sonraki program sayfası yüklenemedi.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  state.recoverNext();
  await page.getByRole("button", { name: "Daha fazla göster", exact: true }).click();
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toBeVisible();
  expect(state.calls).toHaveLength(3);
});
test("empty anonymous result does not reveal private profile or invent application availability", async ({
  page,
  browserName,
  isMobile,
}) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await prepare(page, "empty");
  await expect(
    page.getByText("Bu aralıkta yayınlanan bir içerik yok.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Örnek Stüdyo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Başvur", exact: true })).toHaveCount(0);
  if (browserName === "webkit" && isMobile) {
    // Touch profiles have no Tab path to links, so focus the skip link directly.
    await page.getByRole("link", { name: "İçeriğe geç", exact: true }).focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(page.getByRole("link", { name: "İçeriğe geç", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#public-main$/);
});
test("malformed publication data fails closed without rendering duplicate rows", async ({
  page,
}) => {
  await prepare(page, "malformed");
  await expect(page.getByText("Program yüklenemedi.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toHaveCount(0);
});
test("an explicit native UTC record works without a profile timezone in dark narrow layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 750 });
  await page.addInitScript(
    'document.documentElement.dataset.theme="dark";document.documentElement.classList.add("dark");',
  );
  await prepare(page, "timezone");
  await expect(page.getByText("15:00", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Saat dilimi: UTC", {
      exact: true,
    }),
  ).toBeVisible();
});
