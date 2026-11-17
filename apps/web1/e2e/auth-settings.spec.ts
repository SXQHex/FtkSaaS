import { test, expect } from "./test.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type { DisciplinePresentation, DisciplineView } from "../src/lib/api-contracts/generated.js";

test("settings creates a master and an explicitly selected center relation with separate review and source versions", async ({
  page,
}) => {
  await mockStudio(page);
  const id = "019a7b00-0000-7000-8000-000000000091",
    relationId = "019a7b00-0000-7000-8000-000000000092";
  let master: DisciplineView | undefined,
    relation = false;
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
        ],
        next_cursor: null,
      });
    if (operation === "disciplines_list_v1")
      return send({
        items:
          master && (!r.center_id || relation)
            ? [
                {
                  ...master,
                  presentation: {
                    organization: presentation,
                    center:
                      r.center_id && relation
                        ? {
                            id: relationId,
                            state: "active",
                            version: 1,
                            presentation: { description: null, public_visible: false },
                          }
                        : null,
                  },
                },
              ]
            : [],
        next_cursor: null,
      });
    if (
      operation === "management_state_get_v1" &&
      ["discipline_save_v1", "center_discipline_set_v1"].includes(r.operation)
    ) {
      const exists = r.operation === "discipline_save_v1" ? Boolean(master) : relation;
      const entity = {
        type: r.operation === "discipline_save_v1" ? "disciplines" : "center_disciplines",
        id: r.operation === "discipline_save_v1" ? id : relationId,
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
                    discipline_id: id,
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
      master = { id, name: r.name, state: r.state, version: 1 };
      return send({
        operation_id: I.role,
        primary_id: id,
        version: 1,
        replayed: false,
        related: [],
      });
    }
    if (operation === "center_discipline_set_v1") {
      expect(r.discipline_id).toBe(id);
      expect(r.center_id).toBe(I.center);
      expect(r).not.toHaveProperty("expected_version");
      writes.push({ operation, request: r });
      relation = true;
      return send({
        operation_id: I.role,
        primary_id: relationId,
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
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/settings`);
  const scope = page.getByLabel("Ayar kapsamı", { exact: true });
  await expect(scope).toBeEnabled();
  await scope.selectOption("organization");
  const add = page.getByRole("button", { name: "Disiplin ekle", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  const sheet = page.getByRole("dialog", { name: "Disiplin", exact: true });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Disiplin adı", { exact: true }).fill("Sentetik yeni disiplin");
  await sheet.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Disiplin değişikliğini incele", exact: true });
  await expect(review).toBeVisible();
  expect(writes).toHaveLength(0);

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
  await expect(table.getByText("Merkez listesinde yok", { exact: true })).toBeVisible();
  await table.getByRole("button", { name: "Düzenle", exact: true }).click();
  await expect(sheet.getByLabel("Disiplin adı", { exact: true })).toHaveValue(
    "Sentetik yeni disiplin",
  );
  await expect(sheet.getByLabel("Disiplin adı", { exact: true })).toHaveAttribute("readonly", "");
  await sheet.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(review).toBeVisible();
  expect(writes).toHaveLength(1);
  await review.getByRole("checkbox").press("Space");
  await expect(review.getByRole("checkbox")).toBeChecked();
  await review
    .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
    .click();
  await expect(sheet.getByRole("status")).toContainText(
    "Güncel disiplin kaydı yeniden okunarak doğrulandı.",
  );
  await sheet.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(writes.map((item) => item.operation)).toEqual([
    "discipline_save_v1",
    "center_discipline_set_v1",
  ]);
  expect(writes[0]?.request.operation_key).not.toBe(writes[1]?.request.operation_key);
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
});
