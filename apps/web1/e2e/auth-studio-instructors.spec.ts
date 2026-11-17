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
    {
      kind: "email",
      value: "first@example.invalid",
      verified_at: null,
      field_policy: { source: "person", person_update_writable: true },
    },
    {
      kind: "email",
      value: "preserved@example.invalid",
      verified_at: "2026-11-01T00:00:00Z",
      field_policy: { source: "native_auth", person_update_writable: false },
    },
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
    {
      kind: "email",
      value: "preserved@example.invalid",
      verified_at: "2026-11-01T00:00:00Z",
      field_policy: { source: "native_auth", person_update_writable: false },
    },
    {
      kind: "email",
      value: "changed@example.invalid",
      field_policy: { source: "person", person_update_writable: true },
    },
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

for (const width of [1440, 320]) {
  test(`Studio person policy: protected identity and explicit local contact at ${width}px`, async ({
    page,
  }) => {
    const state = await mockStudio(page);
    state.people[0]!.field_policy!.display_name = {
      source: "account_profile",
      person_update_writable: false,
    };
    state.people[0]!.contacts = [
      {
        kind: "email",
        value: "native@example.invalid",
        field_policy: { source: "native_auth", person_update_writable: false },
      },
      {
        kind: "email",
        value: "local@example.invalid",
        verified_at: "2026-11-01T00:00:00Z",
        field_policy: { source: "person", person_update_writable: true },
      },
    ];
    await openStudio(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: /Örnek Eğitmen/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#instructor-name")).toHaveAttribute("readonly", "");
    await expect(dialog.locator("#instructor-name-source")).toContainText("Hesap profilinden");
    await expect(dialog.locator("#instructor-email")).toHaveAttribute("readonly", "");
    await expect(dialog.locator("#instructor-email-hint")).toContainText("Giriş hesabından");
    const select = dialog.getByLabel("İletişim e-postası seç", { exact: true });
    await select.focus();
    await expect(select).toBeFocused();
    await select.selectOption("1");
    await page.keyboard.press("Tab");
    await expect(dialog.locator("#instructor-email")).toBeFocused();
    await expect(dialog.locator("#instructor-email")).toHaveValue("local@example.invalid");
    await expect(dialog.locator("#instructor-email")).toBeEditable();
    expect(state.writes).toEqual([]);
    await dialog.locator("#instructor-email").fill("changed@example.invalid");
    await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(
      dialog.getByText("İşlemler kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.locator("#instructor-email")).toHaveValue("changed@example.invalid");
    expect(state.effects).toEqual(["person_update_v1"]);
    expect(state.people[0]!.contacts?.[0]).toMatchObject({
      value: "native@example.invalid",
      field_policy: { source: "native_auth", person_update_writable: false },
    });
    await select.selectOption("new");
    await dialog.locator("#instructor-email").fill("added@example.invalid");
    expect(state.effects).toHaveLength(1);
    await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(
      dialog.getByText("İşlemler kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.locator("#instructor-email")).toHaveValue("added@example.invalid");
    expect(state.people[0]!.contacts?.map((contact) => contact.value)).toEqual([
      "native@example.invalid",
      "changed@example.invalid",
      "added@example.invalid",
    ]);
    expect((await scanAccessibility(page, `studio-person-policy-${width}`)).violations).toEqual([]);
    for (const field of ["#instructor-name", "#instructor-email-choice", "#instructor-email"]) {
      const box = await dialog.locator(field).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  });
}

test("Studio person policy: omitted metadata remains read-only without blocking an explicit new contact", async ({
  page,
}) => {
  const state = await mockStudio(page);
  delete state.people[0]!.field_policy;
  state.people[0]!.contacts = [
    { kind: "email", value: "unknown@example.invalid", verified_at: "2026-11-01T00:00:00Z" },
  ];
  await openStudio(page);
  await page.getByRole("button", { name: /Örnek Eğitmen/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#instructor-name")).toHaveAttribute("readonly", "");
  await expect(dialog.locator("#instructor-email")).toHaveAttribute("readonly", "");
  await expect(dialog.locator("#instructor-name-source")).toContainText("henüz doğrulanamadı");
  await dialog.getByLabel("İletişim e-postası seç", { exact: true }).selectOption("new");
  await expect(dialog.locator("#instructor-email")).toBeEditable();
  expect(state.writes).toEqual([]);
});
