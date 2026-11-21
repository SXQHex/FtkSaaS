import { test, expect } from "./test.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { clickWorkspaceLink, origin } from "./auth-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

test("staff person.manage permits creation only while the native grant is active, including an already open form", async ({
  page,
}) => {
  const native = await mockStudio(page);
  const state = { granted: false, attempts: 0 };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "roles_list_v1") {
      expect(r.person_id).toBe(I.self);
      return send({
        items: [
          {
            id: I.role,
            person_id: I.self,
            role: "staff",
            scope_center_id: I.center,
            state: "active",
            version: 1,
            account_access_granted: true,
          },
        ],
        next_cursor: null,
      });
    }
    if (op === "people_list_v1")
      return send({
        items: native.people.filter((person) => person.id !== I.instructor),
        next_cursor: null,
        as_of: "2026-11-18T08:00:00Z",
      });
    if (op === "person_create_v1") {
      expect(r).toMatchObject({ org_id: I.org, center_id: I.center });
      expect(r).not.toHaveProperty("person_id");
      state.attempts++;
      if (!state.granted)
        return route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await clickWorkspaceLink(page, "Üyeler");
  const open = async (name: string) => {
    await page.getByRole("button", { name: "Üye davet et", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#people-name").fill(name);
    await dialog.locator("#people-email").fill("staff-created@example.invalid");
    return dialog;
  };
  let form = await open("İzin öncesi kişi");
  await form.getByRole("button", { name: "Kişiyi oluştur", exact: true }).click();
  await expect(form.getByText(common.people.writeRejected, { exact: true })).toBeVisible();
  expect(native.effects).toEqual([]);
  await form.getByRole("button", { name: "Vazgeç", exact: true }).click();

  // The paired manager UI test applies/revokes this native permission; this actor only consumes its live outcome.
  state.granted = true;
  form = await open("İzinli personel kaydı");
  await form.getByRole("button", { name: "Kişiyi oluştur", exact: true }).click();
  await expect(form.locator("#people-name")).toHaveAttribute("readonly", "");
  expect(
    native.people.filter((person) => person.display_name === "İzinli personel kaydı"),
  ).toHaveLength(1);
  await form.getByRole("button", { name: "Vazgeç", exact: true }).click();
  form = await open("Geri alınan izinle taslak");
  state.granted = false;
  await form.getByRole("button", { name: "Kişiyi oluştur", exact: true }).click();
  await expect(form.getByText(common.people.writeRejected, { exact: true })).toBeVisible();
  expect(
    native.people.filter((person) => person.display_name === "Geri alınan izinle taslak"),
  ).toHaveLength(0);
  expect(native.effects).toEqual(["person_create_v1"]);
  expect(state.attempts).toBe(3);
  await form.getByRole("button", { name: "Vazgeç", exact: true }).click();
});
