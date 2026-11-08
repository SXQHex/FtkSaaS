import {
  test,
  expect,
  tr,
  login,
  openSection,
  apiResult,
  successful,
  confirmWrite,
} from "./fixtures";

test("S04 manual candidate note and dated followup persist without automatic student activation", async ({
  page,
  account,
  marker,
}) => {
  await login(page, account);
  await openSection(page, "crm", account);
  await page
    .getByRole("combobox", { name: tr.attendance.center, exact: true })
    .selectOption(`${account.orgId}:${account.centerId}`);
  await page.getByRole("button", { name: tr.crm.newLead, exact: true }).click();
  const lead = page.getByRole("region", { name: tr.crm.newLead, exact: true });
  await lead.getByRole("button", { name: tr.students.addPerson, exact: true }).click();
  const create = page.getByRole("dialog", { name: tr.students.addPerson, exact: true });
  await create.getByLabel(tr.students.name, { exact: true }).fill(marker);
  const personWrite = apiResult(page, "person_create_v1");
  await create.getByRole("button", { name: tr.students.createRecord, exact: true }).click();
  await successful(await personWrite);
  await expect(create).toBeHidden();
  await lead.getByLabel(tr.crm.person, { exact: true }).fill(marker);
  await lead.getByRole("button", { name: tr.crm.search, exact: true }).click();
  const option = lead.getByRole("option", { name: new RegExp(`^${marker}(?: ·.*)?$`) });
  await expect(option).toHaveCount(1);
  const personId = await option.getAttribute("value");
  expect(personId).toBeTruthy();
  await lead
    .getByRole("combobox", { name: tr.crm.choosePerson, exact: true })
    .selectOption(personId!);
  await lead.getByLabel(tr.crm.source, { exact: true }).selectOption("whatsapp");
  await lead.getByLabel(tr.crm.interest, { exact: true }).fill(marker);
  await lead.getByRole("button", { name: tr.crm.review, exact: true }).click();
  const leadWrite = apiResult(page, "lead_save_v1");
  await confirmWrite(page);
  await successful(await leadWrite);
  await expect(lead).toBeHidden();
  await page.getByLabel(tr.crm.searchLeads, { exact: true }).fill(marker);
  const searchForm = page
    .locator("form")
    .filter({ has: page.getByLabel(tr.crm.searchLeads, { exact: true }) });
  await searchForm.getByRole("button", { name: tr.crm.search, exact: true }).click();
  const link = page.getByRole("link").filter({ hasText: marker });
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page.getByRole("heading", { name: tr.crm.details, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: tr.crm.convert, exact: true })).toBeEnabled();
  await page.getByLabel(tr.crm.note, { exact: true }).fill(`${marker}-note`);
  await page.getByRole("button", { name: tr.crm.review, exact: true }).click();
  const noteWrite = apiResult(page, "crm_activity_save_v1");
  await confirmWrite(page);
  await successful(await noteWrite);
  await expect(page.getByText(`${marker}-note`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${marker}-note`, { exact: true })).toBeVisible();
  await page.getByLabel(tr.crm.kind, { exact: true }).selectOption("followup");
  await page.getByLabel(tr.crm.note, { exact: true }).fill(`${marker}-followup`);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(tr.crm.due, { exact: true }).fill(`${tomorrow}T12:00:00`);
  await page.getByRole("button", { name: tr.crm.review, exact: true }).click();
  const followupWrite = apiResult(page, "crm_activity_save_v1");
  await confirmWrite(page);
  await successful(await followupWrite);
  await expect(page.getByText(`${marker}-followup`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${marker}-followup`, { exact: true })).toBeVisible();
  await expect(page.getByText(`${marker}-note`, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: tr.crm.convert, exact: true })).toBeEnabled();
});

test("S04 real committed person write recovers after lost response and full reload", async ({
  page,
  account,
  marker,
}) => {
  await login(page, account);
  await openSection(page, "crm", account);
  await page
    .getByRole("combobox", { name: tr.attendance.center, exact: true })
    .selectOption(`${account.orgId}:${account.centerId}`);
  await page.getByRole("button", { name: tr.crm.newLead, exact: true }).click();
  await page.getByRole("button", { name: tr.students.addPerson, exact: true }).click();
  const create = page.getByRole("dialog", { name: tr.students.addPerson, exact: true });
  await create.getByLabel(tr.students.name, { exact: true }).fill(marker);
  let originalKey = "";
  await page.route(
    "**/backend-v1/person_create_v1",
    async (route) => {
      originalKey = route.request().postDataJSON().operation_key;
      // Execute the genuine command, discard only its response. No fake backend success.
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      expect((await response.json()).ok).toBe(true);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await create.getByRole("button", { name: tr.students.createRecord, exact: true }).click();
  await expect(create.getByRole("button", { name: tr.students.check, exact: true })).toBeVisible();
  expect(originalKey).not.toBe("");
  await page.reload();
  await page
    .getByRole("combobox", { name: tr.attendance.center, exact: true })
    .selectOption(`${account.orgId}:${account.centerId}`);
  await page.getByRole("button", { name: tr.crm.newLead, exact: true }).click();
  const status = apiResult(page, "operation_status_get_v1");
  await create.getByRole("button", { name: tr.students.check, exact: true }).click();
  const response = await status;
  expect(response.request().postDataJSON().key).toBe(originalKey);
  const data = await successful(response);
  expect(data.status).toBe("succeeded");
  await expect(create).toBeHidden();
  const lead = page.getByRole("region", { name: tr.crm.newLead, exact: true });
  await lead.getByLabel(tr.crm.person, { exact: true }).fill(marker);
  await lead.getByRole("button", { name: tr.crm.search, exact: true }).click();
  await expect(lead.getByRole("option", { name: new RegExp(`^${marker}(?: ·.*)?$`) })).toHaveCount(
    1,
  );
});
