import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import tr from "../../messages/tr.json";
import en from "../../messages/en.json";

// Use the authorized Starter fixture with one center, room and weekly rule.
// Native Auth and domain reads remain real; this test submits only an invalid local interval.
test("Starter setup supports enlarged text, full axe and keyboard disclosure", async ({ page }) => {
  test.setTimeout(120_000);
  let phase = "native login";
  try {
    await page.goto("/login");
    await page.getByLabel("E-posta adresi").fill(process.env.FTK_E2E_EMAIL ?? "");
    await page.getByLabel("Parola", { exact: true }).fill(process.env.FTK_E2E_PASSWORD ?? "");
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    for (const [locale, messages, theme] of [
      ["tr", tr, "Açık"],
      ["en", en, "Dark"],
    ] as const) {
      phase = `${locale} preferences`;
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("/#settings");
      await page.getByRole("combobox", { name: "Dil / Language" }).click();
      await page
        .getByRole("option", { name: locale === "tr" ? "Türkçe" : "English", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await page.getByRole("combobox", { name: messages.common.theme, exact: true }).click();
      await page.getByRole("option", { name: theme, exact: true }).click();
      await expect(page.locator("html")).toHaveClass(locale === "tr" ? /light/ : /dark/);
      await page.goto("/#studio");
      const room = page.getByRole("region", { name: messages.setup.roomTitle, exact: true });
      const summary = room.locator("details > summary").first();
      phase = `${locale} keyboard disclosure`;
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(room.getByRole("heading", { name: messages.setup.editRule })).toBeVisible();
      await page.keyboard.press("Space");
      await expect(room.getByRole("heading", { name: messages.setup.editRule })).toBeHidden();
      await page.keyboard.press("Enter");
      await expect(summary).toBeFocused();
      const closure = room.locator("form").filter({
        has: page.getByRole("heading", { name: messages.setup.closureTitle, exact: true }),
      });
      phase = `${locale} local validation`;
      await closure
        .getByLabel(messages.setup.closureStart, { exact: true })
        .fill("2030-01-01T18:00:00");
      await closure
        .getByLabel(messages.setup.closureEnd, { exact: true })
        .fill("2030-01-01T19:00:00");
      await closure
        .getByLabel(messages.setup.closureReason, { exact: true })
        .fill("Local validation test");
      await closure.getByRole("button", { name: messages.setup.saveClosure, exact: true }).click();
      await expect(closure.getByRole("alert")).toHaveText(messages.setup.invalidInterval);
      for (const width of [320, 768, 1024, 1440]) {
        phase = `${locale} ${width}px axe/reflow`;
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(async () => {
          document.documentElement.style.fontSize = "200%";
          await document.fonts.ready;
          await Promise.all(document.getAnimations().map((animation) => animation.finished));
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const clipped = await room.locator("input, button, select, time").evaluateAll(
          (elements) =>
            elements.filter((element) => {
              const bounds = element.getBoundingClientRect();
              return (
                element.getClientRects().length && (bounds.left < 0 || bounds.right > innerWidth)
              );
            }).length,
        );
        expect(clipped).toBe(0);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
    }
  } catch {
    // Live account information must not enter Playwright's automatic error context.
    await page.close();
    throw new Error(`Studio accessibility failed at: ${phase}. No account details recorded.`);
  }
});
