import { test, expect } from "./test.js";
import { mockStudio, openStudio, studioIds } from "./studio-fixture.js";

test("Studio enrollment: unknown person creation resumes without duplicating the person", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await page.getByRole("button", { name: "Eğitmen ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#new-instructor-name").fill("Yeni Fixture Eğitmen");
  await dialog.locator("#new-instructor-email").fill("new-instructor@example.invalid");
  state.nextWrite = "unknown";
  await dialog.getByRole("button", { name: "Kişiyi oluştur ve devam et", exact: true }).click();
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await retry.click();
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
  const state = await mockStudio(page);
  state.roles[0]!.accountAccessGranted = false;
  await openStudio(page);
  await page.getByRole("button", { name: "Eğitmen ekle", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Mevcut kişi", exact: true }).click();
  await dialog.getByRole("button", { name: "Kişi ara", exact: true }).click();
  await dialog.locator("#existing-instructor-person").selectOption(studioIds.instructor);
  await dialog.getByRole("button", { name: "Kuruluma devam et", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Hesap daveti gönder", exact: true }).click();
  await expect(dialog.getByText("Davet gönderim işi bekliyor.", { exact: true })).toBeVisible();
  expect(state.roles[0]!.accountAccessGranted).toBe(false);
  expect(state.effects).toEqual(["account_access_send_v1"]);
  await expect(dialog.locator("#instructor-role-grant")).toHaveCount(0);
  state.accountLinked = true;
  await dialog.getByRole("button", { name: "Hesap bağını kontrol et", exact: true }).click();
  const approval = dialog.getByRole("checkbox");
  await expect(approval).not.toBeChecked();
  await approval.focus();
  await page.keyboard.press("Space");
  await dialog.getByRole("button", { name: "Bağlı hesaba rolü uygula", exact: true }).click();
  await expect(page.getByRole("dialog").locator("#instructor-name")).toBeEditable();
  expect(state.effects).toEqual(["account_access_send_v1", "role_assign_v1"]);
  expect(state.roles).toHaveLength(1);
  expect(state.roles[0]).toMatchObject({ accountAccessGranted: true, version: 3 });
});
