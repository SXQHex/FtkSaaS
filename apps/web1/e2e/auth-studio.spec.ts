import { test, expect } from "./test.js";
import { reviewStudioAccessibility } from "./studio-accessibility-review.js";
import { mockStudio, openStudio } from "./studio-fixture.js";
import { writeFile } from "node:fs/promises";

const tabs = ["Eğitmenler", "Dersler ve salonlar", "Uygunluk", "Kapanışlar", "Anlaşmalar"];

test("Studio drawing: complete tabs and live form composition, responsive AA", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await mockStudio(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStudio(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Stüdyo", exact: true })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    /3 adımın durumu bilinmiyor/,
  );
  const reviews: Awaited<ReturnType<typeof reviewStudioAccessibility>>[] = [];
  async function scanAccessibility(page: import("@playwright/test").Page, name: string) {
    const review = await reviewStudioAccessibility(page, name);
    reviews.push(review);
    await writeFile(".tmp/e12-manual-review.json", JSON.stringify(reviews, null, 2));
    return review;
  }
  const layout: { width: number; theme: string; state: string; overflow: boolean }[] = [];
  const measure = async (state: string, width: number, theme: string) => {
    const overflow = await page.evaluate<boolean>(
      "document.documentElement.scrollWidth > innerWidth",
    );
    layout.push({ width, theme, state, overflow });
    expect(overflow, `${state} at ${width}/${theme}`).toBe(false);
  };
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      for (const tab of tabs) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await measure(tab, width, colorScheme);
        if (
          (width === 1440 && colorScheme === "light") ||
          (width === 320 && colorScheme === "dark")
        ) {
          expect(
            (await scanAccessibility(page, `studio-${tab}-${width}-${colorScheme}`)).violations,
          ).toEqual([]);
        }
      }
      if (width === 1440 && colorScheme === "light") {
        await page.getByRole("tab", { name: "Eğitmenler", exact: true }).click();
        await expect(page.getByRole("tab", { name: "Eğitmenler", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.screenshot({
          path: ".tmp/e12-final-source-app-1440-light.png",
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
  for (const [width, colorScheme] of [
    [1440, "light"],
    [320, "dark"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme });
    for (const form of ["new-instructor", "instructor", "class", "room", "closure", "agreement"]) {
      if (form === "new-instructor")
        await page.getByRole("button", { name: "Eğitmen ekle", exact: true }).click();
      else if (form === "instructor") {
        await page.getByRole("tab", { name: "Eğitmenler", exact: true }).click();
        await page.getByRole("button", { name: /Örnek Eğitmen/ }).click();
      } else if (form === "class" || form === "room") {
        await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
        await page
          .getByRole("button", {
            name: form === "room" ? "Salon ekle" : "Ders türü ekle",
            exact: true,
          })
          .click();
      } else if (form === "closure") {
        await page.getByRole("tab", { name: "Kapanışlar", exact: true }).click();
        await page.getByRole("button", { name: "Kapanış ekle", exact: true }).click();
      } else {
        await page.getByRole("tab", { name: "Anlaşmalar", exact: true }).click();
        await page.getByRole("button", { name: /Örnek Eğitmen/ }).click();
      }
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (form === "instructor")
        await expect(dialog.getByRole("textbox", { name: "Ad soyad", exact: true })).toBeEditable();
      if (form === "agreement")
        await expect(
          dialog.getByRole("textbox", { name: "Para birimi (ISO 4217)", exact: true }),
        ).toHaveValue("TRY");
      if (form === "closure")
        await expect(dialog.getByText(/Europe\/Istanbul merkez saat dilimine/)).toBeVisible();
      await measure(form, width, colorScheme);
      expect(
        await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
        `${form} content width`,
      ).toBe(true);
      expect(
        (await scanAccessibility(page, `studio-form-${form}-${width}-${colorScheme}`)).violations,
      ).toEqual([]);
      if (form === "agreement" && width === 320) {
        await page.screenshot({
          path: ".tmp/e12-final-source-agreement-320-dark.png",
          fullPage: false,
          animations: "disabled",
        });
        await dialog
          .getByRole("button", { name: "Yeni sürümü yayınla", exact: true })
          .scrollIntoViewIfNeeded();
        await expect(
          dialog.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }),
        ).toBeInViewport();
      }
      await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }
  }
  expect(state.writes).toHaveLength(0);
  expect(errors).toEqual([]);
  await writeFile(
    ".tmp/e12-final-source-layout.json",
    JSON.stringify({ layout, pageErrors: errors, writes: state.writes.length }, null, 2),
  );
});
