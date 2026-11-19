import { test, expect } from "./test.js";
import { mockNative } from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { uid } from "./pro-completion-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

const text = common.studioSetup;
const name = "Sentetik İlk Stüdyo";
const id = uid(197);
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("studio-setup@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
test("verified account submits one studio setup request and hands the fulfilled organization to first-center setup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mockNative(page);
  const writes: Record<string, unknown>[] = [];
  let finished = false;
  let platformQueries = 0;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    const r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const list = (items: unknown[]) => ({
      items,
      next_cursor: null,
      as_of: "2026-11-16T12:00:00Z",
    });
    if (op === "studio_setup_list_v1") {
      expect(r).not.toHaveProperty("platform_queue");
      expect(r).not.toHaveProperty("org_id");
      return send(
        list(
          writes.length
            ? [
                {
                  id,
                  account_id: I.account,
                  name,
                  state: finished ? "fulfilled" : "pending",
                  organization_id: finished ? I.org : null,
                  created_at: "2026-11-16T12:00:00Z",
                },
              ]
            : [],
        ),
      );
    }
    if (op === "studio_setup_open_v1") {
      expect(r).toMatchObject({ client_api_version: 1, name, operation_key: expect.any(String) });
      expect(r).not.toHaveProperty("org_id");
      writes.push(r);
      if (writes.length === 1) return route.abort("failed");
      expect(r.operation_key).toBe(writes[0]?.operation_key);
      expect(r.request_id).not.toBe(writes[0]?.request_id);
      return send({ primary_id: id, replayed: true, related: [] });
    }
    if (op === "organizations_list_v1")
      return send(
        list(
          finished
            ? [
                {
                  id: I.org,
                  name,
                  access_mode: "bootstrap",
                  state: "active",
                  version: 1,
                  self_context: { person_id: I.self, subscriber_number: null, centers: [] },
                },
              ]
            : [],
        ),
      );
    if (op === "centers_list_v1" || op === "roles_list_v1") {
      expect(r.org_id).toBe(I.org);
      return send(list([]));
    }
    if (op === "settings_catalog_get_v1" && r.scope === "organization") {
      expect(r.org_id).toBe(I.org);
      return send({
        scope: "organization",
        catalog_version: 25,
        fields: [{ key: "address", group: "O01", consumer: "public_profile", writable: true }],
        defaults: {},
        brand_packages: [],
        limitations: [],
      });
    }
    if (op === "organization_create_v1" || op === "center_create_v1") platformQueries++;
    return route.fallback();
  });
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Bir stüdyoya erişimin yok" })).toBeVisible();
  const studio = page.getByRole("textbox", { name: text.name, exact: true });
  const review = page.getByRole("button", { name: text.review, exact: true });
  await review.click();
  await expect(studio).toBeFocused();
  await expect(studio).toHaveAccessibleDescription(text.nameError);
  await studio.fill("  " + name + "  ");
  await review.click();
  const dialog = page.getByRole("dialog", { name: text.review });
  const submit = dialog.getByRole("button", { name: text.submit, exact: true });
  await expect(submit).toBeDisabled();
  expect(writes).toHaveLength(0);
  await dialog.getByRole("checkbox").press("Space");
  await submit.click();
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.unknown);
  await dialog.getByRole("button", { name: common.studio.retrySameRequest, exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await page.reload();
  await expect(page.getByText(text.pending, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: common.centerSetup.action, exact: true }),
  ).toHaveCount(0);
  await expect(review).toHaveCount(0);

  finished = true;
  await page.getByRole("button", { name: text.refresh, exact: true }).click();
  await expect(
    page.getByRole("button", { name: common.centerSetup.action, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: text.title, exact: true })).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(platformQueries).toBe(0);
});

test("an unread studio setup source stays closed and a foreign row does not expose data", async ({
  page,
}) => {
  await mockNative(page);
  let fail = true;
  await page.route("**/functions/v1/backend-v1/studio_setup_list_v1", (route) => {
    if (fail) return route.abort("failed");
    return route.fulfill({
      json: {
        ok: true,
        trace_id: id,
        data: {
          items: [
            {
              id,
              account_id: uid(196),
              name: "Başka hesaba ait stüdyo",
              state: "pending",
              organization_id: null,
              created_at: "2026-11-16T12:00:00Z",
            },
          ],
          next_cursor: null,
          as_of: "2026-11-16T12:00:00Z",
        },
      },
    });
  });
  await signIn(page);
  await expect(page.getByText(text.readError, { exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: text.refresh, exact: true }).click();
  await expect(page.getByText(text.readError, { exact: true })).toBeVisible();
  await expect(page.getByText("Başka hesaba ait stüdyo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: text.name, exact: true })).toHaveCount(0);
});
