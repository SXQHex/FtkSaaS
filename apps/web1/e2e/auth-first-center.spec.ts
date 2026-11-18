import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import type { CenterView, SuccessSettingsCatalogGet } from "../src/lib/api-contracts/generated.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const text = common.centerSetup;
async function setup(
  page: import("@playwright/test").Page,
  options: {
    unknown?: boolean;
    unread?: boolean;
    denied?: boolean;
    existing?: boolean;
    unreadAuthority?: boolean;
  } = {},
) {
  await mockNative(page);
  const writes: Record<string, unknown>[] = [],
    reads: string[] = [];
  const center: CenterView = {
    id: I.center,
    name: "İlk test merkezi",
    timezone: "Europe/Istanbul",
    state: "active",
    accessible: true,
    version: 1,
  };
  let created = !!options.existing,
    effects = 0,
    readFailed = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const list = (items: unknown[]) => ({
      items,
      next_cursor: null,
      as_of: new Date().toISOString(),
    });
    reads.push(op);
    if (op === "organizations_list_v1")
      return send(
        list([
          {
            id: I.org,
            name: "Merkezsiz organizasyon",
            state: "active",
            access_mode: "bootstrap",
            version: 1,
            self_context: { person_id: I.self, subscriber_number: null, centers: [] },
          },
        ]),
      );
    if (op === "centers_list_v1") {
      expect(r.org_id).toBe(I.org);
      if (options.unread && created && !readFailed) {
        readFailed = true;
        return route.abort("failed");
      }
      return send(list(created ? [center] : []));
    }
    // Owner is held on the organization, not a fabricated role-assignment row.
    if (op === "roles_list_v1") return send(list([]));
    if (op === "settings_catalog_get_v1" && r.scope === "organization") {
      if (options.unreadAuthority && !readFailed) {
        readFailed = true;
        return route.abort("failed");
      }
      expect(r).not.toHaveProperty("center_id");
      const envelope: SuccessSettingsCatalogGet = {
        ok: true,
        trace_id: I.role,
        data: {
          scope: "organization",
          catalog_version: 24,
          fields: [
            { key: "address", group: "O01", consumer: "public_profile", writable: !options.denied },
          ],
          defaults: {},
          brand_packages: [],
          limitations: [],
        },
      };
      return route.fulfill({ json: envelope });
    }
    if (op === "center_create_v1") {
      writes.push(r);
      expect(r).toMatchObject({ org_id: I.org, name: center.name, timezone: center.timezone });
      expect(r).not.toHaveProperty("center_id");
      if (!created) {
        effects++;
        created = true;
      } else expect(r.operation_key).toBe(writes[0]!.operation_key);
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: center.id, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1" && r.operation === "center_create_v1")
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "centers", id: center.id },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("first-center@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  return {
    writes,
    reads,
    center,
    get effects() {
      return effects;
    },
  };
}
async function fill(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: text.action, exact: true }).click();
  const panel = page.getByRole("dialog", { name: text.action, exact: true });
  await panel.getByLabel(text.name, { exact: true }).fill("İlk test merkezi");
  await panel.getByLabel(text.timezone, { exact: true }).selectOption("Europe/Istanbul");
  return panel;
}
test("first center validates the ready form, records its explicit zone and restores the actual workspace after reload", async ({
  page,
}) => {
  const f = await setup(page);
  await page.getByRole("button", { name: text.action, exact: true }).click();
  const panel = page.getByRole("dialog", { name: text.action, exact: true });
  const name = panel.getByLabel(text.name, { exact: true }),
    zone = panel.getByLabel(text.timezone, { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(zone).toHaveValue("");
  await panel.getByRole("button", { name: text.action, exact: true }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  expect(f.writes).toHaveLength(0);
  await name.fill(f.center.name);
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await zone.selectOption(f.center.timezone);
  await panel.getByRole("button", { name: text.action, exact: true }).click();
  await expect(panel.getByRole("status")).toContainText(text.states.saved);
  expect(f.effects).toBe(1);
  expect(f.writes).toHaveLength(1);
  await panel.getByRole("button", { name: common.memberProfile.close, exact: true }).click();
  await expect(page.getByRole("link", { name: text.settings, exact: true })).toHaveAttribute(
    "href",
    `/o/${I.org}/c/${I.center}/settings`,
  );
  await page.reload();
  await expect(page.locator("[data-workspace-logo]").locator("..")).toContainText(f.center.name);
  await expect(page.getByRole("button", { name: text.action, exact: true })).toHaveCount(0);
  expect(
    f.reads.filter((op) => ["organization_create_v1", "center_manager_assign_v1"].includes(op)),
  ).toHaveLength(0);
});
test("unknown first-center outcome freezes scope and reuses one immutable command key without duplicate centers", async ({
  page,
}) => {
  const f = await setup(page, { unknown: true }),
    panel = await fill(page);
  await panel.getByRole("button", { name: text.action, exact: true }).click();
  await expect(panel.getByRole("status")).toContainText(text.states.unknown);
  await expect(page.locator("[data-workspace-logo]").locator("..")).toBeDisabled();
  await expect(panel.getByLabel(text.name, { exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: common.finance.retrySame, exact: true }).click();
  await expect(panel.getByRole("status")).toContainText(text.states.saved);
  expect(f.effects).toBe(1);
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]!.operation_key).toBe(f.writes[0]!.operation_key);
  expect(f.writes[1]!.request_id).not.toBe(f.writes[0]!.request_id);
  await panel.getByRole("button", { name: common.memberProfile.close, exact: true }).click();
});
test("acknowledged first-center creation permits only workspace rereads after a failed result read", async ({
  page,
}) => {
  const f = await setup(page, { unread: true }),
    panel = await fill(page);
  await panel.getByRole("button", { name: text.action, exact: true }).click();
  await expect(panel.getByRole("status")).toContainText(text.states["saved-unread"]);
  await expect(
    panel.getByRole("button", { name: common.finance.retrySame, exact: true }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(panel.getByRole("status")).toContainText(text.states.saved);
  expect(f.effects).toBe(1);
  expect(f.writes).toHaveLength(1);
  expect(f.reads).not.toContain("operation_status_get_v1");
  await panel.getByRole("button", { name: common.memberProfile.close, exact: true }).click();
});
for (const condition of ["denied", "existing"] as const)
  test(`first-center setup is absent for ${condition} native scope`, async ({ page }) => {
    const f = await setup(page, { [condition]: true });
    await expect(
      page.getByRole("heading", { name: common.auth.account, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: text.action, exact: true })).toHaveCount(0);
    expect(f.writes).toHaveLength(0);
  });

test("unread first-center authority stays unknown and retries the native read before exposing creation", async ({
  page,
}) => {
  const f = await setup(page, { unreadAuthority: true });
  await expect(page.getByRole("alert")).toContainText(text.authorityUnavailable);
  await expect(page.getByRole("button", { name: text.action, exact: true })).toHaveCount(0);
  await page
    .getByRole("alert")
    .getByRole("button", { name: common.auth.retry, exact: true })
    .click();
  await expect(page.getByRole("button", { name: text.action, exact: true })).toBeEnabled();
  expect(f.writes).toHaveLength(0);
});
