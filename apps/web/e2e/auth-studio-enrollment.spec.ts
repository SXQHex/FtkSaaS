import { activate } from "./device-input.js";
import { test, expect } from "./test.js";
import {
  mockStudio,
  openStudio,
  studioIds,
  studioScheduleChoice,
  mockStudioCalendar,
} from "./studio-fixture.js";

test("Studio enrollment: unknown person creation resumes without duplicating the person", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await activate(page.getByRole("button", { name: "Eğitmen ekle", exact: true }));
  const dialog = page.getByRole("dialog");
  await dialog.locator("#new-instructor-name").fill("Yeni Fixture Eğitmen");
  await dialog.locator("#new-instructor-email").fill("new-instructor@example.invalid");
  state.nextWrite = "unknown";
  await activate(dialog.getByRole("button", { name: "Kişiyi oluştur ve devam et", exact: true }));
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await activate(retry);
  await expect(
    page.getByRole("dialog").getByText("Yeni Fixture Eğitmen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Hesap daveti gönder", exact: true }),
  ).toBeEnabled();
  expect(
    state.people.filter((person) => person.display_name === "Yeni Fixture Eğitmen"),
  ).toHaveLength(1);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.key).toBe(state.writes[1]!.key);
  expect(state.effects).toEqual(["person_create_v1"]);
  expect(state.roles).toHaveLength(1);
});

test("Studio enrollment: queued invitation grants no access until link and explicit role approval", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-18T08:00:00Z"));
  const state = await mockStudio(page);
  await mockStudioCalendar(page);
  const foreign = {
    center_id: "019a7b00-0000-7000-8000-000000000901",
    kind: "instructor" as const,
    state: "active" as const,
  };
  state.people[0]!.relationships!.push(foreign);
  state.roles[0]!.accountAccessGranted = false;
  await openStudio(page);
  const lifetime = await page.evaluate("performance.timeOrigin");
  await studioScheduleChoice(page, studioIds.instructor, false);
  await activate(page.getByRole("button", { name: "Eğitmen ekle", exact: true }));
  let dialog = page.getByRole("dialog");
  await activate(dialog.getByRole("radio", { name: "Mevcut kişi", exact: true }));
  await activate(dialog.getByRole("button", { name: "Kişi ara", exact: true }));
  await dialog.locator("#existing-instructor-person").selectOption(studioIds.instructor);
  await activate(dialog.getByRole("button", { name: "Kuruluma devam et", exact: true }));
  dialog = page.getByRole("dialog");
  await activate(dialog.getByRole("button", { name: "Hesap daveti gönder", exact: true }));
  await expect(dialog.getByText("Davet gönderim işi bekliyor.", { exact: true })).toBeVisible();
  expect(state.roles[0]!.accountAccessGranted).toBe(false);
  expect(state.effects).toEqual(["account_access_send_v1"]);
  await expect(dialog.locator("#instructor-role-grant")).toHaveCount(0);
  state.accountLinked = true;
  await activate(dialog.getByRole("button", { name: "Hesap bağını kontrol et", exact: true }));
  const approval = dialog.getByRole("checkbox");
  await expect(approval).not.toBeChecked();
  await activate(approval, "Space");
  await activate(dialog.getByRole("button", { name: "Bağlı hesaba rolü uygula", exact: true }));
  await expect(page.getByRole("dialog").locator("#instructor-name")).toBeEditable();
  expect(state.effects).toEqual(["account_access_send_v1", "role_assign_v1"]);
  expect(state.roles).toHaveLength(1);
  expect(state.roles[0]).toMatchObject({ accountAccessGranted: true, version: 3 });
  await activate(page.getByRole("dialog").getByRole("button", { name: "Vazgeç", exact: true }));
  await studioScheduleChoice(page, studioIds.instructor, true);
  expect(state.people[0]!.relationships).toContainEqual(foreign);
  expect(await page.evaluate("performance.timeOrigin")).toBe(lifetime);
});
