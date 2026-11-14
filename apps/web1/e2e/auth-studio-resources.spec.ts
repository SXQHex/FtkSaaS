import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { mockStudio, openStudio, studioIds } from "./studio-fixture.js";

test("Studio resource: a class rename preserves its enabled waitlist without resending its flag", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.lessons[0]!.waitlist = true;
  await openStudio(page);
  await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
  await page.getByRole("button", { name: "Başlangıç grubu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = dialog.locator("#class-name");
  await expect(name).toBeEditable();
  await name.fill("Yenilenen grup adı");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.payload).toMatchObject({
    class_id: studioIds.lesson,
    expected_version: 4,
    name: "Yenilenen grup adı",
    external_open: false,
  });
  expect(state.writes[0]!.payload).not.toHaveProperty("waitlist_enabled");
  expect(state.lessons[0]).toMatchObject({ waitlist: true, version: 5 });
  expect(state.effects).toEqual(["class_save_v1"]);
});

test("Studio resource: split availability retries only the unknown step and preserves another period", async ({
  page,
}) => {
  const state = await mockStudio(page);
  const old = {
    id: "019a7b00-0000-7000-8000-000000000030",
    personId: studioIds.instructor,
    version: 6,
    rule: {
      weekdays: [5] as [number, ...number[]],
      local_start: "10:00:00",
      local_end: "12:00:00",
      valid_from: "2025-01-01",
      valid_until: "2026-01-01",
    },
  };
  state.rules.push(structuredClone(old));
  await openStudio(page);
  await page.getByRole("tab", { name: "Uygunluk", exact: true }).click();
  await page.locator("#availability-instructor").selectOption(studioIds.instructor);
  await page.locator("#availability-period").selectOption(JSON.stringify(["2026-11-01", null]));
  const monday = page.locator('input[id^="availability-monday-"][id$="-from"]');
  await expect(monday).toHaveValue("18:00:00");
  await monday.fill("19:00:00");
  state.nextWrite = "unknown";
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  const retry = page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  await expect(page.locator("#availability-instructor")).toBeDisabled();
  expect((await scanAccessibility(page, "studio-availability-unknown-step")).violations).toEqual(
    [],
  );
  await retry.click();
  await expect(
    page.getByText(
      "Uygunluk kuralları güncel kaynaktan okundu. Mevcut seanslar otomatik değiştirilmedi.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.writes).toHaveLength(3);
  expect(state.writes[0]!.key).toBe(state.writes[1]!.key);
  expect(state.writes[2]!.key).not.toBe(state.writes[0]!.key);
  expect(state.effects).toEqual(["availability_save_v1", "availability_save_v1"]);
  expect(state.rules.find((rule) => rule.id === old.id)).toEqual(old);
  expect(state.rules.find((rule) => rule.id === studioIds.availability)).toMatchObject({
    version: 4,
    rule: { weekdays: [3], local_start: "18:00:00" },
  });
  expect(state.rules.at(-1)).toMatchObject({
    version: 1,
    rule: { weekdays: [1], local_start: "19:00:00" },
  });
});
