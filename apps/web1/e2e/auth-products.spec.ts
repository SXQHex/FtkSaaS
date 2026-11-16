import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { ProductView } from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
async function productsFixture(page: Page, unknown = false) {
  await mockStudio(page);
  const writes: Record<string, unknown>[] = [];
  const managementReads: Record<string, unknown>[] = [];
  let product: ProductView | undefined;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "products_management_list_v1") {
      managementReads.push(req);
      expect(req).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        view: "products",
        include_timed_products: true,
      });
      return send({
        view: "products",
        as_of: new Date().toISOString(),
        next_cursor: null,
        items:
          product &&
          ["all", "on_sale"].includes(req.status) &&
          (!req.query || product.terms.name.includes(req.query))
            ? [
                {
                  ...product,
                  version: 1,
                  name: product.terms.name,
                  created_at: "2026-11-15T00:00:00Z",
                  state: "active",
                  active_right_holders: 3,
                },
              ]
            : [],
        totals: {
          on_sale: product ? 1 : 0,
          closed: 0,
          archived: 0,
          active_right_holders: 3,
          last_30_days: [
            { currency: "TRY", sales: 2, net_minor: "9007199254740993" },
            { currency: "USD", sales: 1, net_minor: "100" },
          ],
        },
      });
    }
    if (op === "products_list_v1") {
      expect(req.center_id).toBe(I.center);
      expect(req.include_timed_products).toBe(true);
      expect(req).not.toHaveProperty("query");
      return send({
        items: product ? [product] : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "product_publish_v1") {
      writes.push(req);
      if (unknown && writes.length === 1) return route.abort();
      product = {
        id: "019a7b00-0000-7000-8000-000000000021",
        version_id: "019a7b00-0000-7000-8000-000000000022",
        terms: req.terms,
      };
      return send({ primary_id: product.version_id, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1")
      return route.fulfill({
        json: {
          ok: false,
          error: { code: "VALIDATION_FAILED", retryable: false, trace_id: I.role },
        },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/products`);
  await expect(page.getByRole("button", { name: "Paket ekle", exact: true })).toBeEnabled();
  return { writes, managementReads };
}
async function fillProduct(page: Page, timed = false) {
  await page.getByRole("button", { name: "Paket ekle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paket adı", { exact: true }).fill("Sentetik kabul paketi");
  if (timed) await dialog.getByRole("radio", { name: "Süreli, sınırsız", exact: true }).click();
  else await dialog.getByLabel("Ders sayısı", { exact: true }).fill("8");
  await dialog.getByLabel("Fiyat (para biriminin alt birimi)", { exact: true }).fill("120000");
  await dialog.getByLabel("Para birimi", { exact: true }).fill("TRY");
  await dialog.getByLabel("Rezervasyon biçimi", { exact: true }).selectOption("flexible");
  await dialog
    .getByLabel("İade hesabı", { exact: true })
    .selectOption(timed ? "time_ratio" : "credit_ratio");
  await dialog.getByLabel("Geçerli olduğu alan", { exact: true }).selectOption("center_discipline");
  await dialog.getByLabel("Disiplin", { exact: true }).selectOption(I.discipline);
  await dialog.getByRole("checkbox", { name: "Grup ve özel dersler", exact: true }).press("Space");
  await expect(
    dialog.getByRole("checkbox", { name: "Grup ve özel dersler", exact: true }),
  ).toBeChecked();
  return dialog;
}

test("product management reads native center totals and sends search and lifecycle filters to the server", async ({
  page,
}) => {
  const { managementReads, writes } = await productsFixture(page);
  await expect(page.getByText(/90\.071\.992\.547\.409,93.*1,00/)).toBeVisible();
  await page
    .getByRole("radiogroup", { name: "Durum", exact: true })
    .getByRole("radio", { name: "Kapalı", exact: true })
    .click();
  await expect.poll(() => managementReads.at(-1)?.status).toBe("closed");
  await page.getByRole("textbox", { name: "Paket ara", exact: true }).fill("Fixture");
  await expect.poll(() => managementReads.at(-1)?.query).toBe("Fixture");
  expect(managementReads.at(-1)?.page).toEqual({ limit: 20 });
  await page
    .getByRole("radiogroup", { name: "Durum", exact: true })
    .getByRole("radio", { name: "Arşiv", exact: true })
    .click();
  await expect.poll(() => managementReads.at(-1)?.status).toBe("archived");
  expect(writes).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
  expect(
    (await scanAccessibility(page, "product-management-native-totals-mobile")).violations,
  ).toEqual([]);
});

test("mobile product composition reviews explicit terms, publishes, and rereads the native version", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await productsFixture(page);
  await expect(page.getByRole("columnheader")).toHaveCount(6);
  await expect(page.getByPlaceholder("Paket ara")).toBeEnabled();
  expect((await scanAccessibility(page, "products-list")).violations).toEqual([]);
  const dialog = await fillProduct(page, true);
  await dialog.getByLabel("Dönem", { exact: true }).selectOption("week");
  await dialog.getByLabel("Dönemde en fazla ders", { exact: true }).fill("2");
  await expect(dialog.getByLabel("Geçerlilik (gün)", { exact: true })).toBeDisabled();
  expect((await scanAccessibility(page, "product-editor")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Değişiklikleri incele", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Yayınla", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "product-review")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Yayınla", exact: true }).click();
  await expect(
    dialog.getByText("Paket yayınlandı ve güncel sürümü okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.terms).toMatchObject({
    kind: "timed",
    credits: null,
    price_minor: "120000",
    currency: "TRY",
    quota: { period: "week", limit: 2 },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: I.center,
        discipline_id: I.discipline,
        usage_targets: ["lesson"],
      },
    ],
  });
  await dialog.getByRole("button", { name: "Kapat", exact: true }).first().click();
  await expect(page.getByText("Sentetik kabul paketi", { exact: true })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("unknown publish survives a failed receipt read and retries the same frozen operation", async ({
  page,
}) => {
  const state = await productsFixture(page, true);
  const dialog = await fillProduct(page);
  await dialog.getByRole("button", { name: "Değişiklikleri incele", exact: true }).click();
  await dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(dialog.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  await dialog.getByRole("button", { name: "Yayınla", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
  await expect(
    dialog.getByText("Paket yayınlandı ve güncel sürümü okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.operation_key).toBe(state.writes[1]!.operation_key);
  expect(state.writes[0]!.terms).toEqual(state.writes[1]!.terms);
  await dialog.getByRole("button", { name: "Kapat", exact: true }).first().click();
});
