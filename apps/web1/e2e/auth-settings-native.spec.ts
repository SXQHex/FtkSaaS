import { test, expect } from "./test.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { uid } from "./pro-completion-fixture.js";
import { origin } from "./auth-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
async function confirm(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", {
      name: "Kapsamı ve güncel etkileri okudum, bu değişikliği onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await dialog
    .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
    .click();
  return dialog;
}
test("public settings explicitly bind the selected form and published consent source with native versioned readback", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Yayın", exact: true }).click();
  await page.getByRole("button", { name: "Yayın ayarlarını düzenle", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("checkbox", { name: "Public profili göster", exact: true }).press("Space");
  await editor
    .getByRole("combobox", { name: "Etkin web formu", exact: true })
    .selectOption(uid(105));
  await expect(
    editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("textbox", { name: "Yayımlanmış belge kodu", exact: true })
    .fill("document.synthetic");
  await editor.getByRole("button", { name: "Belge sürümlerini oku", exact: true }).click();
  await editor
    .getByRole("combobox", { name: "Yayımlanmış metin", exact: true })
    .selectOption(uid(106));
  await editor.getByRole("textbox", { name: "Onay amacı", exact: true }).fill("application");
  await editor.getByRole("button", { name: "Onay kaynağını ekle", exact: true }).click();
  await editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true }).click();
  const review = await confirm(page);
  await expect.poll(() => f.writes.length).toBe(1);
  await expect(
    review.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
  expect(f.writes[0]!.r).toMatchObject({
    scope: "center",
    expected_version: 1,
    patch: {
      public_profile_enabled: true,
      public_application_form: {
        form_id: uid(105),
        consents: [
          {
            purpose: "application",
            version: "approved-1",
            required: true,
            content_template_id: uid(106),
          },
        ],
      },
    },
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Sayfayı yayınla", exact: true })).toBeChecked();
});
test("policy editing publishes a native protected change after review and keeps source scope and local instant", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await page.getByRole("tab", { name: "Politikalar", exact: true }).click();
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("spinbutton", { name: "Kapanış (dakika önce)", exact: true }).fill("120");
  await editor.locator('input[type="datetime-local"]').fill("2098-12-01T15:00");
  await editor
    .getByRole("textbox", { name: "Değişiklik gerekçesi", exact: true })
    .fill("Sentetik politika değişikliği");
  await editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true }).click();
  const review = await confirm(page);
  await expect.poll(() => f.writes.some((row) => row.op === "policy_publish_v1")).toBe(true);
  await expect(
    review.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
  const write = f.writes.find((row) => row.op === "policy_publish_v1")!.r;
  expect(write).toMatchObject({
    value: { kind: "window", closes_minutes_before: 120 },
    effective_at: "2098-12-01T12:00:00Z",
    mandatory: false,
    accepted_reservation_ids: [],
  });
  expect(write).not.toHaveProperty("center_id");
});
test("downgrade preserves the selected scope and period, then a stale Pro editor cannot publish after the native transition", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const f = await mockSettingsCompletion(page);
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Planı değiştir", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("radio", { name: /starter/ }).press("Space");
  await editor
    .getByRole("combobox", { name: "Korunacak merkez", exact: true })
    .selectOption(I.center);
  await editor.getByRole("combobox", { name: "Salon", exact: true }).selectOption(I.room);
  await editor.getByRole("combobox", { name: "Disiplin", exact: true }).selectOption(I.discipline);
  await editor.getByRole("combobox", { name: "Eğitmen", exact: true }).selectOption(I.instructor);
  await expect(
    editor.getByRole("checkbox", { name: "Sentetik öğrenci", exact: true }),
  ).not.toBeChecked();
  await editor.getByRole("button", { name: "Teklifi incele", exact: true }).click();
  const review = await confirm(page);
  await expect
    .poll(() => f.writes.some((row) => row.op === "subscription_downgrade_request_v1"))
    .toBe(true);
  await expect(
    review.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
  const write = f.writes.find((row) => row.op === "subscription_downgrade_request_v1")!.r;
  expect(write).toMatchObject({
    target_plan_id: uid(101),
    expected_version: 2,
    kept_center_id: I.center,
    kept_scope: {
      room_id: I.room,
      discipline_id: I.discipline,
      instructor_id: I.instructor,
      student_person_ids: [],
    },
  });
  expect(f.state.pending).toBe(true);
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  const base = `${origin}/o/${I.org}/c/${I.center}`;
  await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
  await page.goto(`${base}/studio`);
  await page.getByRole("tab", { name: "Anlaşmalar", exact: true }).click();
  await page.getByRole("button", { name: /Sentetik personel/ }).click();
  const staleEditor = page.getByRole("dialog");
  await staleEditor.getByLabel("Tutar (en küçük para birimi)", { exact: true }).fill("25000");
  await staleEditor.locator("#agreement-from").fill("2099-01-01T12:00");
  await staleEditor.locator("#agreement-until").fill("2100-01-01T12:00");
  await staleEditor.locator("#agreement-reason").fill("Sentetik eski Pro sekmesi");
  await staleEditor.getByRole("checkbox").press("Space");
  // A native period transition is authoritative even in an already-open editor.
  // Backend period/limit behavior is accepted separately in native CI.
  f.state.transitioned = true;
  let rejected = 0;
  await page.route("**/functions/v1/backend-v1/instructor_agreement_publish_v1", async (route) => {
    rejected++;
    expect(f.state.transitioned).toBe(true);
    return route.fulfill({
      json: {
        ok: false,
        error: { code: "PLAN_FEATURE_UNAVAILABLE", retryable: false, trace_id: I.role },
      },
    });
  });
  await staleEditor.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }).click();
  await expect(staleEditor.getByRole("status")).toContainText(common.studio.agreementRejected);
  expect(rejected).toBe(1);
  expect(f.studio.agreements).toHaveLength(1);
  expect(f.studio.effects).not.toContain("instructor_agreement_publish_v1");
  await staleEditor.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.goto(`${base}/settings`);
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await expect(page.getByText("Starter", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Planı değiştir", exact: true })).toBeDisabled();
});
test("team permission unknown state blocks scope and retries exactly one frozen grant before rereading effective permissions", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, { permissionUnknown: true });
  await page.getByRole("tab", { name: "Ekip", exact: true }).click();
  await page.getByRole("button", { name: "İzinleri seç", exact: true }).click();
  await page.getByRole("tab", { name: "İzinler", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Sentetik personel: Satış", exact: true })
    .press("Space");
  const dialog = await confirm(page);
  await expect(page.getByRole("combobox", { name: "Ayar kapsamı", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect.poll(() => f.writes.filter((row) => row.op === "permission_set_v1").length).toBe(2);
  const writes = f.writes.filter((row) => row.op === "permission_set_v1");
  expect(writes[0]!.r.operation_key).toBe(writes[1]!.r.operation_key);
  expect(writes[0]!.r).toMatchObject({
    person_id: I.instructor,
    permission: "sale.write",
    enabled: true,
    expected_version: 3,
  });
  await expect(
    dialog.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
});
test("operational team role is a separate reviewed command and native channel/template limits stay read-only on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Ekip", exact: true }).click();
  await page.getByRole("button", { name: "Görevi düzenle", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("checkbox", { name: /Asistan/ }).press("Space");
  await editor.getByRole("button", { name: "Değişiklikleri önizle", exact: true }).click();
  const review = await confirm(page);
  await expect.poll(() => f.writes.some((row) => row.op === "role_assign_v1")).toBe(true);
  await expect(
    review.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
  expect(f.writes.find((row) => row.op === "role_assign_v1")!.r).toMatchObject({
    person_id: I.instructor,
    role: "assistant",
    scope: { center_id: I.center },
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("tab", { name: "Şablonlar", exact: true }).click();
  await page.getByRole("button", { name: "Yönetim sınırı", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("platform içerik kataloğunda");
  await expect(sheet.getByRole("textbox").first()).toHaveAttribute("readonly", "");
  expect(f.writes.some((row) => row.op === "content_catalog_save_v1")).toBe(false);
});

test("manager directory binds role and state to scope and revokes through the dedicated org command", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Ekip", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Görev türü", exact: true })
    .selectOption("center_manager");
  const cm = page.getByRole("row").filter({ hasText: "Sentetik yönetici" });
  await expect(cm).toContainText("Merkez yöneticisi");
  expect(
    f.requests.filter((row) => row.op === "roles_list_v1" && row.r.role === "center_manager").at(-1)
      ?.r,
  ).toMatchObject({ center_id: I.center, state: "active" });
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  const om = page.getByRole("row").filter({ hasText: "Sentetik yönetici" });
  await expect(om).toContainText("Organizasyon yöneticisi");
  expect(
    f.requests.filter((row) => row.op === "roles_list_v1" && row.r.role === "org_manager").at(-1)
      ?.r,
  ).not.toHaveProperty("center_id");
  await om.getByRole("button", { name: "Görevi düzenle", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("checkbox", { name: "Organizasyon yöneticisi", exact: true })
    .press("Space");
  await editor
    .getByRole("textbox", { name: "Görev kaldırma gerekçesi", exact: true })
    .fill("Sentetik yönetici görevini kaldır");
  await editor.getByRole("button", { name: "Değişiklikleri önizle", exact: true }).click();
  const review = await confirm(page);
  await expect
    .poll(() => f.writes.filter((row) => row.op === "org_manager_revoke_v1").length)
    .toBe(1);
  const write = f.writes.find((row) => row.op === "org_manager_revoke_v1")!.r;
  expect(write).toMatchObject({
    person_id: uid(130),
    expected_version: 2,
    reason: "Sentetik yönetici görevini kaldır",
  });
  expect(write).not.toHaveProperty("center_id");
  expect(f.writes.some((row) => row.op === "role_revoke_v1")).toBe(false);
  await expect(
    review.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("combobox", { name: "Görev durumu", exact: true }).selectOption("inactive");
  await expect(page.getByRole("row").filter({ hasText: "Sentetik yönetici" })).toContainText(
    "Pasif",
  );
  expect(
    f.requests.filter((row) => row.op === "roles_list_v1" && row.r.role === "org_manager").at(-1)
      ?.r,
  ).toMatchObject({ state: "inactive", page: { limit: 20 } });
});
