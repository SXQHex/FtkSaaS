import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockNative, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
async function setup(page: Page) {
  await mockNative(page);
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/help`);
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeVisible();
}
test("help has all reference groups and questions, supports multiple keyboard disclosures and Turkish answer search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  await expect(page.locator("main h2")).toHaveText([
    "Üyeler ve haklar",
    "Ders programı",
    "Rezervasyon ve yoklama",
    "Tahsilat ve borç",
    "Belgeler",
    "Hesap",
    "Destek",
    "Kısayollar",
  ]);
  const questions = page.locator("[data-slot=accordion-trigger]");
  await expect(questions).toHaveCount(27);
  await questions.nth(0).focus();
  await page.keyboard.press("Enter");
  await questions.nth(1).focus();
  await page.keyboard.press("Space");
  await expect(questions.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(questions.nth(1)).toHaveAttribute("aria-expanded", "true");
  expect((await scanAccessibility(page, "help-two-expanded-questions")).violations).toEqual([]);
  const search = page.getByRole("searchbox", { name: "Yardımda ara", exact: true });
  await search.fill("İADE");
  await expect(
    page.getByRole("button", { name: "Satışı nasıl iade ederim?", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Yeni üyeyi nasıl eklerim?", exact: true }),
  ).toHaveCount(0);
  await search.fill("işlem referansı");
  await expect(
    page.getByRole("button", { name: "Tahsilatı nasıl kaydederim?", exact: true }),
  ).toBeVisible();
  await search.fill("zzbulunmayan");
  await expect(
    page.getByText("Aramana uygun soru bulunamadı. Destek ekibine yazabilirsin.", { exact: true }),
  ).toBeVisible();
  await search.clear();
  await expect(questions).toHaveCount(27);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Sayfalarda ara", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Durum ekranları", exact: true })).toHaveCount(0);
});
test("help copies the displayed approved contact repeatedly without disabling or moving the focused button", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const writes: string[] = [];
    Object.defineProperty(globalThis, "__helpClipboard", { value: writes });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          writes.push(text);
        },
      },
    });
  });
  await setup(page);
  const displayed = await page.locator("main dd").first().textContent();
  const copy = page.getByRole("button", { name: "Adresi kopyala", exact: true });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Destek adresi kopyalandı." }),
  ).toBeVisible();
  await expect(copy).toBeFocused();
  await expect(copy).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        () => (globalThis as typeof globalThis & { __helpClipboard: string[] }).__helpClipboard,
      ),
    )
    .toEqual([displayed, displayed]);
  await expect(page.getByText("Pazartesi–Cuma 09:00–18:00", { exact: false })).toContainText(
    "Cumartesi 09:00–13:00",
  );
  await expect(page.getByText("İş günlerinde 1 gün içinde", { exact: true })).toHaveCount(0);
});
for (const failure of ["denied", "missing"] as const)
  test(`help reports ${failure} clipboard access and keeps the contact selectable and retry available`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value:
          mode === "missing"
            ? undefined
            : {
                writeText: async () => {
                  throw new DOMException("Denied", "NotAllowedError");
                },
              },
      });
    }, failure);
    await setup(page);
    const copy = page.getByRole("button", { name: "Adresi kopyala", exact: true });
    await copy.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Adres kopyalanamadı." }),
    ).toBeVisible();
    await expect(copy).toBeEnabled();
    await expect(page.locator("main dd").first()).toHaveCSS("user-select", "text");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => {} },
      }),
    );
    await copy.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Destek adresi kopyalandı." }),
    ).toBeVisible();
  });
test("help remains protected after native signout", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: /Fixture Account/ }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  await page.goto(`${origin}/help`);
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(
    page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
  ).toBeVisible();
});
