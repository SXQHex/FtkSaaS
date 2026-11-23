import { test, expect } from "./test.js";
import { mockMemberAccount, confirmCalendar } from "./member-account-fixture.js";
import { mockSessionDetail } from "./session-detail-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { uid } from "./pro-completion-fixture.js";
test("member account places five sections and saves native email reminder preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await mockMemberAccount(page);
  await expect(page.locator('main [data-slot="card"] h2')).toHaveText([
    "Kişi bilgileri",
    "Belgeler",
    "Hesabı sil",
    "Takvimime ekle",
    "Bildirim tercihlerim",
  ]);
  const profile = page.getByRole("form", { name: "Kişi bilgileri", exact: true });
  await profile.getByLabel("Görünen ad", { exact: true }).fill("Sentetik yeni görünen ad");
  const profileWrite = page.waitForRequest("**/functions/v1/backend-v1/account_profile_update_v1");
  await profile.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  const { client_api_version, request_id, operation_key, expected_version, ...changed } = (
    await profileWrite
  ).postDataJSON();
  expect({ client_api_version, request_id, operation_key, expected_version }).toEqual({
    client_api_version: 1,
    request_id: expect.any(String),
    operation_key: expect.any(String),
    expected_version: expect.any(Number),
  });
  expect(changed).toEqual({ display_name: "Sentetik yeni görünen ad", unverified_phone: null });
  await expect(profile.getByText("Değişiklikler kaydedildi.", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Stüdyo duyuruları", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Zorunlu bildirimler", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Zorunlu bildirimler", exact: true }),
  ).toBeDisabled();
  const email = page.getByRole("switch", { name: "E-posta ile hatırlatmalar", exact: true });
  await expect(email).not.toBeChecked();
  await page
    .locator("label")
    .filter({ hasText: /^E-posta ile hatırlatmalar$/ })
    .click();
  await expect(
    page.getByText("Tercih kaydedildi ve güncel durumu okundu.", { exact: true }),
  ).toBeVisible();
  await expect(email).toBeChecked();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.operation).toBe("notification_preferences_set_v1");
  await page.reload();
  await expect(email).toBeChecked();
  await expect(profile.getByLabel("Görünen ad", { exact: true })).toHaveValue(
    "Sentetik yeni görünen ad",
  );
});
test("transactional email uses its own native version and never changes the reminder preference", async ({
  page,
}) => {
  const state = await mockMemberAccount(page);
  const email = page.getByRole("switch", { name: "E-posta ile işlem bildirimleri", exact: true });
  const reminder = page.getByRole("switch", { name: "E-posta ile hatırlatmalar", exact: true });
  await expect(email).not.toBeChecked();
  await email.press("Space");
  await expect(email).toBeChecked();
  await page.reload();
  await expect(email).toBeChecked();
  await expect(reminder).not.toBeChecked();
  await email.press("Space");
  await expect(email).not.toBeChecked();
  await page.reload();
  await expect(email).toBeEnabled();
  await expect(email).not.toBeChecked();
  await expect(reminder).not.toBeChecked();
  expect(
    state.writes.map(({ request }) => [request.purpose, request.enabled, request.expected_version]),
  ).toEqual([
    ["transactional", true, 4],
    ["transactional", false, 5],
  ]);
});
test("Starter account shows native delivery limits and rejects another center from a direct URL", async ({
  page,
}) => {
  const state = await mockMemberAccount(page, { starter: true });
  const transactional = page.getByRole("switch", {
    name: "E-posta ile işlem bildirimleri",
    exact: true,
  });
  const reminder = page.getByRole("switch", { name: "E-posta ile hatırlatmalar", exact: true });
  const mandatory = page.getByRole("switch", { name: "Zorunlu bildirimler", exact: true });
  await expect(mandatory).toBeChecked();
  await expect(mandatory).toBeDisabled();
  await expect(transactional).not.toBeChecked();
  await expect(transactional).toBeDisabled();
  await expect(reminder).not.toBeChecked();
  await expect(reminder).toBeDisabled();
  expect(state.writes).toHaveLength(0);

  const otherCenter = uid(993);
  const preferencesReads = () =>
    state.reads.filter(({ operation }) => operation === "notifications_list_v1").length;
  const before = preferencesReads();
  await page.goto(`/member/account?org=${I.org}&center=${otherCenter}`);
  await expect(page.getByText("Organizasyon ve merkez seç.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "E-posta ile işlem bildirimleri", exact: true }),
  ).toHaveCount(0);
  expect(preferencesReads()).toBe(before);
  expect(state.writes).toHaveLength(0);
});
test("member calendar creates rotates and revokes with explicit review and version rereads", async ({
  page,
}) => {
  const state = await mockMemberAccount(page);
  let dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-1/,
  );
  expect((await scanAccessibility(page, "member-calendar-credential")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(state.links).toHaveLength(1);
  dialog = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-2/,
  );
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  dialog = await confirmCalendar(page, "Bağlantıyı iptal et");
  await expect(dialog.getByText(/İşlem tamamlandı ve güncel durum okundu/)).toBeVisible();
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  expect(state.links[0]!.state).toBe("revoked");
  expect(state.writes).toHaveLength(3);
  expect(state.writes[2]!.request.expected_version).toBe(2);
  const operations = state.reads.map(({ operation }) => operation);
  for (const action of ["create", "rotate", "revoke"]) {
    const write = operations.indexOf(`calendar_link_${action}_v1`);
    const readback = operations.indexOf("calendar_links_get_v1", write + 1);
    expect(write).toBeGreaterThan(-1);
    expect(readback).toBeGreaterThan(write);
    expect(operations.slice(write + 1, readback)).toContain("account_get_v1");
  }
});
test("instructor account creates its own assigned-lesson calendar and hides the secret on reload", async ({
  page,
}) => {
  await mockSessionDetail(page, { existing: true, instructor: true });
  const links = [
    {
      id: uid(981),
      org_id: I.org,
      kinds: ["lessons"],
      state: "active",
      version: 1,
      created_at: "2026-11-16T12:00:00Z",
    },
  ];
  await page.route("**/functions/v1/backend-v1/calendar_links_get_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: links,
          next_cursor: null,
          as_of: "2026-11-16T12:00:00Z",
          service_ready: true,
          supported_kinds: ["lessons", "duties"],
        },
      },
    }),
  );
  await page.route("**/functions/v1/backend-v1/calendar_link_create_v1", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      organization_scope: { org_id: I.org },
      kinds: ["duties"],
    });
    const link = { ...links[0]!, id: uid(982), kinds: ["duties"] };
    links.push(link);
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          operation_id: I.role,
          primary_id: I.account,
          replayed: false,
          related: [],
          link,
          subscription_url: "https://calendar.example.invalid/calendar/synthetic-duties.ics",
        },
      },
    });
  });
  await page.goto("/account");
  await expect(
    page.getByText("Atandığın dersleri Google, Apple veya Outlook takviminde gör."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stüdyo programı aboneliği" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bağlantıyı yenile", exact: true })).toHaveCount(0);
  const dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-duties/,
  );
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Bağlantıyı yenile", exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveCount(0);
});
test("manager creates, rotates and revokes the studio calendar in the selected center", async ({
  page,
}) => {
  await mockStudio(page);
  const center = { org_id: I.org, center_id: I.center };
  const link = {
    ...center,
    id: uid(983),
    kinds: ["studio_program"],
    state: "active",
    version: 0,
    created_at: "2026-11-18T08:00:00Z",
  };
  await page.route("**/functions/v1/backend-v1/calendar_links_get_v1", (route) => {
    expect(route.request().postDataJSON().studio_program_scope).toEqual(center);
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: link.version ? [link] : [],
          next_cursor: null,
          as_of: link.created_at,
          service_ready: true,
          supported_kinds: ["lessons", "duties"],
        },
      },
    });
  });
  for (const action of ["create", "rotate", "revoke"]) {
    await page.route(`**/functions/v1/backend-v1/calendar_link_${action}_v1`, (route) => {
      const request = route.request().postDataJSON();
      if (action !== "revoke") expect(request.organization_scope).toEqual(center);
      if (action === "create") expect(request.kinds).toEqual(["studio_program"]);
      else expect(request).toMatchObject({ link_id: link.id, expected_version: link.version });
      link.version++;
      if (action === "revoke") link.state = "revoked";
      return route.fulfill({
        json: {
          ok: true,
          trace_id: I.role,
          data: {
            operation_id: I.role,
            primary_id: I.account,
            replayed: false,
            related: [],
            link,
            ...(action === "revoke"
              ? {}
              : {
                  subscription_url: `https://calendar.example.invalid/calendar/studio-v${link.version}.ics`,
                }),
          },
        },
      });
    });
  }
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stüdyo programı aboneliği" })).toBeVisible();
  const create = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(create.getByLabel("Kişisel takvim bağlantısı")).toHaveValue(/studio-v1/);
  await create.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Kişisel takvim bağlantısı")).toHaveCount(0);
  const rotate = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(rotate.getByLabel("Kişisel takvim bağlantısı")).toHaveValue(/studio-v2/);
  await rotate.getByRole("button", { name: "Kapat", exact: true }).click();
  const revoke = await confirmCalendar(page, "Bağlantıyı iptal et");
  await expect(revoke.getByRole("button", { name: "Kapat", exact: true })).toBeVisible();
  await expect(revoke.getByLabel("Kişisel takvim bağlantısı")).toHaveCount(0);
  await revoke.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bağlantıyı yenile", exact: true })).toHaveCount(0);
});
test("unknown calendar uses the same key and freezes navigation without exposing credential in URL or storage", async ({
  page,
}) => {
  const state = await mockMemberAccount(page, { unknownCalendar: true });
  const dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByText(/İşlemin sonucu bilinmiyor/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Üye menüsü", exact: true })
      .getByRole("link", { name: "Rezervasyonlarım", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-1/,
  );
  expect(state.writes).toHaveLength(2);
  expect(state.links).toHaveLength(1);
  expect(state.writes[0]!.request.operation_key).toBe(state.writes[1]!.request.operation_key);
  expect(page.url()).not.toContain("synthetic");
  expect(
    await page.evaluate("JSON.stringify(localStorage)+JSON.stringify(sessionStorage)"),
  ).not.toContain("calendar.example.invalid");
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("acknowledged calendar retries only metadata reads", async ({ page }) => {
  const state = await mockMemberAccount(page, { ackUnread: true });
  const dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByText(/İşlem kaydedildi. Güncel durumu yeniden oku/)).toBeVisible();
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(dialog.getByText(/İşlem tamamlandı ve güncel durum okundu/)).toBeVisible();
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-1/,
  );
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("unknown preference recovers receipt with one writer", async ({ page }) => {
  const state = await mockMemberAccount(page, { unknownPreference: true });
  await page
    .getByRole("switch", { name: "Uygulama içi hatırlatmalar", exact: true })
    .press("Space");
  await expect(page.getByText(/Kaydetme sonucu bilinmiyor/)).toBeVisible();
  await expect(page.getByLabel("Görünen ad", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "İşlem durumunu oku", exact: true }).click();
  await expect(
    page.getByText("Tercih kaydedildi ve güncel durumu okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await expect(
    page.getByRole("switch", { name: "Uygulama içi hatırlatmalar", exact: true }),
  ).not.toBeChecked();
});
test("denied account sources stay unavailable and recover by reading", async ({ page }) => {
  const state = await mockMemberAccount(page, { denied: true });
  await expect(page.getByText("Takvim bağlantıları okunamadı.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Paket bitiş hatırlatmaları", exact: true }),
  ).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.setDenied(false);
  for (const message of ["Takvim bağlantıları okunamadı.", "Bildirim tercihleri okunamadı."]) {
    const alert = page.getByRole("alert").filter({ hasText: message });
    await alert.getByRole("button", { name: "Yeniden dene", exact: true }).click();
    await expect(alert).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeEnabled();
});
test("changed calendar version requires a new review without sending a stale writer", async ({
  page,
}) => {
  const state = await mockMemberAccount(page);
  let dialog = await confirmCalendar(page, "Takvim bağlantısı oluştur");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  state.links[0]!.version++;
  dialog = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(dialog.getByText(/Bağlantı değişti/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  dialog = await confirmCalendar(page, "Bağlantıyı yenile");
  await expect(dialog.getByLabel("Kişisel takvim bağlantısı", { exact: true })).toHaveValue(
    /synthetic-3/,
  );
  expect(state.writes[1]!.request.expected_version).toBe(2);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("unready calendar service disables credential creation while metadata remains readable", async ({
  page,
}) => {
  const state = await mockMemberAccount(page, { serviceReady: false });
  await expect(
    page.getByRole("button", { name: "Takvim bağlantısı oluştur", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Takvim bağlantısı hizmeti henüz hazır değil/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.evaluate("document.documentElement.dataset.theme='dark'");
});
