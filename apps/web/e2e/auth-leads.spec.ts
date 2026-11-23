import { test, expect } from "./test.js";
import { clickWorkspaceLink } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import { mockLeads, openLead, closeLead, leadIds } from "./leads-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
const footer = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="sheet-footer"]');
test("CRM stage and trial totals use the native summary instead of the visible cards", async ({
  page,
}) => {
  const state = await mockLeads(page);
  await expect(page.getByText("24", { exact: true })).toBeVisible();
  const totals = page.getByLabel("Deneme dersi sayaçları", { exact: true });
  await expect(totals.locator("dd")).toHaveText(["8", "5", "3"]);
  await page.getByRole("radio", { name: "Görüşülüyor", exact: true }).click();
  await expect
    .poll(() => state.reads.filter((read) => read.operation === "leads_list_v1").at(-1)?.request)
    .toMatchObject({ stage_key: "talk", include_pipeline_summary: true });
  await expect(page.getByText("24", { exact: true })).toBeVisible();
  await expect(totals.locator("dd")).toHaveText(["8", "5", "3"]);
});
test("Starter plan allows the basic candidate list after pipeline denial", async ({ page }) => {
  const state = await mockLeads(page, { starter: true });
  await expect(page.getByRole("button", { name: "Aday ekle", exact: true })).toBeEnabled();
  await expect(page.getByRole("tab", { name: "Pano", exact: true })).toBeDisabled();
  const dialog = await openLead(page);
  await expect(
    dialog.getByRole("button", { name: "Takip veya not ekle", exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByRole("button", { name: /deneme|üyeliğe çevir/i })).toHaveCount(0);
  expect(
    state.reads
      .filter((read) => read.operation === "leads_list_v1")
      .map((read) => read.request.include_pipeline),
  ).toEqual([true, undefined]);
  expect(state.writes).toHaveLength(0);
});
test("phone lead creation keeps person and candidate writes separate without an invitation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 750 });
  const state = await mockLeads(page);
  const source = { scope: "organization", key: "phone", version: 2 };
  const defaults = { source: "phone", interest: "Akşam Tango" };
  await page.route("**/functions/v1/backend-v1/settings_catalog_get_v1", (route) => {
    const request = route.request().postDataJSON();
    if (request.scope !== "center") return route.fallback();
    expect(request).toMatchObject({ org_id: I.org, center_id: I.center });
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          scope: "center",
          catalog_version: 24,
          fields: [],
          defaults: {},
          brand_packages: [],
          limitations: [],
          preparation_templates: {
            availability: [],
            packages: [],
            package_currency_suggestion: "TRY",
            crm: [{ source, template: { key: "phone", name: "Telefon başvurusu", defaults } }],
          },
        },
      },
    });
  });
  await page.route("**/functions/v1/backend-v1/settings_preparation_resolve_v1", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      source,
      kind: "crm",
    });
    return route.fulfill({
      json: { ok: true, trace_id: I.role, data: { source, kind: "crm", defaults } },
    });
  });
  await page.getByRole("button", { name: "Aday ekle", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Hazırlık şablonu" })
    .selectOption({ label: "Telefon başvurusu · Organizasyon" });
  await dialog.getByRole("button", { name: "Taslağa uygula", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await dialog.getByLabel("Ad soyad", { exact: false }).fill("Telefon adayı");
  await dialog.getByLabel("Telefon", { exact: false }).fill("+905550000001");
  await footer(page)
    .getByRole("button", { name: "Kişiyi oluştur ve devam et", exact: true })
    .click();
  await expect(dialog.getByText(/Kişi oluşturuldu. Aday kaydını ayrı/)).toBeVisible();
  expect(state.effects).toEqual(["person_create_v1"]);
  expect(state.leads).toHaveLength(1);
  await dialog.getByRole("button", { name: "Aday kaydına devam et", exact: true }).click();
  await expect(dialog.getByLabel("İlgilendiği ders", { exact: true })).toHaveValue(
    defaults.interest,
  );
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toEqual(["person_create_v1", "lead_save_v1"]);
  expect(state.writes[0]!.request.contacts).toEqual([{ kind: "phone", value: "+905550000001" }]);
  expect(state.writes[1]!.request).toMatchObject(defaults);
  await closeLead(page);
  await expect(page.getByRole("button", { name: "Telefon adayı", exact: true })).toBeVisible();
});
test("stage selection requires a loss reason and never converts a candidate", async ({ page }) => {
  const state = await mockLeads(page);
  await page.getByRole("combobox", { name: "Aday A için aşama", exact: true }).selectOption("lost");
  const dialog = page.getByRole("dialog");
  const lossReason = dialog.getByLabel("Kayıp nedeni", { exact: true });
  await expect(lossReason).not.toHaveAttribute("aria-describedby", /lead-loss-error/);
  await expect(footer(page).getByRole("button", { name: "Kaydet", exact: true })).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(lossReason).toHaveAttribute("aria-invalid", "true");
  await expect(lossReason).toHaveAccessibleDescription(/.+/);
  expect(state.effects).toHaveLength(0);
  expect((await scanAccessibility(page, "lead-invalid-loss-reason")).violations).toEqual([]);
  await dialog.getByLabel("Kayıp nedeni", { exact: true }).selectOption("price");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.leads[0]!.pipeline?.loss_reason).toBe("price");
  expect(state.leads[0]!.state).toBe("open");
  expect(state.effects).toEqual(["lead_save_v1"]);
  await closeLead(page);
});
test("unknown lead save freezes editing and recovers its receipt with one writer", async ({
  page,
}) => {
  const state = await mockLeads(page, { unknown: "lead_save_v1" });
  const dialog = await openLead(page);
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).fill("Vals");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  await expect(dialog.getByLabel("İlgilendiği ders", { exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await closeLead(page);
});
test("acknowledged lead save repeats only reads", async ({ page }) => {
  const state = await mockLeads(page, { ackUnread: true });
  const dialog = await openLead(page);
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).fill("Vals");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/İşlem kaydedildi; güncel kayıt okunamadı/)).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await closeLead(page);
});
test("stale lead review reloads the actual version before saving", async ({ page }) => {
  const state = await mockLeads(page);
  const dialog = await openLead(page);
  state.leads[0]!.version++;
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).fill("Vals");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/Kayıt değişti. Güncel bilgileri yükleyip/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Güncel kaydı yükle", exact: true }).click();
  await expect(dialog.getByLabel("İlgilendiği ders", { exact: true })).toHaveValue("Tango");
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).fill("Vals");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.request.expected_version).toBe(3);
  await closeLead(page);
});
test("a known followup is completed with its exact activity version", async ({ page }) => {
  const state = await mockLeads(page);
  const tasks = page.getByRole("tab", { name: "Takipler", exact: true });
  const applications = page.getByRole("tab", { name: "Başvurular", exact: true });
  await expect(tasks).toHaveAccessibleDescription("Bekleyen iş sayısı 1");
  await expect(applications).toHaveAccessibleDescription("Bekleyen iş sayısı 1");
  const dialog = await openLead(page);
  await dialog.getByRole("button", { name: "İlk görüşmeyi yap", exact: true }).click();
  await dialog.getByLabel("Faaliyet türü", { exact: true }).selectOption("outcome");
  await dialog.getByLabel("Sonuç", { exact: true }).fill("Görüşme tamamlandı");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.request).toMatchObject({
    activity_id: leadIds.activity,
    expected_version: 2,
    kind: "outcome",
  });
  expect(state.activities[0]!.state).toBe("completed");
  await closeLead(page);
  await expect(tasks).toHaveAccessibleDescription("Bekleyen iş sayısı 0");
  await expect(applications).toHaveAccessibleDescription("Bekleyen iş sayısı 1");
});
test("conversion keeps the same person, refreshes Members and creates no sale or invitation", async ({
  page,
}) => {
  const state = await mockLeads(page);
  const memberGrid = page.getByRole("grid", { name: "Üyeler", exact: true });
  const candidate = memberGrid.getByRole("row").filter({ hasText: "Aday A" });
  await clickWorkspaceLink(page, "Üyeler");
  await expect(candidate.getByText("Öğrencilik yok", { exact: true })).toBeVisible();
  await clickWorkspaceLink(page, "Adaylar");
  const dialog = await openLead(page);
  await dialog.getByRole("button", { name: "Üyeliğe çevir", exact: true }).click();
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toEqual(["lead_convert_v1"]);
  expect(state.leads[0]!.person_id).toBe(leadIds.person);
  expect(state.leads[0]!.state).toBe("converted");
  await closeLead(page);
  await openLead(page);
  await expect(
    page.getByRole("dialog").getByLabel("İlgilendiği ders", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Üyeliğe çevir", exact: true }),
  ).toBeDisabled();
  await closeLead(page);
  await clickWorkspaceLink(page, "Üyeler");
  await expect(candidate.getByText("Aktif", { exact: true })).toBeVisible();
  const directoryReads = state.reads.filter(
    ({ operation, request }) => operation === "people_list_v1" && request.include_member_summary,
  );
  expect(directoryReads).toHaveLength(2);
});
test("native staff conversion denial preserves the candidate", async ({ page }) => {
  const state = await mockLeads(page, { staff: true });
  const dialog = await openLead(page);
  await dialog.getByRole("button", { name: "Üyeliğe çevir", exact: true }).click();
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/İşlem reddedildi/)).toBeVisible();
  expect(state.effects).toHaveLength(0);
  expect(state.leads[0]!.state).toBe("open");
  await closeLead(page);
});
test("application phone suggestion stays a proposal until explicit person match and review", async ({
  page,
}) => {
  const state = await mockLeads(page);
  await page.getByRole("tab", { name: "Başvurular", exact: true }).click();
  await page.getByRole("button", { name: "Başvuran Örnek", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Telefon eşleşmesi önerileri", exact: true }),
  ).toBeVisible();
  expect(state.effects).toHaveLength(0);
  await dialog.getByRole("button", { name: "Seç", exact: true }).click();
  await expect(dialog.getByLabel("Kişi", { exact: true })).toHaveValue(leadIds.person);
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.app.person_id).toBe(leadIds.person);
  expect(state.effects).toEqual(["public_application_review_v1"]);
  await closeLead(page);
});
test("application close preserves its intake without creating a lead", async ({ page }) => {
  const state = await mockLeads(page);
  const applications = page.getByRole("tab", { name: "Başvurular", exact: true });
  await expect(applications).toHaveAccessibleDescription("Bekleyen iş sayısı 1");
  await applications.click();
  await page.getByRole("button", { name: "Başvuran Örnek", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Başvuru işlemi", { exact: true }).selectOption("close");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.app.state).toBe("closed");
  expect(state.app.intake.phone).toBe("+905550000000");
  expect(state.leads).toHaveLength(1);
  await closeLead(page);
  await expect(applications).toHaveAccessibleDescription("Bekleyen iş sayısı 0");
  const tab = page.getByRole("tabpanel", { name: "Başvurular", exact: true });
  await expect(tab.getByRole("button", { name: "Başvuran Örnek", exact: true })).toHaveCount(0);
  await tab.getByRole("radio", { name: "Tamamlanan", exact: true }).click();
  await expect(tab.getByRole("button", { name: "Başvuran Örnek", exact: true })).toBeVisible();
  expect(
    state.reads.filter((read) => read.request.operation === "public_application_review_v1").at(-1)
      ?.request,
  ).toMatchObject({
    selector: { key: { states: ["reviewed", "closed"] } },
    page: { limit: 20 },
  });
});
test("denied lead listing has read recovery and no invented totals", async ({ page }) => {
  const state = await mockLeads(page, { denied: true });
  await expect(page.getByText("Aday kaydı okunamadı.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aday ekle", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.setDenied(false);
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aday A", exact: true })).toBeVisible();
});
test("keyboard kanban movement opens review before any native writer", async ({ page }) => {
  const state = await mockLeads(page);
  const handle = page.getByRole("button", {
    name: "Aday A için aşamayı sürükleyerek seç",
    exact: true,
  });
  await handle.focus();
  await handle.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("hedef: Yeni");
  expect((await scanAccessibility(page, "lead-keyboard-grabbed")).violations).toEqual([]);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText("hedef: Görüşülüyor");
  await page.keyboard.press("Space");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Aşamayı değiştir", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.leads[0]!.pipeline?.stage.key).toBe("talk");
  await closeLead(page);
});
test.describe("touch input", () => {
  test.use({ hasTouch: true, viewport: { width: 1100, height: 900 } });
  test("touch kanban movement proposes a stage without committing a native writer", async ({
    page,
    browserName,
  }) => {
    const state = await mockLeads(page),
      handle = page.getByRole("button", {
        name: "Aday A için aşamayı sürükleyerek seç",
        exact: true,
      });
    await handle.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox(),
      to = await page.locator('[data-slot="kanban-column"]').nth(1).boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();

    const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : undefined;
    const touchTarget = cdp ? undefined : await handle.elementHandle();
    const start = { x: from!.x + from!.width / 2, y: from!.y + from!.height / 2 };
    const target = { x: to!.x + to!.width / 2, y: to!.y + 70 };
    type TouchPhase = "touchStart" | "touchMove" | "touchEnd";
    const dispatchWebKitTouch = cdp
      ? undefined
      : await page.evaluateHandle<
          (element: unknown, type: TouchPhase, point: typeof start) => void
        >(
          `(element, type, point) => {
            const doc = element.ownerDocument;
            const view = doc.defaultView;
            const contact = doc.createTouch(
              view, element, 1, point.x + view.scrollX, point.y + view.scrollY,
            );
            const active = doc.createTouchList(...(type === "touchEnd" ? [] : [contact]));
            element.dispatchEvent(new TouchEvent(type.toLowerCase(), {
              bubbles: true,
              cancelable: true,
              touches: active,
              targetTouches: active,
              changedTouches: doc.createTouchList(contact),
            }));
          }`,
        );
    async function touch(type: TouchPhase, point: typeof start) {
      if (cdp) {
        await cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [point],
        });
        return;
      }
      // A touch stays bound to its initial target, even if moving the card remounts its handle.
      await dispatchWebKitTouch!.evaluate(
        (dispatch, { element, type, point }) => dispatch(element, type, point),
        { element: touchTarget!, type, point },
      );
    }
    await touch("touchStart", start);
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    for (let step = 1; step <= 5; step++)
      await touch("touchMove", {
        x: start.x + ((target.x - start.x) * step) / 5,
        y: start.y + ((target.y - start.y) * step) / 5,
      });
    await expect(page.getByRole("status")).toContainText("hedef: Görüşülüyor");
    await touch("touchEnd", target);
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Aşamayı değiştir", exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(0);
    await closeLead(page);
    expect(state.leads[0]!.pipeline?.stage.key).toBe("new");
    await cdp?.detach();
    await touchTarget?.dispose();
    await dispatchWebKitTouch?.dispose();
    await page.evaluate(
      "document.documentElement.dataset.theme = 'dark'; document.documentElement.classList.add('dark')",
    );
  });
});
test("an existing person becomes a candidate without a second person writer", async ({ page }) => {
  const state = await mockLeads(page);
  await page.getByRole("button", { name: "Aday ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Mevcut kişi", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Kişi", exact: true })
    .selectOption("019a7b00-0000-7000-8000-000000000005");
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).fill("Tango");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toEqual(["lead_save_v1"]);
  expect(state.people.size).toBe(2);
  await closeLead(page);
});
test("a duplicate open candidate is rejected without creating another person", async ({ page }) => {
  const state = await mockLeads(page);
  await page.getByRole("button", { name: "Aday ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Mevcut kişi", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Kişi", exact: true }).selectOption(leadIds.person);
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).fill("Tango");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/İşlem reddedildi/)).toBeVisible();
  expect(state.effects).toHaveLength(0);
  expect(state.people.size).toBe(2);
  expect(state.leads).toHaveLength(1);
  await closeLead(page);
});
test("a new future followup rereads its native activity and due instant", async ({ page }) => {
  const state = await mockLeads(page);
  const dialog = await openLead(page);
  await dialog.getByRole("button", { name: "Takip veya not ekle", exact: true }).click();
  await dialog.getByLabel("Faaliyet türü", { exact: true }).selectOption("followup");
  const due = dialog.getByLabel("Ne zaman", { exact: true });
  await expect(due).toHaveAttribute("aria-describedby", "lead-due-hint");
  await expect(due).toHaveAccessibleDescription(/saat diliminde/i);
  await due.fill("2026-11-21T16:00");
  await dialog.getByLabel("Not", { exact: true }).fill("Programı paylaş");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toEqual(["crm_activity_save_v1"]);
  expect(state.writes[0]!.request).toMatchObject({
    due_at: "2026-11-21T13:00:00Z",
    kind: "followup",
    note: "Programı paylaş",
  });
  await closeLead(page);
});
test("stale activity reloads its own version before the reviewed update", async ({ page }) => {
  const state = await mockLeads(page);
  const dialog = await openLead(page);
  await dialog.getByRole("button", { name: "İlk görüşmeyi yap", exact: true }).click();
  state.activities[0]!.version++;
  await dialog.getByLabel("Faaliyet türü", { exact: true }).selectOption("outcome");
  await dialog.getByLabel("Sonuç", { exact: true }).fill("Tamamlandı");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/Kayıt değişti. Güncel bilgileri yükleyip/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await dialog.getByRole("button", { name: "Güncel kaydı yükle", exact: true }).click();
  await expect(dialog.getByLabel("Faaliyet türü", { exact: true })).toHaveValue("followup");
  await dialog.getByLabel("Faaliyet türü", { exact: true }).selectOption("outcome");
  await dialog.getByLabel("Sonuç", { exact: true }).fill("Tamamlandı");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes[0]!.request.expected_version).toBe(3);
  await closeLead(page);
});
test("explicit application candidate creation rereads the same native person without client identity writers", async ({
  page,
}) => {
  const state = await mockLeads(page);
  state.app.phone_matches = [];
  state.people.get(leadIds.person)!.contacts = [];
  await page.getByRole("tab", { name: "Başvurular", exact: true }).click();
  await page.getByRole("button", { name: "Başvuran Örnek", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Başvuru işlemi", { exact: true }).selectOption("create_candidate");
  await dialog
    .getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true })
    .press("Space");
  await footer(page).getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.effects).toEqual(["public_application_review_v1"]);
  expect(state.people.get(state.app.person_id!)?.display_name).toBe("Başvuran Örnek");
  expect(state.leads.some((lead) => lead.person_id === state.app.person_id)).toBe(true);
  await closeLead(page);
});
test("an explicitly unbound manager role does not enable application review", async ({ page }) => {
  const state = await mockLeads(page, { unboundManager: true });
  await page.getByRole("tab", { name: "Başvurular", exact: true }).click();
  await page.getByRole("button", { name: "Başvuran Örnek", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Bu işlemi yapma yetkisi bulunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Başvuru işlemi", { exact: true })).toBeDisabled();
  await expect(footer(page).getByRole("button", { name: "Kaydet", exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await closeLead(page);
});
