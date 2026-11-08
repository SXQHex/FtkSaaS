import { test, expect, tr, login, openSection, apiResult, successful } from "./fixtures";

for (const [section, operation] of [
  ["schedule", "calendar_get_v1"],
  ["students", "people_list_v1"],
  ["crm", "leads_list_v1"],
] as const) {
  test(`S02-S06 ${section} loads real records and reloads without placeholder`, async ({
    page,
    account,
  }) => {
    await login(page, account);
    for (let read = 0; read < 2; read++) {
      const result = apiResult(page, operation);
      await openSection(page, section, account);
      const response = await result;
      await successful(response);
      expect(response.request().postDataJSON().org_id).toBe(account.orgId);
      expect(response.request().postDataJSON().center_id).toBe(account.centerId);
      await expect(page.locator("main [role=alert]")).toHaveCount(0);
    }
  });
}

test("S05 real package catalog is available with explicit publishing action", async ({
  page,
  account,
}) => {
  await login(page, account);
  await openSection(page, "packages", account);
  await expect(page.getByRole("heading", { name: tr.products.title, exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: tr.products.newProduct, exact: true }),
  ).toBeEnabled();
  await expect(page.getByText(tr.products.loading, { exact: true })).toHaveCount(0);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("S08 finance requires an explicit person before showing balances", async ({
  page,
  account,
}) => {
  await login(page, account);
  await openSection(page, "finance", account);
  await expect(
    page.getByRole("heading", { name: tr.finance.choosePerson, exact: true }),
  ).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("S11 inbox and document scopes use the authorized organization", async ({ page, account }) => {
  await login(page, account);
  await openSection(page, "inbox", account);
  await expect(
    page.getByRole("combobox", { name: tr.inbox.organization, exact: true }),
  ).toHaveValue(account.orgId);
  await expect(page.getByRole("heading", { name: tr.inbox.title, exact: true })).toBeVisible();
  await openSection(page, "documents", account);
  const scope = page.getByRole("combobox", { name: tr.documents.scope, exact: true });
  await expect(scope).toBeEnabled();
  await scope.selectOption(`${account.orgId}:${account.centerId}`);
  await expect(scope).toHaveValue(`${account.orgId}:${account.centerId}`);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("S02 S07 setup and attendance expose real center controls", async ({ page, account }) => {
  await login(page, account);
  await openSection(page, "studio", account);
  await expect(
    page.getByRole("region", { name: tr.setup.roomTitle, exact: true }).first(),
  ).toBeVisible();
  await openSection(page, "attendance", account);
  await expect(page.getByRole("combobox", { name: tr.attendance.center, exact: true })).toHaveValue(
    `${account.orgId}:${account.centerId}`,
  );
  await expect(page.getByText(tr.attendance.tasksHint, { exact: true })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("S12 settings remains reachable through keyboard page search and reload", async ({
  page,
  account,
}) => {
  await login(page, account);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(tr.admin.search).fill(tr.admin.nav.settings);
  await page.getByRole("button", { name: tr.admin.nav.settings, exact: true }).last().click();
  await expect(page.locator("main h1")).toHaveText(tr.admin.nav.settings);
  await expect(page.locator("main")).toBeFocused();
  await page.reload();
  await expect(page.locator("main h1")).toHaveText(tr.admin.nav.settings);
  await expect(page.getByRole("combobox", { name: "Dil / Language" })).toBeVisible();
});
