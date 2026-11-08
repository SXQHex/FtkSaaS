import en from "../../messages/en.json" with { type: "json" };
import { test, expect, tr, login, apiResult, successful } from "./fixtures";

test("S01 native session survives reload and logout removes protected access", async ({
  page,
  account,
}) => {
  await login(page, account);
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Merhaba,/ })).toBeVisible();
  await page.getByRole("button", { name: tr.admin.accountPreferences }).click();
  await page.getByRole("button", { name: tr.common.signOut, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?/);
});

test("S01 profile write is read after full reload and restored", async ({
  page,
  account,
  marker,
}) => {
  await login(page, account);
  await page.goto("/account");
  const name = page.getByLabel(tr.account.display_name, { exact: true });
  await expect(name).toBeEditable();
  const original = await name.inputValue();
  try {
    await name.fill(marker);
    const write = apiResult(page, "account_profile_update_v1");
    await page.getByRole("button", { name: tr.account.saveProfile, exact: true }).click();
    await successful(await write);
    await page.reload();
    await expect(name).toHaveValue(marker);
  } finally {
    await page.goto("/account");
    await expect(name).toBeEditable();
    await name.fill(original);
    const restore = apiResult(page, "account_profile_update_v1");
    await page.getByRole("button", { name: tr.account.saveProfile, exact: true }).click();
    await successful(await restore);
    await page.reload();
    await expect(name).toHaveValue(original);
  }
});

test("S01 XREQ-031 account has no SMS controls and invalid phone stays local", async ({
  page,
  account,
}) => {
  await login(page, account);
  await page.goto("/account");
  const phone = page.getByLabel(tr.account.unverified_phone, { exact: true });
  await expect(phone).toBeEditable();
  await expect(page.getByLabel(tr.account.phoneCode, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(tr.account.new_phone, { exact: true })).toHaveCount(0);
  await phone.fill("invalid-phone");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/account_profile_update_v1")) writes.push("profile-write");
  });
  await page.getByRole("button", { name: tr.account.saveProfile, exact: true }).click();
  await expect(page.getByText(tr.account.fieldPhone, { exact: true })).toBeVisible();
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  expect(writes).toEqual([]);
});

test("S01 account supports TR EN themes keyboard and 200 percent text reflow", async ({
  page,
  account,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  test.setTimeout(240_000);
  await login(page, account);
  await page.goto("/account");
  await expect(page.getByLabel(tr.account.display_name, { exact: true })).toBeEditable();
  for (const [locale, messages, theme] of [
    ["tr", tr, "Açık"],
    ["en", en, "Dark"],
  ] as const) {
    await page.getByRole("combobox", { name: "Dil / Language" }).click();
    await page
      .getByRole("option", { name: locale === "tr" ? "Türkçe" : "English", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.getByRole("combobox", { name: messages.common.theme, exact: true }).click();
    await page.getByRole("option", { name: theme, exact: true }).click();
    await expect(page.locator("html")).toHaveClass(locale === "tr" ? /light/ : /dark/);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(async () => {
        document.documentElement.style.fontSize = "200%";
        await document.fonts.ready;
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const violations = (await new AxeBuilder({ page }).analyze()).violations;
      // Only rule/count data may enter the sanitized test failure, never DOM/PII.
      expect(violations.map(({ id, nodes }) => ({ id, count: nodes.length }))).toEqual([]);
    }
    const edit = page.getByRole("button", { name: messages.account.editPhoto, exact: true });
    await edit.focus();
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    await chooser;
    await expect(edit).toBeFocused();
  }
});
