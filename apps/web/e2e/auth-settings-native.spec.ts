import { activate, hasTouchInput, submitWithDevice } from "./device-input.js";
import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { uid, requestsFor } from "./pro-completion-fixture.js";
import { openWorkspaceSearch, origin } from "./auth-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
async function confirm(page: import("@playwright/test").Page) {
  const dialog = page.getByRole("dialog");
  await activate(
    dialog.getByRole("checkbox", {
      name: "Kapsamı ve güncel etkileri okudum, bu değişikliği onaylıyorum.",
      exact: true,
    }),
    "Space",
  );
  await activate(
    dialog.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  );
  return dialog;
}
test("a pending subscription owner can reach the first payment form through the Plan link", async ({
  page,
}) => {
  const fixture = await mockSettingsCompletion(page, {
    bootstrapBilling: "owner",
    startUrl: `${origin}/account?org=${I.org}&center=${I.center}`,
  });
  await activate(page.getByRole("link", { name: common.settings.tabs.plan, exact: true }), "Enter");
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/settings?section=plan`);
  const plan = page.getByRole("tabpanel", { name: common.settings.tabs.plan, exact: true });
  await expect(plan.getByText(/Ödeme bekliyor/)).toBeVisible();
  await expect(plan.getByRole("button", { name: common.settings.changePlan })).toBeDisabled();
  await activate(
    plan.getByRole("button", { name: common.settings.reportPayment, exact: true }),
    "Enter",
  );
  await expect(
    page.getByRole("dialog", { name: common.settings.paymentEditor.title }),
  ).toBeVisible();
  await activate(
    page
      .getByRole("dialog", { name: common.settings.paymentEditor.title })
      .getByRole("button", { name: common.settings.discard, exact: true }),
  );
  await expect(
    page.getByRole("dialog", { name: common.settings.paymentEditor.title }),
  ).toBeHidden();
  expect(fixture.writes).toEqual([]);
});

test("a pending organization's member gets no billing link or payment action", async ({ page }) => {
  const fixture = await mockSettingsCompletion(page, {
    bootstrapBilling: "member",
    startUrl: `${origin}/o/${I.org}/c/${I.center}/settings?section=plan`,
  });
  await expect(
    page.getByRole("alert").filter({ hasText: common.settings.subscriptionReadError }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: common.settings.tabs.plan, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: common.settings.reportPayment, exact: true }),
  ).toBeDisabled();
  expect(fixture.writes).toEqual([]);
});
test("command palette opens a settings section in the current managed center", async ({ page }) => {
  const fixture = await mockSettingsCompletion(page);
  await openWorkspaceSearch(page);
  const dialog = page.getByRole("dialog", { name: "Sayfalarda ara", exact: true });
  const search = dialog.getByPlaceholder("Sayfa adı ara…");
  await expect(search).toBeFocused();
  await search.fill("Politikalar");
  if (hasTouchInput(page)) {
    await activate(page.getByRole("menuitem", { name: "Politikalar", exact: true }));
  } else {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  }
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
  await activate(page.getByRole("tab", { name: "Yayın", exact: true }));
  await activate(page.getByRole("button", { name: "Yayın ayarlarını düzenle", exact: true }));
  const editor = page.getByRole("dialog");
  await activate(
    editor.getByRole("checkbox", { name: "Public profili göster", exact: true }),
    "Space",
  );
  await editor
    .getByRole("combobox", { name: "Etkin web formu", exact: true })
    .selectOption(uid(105));
  await expect(
    editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("textbox", { name: "Yayımlanmış belge kodu", exact: true })
    .fill("document.synthetic");
  await activate(editor.getByRole("button", { name: "Belge sürümlerini oku", exact: true }));
  await editor
    .getByRole("combobox", { name: "Yayımlanmış metin", exact: true })
    .selectOption(uid(106));
  await editor.getByRole("textbox", { name: "Onay amacı", exact: true }).fill("application");
  await activate(editor.getByRole("button", { name: "Onay kaynağını ekle", exact: true }));
  await activate(editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(
    page.getByRole("switch", { name: "Ziyaretçi profili görünür", exact: true }),
  ).toBeChecked();
});
test("publication settings share the scoped visitor route and preview live closed and open states", async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === "webkit") {
    await page.addInitScript(() => {
      let copied = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            copied = text;
          },
          readText: async () => copied,
        },
      });
    });
  } else {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  }
  const f = await mockSettingsCompletion(page);
  await activate(page.getByRole("tab", { name: "Yayın", exact: true }));
  const centerUrl = `${origin}/public/${I.org}/calendar?center_id=${I.center}`;
  const address = page.getByRole("textbox", { name: "Sayfa adresi", exact: true });
  await expect(address).toHaveValue(centerUrl);
  await expect(address).toHaveAttribute("readonly", "");
  await activate(page.getByRole("button", { name: "Bağlantıyı kopyala", exact: true }));
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
  await activate(page.getByRole("button", { name: "Sayfayı önizle", exact: true }));
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
test("organization publication address uses versioned settings and closes old addresses and visitor access", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  f.state.values.organization!.public_page = { slug: "ilk-adres", enabled: true };
  const publicReads: string[] = [];
  const publicationReadRequests: Record<string, unknown>[] = [];
  await page.route("**/api/public/calendar", (route) => {
    const request = route.request();
    expect(request.headers()).not.toHaveProperty("authorization");
    const { slug } = request.postDataJSON() as { slug: string };
    publicReads.push(slug);
    publicationReadRequests.push(request.postDataJSON() as Record<string, unknown>);
    const current = f.state.values.organization!.public_page as { slug: string; enabled: boolean };
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: [],
          as_of: "2026-11-16T12:00:00Z",
          next_cursor: null,
          publication_state: current.slug === slug && current.enabled ? "available" : "unavailable",
          application: { state: "closed", form: null },
        },
      },
    });
  });
  await activate(page.getByRole("tab", { name: "Yayın", exact: true }));
  const scope = page.getByRole("combobox", { name: "Ayar kapsamı", exact: true });
  const address = page.getByRole("textbox", { name: "Sayfa adresi", exact: true });
  await expect(address).toHaveValue(`${origin}/public/ilk-adres/calendar?center_id=${I.center}`);
  await scope.selectOption("organization");
  await activate(page.getByRole("button", { name: "Yayın ayarlarını düzenle", exact: true }));
  const editor = page.getByRole("dialog");
  const slug = editor.getByLabel("Yayın adresi kısa adı", { exact: true });
  const reviewButton = editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true });
  await slug.fill("Geçersiz Adres");
  await activate(reviewButton);
  await expect(slug).toBeFocused();
  await expect(slug).toHaveAttribute("aria-invalid", "true");
  expect(f.writes).toHaveLength(0);
  await slug.fill("yeni-adres");
  await activate(reviewButton);
  const review = await confirm(page);
  await expect(review.getByRole("status")).toHaveText(common.events.commandStates.saved);
  expect(f.writes[0]?.r).toMatchObject({
    scope: "organization",
    expected_version: 1,
    patch: { public_page: { slug: "yeni-adres", enabled: true } },
  });
  expect(publicReads).toEqual(expect.arrayContaining(["ilk-adres", "yeni-adres"]));
  expect(publicationReadRequests).toHaveLength(2);
  for (const request of publicationReadRequests) {
    expect(request).toMatchObject({ mode: "context", page: {} });
    expect(request).not.toHaveProperty("interval");
    expect(request).not.toHaveProperty("include_disciplines");
  }
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(address).toHaveValue(`${origin}/public/yeni-adres/calendar`);
  await activate(page.getByRole("button", { name: "Yayın ayarlarını düzenle", exact: true }));
  await activate(
    editor.getByRole("checkbox", { name: "Ziyaretçi sayfasını yayına aç", exact: true }),
    "Space",
  );
  await activate(reviewButton);
  await confirm(page);
  await expect(review.getByRole("status")).toHaveText(common.events.commandStates.saved);
  expect(f.writes[1]?.r).toMatchObject({
    scope: "organization",
    expected_version: 2,
    patch: { public_page: { slug: "yeni-adres", enabled: false } },
  });
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(
    page.getByRole("switch", { name: "Ziyaretçi sayfası yayında", exact: true }),
  ).not.toBeChecked();
  await activate(page.getByRole("button", { name: "Sayfayı önizle", exact: true }));
  await expect(page).toHaveURL(`${origin}/public/yeni-adres/calendar`);
  await expect(
    page.getByRole("heading", { name: "Bu sayfa şu an yayında değil", exact: true }),
  ).toBeVisible();
});
test("policy editing publishes a native protected change after review and keeps source scope and local instant", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await activate(page.getByRole("tab", { name: "Politikalar", exact: true }));
  await activate(page.getByRole("button", { name: "Düzenle", exact: true }));
  const editor = page.getByRole("dialog");
  await editor.getByRole("spinbutton", { name: "Kapanış (dakika önce)", exact: true }).fill("120");
  await editor.locator('input[type="datetime-local"]').fill("2098-12-01T15:00");
  await editor
    .getByRole("textbox", { name: "Değişiklik gerekçesi", exact: true })
    .fill("Sentetik politika değişikliği");
  await activate(editor.getByRole("button", { name: "Yayın önizlemesine geç", exact: true }));
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
  await submitWithDevice(
    page.locator(`button[type="submit"][form="${await form.getAttribute("id")}"]`),
    duration,
  );
  expect(f.writes).toHaveLength(0);
  const review = await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    op: "settings_update_v1",
    r: { scope: "center", org_id: I.org, center_id: I.center, expected_version: 1 },
  });
  expect(f.writes[0]?.r.patch).toEqual({ program_duration_minutes: 75 });
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
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
  await activate(plan);
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
  await submitWithDevice(
    page.locator(`button[type="submit"][form="${await form.getAttribute("id")}"]`),
    name,
  );
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
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
  await activate(page.getByRole("tab", { name: "Şablonlar", exact: true }));
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
  await activate(form.getByRole("button", { name: "Şablonu incele", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(form.getByRole("option", { name: "Paket takibi", exact: true })).toHaveCount(1);
  await activate(form.getByRole("button", { name: "Organizasyon kaynağını kullan", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
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
  await activate(page.getByRole("tab", { name: "Şablonlar", exact: true }));
  const form = page.getByRole("form", { name: "Etkinlik hazırlık şablonları", exact: true });
  await form.getByLabel("Şablon adı", { exact: true }).fill("Atölye koşulları");
  await form.getByLabel(common.events.editor.nominal, { exact: true }).fill("8");
  await form.getByLabel(common.events.editor.maximum, { exact: true }).fill("12");
  await form.getByLabel(common.events.editor.fee, { exact: true }).fill("15000");
  await form.getByLabel(common.events.editor.currency, { exact: true }).fill("TRY");
  await activate(form.getByLabel(common.events.editor.fullPayment, { exact: true }), "Space");
  await form.getByLabel(common.events.editor.cutoff, { exact: true }).fill("120");
  await form.getByLabel("Sınırdan önce", { exact: true }).selectOption("release");
  await form.getByLabel("Sınırdan sonra", { exact: true }).selectOption("consume");
  await form.getByLabel("Gelmediğinde", { exact: true }).selectOption("consume");
  await form.getByLabel("İade yöntemi", { exact: true }).selectOption("none");
  await activate(form.getByRole("button", { name: "Şablonu incele", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await form
    .getByLabel("Hazırlık şablonu", { exact: true })
    .selectOption({ label: "Atölye koşulları" });
  await expect(form.getByLabel(common.events.editor.maximum, { exact: true })).toHaveValue("12");
});

test("E42 saves a weekly program template with exact clock and category capacity", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await activate(page.getByRole("tab", { name: "Şablonlar", exact: true }));
  const form = page.getByRole("form", { name: "Program hazırlık şablonları", exact: true });
  await form.getByLabel("Şablon adı", { exact: true }).fill("Hafta sonu");
  await activate(form.getByRole("button", { name: "Cmt", exact: true }), "Space");
  await activate(form.getByRole("button", { name: "Paz", exact: true }), "Space");
  await form.getByLabel("Başlangıç", { exact: true }).fill("10:20:30");
  await form.getByLabel("Süre (dakika)", { exact: true }).fill("75");
  await form.getByLabel(common.schedule.capacity, { exact: true }).fill("10");
  await form.getByLabel("Erkek kontenjanı", { exact: true }).fill("4");
  await form.getByLabel("Kadın kontenjanı", { exact: true }).fill("6");
  await activate(form.getByRole("button", { name: "Şablonu incele", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await form.getByLabel("Hazırlık şablonu", { exact: true }).selectOption({ label: "Hafta sonu" });
  await expect(form.getByLabel("Kadın kontenjanı", { exact: true })).toHaveValue("6");
});

test("E42 manages a center payment template and an organization CRM template with separate review", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page);
  await activate(page.getByRole("tab", { name: "Şablonlar", exact: true }));
  const collection = page.getByRole("form", { name: "Tahsilat hazırlık şablonları", exact: true });
  await collection.getByLabel("Hazırlık şablonu", { exact: true }).selectOption("cash");
  await collection.getByLabel("Ödeme yöntemi", { exact: true }).selectOption("bank_transfer");
  await activate(collection.getByRole("button", { name: "Şablonu incele", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await collection.getByLabel("Hazırlık şablonu").selectOption("cash");
  await expect(collection.getByLabel("Ödeme yöntemi")).toHaveValue("bank_transfer");
  await activate(collection.getByRole("button", { name: "Kaldırmayı incele", exact: true }));
  expect(f.writes).toHaveLength(1);
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  const crm = page.getByRole("form", { name: "Aday hazırlık şablonları", exact: true });
  await crm.getByLabel("Şablon adı", { exact: true }).fill("Telefon başvurusu");
  await crm.getByLabel(common.leads.source, { exact: true }).fill("phone");
  await crm.getByLabel(common.leads.interest, { exact: true }).fill("Tango");
  await activate(crm.getByRole("button", { name: "Şablonu incele", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(crm.getByRole("option", { name: "Telefon başvurusu", exact: true })).toHaveCount(1);
  await crm
    .getByLabel("Hazırlık şablonu", { exact: true })
    .selectOption({ label: "Telefon başvurusu" });
  await activate(crm.getByRole("button", { name: "Kaldırmayı incele", exact: true }));
  expect(f.writes).toHaveLength(2);
  await confirm(page);
  await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
  expect(f.writes[2]?.r).toMatchObject({
    scope: "organization",
    expected_version: 2,
    patch: { crm_templates: [] },
  });
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
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
  await activate(page.getByRole("tab", { name: "Plan", exact: true }));
  await activate(page.getByRole("button", { name: "Planı değiştir", exact: true }));
  const editor = page.getByRole("dialog", { name: "Planı daralt", exact: true });
  await activate(editor.getByRole("radio", { name: /^Starter/ }), "Space");
  await editor
    .getByRole("combobox", { name: "Korunacak merkez", exact: true })
    .selectOption(I.center);
  await editor.getByRole("combobox", { name: "Salon", exact: true }).selectOption(I.room);
  await editor.getByRole("combobox", { name: "Disiplin", exact: true }).selectOption(I.discipline);
  await editor.getByRole("combobox", { name: "Eğitmen", exact: true }).selectOption(I.instructor);
  await expect(
    editor.getByRole("checkbox", { name: "Sentetik öğrenci", exact: true }),
  ).not.toBeChecked();
  await activate(editor.getByRole("button", { name: "Teklifi incele", exact: true }));
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  const base = `${origin}/o/${I.org}/c/${I.center}`;
  await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
  await page.goto(`${base}/studio`);
  await activate(page.getByRole("tab", { name: "Anlaşmalar", exact: true }));
  await activate(page.getByRole("button", { name: /Sentetik personel/ }));
  const staleEditor = page.getByRole("dialog");
  await staleEditor.getByLabel("Tutar (en küçük para birimi)", { exact: true }).fill("25000");
  await staleEditor.locator("#agreement-from").fill("2099-01-01T12:00");
  await staleEditor.locator("#agreement-until").fill("2100-01-01T12:00");
  await staleEditor.locator("#agreement-reason").fill("Sentetik eski Pro sekmesi");
  await activate(staleEditor.getByRole("checkbox"), "Space");
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
  await activate(staleEditor.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }));
  await expect(staleEditor.getByRole("status")).toContainText(common.studio.agreementRejected);
  expect(rejected).toBe(1);
  expect(f.studio.agreements).toHaveLength(1);
  expect(f.studio.effects).not.toContain("instructor_agreement_publish_v1");
  await activate(staleEditor.getByRole("button", { name: "Vazgeç", exact: true }));
  await page.goto(`${base}/settings`);
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await activate(page.getByRole("tab", { name: "Plan", exact: true }));
  await expect(page.getByText("Starter", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Planı değiştir", exact: true })).toBeDisabled();
});
for (const target of [
  { name: "Pro", id: uid(140) },
  { name: "Starter", id: uid(101) },
] as const) {
  test(`Business downgrade review names the kept center and submits the selected ${target.name} scope`, async ({
    page,
  }) => {
    const f = await mockSettingsCompletion(page, { billingOwner: true, businessDowngrade: true });
    await page
      .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
      .selectOption("organization");
    await activate(page.getByRole("tab", { name: "Plan", exact: true }));
    await activate(page.getByRole("button", { name: "Planı değiştir", exact: true }));
    const dialog = page.getByRole("dialog", { name: "Planı daralt", exact: true });
    await activate(dialog.getByRole("radio", { name: new RegExp(`^${target.name}`) }), "Space");
    await dialog
      .getByRole("combobox", { name: "Korunacak merkez", exact: true })
      .selectOption(uid(141));
    if (target.name === "Starter") {
      await dialog.getByRole("combobox", { name: "Salon", exact: true }).selectOption(I.room);
      await dialog
        .getByRole("combobox", { name: "Disiplin", exact: true })
        .selectOption(I.discipline);
      await dialog
        .getByRole("combobox", { name: "Eğitmen", exact: true })
        .selectOption(I.instructor);
      await activate(
        dialog.getByRole("checkbox", { name: "Sentetik öğrenci", exact: true }),
        "Space",
      );
    } else {
      await expect(dialog.getByRole("combobox", { name: "Salon", exact: true })).toHaveCount(0);
    }
    await activate(dialog.getByRole("button", { name: "Teklifi incele", exact: true }));
    await expect(
      dialog.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByText("Korunacak merkez", { exact: true })).toBeVisible();
    await expect(dialog.getByText("İkinci merkez", { exact: true })).toBeVisible();
    await expect(dialog.getByText("1.01.2099 03:00", { exact: true })).toBeVisible();
    expect(f.writes).toHaveLength(0);
    const review = await confirm(page);
    await expect(review.getByRole("status")).toContainText("güncel kayıt okundu");
    const writes = f.writes.filter(({ op }) => op === "subscription_downgrade_request_v1");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.r).toMatchObject({
      target_plan_id: target.id,
      expected_version: 2,
      kept_center_id: uid(141),
    });
    if (target.name === "Starter") {
      expect(writes[0]?.r.kept_scope).toEqual({
        room_id: I.room,
        discipline_id: I.discipline,
        instructor_id: I.instructor,
        student_person_ids: [uid(114)],
      });
    } else {
      expect(writes[0]?.r).not.toHaveProperty("kept_scope");
    }
  });
}

test("team permission unknown state blocks scope and retries exactly one frozen grant before rereading effective permissions", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, { permissionUnknown: true });
  await activate(page.getByRole("tab", { name: "Ekip", exact: true }));
  const panelStart = f.requests.length;
  expect(
    requestsFor(f.requests, "management_state_get_v1").filter(
      ({ r }) => r.operation === "permission_set_v1",
    ),
  ).toHaveLength(0);
  await activate(page.getByRole("tab", { name: "İzinler", exact: true }));
  const permissionPanel = page.getByRole("tabpanel", { name: "İzinler", exact: true });
  const save = permissionPanel.getByRole("button", { name: common.settings.save, exact: true });
  const sale = permissionPanel.getByRole("switch", {
    name: "Sentetik personel: Satış",
    exact: true,
  });
  await expect(sale).toBeVisible();
  await expect(permissionPanel.getByRole("combobox")).toHaveCount(0);
  const panelReads = requestsFor(f.requests.slice(panelStart), "management_state_get_v1").filter(
    ({ r }) =>
      r.operation === "permission_set_v1" &&
      r.selector?.operation === "permission_set_v1" &&
      r.selector.key.person_id === I.instructor,
  );
  expect(panelReads).toHaveLength(1);
  expect(panelReads[0]!.r).toMatchObject({
    org_id: I.org,
    center_id: I.center,
    selector: {
      operation: "permission_set_v1",
      key: { person_id: I.instructor, permission_summary: true },
    },
    page: { limit: 1 },
  });
  await activate(sale, "Space");
  expect(f.writes).toEqual([]);
  await activate(save);
  const dialog = await confirm(page);
  await expect(
    page.getByRole("tab", { name: "Ekip", exact: true, includeHidden: true }),
  ).toBeDisabled();
  await activate(dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }));
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
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  const manage = page.getByRole("switch", {
    name: "Sentetik personel: Kişi yönetimi",
    exact: true,
  });
  await activate(manage, "Space");
  await activate(save);
  let manageReview = await confirm(page);
  await expect(manageReview.getByRole("status")).toContainText(common.events.commandStates.saved);
  await activate(manageReview.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(manage).toBeChecked();
  await activate(manage, "Space");
  await activate(save);
  manageReview = await confirm(page);
  await expect(manageReview.getByRole("status")).toContainText(common.events.commandStates.saved);
  const changes = requestsFor(f.writes, "permission_set_v1").filter(
    (row) => row.r.permission === "person.manage",
  );
  expect(changes.map((row) => row.r.enabled)).toEqual([true, false]);
  expect(changes.map((row) => row.r.expected_version)).toEqual([4, 5]);
  expect(changes[0]!.r.operation_key).not.toBe(changes[1]!.r.operation_key);
  expect(f.state.permissions["person.manage"]).toBe(false);
  await activate(manageReview.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(manage).not.toBeChecked();
});
test("team matrix shows staff and center manager while preserving the delegated limit", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, {
    startUrl: `${origin}/o/${I.org}/c/${I.center}/settings?section=ekip`,
  });
  const managerStart = f.requests.length;
  await activate(page.getByRole("tab", { name: "İzinler", exact: true }));
  const managerPermissions = page.getByRole("tabpanel", { name: "İzinler", exact: true });
  const managerSwitches = managerPermissions.getByRole("switch", { name: /^Sentetik yönetici:/ });
  await expect(managerSwitches).toHaveCount(1);
  await expect(managerSwitches).toHaveAccessibleName(
    `Sentetik yönetici: ${common.settings.teamNative.permissions.sale.discount}`,
  );
  await expect(
    managerPermissions.getByRole("switch", { name: "Sentetik personel: Satış", exact: true }),
  ).toBeVisible();
  const managerReads = requestsFor(
    f.requests.slice(managerStart),
    "management_state_get_v1",
  ).filter(
    ({ r }) =>
      r.operation === "permission_set_v1" &&
      r.selector?.operation === "permission_set_v1" &&
      r.selector.key.person_id === uid(130),
  );
  expect(managerReads).toHaveLength(1);
  expect(managerReads[0]!.r.selector.key).toEqual({
    person_id: uid(130),
    permission_summary: true,
  });
});
test("operational team role is a separate reviewed command and native channel/template limits stay read-only on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const f = await mockSettingsCompletion(page);
  await activate(page.getByRole("tab", { name: "Ekip", exact: true }));
  await activate(
    page
      .getByRole("row")
      .filter({ hasText: "Sentetik personel" })
      .getByRole("button", { name: common.settings.teamNative.edit, exact: true }),
  );
  const editor = page.getByRole("dialog");
  await activate(editor.getByText(common.settings.teamEditor.otherRoles, { exact: true }));
  await activate(editor.getByRole("checkbox", { name: /Asistan/ }), "Space");
  await activate(
    editor.getByRole("button", { name: common.settings.teamEditor.save, exact: true }),
  );
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await activate(page.getByRole("tab", { name: "Şablonlar", exact: true }));
  const documentScan = await scanAccessibility(page, "settings-template-list");
  expect(documentScan.violations).toEqual([]);
  await activate(page.getByRole("button", { name: "Yönetim sınırı", exact: true }).first());
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("platform içerik kataloğunda");
  await expect(sheet.getByRole("textbox").first()).toHaveAttribute("readonly", "");
  // The modal hides the document landmarks. Check the modal and its owning page separately.
  const backgroundIsHidden = () =>
    page
      .locator("main")
      .evaluate((element) => Boolean(element.closest('[inert], [aria-hidden="true"]')));
  await expect.poll(backgroundIsHidden).toBe(true);
  const sheetScan = await scanAccessibility(page, "settings-read-only-template", {
    selector: '[data-slot="sheet"]',
    documentScan,
  });
  expect(sheetScan.violations).toEqual([]);
  await activate(sheet.getByRole("button", { name: common.settings.discard, exact: true }));
  await expect(sheet).toHaveCount(0);
  await expect.poll(backgroundIsHidden).toBe(false);
  await expect(page.getByRole("main")).toBeVisible();
  expect(f.writes.some((row) => row.op === "content_catalog_save_v1")).toBe(false);
});

test("failed role detail readback stays unread and recovers with one acknowledged write", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, { roleDetailReadbackFailure: true });
  await activate(page.getByRole("tab", { name: "Ekip", exact: true }));
  await activate(
    page
      .getByRole("row")
      .filter({ hasText: "Sentetik personel" })
      .getByRole("button", { name: common.settings.teamNative.edit, exact: true }),
  );
  const editor = page.getByRole("dialog");
  await activate(editor.getByText(common.settings.teamEditor.otherRoles, { exact: true }));
  await activate(editor.getByRole("checkbox", { name: /Asistan/ }), "Space");
  await activate(
    editor.getByRole("button", { name: common.settings.teamEditor.save, exact: true }),
  );
  const review = await confirm(page);
  await expect(
    review.getByText(common.events.commandStates["saved-unread"], { exact: true }),
  ).toBeVisible();
  expect(requestsFor(f.writes, "role_assign_v1")).toHaveLength(1);

  await activate(review.getByRole("button", { name: common.finance.readResult, exact: true }));
  await expect(review.getByText(common.events.commandStates.saved, { exact: true })).toBeVisible();
  expect(requestsFor(f.writes, "role_assign_v1")).toHaveLength(1);
  expect(
    requestsFor(f.requests, "operation_status_get_v1").filter(
      ({ r }) => r.operation === "role_assign_v1",
    ),
  ).toHaveLength(0);
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
});

test("manager directory scopes each role and revokes through the dedicated org command", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, { billingOwner: true });
  await activate(page.getByRole("tab", { name: "Ekip", exact: true }));
  const row = page.getByRole("row").filter({ hasText: "Sentetik yönetici" });
  await expect(row).toContainText("Merkez yöneticisi");
  expect(
    f.requests.filter((row) => row.op === "roles_list_v1" && row.r.role === "center_manager").at(-1)
      ?.r,
  ).toMatchObject({ center_id: I.center, state: "active" });
  await expect(row).toContainText("Organizasyon yöneticisi");
  expect(
    f.requests.filter((row) => row.op === "roles_list_v1" && row.r.role === "org_manager").at(-1)
      ?.r,
  ).not.toHaveProperty("center_id");
  await activate(row.getByRole("button", { name: common.settings.teamNative.edit, exact: true }));
  const editor = page.getByRole("dialog");
  await activate(editor.getByText(common.settings.teamEditor.otherRoles, { exact: true }));
  await activate(
    editor.getByRole("checkbox", { name: "Organizasyon yöneticisi", exact: true }),
    "Space",
  );
  await editor
    .getByRole("textbox", { name: "Görev kaldırma gerekçesi", exact: true })
    .fill("Sentetik yönetici görevini kaldır");
  await activate(
    editor.getByRole("button", { name: common.settings.teamEditor.review, exact: true }),
  );
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
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(row).not.toContainText("Organizasyon yöneticisi");
  await expect(row).toContainText("Merkez yöneticisi");
  expect(
    f.requests.filter((row) => row.op === "roles_list_v1" && row.r.role === "org_manager").at(-1)
      ?.r,
  ).toMatchObject({ state: "active", page: { limit: 20 } });
});

test("team drawer finds a person at the bottom and uses the verified-account manager command", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, {
    billingOwner: true,
    startUrl: `${origin}/o/${I.org}/c/${I.center}/settings?section=ekip`,
  });
  const team = page.getByRole("tabpanel", { name: "Ekip", exact: true });
  await expect(team.getByRole("tab", { name: "Kişiler", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(team.getByRole("combobox")).toHaveCount(0);
  const listReads = requestsFor(f.requests, "people_list_v1").length;
  await activate(team.getByRole("button", { name: "Kişi davet et", exact: true }));
  const drawer = page.getByRole("dialog", { name: "Kişi davet et", exact: true });
  const name = drawer.getByRole("textbox", { name: "Ad soyad", exact: true });
  const role = drawer.getByRole("checkbox", { name: "Merkez yöneticisi", exact: true });
  const search = drawer.getByRole("searchbox", { name: "Mevcut kişiyi ara", exact: true });
  await expect(name).toHaveAttribute("readonly", "");
  await expect(role).toBeDisabled();
  expect(
    await search.evaluate((input) => {
      const first = input.closest("form")?.querySelector('[name="name"]');
      return !!first && Boolean(first.compareDocumentPosition(input) & 4);
    }),
  ).toBe(true);
  expect(requestsFor(f.requests, "people_list_v1")).toHaveLength(listReads);
  await search.fill("Sentetik");
  await activate(drawer.getByRole("button", { name: "Kişileri bul", exact: true }));
  await activate(drawer.getByRole("button", { name: /^Sentetik personel/ }));
  await expect(name).toHaveValue("Sentetik personel");
  await activate(role, "Space");
  await activate(drawer.getByRole("button", { name: "Rol ata", exact: true }));
  const review = page.getByRole("dialog", { name: "Kişi davet et", exact: true });
  await expect(
    review.getByText(common.settings.teamNative.targetCenter, { exact: true }),
  ).toBeVisible();
  await confirm(page);
  await expect(review.getByRole("status")).toContainText(common.events.commandStates.saved);
  const assignments = requestsFor(f.writes, "center_manager_assign_v1");
  expect(assignments).toHaveLength(1);
  expect(assignments[0]?.r).toMatchObject({
    org_id: I.org,
    center_id: I.center,
    person_id: I.instructor,
  });
  expect(requestsFor(f.requests, "account_access_send_v1")).toHaveLength(0);
});

test("editing staff and a manager always shows both selected-center role options", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, {
    billingOwner: true,
    startUrl: `${origin}/o/${I.org}/c/${I.center}/settings?section=ekip`,
  });
  const edit = (person: string) =>
    page
      .getByRole("row")
      .filter({ hasText: person })
      .getByRole("button", { name: "Düzenle", exact: true });
  const drawer = page.getByRole("dialog", { name: "Rolleri düzenle", exact: true });
  const manager = drawer.getByRole("checkbox", { name: "Merkez yöneticisi", exact: true });
  const staff = drawer.getByRole("checkbox", { name: "Personel", exact: true });

  await activate(edit("Sentetik personel"));
  await expect(manager).toBeEnabled();
  await expect(manager).not.toBeChecked();
  await expect(staff).toBeChecked();
  await expect(drawer.getByRole("textbox", { name: "Ad soyad", exact: true })).toHaveValue(
    "Sentetik personel",
  );
  await activate(drawer.getByRole("button", { name: "Kapat", exact: true }));

  await activate(edit("Sentetik yönetici"));
  await expect(manager).toBeChecked();
  await expect(staff).toBeEnabled();
  await expect(staff).not.toBeChecked();
  const save = drawer.getByRole("button", { name: "Kaydet", exact: true });
  await expect(save).toBeDisabled();
  await activate(staff, "Space");
  await expect(drawer.getByText("Eklenecek: Personel.", { exact: true })).toBeVisible();
  await activate(save);
  const review = await confirm(page);
  await expect(review.getByRole("status")).toContainText(common.events.commandStates.saved);
  expect(requestsFor(f.writes, "role_assign_v1").map(({ r }) => r)).toEqual([
    expect.objectContaining({
      org_id: I.org,
      center_id: I.center,
      person_id: uid(130),
      role: "staff",
      scope: { center_id: I.center },
    }),
  ]);
  expect(requestsFor(f.writes, "center_manager_assign_v1")).toHaveLength(0);
  await activate(review.getByRole("button", { name: "Vazgeç", exact: true }));
});

test("center manager can edit staff on the manager's row without changing manager authority", async ({
  page,
}) => {
  const f = await mockSettingsCompletion(page, {
    startUrl: `${origin}/o/${I.org}/c/${I.center}/settings?section=ekip`,
  });
  const row = page.getByRole("row").filter({ hasText: "Sentetik yönetici" });
  await activate(row.getByRole("button", { name: "Düzenle", exact: true }));
  const drawer = page.getByRole("dialog", { name: "Rolleri düzenle", exact: true });
  const manager = drawer.getByRole("checkbox", { name: "Merkez yöneticisi", exact: true });
  await expect(manager).toBeChecked();
  await expect(manager).toBeDisabled();
  await expect(drawer.getByRole("checkbox", { name: "Personel", exact: true })).toBeEnabled();
  expect(f.writes).toEqual([]);
  await activate(drawer.getByRole("button", { name: "Kapat", exact: true }));
});
