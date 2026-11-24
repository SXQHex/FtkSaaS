import { activate, hasTouchInput, attemptOutsideDismissal } from "./device-input.js";
import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

test("an open reauthentication dialog stays hidden and inert until the new native session is revalidated", async ({
  page,
}) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await activate(page.getByRole("button", { name: "Giriş yap", exact: true }));
  await expect(page).toHaveURL(`${origin}/account`);
  await activate(page.getByRole("tab", { name: "Oturumlar", exact: true }));
  await activate(page.getByRole("button", { name: "Diğerlerini kapat", exact: true }));
  const dialog = page.locator('[data-slot="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Parola", { exact: true }).fill("fixture-password");

  let release!: () => void;
  const revalidation = new Promise<void>((resolve) => {
    release = resolve;
  });
  let heldReads = 0;
  await page.route("**/functions/v1/backend-v1/account_get_v1", async (route) => {
    heldReads++;
    await revalidation;
    await route.fallback();
  });

  try {
    // The second native password exchange creates S2 through the real SDK.
    // Hold its private reads so the portal cannot pass only after the handoff.
    await activate(dialog.getByRole("button", { name: "Devam et", exact: true }));
    await expect.poll(() => calls.exchange).toBe(2);
    await expect.poll(() => heldReads).toBeGreaterThan(0);
    await expect(dialog).toHaveCount(1);
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("dialog", { name: common.sessions.closeOthers, exact: true }),
    ).toHaveCount(0);
    const loading = page.getByRole("dialog", {
      name: common.states.content.loading.title,
      exact: true,
    });
    await expect(loading).toBeVisible();
    await expect(loading.getByRole("progressbar")).toBeVisible();

    if (hasTouchInput(page)) {
      await attemptOutsideDismissal(loading);
      await expect(loading).toBeVisible();
      await expect(dialog).toBeHidden();
    } else {
      for (const key of ["Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        await expect
          .poll(() =>
            dialog.evaluate((element) => element.contains(element.ownerDocument.activeElement)),
          )
          .toBe(false);
        await expect
          .poll(() =>
            loading.evaluate((element) => element.contains(element.ownerDocument.activeElement)),
          )
          .toBe(true);
      }
      await page.keyboard.press("Enter");
    }
    await expect(page).toHaveURL(`${origin}/account`);
    expect(calls.othersKeys).toHaveLength(0);

    release();
    await expect(dialog).toBeVisible();
    await expect(loading).toHaveCount(0);
    const confirm = dialog.getByRole("button", { name: "Diğer oturumları kapat", exact: true });
    await expect(confirm).toBeEnabled();
    await expect(dialog.getByLabel("Parola", { exact: true })).toHaveCount(0);
    expect(calls.exchange).toBe(2);
    expect(calls.previousSessionRevocations).toBe(1);

    // The original command continues from its prepared intent, without another login or write.
    await activate(confirm);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Bu cihaz", { exact: true })).toBeVisible();
    expect(calls.othersKeys).toHaveLength(1);
    expect(calls.exchange).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});
