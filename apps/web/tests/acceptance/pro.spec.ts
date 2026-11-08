import { test, expect, tr, login, openSection, apiResult, successful } from "./fixtures";

for (const report of [
  "collections_debts",
  "lesson_attendance",
  "renewal",
  "occupancy",
  "resource_usage",
  "earnings",
  "crm_conversion",
] as const) {
  test(`S10 ${report} reads the real scoped report with matching filters`, async ({
    page,
    account,
  }) => {
    await login(page, account);
    await openSection(page, "reports", account);
    await page.getByRole("combobox", { name: tr.reports.kind, exact: true }).selectOption(report);
    const reading = apiResult(page, "report_get_v1");
    await page.getByRole("button", { name: tr.reports.read, exact: true }).click();
    const response = await reading;
    const request = response.request().postDataJSON();
    const data = await successful(response);
    expect(request.org_id).toBe(account.orgId);
    expect(request.center_id).toBe(account.centerId);
    expect(data.report_kind).toBe(report);
    expect(data.filters.interval).toEqual(request.filters.interval);
    expect(data.filters.center_ids).toEqual(request.filters.center_ids);
    expect(data.filters.currency ?? null).toBe(request.filters.currency ?? null);
    expect(Array.isArray(data.rows.items)).toBe(true);
    expect(Array.isArray(data.totals)).toBe(true);
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
    await expect(page.getByText(tr.reports.loading, { exact: true })).toHaveCount(0);
  });
}

test("R11 event controls use the real selected center", async ({ page, account }) => {
  await login(page, account);
  await openSection(page, "events", account);
  await expect(page.getByRole("heading", { name: tr.events.title, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: tr.events.create, exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: tr.events.center, exact: true })).toHaveValue(
    `${account.orgId}:${account.centerId}`,
  );
});

test("R12 automation and segment configuration have real readers without placeholder", async ({
  page,
  account,
}) => {
  await login(page, account);
  await openSection(page, "automation", account);
  for (const tab of ["automation", "segment"] as const) {
    const reading = apiResult(page, "management_state_get_v1");
    await page.getByRole("button", { name: tr.automation[tab], exact: true }).click();
    await successful(await reading);
    await expect(
      page.getByRole("combobox", { name: tr.automation.configurationScope, exact: true }),
    ).toBeVisible();
    await expect(page.locator("main [role=alert]")).toHaveCount(0);
  }
});
