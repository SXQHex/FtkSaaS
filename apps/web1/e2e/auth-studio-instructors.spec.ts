import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { mockStudio, openStudio, studioIds } from "./studio-fixture.js";

async function openInstructor(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Örnek Eğitmen/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#instructor-name")).toBeEditable();
  return dialog;
}

test("Studio instructor: acknowledged contact edit is not replayed when class grant is unknown", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.people[0]!.contacts = [
    { kind: "email", value: "first@example.invalid", verified_at: null },
    { kind: "email", value: "preserved@example.invalid", verified_at: "2026-11-01T00:00:00Z" },
  ];
  await openStudio(page);
  const dialog = await openInstructor(page);
  await dialog.locator("#instructor-email").fill("changed@example.invalid");
  const lesson = dialog.getByRole("checkbox", { name: "Başlangıç grubu", exact: true });
  await lesson.focus();
  await page.keyboard.press("Space");
  const approval = dialog.getByRole("checkbox", {
    name: "Sınıf ve disiplin bağlarındaki değişiklikleri ve gelecek seanslara etkisini onaylıyorum.",
    exact: true,
  });
  await approval.focus();
  await page.keyboard.press("Space");
  state.unknownOperation = "class_assignment_set_v1";
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  expect(state.writes.map((write) => write.operation)).toEqual([
    "person_update_v1",
    "class_assignment_set_v1",
  ]);
  expect((await scanAccessibility(page, "studio-instructor-partial-unknown")).violations).toEqual(
    [],
  );
  await retry.click();
  await expect(
    dialog.getByText("İşlemler kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  expect(state.writes.map((write) => write.operation)).toEqual([
    "person_update_v1",
    "class_assignment_set_v1",
    "class_assignment_set_v1",
  ]);
  expect(state.writes[1]!.key).toBe(state.writes[2]!.key);
  expect(state.effects).toEqual(["person_update_v1", "class_assignment_set_v1"]);
  expect(state.people[0]!.contacts).toEqual([
    { kind: "email", value: "preserved@example.invalid", verified_at: "2026-11-01T00:00:00Z" },
    { kind: "email", value: "changed@example.invalid" },
  ]);
  expect(state.assignments).toEqual([
    expect.objectContaining({
      classId: studioIds.lesson,
      personId: studioIds.instructor,
      active: true,
      version: 1,
    }),
  ]);
});

test("Studio instructor: revocation keeps its preview and key through an unknown result", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const sheet = await openInstructor(page);
  await sheet.getByRole("button", { name: "Eğitmen rolünü kaldır", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Eğitmen rolünü kaldır", exact: true });
  await expect(
    dialog.getByText("Bu önizlemede etkilenen gelecek seans bulunmuyor.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await dialog.locator("#instructor-revoke-reason").fill("Fixture görev sona erdi");
  await dialog.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  state.nextWrite = "unknown";
  await dialog.getByRole("button", { name: "Rolü kaldır", exact: true }).click();
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect((await scanAccessibility(page, "studio-instructor-revoke-unknown")).violations).toEqual(
    [],
  );
  await retry.click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.key).toBe(state.writes[1]!.key);
  expect(state.effects).toEqual(["role_revoke_v1"]);
  expect(state.roles[0]).toMatchObject({ active: false, version: 3 });
});
