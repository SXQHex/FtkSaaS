import { activate, attemptOutsideDismissal, closeWithDevice } from "./device-input.js";
import { test, expect } from "./test.js";
import {
  checkLockedWorkspaceScope,
  closeWorkspaceNavigation,
  openWorkspaceNavigation,
  mockNative,
  origin,
} from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import { assertLayoutFit, readLayoutFit } from "./layout.js";
import type { CenterView, SuccessSettingsCatalogGet } from "@ftksaas/api-contracts";
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
    managesCenter?: boolean;
    rejectCreate?: "VERSION_CONFLICT" | "PLAN_LIMIT_REACHED";
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
            access_mode: options.managesCenter ? "normal" : "bootstrap",
            version: 1,
            self_context: { person_id: I.self, subscriber_number: null, centers: [] },
            ...(options.managesCenter && {
              self_management_scope: {
                owner: false,
                org_manager: false,
                managed_center_ids: [I.center],
              },
            }),
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
    if (
      options.managesCenter &&
      ((op === "management_state_get_v1" && r.operation === "room_save_v1") ||
        op === "disciplines_list_v1")
    ) {
      expect(r).toMatchObject({ org_id: I.org, center_id: I.center });
      return send(list([]));
    }
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
          catalog_version: 25,
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
      if (options.rejectCreate)
        return route.fulfill({
          status: 409,
          json: {
            ok: false,
            error: { code: options.rejectCreate, retryable: false, trace_id: I.role },
          },
        });
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
  await activate(page.getByRole("button", { name: "Giriş yap", exact: true }));
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
  await activate(page.getByRole("button", { name: text.action, exact: true }));
  const panel = page.getByRole("dialog", { name: text.action, exact: true });
  await panel.getByLabel(text.name, { exact: true }).fill("İlk test merkezi");
  await panel.getByLabel(text.timezone, { exact: true }).selectOption("Europe/Istanbul");
  await review(panel);
  return panel;
}
async function review(panel: import("@playwright/test").Locator) {
  const next = panel.getByRole("button", { name: text.continue, exact: true });
  await activate(next);
  await expect(
    panel.getByRole("heading", { name: text.steps.resources, exact: true }),
  ).toBeFocused();
  await activate(next);
  await expect(panel.getByRole("heading", { name: text.steps.review, exact: true })).toBeFocused();
}
test("first center validates the ready form, records its explicit zone and restores the actual workspace after reload", async ({
  page,
}) => {
  const f = await setup(page);
  await activate(page.getByRole("button", { name: text.action, exact: true }));
  const panel = page.getByRole("dialog", { name: text.action, exact: true });
  const name = panel.getByLabel(text.name, { exact: true }),
    zone = panel.getByLabel(text.timezone, { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(zone).toHaveValue("");
  await activate(panel.getByRole("button", { name: text.continue, exact: true }));
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  expect(f.writes).toHaveLength(0);
  await name.fill(f.center.name);
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await zone.selectOption(f.center.timezone);
  await review(panel);
  await expect(panel.getByText(f.center.name, { exact: true })).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await activate(panel.getByRole("button", { name: text.action, exact: true }));
  await expect(panel.getByRole("status")).toContainText(text.states.saved);
  expect(f.effects).toBe(1);
  expect(f.writes).toHaveLength(1);
  await activate(panel.getByRole("button", { name: common.memberProfile.close, exact: true }));
  await expect(page.getByRole("link", { name: text.settings, exact: true })).toHaveAttribute(
    "href",
    `/o/${I.org}/c/${I.center}/settings`,
  );
  await page.reload();
  await openWorkspaceNavigation(page);
  await expect(page.locator("[data-workspace-logo]").locator("..")).toContainText(f.center.name);
  await closeWorkspaceNavigation(page);
  await expect(page.getByRole("button", { name: text.action, exact: true })).toHaveCount(0);
  expect(
    f.reads.filter((op) => ["organization_create_v1", "center_manager_assign_v1"].includes(op)),
  ).toHaveLength(0);
});
test("first-center setup can be postponed and starts again from the live account state", async ({
  page,
}) => {
  const f = await setup(page);
  const trigger = page.getByRole("button", { name: text.action, exact: true });
  await activate(trigger, "Enter");
  const panel = page.getByRole("dialog", { name: text.action, exact: true });
  await expect(panel.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await panel.getByLabel(text.name, { exact: true }).fill(f.center.name);
  await panel.getByLabel(text.timezone, { exact: true }).selectOption(f.center.timezone);
  await activate(panel.getByRole("button", { name: text.continue, exact: true }));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    expect((await scanAccessibility(page, `first-center-resources-${theme}`)).violations).toEqual(
      [],
    );
    assertLayoutFit(await readLayoutFit(page));
    await page.screenshot({ path: `.tmp/v67-first-center-resources-${theme}.png` });
  }
  await activate(panel.getByRole("button", { name: text.later, exact: true }));
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(f.writes).toHaveLength(0);
  await page.reload();
  await activate(trigger);
  await expect(panel.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await expect(panel.getByLabel(text.name, { exact: true })).toBeEmpty();
  expect(f.writes).toHaveLength(0);
  await closeWithDevice(panel.getByRole("button", { name: text.later, exact: true }));
});
test("managed center resumes only the live missing room and discipline", async ({ page }) => {
  const f = await setup(page, { existing: true, managesCenter: true });
  await expect(page.getByRole("link", { name: text.room, exact: true })).toHaveAttribute(
    "href",
    `/o/${I.org}/c/${I.center}/settings?section=salonlar`,
  );
  await expect(page.getByRole("link", { name: text.discipline, exact: true })).toHaveAttribute(
    "href",
    `/o/${I.org}/c/${I.center}/settings?section=genel`,
  );
  await expect(page.getByRole("button", { name: text.action, exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("unknown first-center outcome freezes scope and reuses one immutable command key without duplicate centers", async ({
  page,
}) => {
  const f = await setup(page, { unknown: true }),
    panel = await fill(page);
  await activate(panel.getByRole("button", { name: text.action, exact: true }));
  await expect(panel.getByRole("status")).toContainText(text.states.unknown);
  await checkLockedWorkspaceScope(page, async () => {
    await expect(page.locator("[data-workspace-logo]").locator("..")).toBeDisabled();
  });
  await expect(panel.getByRole("button", { name: text.back, exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: text.later, exact: true })).toBeDisabled();
  await expect(panel.getByRole("textbox", { name: text.name, exact: true })).toHaveCount(0);
  await expect(panel.getByText(f.center.name, { exact: true })).toBeVisible();
  await attemptOutsideDismissal(panel);
  await expect(panel).toBeVisible();
  await activate(panel.getByRole("button", { name: common.finance.retrySame, exact: true }));
  await expect(panel.getByRole("status")).toContainText(text.states.saved);
  expect(f.effects).toBe(1);
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]!.operation_key).toBe(f.writes[0]!.operation_key);
  expect(f.writes[1]!.request_id).not.toBe(f.writes[0]!.request_id);
  await activate(panel.getByRole("button", { name: common.memberProfile.close, exact: true }));
});
for (const rejectCreate of ["VERSION_CONFLICT", "PLAN_LIMIT_REACHED"] as const)
  test(`first-center review handles ${rejectCreate} without a phantom center`, async ({ page }) => {
    const f = await setup(page, { rejectCreate });
    const panel = await fill(page);
    await activate(panel.getByRole("button", { name: text.action, exact: true }));
    const notice = rejectCreate === "VERSION_CONFLICT" ? text.states.stale : text.states.rejected;
    await expect(panel.getByRole("status")).toHaveText(notice);
    await expect(
      panel.getByRole("button", { name: common.finance.retrySame, exact: true }),
    ).toHaveCount(0);
    await activate(panel.getByRole("button", { name: text.later, exact: true }));
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("link", { name: text.settings, exact: true })).toHaveCount(0);
    expect(f.writes).toHaveLength(1);
    expect(f.effects).toBe(0);
  });
test("acknowledged first-center creation permits only workspace rereads after a failed result read", async ({
  page,
}) => {
  const f = await setup(page, { unread: true }),
    panel = await fill(page);
  await activate(panel.getByRole("button", { name: text.action, exact: true }));
  await expect(panel.getByRole("status")).toContainText(text.states["saved-unread"]);
  await expect(
    panel.getByRole("button", { name: common.finance.retrySame, exact: true }),
  ).toHaveCount(0);
  await activate(panel.getByRole("button", { name: common.finance.readResult, exact: true }));
  await expect(panel.getByRole("status")).toContainText(text.states.saved);
  expect(f.effects).toBe(1);
  expect(f.writes).toHaveLength(1);
  expect(f.reads).not.toContain("operation_status_get_v1");
  await activate(panel.getByRole("button", { name: common.memberProfile.close, exact: true }));
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
  await activate(
    page.getByRole("alert").getByRole("button", { name: common.auth.retry, exact: true }),
  );
  await expect(page.getByRole("button", { name: text.action, exact: true })).toBeEnabled();
  expect(f.writes).toHaveLength(0);
});
