import { test, expect, tr, login, openSection, apiResult, successful } from "./fixtures";

test("S09 own student or instructor calendar is read in the linked center", async ({
  page,
  account,
}) => {
  await login(page, account);
  const reading = apiResult(page, "calendar_get_v1");
  await openSection(page, "personal", account);
  await expect(
    page.getByRole("combobox", { name: tr.selfDashboard.context, exact: true }),
  ).toHaveValue(`${account.orgId}:${account.centerId}`);
  const response = await reading;
  await successful(response);
  expect(response.request().postDataJSON().org_id).toBe(account.orgId);
  expect(response.request().postDataJSON().center_id).toBe(account.centerId);
  await expect(page.getByText(tr.selfDashboard.noLink, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: tr.selfDashboard.inbox, exact: true })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  const reread = apiResult(page, "calendar_get_v1");
  await page.getByRole("button", { name: tr.selfDashboard.reload, exact: true }).click();
  await successful(await reread);
});

test("S09 private ICS supports real GET HEAD rotate and revoke", async ({
  page,
  account,
}, info) => {
  await login(page, account);
  await openSection(page, "personal", account);
  const panel = page.getByRole("region", { name: tr.personalCalendar.title, exact: true });
  await expect(panel.getByText(tr.personalCalendar.notReady, { exact: true })).toHaveCount(0);
  // Dedicated accounts must start without active links so this test cannot rotate somebody else's link.
  await expect(
    panel.getByRole("button", { name: tr.personalCalendar.rotate, exact: true }),
  ).toHaveCount(0);
  await panel
    .getByRole("combobox", { name: tr.personalCalendar.organization, exact: true })
    .selectOption(account.orgId);
  await panel
    .getByRole("checkbox", {
      name:
        info.project.name === "pro-student"
          ? tr.personalCalendar.lessons
          : tr.personalCalendar.duties,
      exact: true,
    })
    .check();
  await panel.getByRole("button", { name: tr.personalCalendar.create, exact: true }).click();
  async function apply(operation: string) {
    const review = panel.getByRole("region", { name: tr.personalCalendar.review, exact: true });
    await expect(
      review.getByRole("button", { name: tr.personalCalendar.apply, exact: true }),
    ).toBeDisabled();
    await review.getByRole("checkbox", { name: tr.personalCalendar.confirm, exact: true }).check();
    const write = apiResult(page, operation);
    await review.getByRole("button", { name: tr.personalCalendar.apply, exact: true }).click();
    await successful(await write);
    await expect(review).toBeHidden();
  }
  await apply("calendar_link_create_v1");
  let revoked = false;
  try {
    const field = panel.getByLabel(tr.personalCalendar.subscriptionUrl, { exact: true });
    await expect(field).toBeVisible();
    const original = await field.inputValue();
    const parsed = new URL(original);
    expect(parsed.protocol).toBe("https:");
    const allowed = new URL(process.env.FTK_LIVE_CALENDAR_ORIGIN ?? "");
    expect(allowed.protocol).toBe("https:");
    expect(parsed.origin).toBe(allowed.origin);
    expect(parsed.username).toBe("");
    expect(parsed.password).toBe("");
    const get = await page.request.get(original);
    expect(get.status()).toBe(200);
    expect(get.headers()["content-type"]).toContain("text/calendar");
    expect(await get.text()).toContain("BEGIN:VCALENDAR");
    expect((await page.request.head(original)).status()).toBe(200);
    await panel.getByRole("button", { name: tr.personalCalendar.rotate, exact: true }).click();
    await apply("calendar_link_rotate_v1");
    await expect(field).toBeVisible();
    const rotated = await field.inputValue();
    expect(rotated).not.toBe(original);
    expect((await page.request.get(original)).status()).toBeGreaterThanOrEqual(400);
    expect((await page.request.get(rotated)).status()).toBe(200);
    await panel.getByRole("button", { name: tr.personalCalendar.revoke, exact: true }).click();
    await apply("calendar_link_revoke_v1");
    revoked = true;
    expect((await page.request.get(rotated)).status()).toBeGreaterThanOrEqual(400);
    await page.reload();
    await expect(
      panel.getByRole("button", { name: tr.personalCalendar.rotate, exact: true }),
    ).toHaveCount(0);
  } finally {
    if (!revoked) {
      await page.goto("/#personal");
      await panel.getByRole("button", { name: tr.personalCalendar.revoke, exact: true }).click();
      await apply("calendar_link_revoke_v1");
    }
  }
});
