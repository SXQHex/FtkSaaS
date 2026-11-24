import { test, expect } from "./test.js";
import { mockPublicCalendar, publicCalendarId } from "./public-calendar-fixture.js";
const checkAgain = "Yayın durumunu yeniden kontrol et";
const closed = "Bu sayfa şu an yayında değil";
test("unavailable route reads only anonymous source and retains center scope across refresh", async ({
  page,
}) => {
  const f = await mockPublicCalendar(page);
  f.packet.items = [];
  f.packet.next_cursor = null;
  f.packet.publication_state = "unavailable";
  f.packet.organization_profile = null;
  await page.goto(`/public/test-studio/unavailable?center_id=${publicCalendarId}`);
  await expect(page.getByRole("heading", { name: closed, exact: true })).toBeVisible();
  await expect(page.getByRole("form")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(f.calls[0]).toMatchObject({
    slug: "test-studio",
    center_id: publicCalendarId,
    mode: "context",
    page: {},
  });
  expect(f.calls[0]).not.toHaveProperty("include_disciplines");
  expect(f.calls[0]).not.toHaveProperty("interval");
  await expect(
    page
      .getByRole("navigation", { name: "Sayfa menüsü", exact: true })
      .getByRole("link", { name: "Program", exact: true }),
  ).toHaveAttribute("href", `/public/test-studio/calendar?center_id=${publicCalendarId}`);
  await page.reload();
  await expect(page.getByRole("heading", { name: closed, exact: true })).toBeVisible();
  expect(f.calls).toHaveLength(2);
});
test("source refresh distinguishes an available empty program from a closed publication and exposes the actual calendar target", async ({
  page,
}) => {
  const f = await mockPublicCalendar(page);
  f.packet.items = [];
  f.packet.next_cursor = null;
  f.packet.publication_state = "unavailable";
  await page.goto("/public/test-studio/unavailable");
  await expect(page.getByRole("heading", { name: closed, exact: true })).toBeVisible();
  f.packet.publication_state = "available";
  await page.getByRole("button", { name: checkAgain, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Program yayında.", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: closed, exact: true })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Program", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ders programı", exact: true })).toBeVisible();
  await expect(
    page.getByText("Bu aralıkta yayınlanan bir içerik yok.", { exact: true }),
  ).toBeVisible();
});
test("transport errors never masquerade as closed publication and retry reads current source", async ({
  page,
}) => {
  const f = await mockPublicCalendar(page, "error");
  await page.goto("/public/test-studio/unavailable");
  await expect(page.getByText("Yayın durumu okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: closed, exact: true })).toHaveCount(0);
  f.recover();
  f.packet.items = [];
  f.packet.next_cursor = null;
  f.packet.publication_state = "unavailable";
  await page.getByRole("button", { name: checkAgain, exact: true }).click();
  await expect(page.getByRole("heading", { name: closed, exact: true })).toBeVisible();
  f.setFailure(true);
  await page.getByRole("button", { name: checkAgain, exact: true }).click();
  await expect(page.getByText("Yayın durumu okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: closed, exact: true })).toHaveCount(0);
});
test("invalid public payload fails closed without declaring the publication unavailable", async ({
  page,
}) => {
  const f = await mockPublicCalendar(page, "malformed");
  await page.goto("/public/test-studio/unavailable");
  await expect(page.getByText("Yayın durumu okunamadı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: closed, exact: true })).toHaveCount(0);
  expect(f.calls).toHaveLength(1);
});
