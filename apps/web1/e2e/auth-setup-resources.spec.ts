import { test, expect } from "./test.js";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";

test("new rooms and capacities replace cached calendar choices without a document reload", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00Z"));
  const state = await mockStudio(page);
  await page.route("**/functions/v1/backend-v1/calendar_get_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-17T10:00:00Z" },
        trace_id: I.role,
      },
    }),
  );
  await openStudio(page);
  const lifetime = await page.evaluate("window.__setupLifetime = performance.timeOrigin");
  const menu = page.getByRole("navigation", { name: "Ana menü", exact: true });
  await menu.getByRole("link", { name: "Ders programı", exact: true }).click();
  const rooms = page.getByRole("combobox", { name: "Salon", exact: true });
  await expect(page.getByRole("button", { name: "Seans ekle", exact: true })).toBeEnabled();
  await expect(rooms.locator("option")).toHaveCount(2);
  await menu.getByRole("link", { name: "Stüdyo", exact: true }).click();
  await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
  for (const [name, capacity] of [
    ["Yeni küçük salon", 0],
    ["Yeni büyük salon", 24],
  ] as const) {
    await page.getByRole("button", { name: "Salon ekle", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Salon adı", exact: true }).fill(name);
    await dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true }).fill(String(capacity));
    await dialog.getByRole("button", { name: "Salonu ekle", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name, exact: true }).click();
    await expect(dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true })).toHaveValue(
      String(capacity),
    );
    await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  }
  await menu.getByRole("link", { name: "Ders programı", exact: true }).click();
  await expect(rooms.locator("option")).toHaveCount(4);
  for (const name of ["Yeni küçük salon", "Yeni büyük salon"])
    await expect(rooms.getByRole("option", { name, exact: true })).toHaveCount(1);
  expect(state.rooms.slice(-2).map((room) => room.capacity)).toEqual([0, 24]);
  expect(state.writes.map((write) => write.operation)).toEqual(["room_save_v1", "room_save_v1"]);
  expect(await page.evaluate("window.__setupLifetime === performance.timeOrigin")).toBe(true);
  expect(await page.evaluate("performance.timeOrigin")).toBe(lifetime);
});
