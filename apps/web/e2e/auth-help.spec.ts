import { activate, hasTouchInput } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockNative, openWorkspaceNavigation, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
async function setup(page: Page) {
  await mockNative(page);
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await activate(page.getByRole("button", { name: "Giriş yap", exact: true }));
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await page.goto(`${origin}/help`);
  await expect(page.getByRole("heading", { name: "Yardım", exact: true })).toBeVisible();
}
test("help has all reference groups and questions, supports multiple keyboard disclosures and Turkish answer search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  await expect(page.getByRole("group", { name: "Üyeler ve haklar", exact: true })).toBeVisible();
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
  await activate(questions.nth(0), "Enter");
  await activate(questions.nth(1), "Space");
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
  const touch = hasTouchInput(page);
  if (touch) {
    const searchButton = page.getByRole("button", { name: "Ara… Ctrl K", exact: true });
    await expect(searchButton).toBeVisible();
    await activate(searchButton);
  } else {
    await page.keyboard.press("Control+k");
  }
  const command = page.getByRole("dialog", { name: "Sayfalarda ara", exact: true });
  await expect(page.getByRole("dialog", { name: "Sayfalarda ara", exact: true })).toBeVisible();
  if (touch) await activate(command.getByRole("button", { name: "Kapat", exact: true }));
  else await page.keyboard.press("Escape");
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
  await activate(copy, "Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Destek adresi kopyalandı." }),
  ).toBeVisible();
  if (!hasTouchInput(page)) {
    await expect(copy).toBeFocused();
  }
  await expect(copy).toBeEnabled();
  await activate(copy, "Enter");
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
    await activate(copy);
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
    await activate(copy);
    await expect(
      page.getByRole("status").filter({ hasText: "Destek adresi kopyalandı." }),
    ).toBeVisible();
  });
test("help remains protected after native signout", async ({ page }) => {
  await setup(page);
  await openWorkspaceNavigation(page);
  await activate(page.getByRole("button", { name: /Fixture Account/ }));
  await activate(page.getByRole("menuitem", { name: "Çıkış yap", exact: true }));
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(
    page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
  ).toBeVisible();
  await page.goto(`${origin}/help`);
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(
    page.getByRole("heading", { name: "Hesabına giriş yap", exact: true }),
  ).toBeVisible();
});
