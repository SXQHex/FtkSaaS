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
test("command palette opens a settings section in the current managed center", async ({ page }) => {
  const fixture = await mockSettingsCompletion(page);
  await page.getByRole("button", { name: "Ara… Ctrl K", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sayfalarda ara", exact: true });
  const search = dialog.getByPlaceholder("Sayfa adı ara…");
  await expect(search).toBeFocused();
  await search.fill("Politikalar");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`/o/${I.org}/c/${I.center}/settings\\?section=politika$`),
  );
  await expect(page.getByRole("tab", { name: "Politikalar", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.reload();
  await expect(page.getByRole("tab", { name: "Politikalar", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(fixture.writes).toEqual([]);
});

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
  await expect(
    page.getByRole("switch", { name: "Ziyaretçi profili görünür", exact: true }),
  ).toBeChecked();
});
test("publication settings share the scoped visitor route and preview live closed and open states", async ({
  page,
  context,
}) => {
  const f = await mockSettingsCompletion(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await page.getByRole("tab", { name: "Yayın", exact: true }).click();
  const centerUrl = `${origin}/public/${I.org}/calendar?center_id=${I.center}`;
  const address = page.getByRole("textbox", { name: "Sayfa adresi", exact: true });
  await expect(address).toHaveValue(centerUrl);
  await expect(address).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Bağlantıyı kopyala", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Yayın bağlantısı kopyalandı." }),
  ).toBeVisible();
  expect(await page.evaluate("navigator.clipboard.readText()")).toBe(centerUrl);

  let available = false;
  await page.route("**/api/public/calendar", (route) => {
    const request = route.request();
    expect(request.headers()).not.toHaveProperty("authorization");
    expect(request.headers()).not.toHaveProperty("apikey");
    expect(request.postDataJSON()).toMatchObject({ slug: I.org, center_id: I.center });
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: [],
          as_of: "2026-11-16T12:00:00Z",
          next_cursor: null,
          publication_state: available ? "available" : "unavailable",
          application: { state: "closed", form: null },
        },
      },
    });
  });
  const documentTime = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole("button", { name: "Sayfayı önizle", exact: true }).click();
  await expect(page).toHaveURL(centerUrl);
  await expect(
    page.getByRole("heading", { name: "Bu sayfa şu an yayında değil", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentTime);
  available = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ders programı", exact: true })).toBeVisible();
  await expect(
    page.getByText("Bu aralıkta yayınlanan bir içerik yok.", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
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
test("program duration changes only the reviewed center setting and survives a fresh read", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  const form = page.getByRole("form", { name: "Stüdyo bilgileri", exact: true });
  const duration = form.getByRole("spinbutton", { name: "Varsayılan program süresi (dakika)" });
  await expect(duration).toHaveValue("60");
  await duration.fill("75");
  await duration.press("Enter");
  expect(f.writes).toHaveLength(0);
  const review = await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    op: "settings_update_v1",
    r: { scope: "center", org_id: I.org, center_id: I.center, expected_version: 1 },
  });
  expect(f.writes[0]?.r.patch).toEqual({ program_duration_minutes: 75 });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.reload();
  await expect(duration).toHaveValue("75");
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await expect(duration).toHaveValue("45");
});
test("V07.1 reviews organization billing fields and reloads the saved values without a center write", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const f = await mockSettingsCompletion(page);
  const scope = page.getByRole("combobox", { name: "Ayar kapsamı", exact: true });
  await scope.selectOption("organization");
  const plan = page.getByRole("tab", { name: "Plan", exact: true });
  await plan.click();
  await expect(plan).toHaveAttribute("aria-selected", "true");
  await expect(plan).toBeInViewport();
  const form = page.getByRole("form", { name: "Fatura bilgileri", exact: true });
  const name = form.getByRole("textbox", { name: "Fatura unvanı" });
  const address = form.getByRole("textbox", { name: "Fatura adresi" });
  const email = form.getByRole("textbox", { name: "Fatura e-postası" });
  await expect(name).toHaveValue("Sentetik kuruluş");
  await name.fill("Örnek Atölye");
  await address.fill("Örnek Sokak\nAnkara");
  await email.clear();
  await name.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Örnek Atölye");
  expect(f.writes).toHaveLength(0);
  const review = await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    op: "settings_update_v1",
    r: { scope: "organization", org_id: I.org, expected_version: 1 },
  });
  expect(f.writes[0]?.r).not.toHaveProperty("center_id");
  expect(f.writes[0]?.r.patch).toEqual({
    billing_name: "Örnek Atölye",
    billing_address: "Örnek Sokak\nAnkara",
    billing_email: null,
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.reload();
  await scope.selectOption("organization");
  await expect(name).toHaveValue("Örnek Atölye");
  await expect(address).toHaveValue("Örnek Sokak\nAnkara");
  await expect(email).toHaveValue("");
  await scope.selectOption("center");
  await expect(form).toHaveCount(0);
});
test("E42 saves an automation preparation and restores the organization source with live scope", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Şablonlar", exact: true }).click();
  const form = page.getByRole("form", { name: "Otomasyon hazırlık şablonları", exact: true });
  await form.getByLabel("Şablon adı", { exact: true }).fill("Paket takibi");
  await form
    .getByLabel(common.automation.columns.when, { exact: true })
    .selectOption("entitlement_expiring");
  await expect(
    form.getByRole("option", { name: common.automation.triggers.pending_request, exact: true }),
  ).toHaveCount(0);
  await form.getByLabel(common.automation.offsetDays, { exact: true }).fill("0");
  await form
    .getByLabel(common.automation.columns.action, { exact: true })
    .selectOption("create_followup");
  await form.getByLabel("Takip görevi metni", { exact: true }).fill("Paket yenilemesini görüş");
  await form.getByRole("button", { name: "Şablonu incele", exact: true }).click();
  const review = page.getByRole("dialog");
  expect(f.writes).toHaveLength(0);
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[0]?.r.patch).toEqual({
    automation_templates: [
      {
        key: expect.stringMatching(/^template-/),
        name: "Paket takibi",
        defaults: {
          trigger: { kind: "entitlement_expiring", offset_days: 0 },
          action: {
            kind: "create_followup",
            channel: "in_app",
            template_key: "Paket yenilemesini görüş",
          },
        },
      },
    ],
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(form.getByRole("option", { name: "Paket takibi", exact: true })).toHaveCount(1);
  await form.getByRole("button", { name: "Organizasyon kaynağını kullan", exact: true }).click();
  await expect(
    review.getByText(common.settings.preparation.inheritReview, { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[1]).toMatchObject({
    op: "settings_update_v1",
    r: {
      scope: "center",
      center_id: I.center,
      expected_version: 2,
      patch: {},
      inherit_fields: ["automation_templates"],
    },
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(form.getByRole("option", { name: "Organizasyon takibi", exact: true })).toHaveCount(
    1,
  );
  await expect(form.getByRole("option", { name: "Paket takibi", exact: true })).toHaveCount(0);
  expect(f.writes.map(({ op }) => op)).toEqual(["settings_update_v1", "settings_update_v1"]);
});

test("E42 edits event capacity, payment and cancellation defaults without creating an event", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Şablonlar", exact: true }).click();
  const form = page.getByRole("form", { name: "Etkinlik hazırlık şablonları", exact: true });
  await form.getByLabel("Şablon adı", { exact: true }).fill("Atölye koşulları");
  await form.getByLabel(common.events.editor.nominal, { exact: true }).fill("8");
  await form.getByLabel(common.events.editor.maximum, { exact: true }).fill("12");
  await form.getByLabel(common.events.editor.fee, { exact: true }).fill("15000");
  await form.getByLabel(common.events.editor.currency, { exact: true }).fill("TRY");
  await form.getByLabel(common.events.editor.fullPayment, { exact: true }).press("Space");
  await form.getByLabel(common.events.editor.cutoff, { exact: true }).fill("120");
  await form.getByLabel("Sınırdan önce", { exact: true }).selectOption("release");
  await form.getByLabel("Sınırdan sonra", { exact: true }).selectOption("consume");
  await form.getByLabel("Gelmediğinde", { exact: true }).selectOption("consume");
  await form.getByLabel("İade yöntemi", { exact: true }).selectOption("none");
  await form.getByRole("button", { name: "Şablonu incele", exact: true }).click();
  expect(f.writes).toHaveLength(0);
  const review = page.getByRole("dialog");
  await expect(review.getByText(/Atölye koşulları.*15000 TRY/)).toBeVisible();
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    op: "settings_update_v1",
    r: { scope: "center", center_id: I.center, expected_version: 1 },
  });
  expect(f.writes[0]?.r.patch).toEqual({
    event_templates: [
      {
        key: expect.stringMatching(/^template-/),
        name: "Atölye koşulları",
        defaults: {
          capacity: { nominal: 8, maximum: 12 },
          terms: {
            fee_minor: "15000",
            currency: "TRY",
            full_payment_required: true,
            allowed_product_version_ids: [],
            cancellation: {
              cutoff_minutes: 120,
              before_cutoff: "release",
              after_cutoff: "consume",
              no_show: "consume",
            },
            refund: { method: "none" },
          },
        },
      },
    ],
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await form
    .getByLabel("Hazırlık şablonu", { exact: true })
    .selectOption({ label: "Atölye koşulları" });
  await expect(form.getByLabel(common.events.editor.maximum, { exact: true })).toHaveValue("12");
});

test("E42 saves a weekly program template with exact clock and category capacity", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Şablonlar", exact: true }).click();
  const form = page.getByRole("form", { name: "Program hazırlık şablonları", exact: true });
  await form.getByLabel("Şablon adı", { exact: true }).fill("Hafta sonu");
  await form.getByRole("button", { name: "Cmt", exact: true }).press("Space");
  await form.getByRole("button", { name: "Paz", exact: true }).press("Space");
  await form.getByLabel("Başlangıç", { exact: true }).fill("10:20:30");
  await form.getByLabel("Süre (dakika)", { exact: true }).fill("75");
  await form.getByLabel(common.schedule.capacity, { exact: true }).fill("10");
  await form.getByLabel("Erkek kontenjanı", { exact: true }).fill("4");
  await form.getByLabel("Kadın kontenjanı", { exact: true }).fill("6");
  await form.getByRole("button", { name: "Şablonu incele", exact: true }).click();
  expect(f.writes).toHaveLength(0);
  const review = page.getByRole("dialog");
  await expect(review.getByText(/Cmt, Paz · 10:20:30 · 75 dk/)).toBeVisible();
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[0]?.r).toMatchObject({
    scope: "center",
    center_id: I.center,
    expected_version: 1,
  });
  expect(f.writes[0]?.r.patch).toEqual({
    program_templates: [
      {
        key: expect.stringMatching(/^template-/),
        name: "Hafta sonu",
        defaults: {
          weekdays: [6, 7],
          local_start: "10:20:30",
          duration_minutes: 75,
          capacity: { total: 10, categories: { male: 4, female: 6 } },
        },
      },
    ],
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await form.getByLabel("Hazırlık şablonu", { exact: true }).selectOption({ label: "Hafta sonu" });
  await expect(form.getByLabel("Kadın kontenjanı", { exact: true })).toHaveValue("6");
});

test("E42 manages a center payment template and an organization CRM template with separate review", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page.getByRole("tab", { name: "Şablonlar", exact: true }).click();
  const collection = page.getByRole("form", { name: "Tahsilat hazırlık şablonları", exact: true });
  await collection.getByLabel("Hazırlık şablonu", { exact: true }).selectOption("cash");
  await collection.getByLabel("Ödeme yöntemi", { exact: true }).selectOption("bank_transfer");
  await collection.getByRole("button", { name: "Şablonu incele", exact: true }).click();
  const review = page.getByRole("dialog");
  await expect(
    review.getByText("Yerel nakit · TRY · Nakit → Yerel nakit · TRY · Havale", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[0]?.r).toMatchObject({
    scope: "center",
    center_id: I.center,
    expected_version: 1,
  });
  expect(f.writes[0]?.r.patch).toEqual({
    collection_templates: [
      {
        key: "cash",
        name: "Yerel nakit",
        defaults: { currency: "TRY", payment_method: "bank_transfer" },
      },
    ],
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await collection.getByLabel("Hazırlık şablonu").selectOption("cash");
  await expect(collection.getByLabel("Ödeme yöntemi")).toHaveValue("bank_transfer");
  await collection.getByRole("button", { name: "Kaldırmayı incele", exact: true }).click();
  expect(f.writes).toHaveLength(1);
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  const crm = page.getByRole("form", { name: "Aday hazırlık şablonları", exact: true });
  await crm.getByLabel("Şablon adı", { exact: true }).fill("Telefon başvurusu");
  await crm.getByLabel(common.leads.source, { exact: true }).fill("phone");
  await crm.getByLabel(common.leads.interest, { exact: true }).fill("Tango");
  await crm.getByRole("button", { name: "Şablonu incele", exact: true }).click();
  expect(f.writes).toHaveLength(1);
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[1]?.r).toMatchObject({
    scope: "organization",
    expected_version: 1,
    patch: {
      crm_templates: [
        {
          key: expect.stringMatching(/^template-/),
          name: "Telefon başvurusu",
          defaults: { source: "phone", interest: "Tango" },
        },
      ],
    },
  });
  expect(f.writes[1]?.r).not.toHaveProperty("center_id");
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(crm.getByRole("option", { name: "Telefon başvurusu", exact: true })).toHaveCount(1);
  await crm
    .getByLabel("Hazırlık şablonu", { exact: true })
    .selectOption({ label: "Telefon başvurusu" });
  await crm.getByRole("button", { name: "Kaldırmayı incele", exact: true }).click();
  expect(f.writes).toHaveLength(2);
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[2]?.r).toMatchObject({
    scope: "organization",
    expected_version: 2,
    patch: { crm_templates: [] },
  });
  await review.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(crm.getByRole("option", { name: "Telefon başvurusu", exact: true })).toHaveCount(0);
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
  const editor = page.getByRole("dialog", { name: "Planı daralt", exact: true });
  await editor.getByRole("radio", { name: /^Starter/ }).press("Space");
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
  await expect(review.getByText("Geçerlilik tarihi", { exact: true })).toBeVisible();
  await expect(review.getByText("1.01.2099 03:00", { exact: true })).toBeVisible();
  await expect(
    review.getByText(
      "Salon: Ana salon · Disiplin: Tango · Eğitmen: Sentetik personel · 0 öğrenci",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect
    .poll(() => f.writes.some((row) => row.op === "subscription_downgrade_request_v1"))
    .toBe(true);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
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
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  const manage = page.getByRole("checkbox", {
    name: "Sentetik personel: Kişi yönetimi",
    exact: true,
  });
  await manage.press("Space");
  let manageReview = await confirm(page);
  await expect(manageReview.getByRole("status")).toContainText(common.events.commandStates.saved);
  await manageReview.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(manage).toBeChecked();
  await manage.press("Space");
  manageReview = await confirm(page);
  await expect(manageReview.getByRole("status")).toContainText(common.events.commandStates.saved);
  const changes = f.writes.filter(
    (row) => row.op === "permission_set_v1" && row.r.permission === "person.manage",
  );
  expect(changes.map((row) => row.r.enabled)).toEqual([true, false]);
  expect(changes.map((row) => row.r.expected_version)).toEqual([4, 5]);
  expect(changes[0]!.r.operation_key).not.toBe(changes[1]!.r.operation_key);
  expect(f.state.permissions["person.manage"]).toBe(false);
  await manageReview.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(manage).not.toBeChecked();
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
