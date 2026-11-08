import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import tr from "../../messages/tr.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

type Account = {
  email: string;
  password: string;
  orgId: string;
  centerId: string;
  testData: true;
  profile: string;
  foreignOrgId: string;
  orgName?: string;
  centerName?: string;
};
export const test = base.extend<{ account: Account; marker: string }>({
  page: async ({ page, baseURL }, use) => {
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && baseURL) {
      // Scope the deployment bypass to this exact app origin, never Supabase/ICS.
      await page.route(`${baseURL}/**`, (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
          },
        }),
      );
    }
    await use(page);
  },
  account: async ({ browserName }, use, info) => {
    if (browserName !== "chromium")
      throw Error("The batch requires the configured Chromium project.");
    let account: Account;
    try {
      const accounts = JSON.parse(process.env.FTK_LIVE_ACCOUNTS ?? "{}");
      const names = ["pro-manager", "starter-manager", "pro-instructor", "pro-student"];
      const emails = new Set<string>();
      for (const name of names) {
        const value = accounts[name];
        if (
          !value ||
          typeof value.email !== "string" ||
          !value.email.includes("@") ||
          typeof value.password !== "string" ||
          !value.password ||
          value.testData !== true ||
          !/^[a-f0-9-]{36}$/i.test(value.orgId) ||
          !/^[a-f0-9-]{36}$/i.test(value.centerId) ||
          emails.has(value.email.toLowerCase())
        )
          throw Error("Invalid fixture");
        emails.add(value.email.toLowerCase());
      }
      if (accounts["pro-manager"].orgId === accounts["starter-manager"].orgId)
        throw Error("Manager tenants must differ");
      account = {
        ...accounts[info.project.name],
        profile: info.project.name,
        foreignOrgId:
          accounts[info.project.name === "starter-manager" ? "pro-manager" : "starter-manager"]
            .orgId,
      };
    } catch {
      throw Error(
        "Provide four distinct authorized synthetic accounts and existing org/center scopes in FTK_LIVE_ACCOUNTS. No account values recorded.",
      );
    }
    await use(account);
  },
  marker: async ({ account }, use) =>
    use(
      `CI-${account.orgId.slice(0, 8)}-${process.env.GITHUB_RUN_ID ?? "local"}-${randomUUID().slice(0, 8)}`,
    ),
});
test.afterEach(async ({ page }) => {
  try {
    if (!page.isClosed() && !/about:blank|\/login(?:\?|$)/.test(page.url())) {
      await page.goto("/#settings");
      await page
        .getByRole("button", { name: tr.common.signOut, exact: true })
        .or(page.getByRole("button", { name: en.common.signOut, exact: true }))
        .click();
      await expect(page).toHaveURL(/\/login$/);
    }
  } finally {
    await page.close();
  }
});
export { expect, tr };

export async function login(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("E-posta adresi").fill(account.email);
  await page.getByLabel("Parola", { exact: true }).fill(account.password);
  const organizations = apiResult(page, "organizations_list_v1");
  const centers = apiResult(page, "centers_list_v1");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^Merhaba,/ })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  const data = await successful(await organizations);
  const organization = data.items.find((item: { id: string }) => item.id === account.orgId);
  expect(organization, "Configured authorized organization is actually readable").toBeTruthy();
  const centerData = await successful(await centers);
  const center = centerData.items.find((item: { id: string }) => item.id === account.centerId);
  expect(center, "Configured authorized center is actually readable").toBeTruthy();
  account.orgName = organization.name;
  account.centerName = center.name;
  expect(
    data.items.some((item: { id: string }) => item.id === account.foreignOrgId),
    "Isolated fixture must not see the other plan tenant",
  ).toBe(false);
  if (account.profile === "pro-student" || account.profile === "pro-instructor") {
    const scope = organization.self_context?.centers.find(
      (center: { center_id: string }) => center.center_id === account.centerId,
    );
    expect(
      scope?.[account.profile === "pro-student" ? "student" : "instructor"],
      "The named profile must have the actual live relationship",
    ).toBe(true);
  }
}

export function apiResult(page: Page, operation: string) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/backend-v1/${operation}`) &&
      response.request().method() === "POST",
  );
}
export async function successful(response: Awaited<ReturnType<typeof apiResult>>) {
  expect(response.ok(), "Real API HTTP success").toBe(true);
  const result = await response.json();
  expect(result.ok, "Real API envelope success").toBe(true);
  return result.data;
}
export async function openSection(
  page: Page,
  section: keyof typeof tr.admin.nav,
  account: Account,
) {
  await page.goto(`/#${section}`);
  await expect(page.locator("main h1")).toHaveText(tr.admin.nav[section]);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
  if (section === "reports" || section === "automation") {
    await page
      .getByRole("combobox", { name: tr.finance.center, exact: true })
      .selectOption(`${account.orgId}:${account.centerId}`);
  }
  if (
    section === "schedule" &&
    (await page.getByRole("heading", { name: tr.calendar.chooseContext, exact: true }).isVisible())
  ) {
    await page
      .getByRole("button", { name: `${account.orgName} / ${account.centerName}`, exact: true })
      .click();
  }
  await expect(page.getByText(tr.live.comingTitle, { exact: true })).toHaveCount(0);
}
export async function confirmWrite(page: Page) {
  const review = page.getByRole("region", { name: tr.flows.review, exact: true });
  await expect(review.getByRole("button", { name: tr.flows.apply, exact: true })).toBeDisabled();
  await review.getByRole("checkbox", { name: tr.flows.confirm, exact: true }).check();
  await review.getByRole("button", { name: tr.flows.apply, exact: true }).click();
}
