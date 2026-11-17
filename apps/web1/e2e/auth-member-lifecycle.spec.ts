import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockMemberLifecycle, lifecycleIds as R } from "./member-lifecycle-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };
const text = common.memberProfile;
async function open(page: Page, action: "renew" | "change" | "terminate") {
  await page.getByRole("button", { name: text.actions[action], exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName(text.titles[action]);
  if (action !== "terminate")
    await dialog.getByLabel(text.lifecycle.source, { exact: true }).selectOption(R.sale);
  return dialog;
}
async function chooseProduct(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Yeni 8 ders", exact: true }).press("Space");
  await dialog.getByLabel(text.fields.startDate, { exact: true }).fill("2027-01-15");
  await dialog.getByLabel(text.fields.endDate, { exact: true }).fill("2027-02-15");
}
async function review(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: text.review, exact: true }).click();
  await expect(dialog.getByRole("checkbox", { name: text.accepted, exact: true })).toBeVisible();
  return dialog;
}
async function apply(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: text.accepted, exact: true }).press("Space");
  await dialog.getByRole("button", { name: text.confirm, exact: true }).click();
  return dialog;
}
test("mobile renewal explicitly selects its source and dates, creates a linked sale and leaves old rights intact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await mockMemberLifecycle(page);
  const before = structuredClone(state.rights[0]);
  const dialog = await open(page, "renew");
  await chooseProduct(page);
  await review(page);
  await expect(dialog.getByText("31", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await apply(page);
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.operation).toBe("sale_renew_apply_v1");
  expect(state.previews[0]!.request).toMatchObject({
    previous_sale_id: R.sale,
    product_version_id: R.version,
    start_date: "2027-01-15",
    end_date: "2027-02-15",
  });
  expect(state.rights[0]).toEqual(before);
  expect(state.rights[1]).toMatchObject({
    sale_id: R.nextSale,
    reserved: 0,
    consumed: 0,
    available: 8,
  });
});
test("change reads every native cursor page, requires each keep/cancel choice and rereads terminal reservation states", async ({
  page,
}) => {
  const state = await mockMemberLifecycle(page, { reservations: true, paged: true });
  const dialog = await open(page, "change");
  await chooseProduct(page);
  await dialog.getByLabel(text.reason, { exact: true }).fill("Sentetik paket değişimi");
  const choices = dialog.locator('select[id^="member-reservation-"]');
  await expect(choices).toHaveCount(2);
  await choices.nth(0).selectOption("keep");
  await choices.nth(1).selectOption("cancel");
  await review(page);
  await apply(page);
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(
    state.inventoryReads.some((req) => (req.page as { cursor?: string }).cursor === "native-next"),
  ).toBe(true);
  expect(state.previews[0]!.request).toMatchObject({
    sale_id: R.sale,
    new_product_version_id: R.version,
    keep_reservation_ids: [R.reservation],
    cancel_reservation_ids: [R.secondReservation],
  });
  expect(state.reservations.map((row) => row.state)).toEqual(["active", "cancelled"]);
  expect(state.rights[0]).toMatchObject({ state: "closed", sale_state: "terminated", reserved: 0 });
  expect(state.rights[1]).toMatchObject({ available: 7, reserved: 1 });
});
test("termination preserves confirmed obligations and does not create a refund or a new sale", async ({
  page,
}) => {
  const state = await mockMemberLifecycle(page, { reservations: true });
  const dialog = await open(page, "terminate");
  await dialog.getByLabel(text.reason, { exact: true }).fill("Sentetik hak sonlandırma");
  await review(page);
  await apply(page);
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(state.writes.map((row) => row.operation)).toEqual(["sale_terminate_apply_v1"]);
  expect(state.rights).toHaveLength(1);
  expect(state.rights[0]).toMatchObject({
    available: 0,
    reserved: 1,
    sale_state: "terminated",
    state: "closed",
  });
  expect(state.reservations[0]!.state).toBe("active");
});
test("unknown lifecycle apply recovers its exact receipt without another writer", async ({
  page,
}) => {
  const state = await mockMemberLifecycle(page, { unknown: true });
  const dialog = await open(page, "renew");
  await chooseProduct(page);
  await review(page);
  await apply(page);
  await expect(dialog.getByText(text.lifecycle.states.unknown, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("ACK with unread rights only rereads the confirmed lifecycle result", async ({ page }) => {
  const state = await mockMemberLifecycle(page, { unread: true });
  const dialog = await open(page, "renew");
  await chooseProduct(page);
  await review(page);
  await apply(page);
  await expect(
    dialog.getByText(text.lifecycle.states["saved-unread"], { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: common.finance.retrySame, exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: common.finance.readResult, exact: true }).click();
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
for (const mode of ["denied", "blocked"] as const)
  test(`native ${mode} lifecycle preview cannot become an apply`, async ({ page }) => {
    const state = await mockMemberLifecycle(page, { [mode]: true });
    const dialog = await open(page, "renew");
    await chooseProduct(page);
    if (mode === "denied") {
      await dialog.getByRole("button", { name: text.review, exact: true }).click();
      await expect(dialog.getByText(text.lifecycle.sourceError, { exact: true })).toBeVisible();
    } else {
      await review(page);
      await dialog.getByRole("checkbox", { name: text.accepted, exact: true }).press("Space");
      await expect(dialog.getByRole("button", { name: text.confirm, exact: true })).toBeDisabled();
    }
    expect(state.writes).toHaveLength(0);
  });
test("a future event registration is cancelled with separate reason and approval before change inventory can be reviewed", async ({
  page,
}) => {
  const state = await mockMemberLifecycle(page, { event: true });
  const dialog = await open(page, "change");
  await chooseProduct(page);
  await expect(dialog.getByText(text.lifecycle.eventsBlock, { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: text.review, exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: new RegExp(text.lifecycle.eventCancellation) }).click();
  await dialog.locator('textarea[id^="event-cancel-"]').fill("Sentetik ayrı etkinlik iptali");
  await dialog
    .getByRole("checkbox", { name: text.lifecycle.eventConfirm, exact: true })
    .press("Space");
  await dialog.getByRole("button", { name: text.lifecycle.eventCancellation, exact: true }).click();
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(state.writes.map((row) => row.operation)).toEqual(["event_registration_cancel_v1"]);
  await dialog.getByRole("button", { name: text.lifecycle.readInventory, exact: true }).click();
  await expect(dialog.getByText(text.lifecycle.eventsBlock, { exact: true })).toHaveCount(0);
  await dialog.getByLabel(text.reason, { exact: true }).fill("Sentetik paket değişimi");
  await review(page);
  await apply(page);
  await expect(dialog.getByText(text.lifecycle.states.saved, { exact: true })).toBeVisible();
  expect(state.writes.map((row) => row.operation)).toEqual([
    "event_registration_cancel_v1",
    "sale_change_apply_v1",
  ]);
});
test("student activation and reasoned deactivation use the native center relationship", async ({
  page,
}) => {
  const state = await mockMemberLifecycle(page);
  await page.getByRole("button", { name: text.actions.activate, exact: true }).click();
  let dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: text.actions.activate, exact: true }).click();
  await expect(dialog.getByText(text.studentStates.saved, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: text.close, exact: true }).click();
  await page.getByRole("button", { name: text.actions.deactivate, exact: true }).click();
  dialog = page.getByRole("alertdialog");
  await dialog.getByLabel(text.reason, { exact: true }).fill("Sentetik merkez pasifleştirme");
  await dialog.getByRole("button", { name: text.actions.deactivate, exact: true }).click();
  await expect(dialog.getByText(text.studentStates.saved, { exact: true })).toBeVisible();
  expect(state.writes.map((row) => row.operation)).toEqual([
    "student_activate_v1",
    "student_deactivate_v1",
  ]);
});
test("native open operations prevent student deactivation without changing the visible relationship", async ({
  page,
}) => {
  const state = await mockMemberLifecycle(page, { studentActive: true, studentBlocked: true });
  await page.getByRole("button", { name: text.actions.deactivate, exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel(text.reason, { exact: true }).fill("Sentetik ret senaryosu");
  await dialog.getByRole("button", { name: text.actions.deactivate, exact: true }).click();
  await expect(dialog.getByText(text.studentStates.rejected, { exact: true })).toBeVisible();
  expect(
    state.person.relationships.some((row) => row.kind === "student" && row.state === "active"),
  ).toBe(true);
});
