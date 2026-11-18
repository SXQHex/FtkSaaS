import { test, expect } from "./test.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type { DisciplinePresentation, DisciplineView } from "../src/lib/api-contracts/generated.js";

test("settings creates a master and an explicitly selected center relation with separate review and source versions", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00Z"));
  await mockStudio(page);
  const id = "019a7b00-0000-7000-8000-000000000091",
    relationId = "019a7b00-0000-7000-8000-000000000092";
  const relationFor = (masterId: string) =>
    masterId === id ? relationId : "019a7b00-0000-7000-8000-000000000094";
  const masters = new Map<string, DisciplineView>();
  const relations = new Set<string>();
  let catalogReads = 0;
  const writes: { operation: string; request: Record<string, unknown> }[] = [];
  const presentation: DisciplinePresentation = {
    description: null,
    color: null,
    icon: null,
    display_order: 0,
    public_visible: false,
    allow_center_description: false,
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (operation === "settings_catalog_get_v1" && r.scope === "organization")
      return send({
        scope: "organization",
        catalog_version: 24,
        fields: [{ key: "address", group: "O01", consumer: "public_profile", writable: true }],
        defaults: { address: "" },
        brand_packages: [],
        limitations: [],
      });
    if (operation === "settings_get_v1" && r.scope === "organization")
      return send({
        scope: "organization",
        version: 1,
        values: { address: "" },
        logo: null,
        overridden_fields: [],
        as_of: "2026-11-17T00:00:00Z",
      });
    if (operation === "roles_list_v1")
      return send({
        items: [
          {
            id: relationId,
            person_id: I.self,
            role: "center_manager",
            scope_center_id: I.center,
            state: "active",
            version: 1,
            account_access_granted: true,
          },
          {
            id: I.account,
            person_id: I.self,
            role: "owner",
            scope_center_id: null,
            state: "active",
            version: 1,
            account_access_granted: true,
          },
        ],
        next_cursor: null,
      });
    if (operation === "calendar_get_v1")
      return send({ items: [], next_cursor: null, as_of: "2026-11-17T10:00:00Z" });
    if (operation === "disciplines_list_v1") {
      catalogReads++;
      return send({
        items: [...masters.values()]
          .filter((master) => !r.center_id || relations.has(master.id))
          .map((master) => ({
            ...master,
            presentation: {
              organization: presentation,
              center:
                r.center_id && relations.has(master.id)
                  ? {
                      id: relationFor(master.id),
                      state: "active",
                      version: 1,
                      presentation: { description: null, public_visible: false },
                    }
                  : null,
            },
          })),
        next_cursor: null,
      });
    }
    if (
      operation === "management_state_get_v1" &&
      ["discipline_save_v1", "center_discipline_set_v1"].includes(r.operation)
    ) {
      const master = masters.get(r.selector.key.discipline_id);
      const exists =
        r.operation === "discipline_save_v1"
          ? Boolean(master)
          : relations.has(r.selector.key.discipline_id);
      const entity = {
        type: r.operation === "discipline_save_v1" ? "disciplines" : "center_disciplines",
        id:
          r.operation === "discipline_save_v1"
            ? r.selector.key.discipline_id
            : relationFor(r.selector.key.discipline_id),
      };
      return send({
        items: [
          {
            operation: r.operation,
            exists,
            entity: exists ? entity : null,
            state: exists ? "active" : null,
            versions: exists ? [{ entity, version: 1 }] : [],
            as_of: new Date().toISOString(),
            current: exists
              ? {
                  operation: r.operation,
                  values: {
                    discipline_id: r.selector.key.discipline_id,
                    state: "active",
                    ...(r.operation === "discipline_save_v1" ? { name: master?.name } : {}),
                  },
                }
              : null,
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (operation === "discipline_save_v1") {
      expect(r).not.toHaveProperty("discipline_id");
      expect(r).not.toHaveProperty("expected_version");
      writes.push({ operation, request: r });
      const masterId = masters.size === 0 ? id : "019a7b00-0000-7000-8000-000000000093";
      masters.set(masterId, { id: masterId, name: r.name, state: r.state, version: 1 });
      return send({
        operation_id: I.role,
        primary_id: masterId,
        version: 1,
        replayed: false,
        related: [],
      });
    }
    if (operation === "center_discipline_set_v1") {
      expect(masters.has(r.discipline_id)).toBe(true);
      expect(r.center_id).toBe(I.center);
      expect(r).not.toHaveProperty("expected_version");
      writes.push({ operation, request: r });
      relations.add(r.discipline_id);
      return send({
        operation_id: I.role,
        primary_id: relationFor(r.discipline_id),
        version: 1,
        replayed: false,
        related: [],
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  const lifetime = await page.evaluate("window.__disciplineLifetime = performance.timeOrigin");
  const menu = page.getByRole("navigation", { name: "Ana menü", exact: true });
  await menu.getByRole("link", { name: "Ders programı", exact: true }).click();
  await expect(page.getByRole("button", { name: "Seans ekle", exact: true })).toBeEnabled();
  await menu.getByRole("link", { name: "Ayarlar", exact: true }).click();
  const scope = page.getByLabel("Ayar kapsamı", { exact: true });
  await expect(scope).toBeEnabled();
  for (const [index, name] of ["Sentetik yeni disiplin", "Sentetik ikinci disiplin"].entries()) {
    await scope.selectOption("organization");
    const add = page.getByRole("button", { name: "Disiplin ekle", exact: true });
    await expect(add).toBeEnabled();
    await add.click();
    const sheet = page.getByRole("dialog", { name: "Disiplin", exact: true });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Disiplin adı", { exact: true }).fill(name);
    await sheet.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Disiplin değişikliğini incele", exact: true });
    await expect(review).toBeVisible();
    expect(writes).toHaveLength(index * 2);

    expect((await scanAccessibility(page, "discipline-explicit-review")).violations).toEqual([]);
    await review.getByRole("checkbox").press("Space");
    await expect(review.getByRole("checkbox")).toBeChecked();
    await review
      .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
      .click();
    await expect(sheet.getByRole("status")).toContainText(
      "Güncel disiplin kaydı yeniden okunarak doğrulandı.",
    );
    await sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 1000 });
    await scope.selectOption("center");
    const table = page.getByRole("grid", { name: "Disiplinler", exact: true });
    const row = table.getByRole("row").filter({ hasText: name });
    await expect(row.getByText("Merkez listesinde yok", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Düzenle", exact: true }).click();
    await expect(sheet.getByLabel("Disiplin adı", { exact: true })).toHaveValue(name);
    await expect(sheet.getByLabel("Disiplin adı", { exact: true })).toHaveAttribute("readonly", "");
    await sheet.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
    await expect(review).toBeVisible();
    expect(writes).toHaveLength(index * 2 + 1);
    await review.getByRole("checkbox").press("Space");
    await expect(review.getByRole("checkbox")).toBeChecked();
    await review
      .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
      .click();
    await expect(sheet.getByRole("status")).toContainText(
      "Güncel disiplin kaydı yeniden okunarak doğrulandı.",
    );
    await sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
  }
  expect(writes.map((item) => item.operation)).toEqual([
    "discipline_save_v1",
    "center_discipline_set_v1",
    "discipline_save_v1",
    "center_discipline_set_v1",
  ]);
  expect(writes[0]?.request.operation_key).not.toBe(writes[1]?.request.operation_key);
  expect(masters.size).toBe(2);
  expect(relations.size).toBe(2);
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  await page.setViewportSize({ width: 1440, height: 900 });
  const beforeCalendar = catalogReads;
  await menu.getByRole("link", { name: "Ders programı", exact: true }).click();
  await expect(page.getByRole("button", { name: "Seans ekle", exact: true })).toBeEnabled();
  await expect.poll(() => catalogReads).toBeGreaterThan(beforeCalendar);
  expect(await page.evaluate("performance.timeOrigin")).toBe(lifetime);
  await menu.getByRole("link", { name: "Stüdyo", exact: true }).click();
  await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
  await page.getByRole("button", { name: "Ders türü ekle", exact: true }).click();
  const choices = page.getByRole("dialog").getByRole("combobox", { name: "Disiplin", exact: true });
  await expect(
    choices.getByRole("option", { name: "Sentetik yeni disiplin", exact: true }),
  ).toHaveCount(1);
  await expect(
    choices.getByRole("option", { name: "Sentetik ikinci disiplin", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("dialog").getByRole("button", { name: "Vazgeç", exact: true }).click();
});
