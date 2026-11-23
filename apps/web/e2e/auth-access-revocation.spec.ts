import { test, expect } from "./test.js";
import { origin } from "./auth-fixture.js";
import { mockLeads } from "./leads-fixture.js";
import { studioIds as I } from "./studio-fixture.js";

test("M06: revoked center access clears live CRM, history and deep-link permissions", async ({
  page,
}) => {
  const state = await mockLeads(page);
  const privateRow = page.getByRole("button", { name: "Aday A", exact: true });
  await expect(privateRow).toBeVisible();

  let revoked = false;
  let verificationReads = 0;
  await page.route("**/functions/v1/backend-v1/centers_list_v1", (route) => {
    if (!revoked) return route.fallback();
    verificationReads++;
    return route.fulfill({
      json: {
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-23T00:00:00Z" },
        trace_id: I.role,
      },
    });
  });

  // The current tab still holds a successful, recent privileged Query result.
  // After remote revocation the next native feature read must not preserve it.
  revoked = true;
  state.setDenied(true);
  await page.getByRole("button", { name: "Yenile", exact: true }).first().click();
  await expect.poll(() => verificationReads).toBeGreaterThan(0);
  await expect(privateRow).toHaveCount(0);
  const add = page.getByRole("button", { name: "Aday ekle", exact: true });
  if (await add.count()) await expect(add).toBeDisabled();
  await expect(page).not.toHaveURL(/\/login$/);
  expect(state.writes).toHaveLength(0);

  // A React Router history transition must revalidate native authority before
  // any cached manager content can return.
  await page.locator('[data-slot="sidebar-footer"]').getByRole("button").click();
  await page.getByRole("menuitem", { name: "Hesabım", exact: true }).click();
  await expect(page).toHaveURL(/\/account/);
  await page.goBack();
  await expect(privateRow).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login$/);
  expect(state.writes).toHaveLength(0);

  // A hard deep-link load must also honor the same inaccessible center.
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/leads`);
  await expect(privateRow).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login$/);
  expect(state.writes).toHaveLength(0);
});

test("M06: an independent CRM FORBIDDEN is not a global logout or old-session cache purge", async ({
  page,
}) => {
  const state = await mockLeads(page);
  await expect(page.getByRole("button", { name: "Aday A", exact: true })).toBeVisible();

  state.setDenied(true);
  await page.getByRole("button", { name: "Yenile", exact: true }).first().click();
  await expect(page.getByText("Aday kaydı okunamadı.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/leads`);
  await expect(page.getByRole("button", { name: "Aday ekle", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);

  state.setDenied(false);
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aday A", exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
