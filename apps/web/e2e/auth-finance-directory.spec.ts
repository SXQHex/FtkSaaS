import { activate } from "./device-input.js";
import { test, expect } from "./test.js";
import { mockFinanceDirectory } from "./finance-directory-fixture.js";
import { scanAccessibility } from "./accessibility.js";
test("center finance uses native cursor and explicitly submitted server filters without summing currencies", async ({
  page,
}) => {
  const state = await mockFinanceDirectory(page);
  const grid = page.getByRole("grid", { name: "Hareketler", exact: true });
  await expect(grid.getByText("8 derslik paket", { exact: true })).toBeVisible();
  await expect(page.getByText("TRY ₺1.000,00 · EUR €200,00", { exact: true })).toBeVisible();
  await activate(page.getByRole("button", { name: "Sonraki sayfa", exact: true }));
  await expect(grid.getByText("İkinci sayfa üyesi", { exact: true })).toBeVisible();
  expect(state.requests.at(-1)?.page.cursor).toBe("native-next");
  const before = state.requests.length;
  await page.getByRole("combobox", { name: "İşlem türü", exact: true }).selectOption("collection");
  await page.getByRole("combobox", { name: "Yöntem", exact: true }).selectOption("cash");
  await page.getByRole("textbox", { name: "Üye ara", exact: true }).fill("Örnek");
  expect(state.requests).toHaveLength(before);
  await activate(page.getByRole("button", { name: "Ara", exact: true }));
  await expect.poll(() => state.requests.at(-1)?.query).toBe("Örnek");
  expect(state.requests.at(-1)).toMatchObject({
    kind: "collection",
    method: "cash",
    page: { limit: 20, sort: "created_at_asc" },
  });
  expect(state.requests.at(-1)?.page.cursor).toBeUndefined();
  await expect(grid.getByText("8 derslik paket", { exact: true })).toHaveCount(0);
  expect((await scanAccessibility(page, "finance-native-directory")).violations).toEqual([]);
});
test("mobile center debt and credit pages preserve per-currency identity and read only visible person balances", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  await page.emulateMedia({ colorScheme: "dark" });
  const state = await mockFinanceDirectory(page);
  await expect(page.getByRole("button", { name: "Dönemi göster", exact: true })).toBeVisible();
  await activate(page.getByRole("tab", { name: /Açık borçlar/ }));
  const debt = page.getByRole("grid", { name: "Açık borçlar", exact: true });
  await expect(debt.getByRole("columnheader", { name: "Kaynak satış", exact: true })).toBeVisible();
  await expect(debt.getByText("8 derslik paket", { exact: true })).toBeVisible();
  await activate(page.getByRole("tab", { name: /Alacaklar/ }));
  const credits = page.getByRole("grid", { name: "Alacaklar", exact: true });
  await expect(credits.getByRole("row")).toHaveCount(3);
  await expect.poll(() => state.personalReads.length).toBe(2);
  await expect(credits.getByText("₺600,00", { exact: true })).toBeVisible();
  await expect(credits.getByText("€100,00", { exact: true })).toBeVisible();
  expect(new Set(state.personalReads.map((row) => row.person_id)).size).toBe(1);
  expect(state.personalReads.map((row) => row.currency).sort((a, b) => a.localeCompare(b))).toEqual(
    ["EUR", "TRY"],
  );
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  expect((await scanAccessibility(page, "finance-native-mobile-credits")).violations).toEqual([]);
});
test("directory denial is distinct from an empty authorized list and preserves the existing person flow", async ({
  page,
}) => {
  const state = await mockFinanceDirectory(page, { denied: true });
  await expect(
    page.getByText(
      "Merkez finansı okunamadı. Yetkiyi ve dönemi kontrol edip yeniden deneyebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("TRY ₺1.000,00 · EUR €200,00", { exact: true })).toHaveCount(0);
  await activate(page.getByRole("button", { name: "Üye bazlı finans", exact: true }));
  await expect(page.getByRole("button", { name: "Finansı getir", exact: true })).toBeVisible();
  expect(state.personalReads).toHaveLength(0);
  expect(state.studio.writes).toHaveLength(0);
  expect(
    (await scanAccessibility(page, "finance-denied-directory-person-context")).violations,
  ).toEqual([]);
});
test("date-only period changes require submit, use center timezone and reject reversed boundaries", async ({
  page,
}) => {
  const state = await mockFinanceDirectory(page),
    before = state.requests.length;
  await page.getByLabel("Başlangıç günü", { exact: true }).fill("2026-11-16");
  await page.getByLabel("Bitiş günü (dahil)", { exact: true }).fill("2026-11-15");
  expect(state.requests).toHaveLength(before);
  await activate(page.getByRole("button", { name: "Dönemi göster", exact: true }));
  await expect(
    page.getByText("Geçerli başlangıç ve bitiş günlerini seç. Dönem en fazla 366 gün olabilir.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.requests).toHaveLength(before);
  await page.getByLabel("Başlangıç günü", { exact: true }).fill("2026-11-01");
  await activate(page.getByRole("button", { name: "Dönemi göster", exact: true }));
  await expect.poll(() => state.requests.at(-1)?.interval.ends_at).toBe("2026-11-15T21:00:00Z");
  expect(state.requests.at(-1)?.interval.starts_at).toBe("2026-10-31T21:00:00Z");
  expect(state.studio.writes).toHaveLength(0);
});
test("denied credit balance reads remain unknown rather than zero and malformed directory rows never render", async ({
  page,
}) => {
  const state = await mockFinanceDirectory(page, { creditDenied: true });
  await activate(page.getByRole("tab", { name: /Alacaklar/ }));
  const credits = page.getByRole("grid", { name: "Alacaklar", exact: true });
  await expect.poll(() => state.personalReads.length).toBe(2);
  await expect(credits.getByText("Bilinmiyor", { exact: true })).toHaveCount(2);
  await expect(credits.getByText("₺0,00", { exact: true })).toHaveCount(0);
  const context = await page.context().browser()!.newPage();
  await mockFinanceDirectory(context, { malformed: true });
  await expect(
    context.getByText(
      "Merkez finansı okunamadı. Yetkiyi ve dönemi kontrol edip yeniden deneyebilirsin.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    context
      .getByRole("grid", { name: "Hareketler", exact: true })
      .getByText("Örnek Eğitmen", { exact: true }),
  ).toHaveCount(0);
  await context.close();
});
