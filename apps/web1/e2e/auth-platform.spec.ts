import { test, expect } from "./test.js";
import { mockNative } from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { uid } from "./pro-completion-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

const text = common.platform;
const target = uid(210);
const initial = {
  kind: "organization",
  id: target,
  name: "Sentetik konsol organizasyonu",
  version: 1,
  state: "active",
  subscription_state: "active",
  access_mode: "normal",
  platform_suspended: false,
  grace_until: null,
};
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("platform-fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
async function platformFixture(
  page: import("@playwright/test").Page,
  role: "platform" | "owner" | "staff",
) {
  await mockNative(page);
  const calls: { operation: string; request: Record<string, unknown> }[] = [];
  let permitted = role === "platform";
  let row = { ...initial };
  let changes = 0;
  let firstKey: string | undefined;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    calls.push({ operation, request });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    const list = (items: unknown[], next_cursor: string | null = null) => ({
      items,
      next_cursor,
      as_of: "2026-11-16T12:00:00Z",
    });
    if (operation === "account_get_v1" && request.include_platform_scope) {
      return send({
        id: I.account,
        state: "active",
        display_name: "Sentetik Platform",
        platform_scope: {
          organizations: permitted,
          organization_create: permitted,
          organization_suspend: permitted,
          owner_manage: permitted,
          payment_verify: permitted,
          grace_extend: permitted,
        },
      });
    }
    if (role !== "platform" && operation === "organizations_list_v1")
      return send(
        list([
          {
            id: I.org,
            name: "Müşteri Stüdyosu",
            version: 1,
            state: "active",
            access_mode: "normal",
            self_context: { person_id: I.self, subscriber_number: null, centers: [] },
          },
        ]),
      );
    if (role !== "platform" && operation === "centers_list_v1")
      return send(
        list([
          {
            id: I.center,
            name: "Müşteri merkezi",
            timezone: "Europe/Istanbul",
            state: "active",
            accessible: true,
            version: 1,
          },
        ]),
      );
    if (role !== "platform" && operation === "roles_list_v1")
      return send(
        list([
          {
            id: I.role,
            person_id: I.self,
            role,
            scope_center_id: role === "staff" ? I.center : null,
            state: "active",
            version: 1,
          },
        ]),
      );
    if (operation === "platform_directory_get_v1") {
      if (!permitted)
        return route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      if (request.scope?.org_id === target && request.view === "owners")
        return send(
          list([
            {
              kind: "owner",
              org_id: target,
              person_id: I.self,
              display_name: "Sentetik Sahip",
              account_id: I.account,
            },
          ]),
        );
      expect(request.view).toBe("organizations");
      if (request.scope) return send(list(request.scope.org_id === target ? [row] : []));
      return send(
        request.page.cursor
          ? list([row])
          : list([{ ...initial, id: uid(211), name: "İlk sayfa organizasyonu" }], "next-org"),
      );
    }
    if (operation === "platform_organization_suspension_set_v1") {
      if (firstKey === request.operation_key)
        return send({ primary_id: target, version: row.version, replayed: true, related: [] });
      expect(request.org_id).toBe(target);
      expect(request.expected_version).toBe(row.version);
      expect(request.reason).toBe(
        request.suspended ? "Sentetik askı nedeni" : "Sentetik açma nedeni",
      );
      row = {
        ...row,
        version: row.version + 1,
        platform_suspended: request.suspended,
        access_mode: request.suspended ? "closed" : "normal",
      };
      changes++;
      if (!firstKey) {
        firstKey = request.operation_key;
        return route.abort("failed");
      }
      return send({ primary_id: target, version: row.version, replayed: false, related: [] });
    }
    return route.fallback();
  });
  return {
    calls,
    revoke: () => {
      permitted = false;
    },
    changes: () => changes,
  };
}

test("platform console pages organizations, reads an independent detail and verifies both suspension decisions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const f = await platformFixture(page, "platform");
  await signIn(page);
  await page.getByRole("link", { name: text.title, exact: true }).click();
  const region = page.getByRole("region", { name: text.organizations, exact: true });
  await region.focus();
  await expect(region).toBeFocused();
  await expect(page.getByRole("grid", { name: text.organizations })).toBeVisible();
  expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByRole("button", { name: text.more, exact: true }).click();
  await page.getByRole("link", { name: initial.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/platform\\?organization_id=${target}$`));
  await page.reload();
  await expect(page.getByRole("heading", { name: initial.name, exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik Sahip", { exact: true })).toBeVisible();
  const reason = page.getByRole("textbox", { name: text.reason, exact: true });
  await page.getByRole("button", { name: text.suspend, exact: true }).click();
  await expect(reason).toBeFocused();
  await expect(reason).toHaveAccessibleDescription(text.reasonError);
  const approve = async (label: string, value: string) => {
    await reason.fill(value);
    await page.getByRole("button", { name: label, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: label, exact: true });
    const apply = dialog.getByRole("button", { name: common.settings.applyReview, exact: true });
    await expect(apply).toBeDisabled();
    await dialog.getByRole("checkbox").press("Space");
    await apply.click();
    return dialog;
  };
  const suspend = await approve(text.suspend, "Sentetik askı nedeni");
  await expect(suspend.getByRole("status")).toHaveText(common.events.commandStates.unknown);
  await suspend.getByRole("button", { name: common.studio.retrySameRequest, exact: true }).click();
  await expect(suspend.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await suspend.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(page.getByText(text.suspended, { exact: true })).toBeVisible();
  await expect(page.getByText(text.subscriptions.active, { exact: true })).toBeVisible();
  const resume = await approve(text.resume, "Sentetik açma nedeni");
  await expect(resume.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await resume.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(page.getByText(text.accessModes.normal, { exact: true })).toBeVisible();
  expect(f.changes()).toBe(2);
  const writes = f.calls.filter(
    ({ operation }) => operation === "platform_organization_suspension_set_v1",
  );
  expect(writes).toHaveLength(3);
  expect(writes[0]!.request.operation_key).toBe(writes[1]!.request.operation_key);
  expect(writes[2]!.request.expected_version).toBe(2);
  f.revoke();
  await page.getByRole("link", { name: text.organizations, exact: true }).click();
  await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
  await expect(page.getByText(initial.name, { exact: true })).toHaveCount(0);
});

for (const role of ["owner", "staff"] as const)
  test(`customer ${role} is denied on the direct platform route before directory reads`, async ({
    page,
  }) => {
    const f = await platformFixture(page, role);
    await signIn(page);
    await expect(page.getByRole("link", { name: text.title, exact: true })).toHaveCount(0);
    await page.goto(`/platform?organization_id=${target}`);
    await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
    expect(f.calls.filter(({ operation }) => operation.startsWith("platform_"))).toEqual([]);
  });
