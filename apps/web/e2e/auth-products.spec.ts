import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { ProductView, ProductLifecycleState } from "@ftksaas/api-contracts";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
const seedProduct: ProductView = {
  id: "019a7b00-0000-7000-8000-000000000021",
  version_id: "019a7b00-0000-7000-8000-000000000022",
  terms: {
    name: "Sentetik mevcut paket",
    kind: "credits",
    booking_mode: "flexible",
    credits: 8,
    price_minor: "120000",
    currency: "TRY",
    quota: null,
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "credit_ratio" },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: I.center,
        discipline_id: I.discipline,
        usage_targets: ["lesson"],
      },
    ],
  },
};
async function productsFixture(
  page: Page,
  unknown = false,
  withProduct = false,
  initialState: ProductLifecycleState = "active",
) {
  await mockStudio(page);
  const writes: Record<string, unknown>[] = [];
  const managementReads: Record<string, unknown>[] = [];
  let product: ProductView | undefined = withProduct ? structuredClone(seedProduct) : undefined;
  const lifecycle = {
    state: initialState,
    version: 1,
    lostReply: false,
    failResult: 0,
    effects: 0,
    conflict: false,
  };
  const stateWrites: Record<string, unknown>[] = [],
    keys = new Set<string>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "products_management_list_v1") {
      managementReads.push(req);
      expect(req).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        include_timed_products: true,
      });
      if (req.view === "versions")
        return send({
          view: "versions",
          as_of: "2026-11-16T00:00:00Z",
          next_cursor: req.page.cursor ? null : "older-versions",
          items: product
            ? [
                {
                  id: req.page.cursor ? "019a7b00-0000-7000-8000-000000000020" : product.version_id,
                  product_id: product.id,
                  version: 1,
                  created_at: "2026-11-15T00:00:00Z",
                  terms: req.page.cursor
                    ? { ...seedProduct.terms, name: "Önceki sürüm", price_minor: "100000" }
                    : product.terms,
                },
              ]
            : [],
          totals: { on_sale: 0, closed: 0, archived: 0, active_right_holders: 3, last_30_days: [] },
        });
      if (req.view === "sales")
        return send({
          view: "sales",
          as_of: "2026-11-16T00:00:00Z",
          next_cursor: null,
          items: [
            {
              id: "019a7b00-0000-7000-8000-000000000024",
              version: 1,
              created_at: "2026-11-15T00:00:00Z",
              person_id: I.self,
              display_name: "Sentetik kişi",
              product_version_id: seedProduct.version_id,
              product_name: "Geçmiş satış",
              net_minor: "9007199254740993",
              currency: "TRY",
              state: "active",
            },
          ],
          totals: { on_sale: 0, closed: 0, archived: 0, active_right_holders: 3, last_30_days: [] },
        });
      if (req.product_id && lifecycle.failResult > 0) {
        lifecycle.failResult--;
        return route.abort();
      }
      const status =
        lifecycle.state === "active"
          ? "on_sale"
          : lifecycle.state === "inactive"
            ? "closed"
            : "archived";
      return send({
        view: "products",
        as_of: new Date().toISOString(),
        next_cursor: null,
        items:
          product &&
          ["all", status].includes(req.status) &&
          (!req.query || product.terms.name.includes(req.query))
            ? [
                {
                  ...product,
                  version: lifecycle.version,
                  name: product.terms.name,
                  created_at: "2026-11-15T00:00:00Z",
                  state: lifecycle.state,
                  active_right_holders: 3,
                },
              ]
            : [],
        totals: {
          on_sale: product && lifecycle.state === "active" ? 1 : 0,
          closed: product && lifecycle.state === "inactive" ? 1 : 0,
          archived: product && lifecycle.state === "archived" ? 1 : 0,
          active_right_holders: 3,
          last_30_days: [
            { currency: "TRY", sales: 2, net_minor: "9007199254740993" },
            { currency: "USD", sales: 1, net_minor: "100" },
          ],
        },
      });
    }
    if (op === "product_state_set_v1") {
      stateWrites.push(req);
      expect(req).not.toHaveProperty("terms");
      expect(req.product_id).toBe(product?.id);
      if (!keys.has(req.operation_key)) {
        if (lifecycle.conflict)
          return route.fulfill({
            json: {
              ok: false,
              error: { code: "VERSION_CONFLICT", retryable: false, trace_id: I.role },
            },
          });
        expect(req.expected_version).toBe(lifecycle.version);
        keys.add(req.operation_key);
        lifecycle.version++;
        lifecycle.effects++;
        lifecycle.state =
          req.action === "open" ? "active" : req.action === "close" ? "inactive" : "archived";
        if (lifecycle.lostReply) {
          lifecycle.lostReply = false;
          return route.abort();
        }
      }
      return send({ primary_id: product!.id, changed: [], jobs: [] });
    }
    if (op === "products_list_v1") {
      expect(req.center_id).toBe(I.center);
      expect(req.include_timed_products).toBe(true);
      expect(req).not.toHaveProperty("query");
      return send({
        items: product && lifecycle.state === "active" ? [product] : [],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "product_publish_v1") {
      writes.push(req);
      if (unknown && writes.length === 1) return route.abort();
      if (withProduct) {
        expect(req.expected_version).toBe(lifecycle.version);
        lifecycle.version++;
      }
      product = {
        id: "019a7b00-0000-7000-8000-000000000021",
        version_id: withProduct
          ? "019a7b00-0000-7000-8000-000000000023"
          : "019a7b00-0000-7000-8000-000000000022",
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
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/products`);
  await expect(page.getByRole("button", { name: "Paket ekle", exact: true })).toBeEnabled();
  return { writes, managementReads, lifecycle, stateWrites };
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
  const recentSales = page.getByRole("article").filter({ hasText: "Son 30 gün satış" });
  const activeHolders = page.getByRole("article").filter({ hasText: "Aktif hak sahibi" });
  await expect(recentSales.getByText("3", { exact: true })).toBeVisible();
  await expect(activeHolders.getByText("3", { exact: true })).toBeVisible();
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
  await expect(recentSales.getByText("3", { exact: true })).toBeVisible();
  await expect(activeHolders.getByText("3", { exact: true })).toBeVisible();
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
  const grid = page.getByRole("grid", { name: "Paketler", exact: true });
  await expect(grid.getByRole("columnheader")).toHaveCount(6);
  await expect(
    grid.getByRole("rowheader", { name: "Henüz paket yok.", exact: true }),
  ).toHaveAttribute("colspan", "6");
  await expect(grid.getByRole("gridcell")).toHaveCount(0);
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
  const productRow = grid.getByRole("row").filter({ hasText: "Sentetik kabul paketi" });
  await expect(productRow.getByRole("rowheader")).toContainText("Sentetik kabul paketi");
  await expect(productRow.getByRole("gridcell")).toHaveCount(5);
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

test("product lifecycle keeps history and recovers one close effect, then opens and archives with fresh versions", async ({
  page,
}) => {
  const state = await productsFixture(page, false, true);
  await page.getByText(seedProduct.terms.name, { exact: true }).click();
  let editor = page.getByRole("dialog");
  const versions = editor.getByRole("region", { name: "Sürümler", exact: true });
  await expect(versions.getByText(seedProduct.terms.name, { exact: true })).toBeVisible();
  await versions.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(versions.getByText("Önceki sürüm", { exact: true })).toBeVisible();
  expect(state.managementReads.at(-1)).toMatchObject({
    product_id: seedProduct.id,
    view: "versions",
    page: { limit: 20, cursor: "older-versions" },
  });
  await versions.getByRole("button", { name: "Önceki sayfa", exact: true }).click();
  await expect(versions.getByText(seedProduct.terms.name, { exact: true })).toBeVisible();
  await expect(editor.getByText("Geçmiş satış", { exact: true })).toBeVisible();
  await editor.getByRole("switch", { name: "Satışta", exact: true }).press("Space");
  let confirm = page.getByRole("alertdialog");
  await expect(confirm.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await expect(confirm.getByRole("button", { name: "Satışa kapat", exact: true })).toBeDisabled();
  await confirm.getByLabel("İşlem gerekçesi", { exact: true }).fill("Kontrollü kapatma");
  expect(state.stateWrites).toHaveLength(0);
  state.lifecycle.lostReply = true;
  await confirm.getByRole("button", { name: "Satışa kapat", exact: true }).click();
  await expect(
    confirm.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  state.lifecycle.failResult = 1;
  await confirm.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }).click();
  await confirm.getByRole("button", { name: "Güncel kaydı oku", exact: true }).click();
  await expect(
    confirm.getByText("Satış durumu kaydedildi ve güncel ürün okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.stateWrites).toHaveLength(2);
  expect(state.stateWrites[0]!.operation_key).toBe(state.stateWrites[1]!.operation_key);
  expect(state.lifecycle.effects).toBe(1);
  expect(state.stateWrites[0]).not.toHaveProperty("terms");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect((await scanAccessibility(page, "product-close-result-mobile")).violations).toEqual([]);
  await confirm.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const action of ["open", "archive"] as const) {
    await page.getByText(seedProduct.terms.name, { exact: true }).click();
    editor = page.getByRole("dialog");
    await expect(editor.getByText("Geçmiş satış", { exact: true })).toBeVisible();
    if (action === "open")
      await editor.getByRole("switch", { name: "Satışta", exact: true }).press("Space");
    else await editor.getByRole("button", { name: "Arşivle", exact: true }).click();
    confirm = page.getByRole("alertdialog");
    await confirm.getByLabel("İşlem gerekçesi", { exact: true }).fill(`Kontrollü ${action}`);
    await confirm
      .getByRole("button", { name: action === "open" ? "Satışa aç" : "Arşivle", exact: true })
      .click();
    await expect(
      confirm.getByText("Satış durumu kaydedildi ve güncel ürün okundu.", { exact: true }),
    ).toBeVisible();
    await confirm.getByRole("button", { name: "Vazgeç", exact: true }).click();
  }
  expect(state.lifecycle.effects).toBe(3);
  expect(state.stateWrites.map((write) => write.expected_version)).toEqual([1, 1, 2, 3]);
  expect(state.lifecycle.state).toBe("archived");
  expect(state.writes).toHaveLength(0);
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
});

test("a closed product publishes a renamed immutable version and rereads history without opening sales", async ({
  page,
}) => {
  const state = await productsFixture(page, false, true, "inactive");
  const historyReads = () => state.managementReads.filter((request) => request.view === "versions");
  const previousReads = historyReads().length;
  await page.getByText(seedProduct.terms.name, { exact: true }).click();
  const editor = page.getByRole("dialog");
  const versions = editor.getByRole("region", { name: "Sürümler", exact: true });
  await expect(versions.getByText(seedProduct.terms.name, { exact: true })).toBeVisible();
  expect(historyReads()).toHaveLength(previousReads + 1);
  await editor.getByLabel("Paket adı", { exact: true }).fill("Yeni sürüm adı");
  await editor.getByRole("button", { name: "Değişiklikleri incele", exact: true }).click();
  await editor.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await editor.getByRole("button", { name: "Yayınla", exact: true }).click();
  await expect(
    editor.getByText("Paket yayınlandı ve güncel sürümü okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    expected_version: 1,
    product_id: seedProduct.id,
    terms: { name: "Yeni sürüm adı" },
  });
  expect(historyReads()).toHaveLength(previousReads + 2);
  expect(state.lifecycle.state).toBe("inactive");
  expect(state.stateWrites).toHaveLength(0);
  await editor.getByRole("button", { name: "Kapat", exact: true }).first().click();
  await page.getByText("Yeni sürüm adı", { exact: true }).click();
  await expect(versions.getByText("Yeni sürüm adı", { exact: true })).toBeVisible();
  expect(historyReads()).toHaveLength(previousReads + 2);
  await editor.getByRole("button", { name: "Kapat", exact: true }).first().click();
});
