import type { Page } from "@playwright/test";
import { test, expect } from "./test.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import { at, metadata, nativeMutation, nativePage, uid } from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

const text = common.businessCenters;
const second = uid(260);
const third = uid(261);
const application = uid(262);
const movement = uid(263);
const settlement = uid(264);
const centerUrl = (center = I.center) => `/o/${I.org}/c/${center}/centers`;
type Role = "owner" | "org_manager" | "center_manager";
type Calls = { op: string; request: Record<string, unknown> }[];
async function businessFixture(page: Page, role: Role, plan = "business") {
  await mockSettingsCompletion(page, { billingOwner: role === "owner" });
  const calls: Calls = [];
  const centers = [
    {
      id: I.center,
      name: "Sentetik Merkez A",
      timezone: "Europe/Istanbul",
      state: "active",
      accessible: true,
      version: 1,
    },
    {
      id: second,
      name: "Sentetik Merkez B",
      timezone: "Europe/Istanbul",
      state: "active",
      accessible: true,
      version: 1,
    },
  ];
  let targetCenter = null as string | null;
  let applicationVersion = 1;
  let state = "";
  let proposal: unknown;
  let granted = true;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    calls.push({ op, request });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    if (op === "centers_list_v1") return send(nativePage(centers));
    if (op === "roles_list_v1" && role !== "owner" && request.person_id === I.self)
      return send(
        nativePage(
          (role === "org_manager" ? [null] : [I.center, second]).map((center, index) => ({
            id: uid(265 + index),
            person_id: I.self,
            role,
            state: "active",
            version: 1,
            scope_center_id: center,
          })),
        ),
      );
    if (op === "subscription_get_v1" && role === "owner")
      return send({
        state: "active",
        plan,
        subscription_version: 1,
        limits: {
          entries: [
            { key: "centers", value: 5 },
            { key: "active_students", value: 1250 },
          ],
        },
        usage: {
          entries: [
            { key: "centers", value: centers.length },
            { key: "active_students", value: 1 },
          ],
        },
        cancel_at_period_end: false,
        period_start: "2026-11-01T00:00:00Z",
        period_end: "2026-12-01T00:00:00Z",
        grace_until: null,
        pending_change: null,
      });
    if (op === "center_create_v1") {
      expect(request.org_id).toBe(I.org);
      centers.push({ ...centers[0]!, id: third, name: request.name, timezone: request.timezone });
      return send(nativeMutation(third));
    }
    if (op === "report_get_v1" && request.report === "cross_center_usage")
      return send({
        report_kind: "cross_center_usage",
        as_of: at,
        filters: request.filters,
        rows: nativePage(
          request.page.limit === 1
            ? []
            : [
                {
                  group_key: "outgoing_to:" + second,
                  center_id: I.center,
                  count: 1,
                  amount_minor: "12000",
                  currency: "TRY",
                },
              ],
        ),
        totals: [],
      });
    if (
      op === "management_state_get_v1" &&
      request.operation === "public_application_review_v1" &&
      !request.center_id
    )
      return send(
        nativePage([
          metadata(
            request.operation,
            "public_applications",
            application,
            { center_id: targetCenter, contact: "Sentetik Başvuran" },
            applicationVersion,
            "pending",
          ),
        ]),
      );
    if (op === "public_application_review_v1" && request.action === "assign_center") {
      expect(request.expected_version).toBe(applicationVersion);
      expect(request.center_id).toBeUndefined();
      applicationVersion++;
      targetCenter = request.target_center_id;
      return send(nativeMutation(application));
    }
    if (op === "settlement_authority_get_v1") {
      expect(request.person_id).toBe(I.self);
      return send({
        org_id: I.org,
        person_id: I.self,
        version: 1,
        delegation_allowed: false,
        center_grants: [{ center_id: request.center_id, granted }],
      });
    }
    if (op === "settlement_movements_list_v1")
      return send(
        nativePage([
          {
            id: movement,
            version: state === "approved" ? 2 : 1,
            debtor_center_id: I.center,
            creditor_center_id: second,
            kind: "accrual",
            currency: "TRY",
            amount_minor: "12000",
            open_minor: state === "approved" ? "0" : "12000",
            source_allocation_id: null,
            source_sale_id: null,
            previous_id: null,
            created_at: at,
          },
        ]),
      );
    const row = () => ({
      id: settlement,
      version: state === "approved" ? 2 : 1,
      from_center_id: I.center,
      to_center_id: second,
      currency: "TRY",
      state,
      reason: "Sentetik hesaplaşma",
      initiator_account_id: I.account,
      proposal,
    });
    if (op === "settlement_requests_list_v1") return send(nativePage(state ? [row()] : []));
    if (op === "settlement_request_submit_v1") {
      expect(request.from_center_id).toBe(I.center);
      expect(request.to_center_id).toBe(second);
      expect(request.center_id).toBe(I.center);
      proposal = request.proposal;
      state = "pending";
      return send(nativeMutation(settlement));
    }
    if (op === "settlement_request_decide_v1") {
      expect(request.settlement_request_id).toBe(settlement);
      expect(request.expected_version).toBe(1);
      expect(request.center_id).toBe(second);
      state = "approved";
      return send(nativeMutation(settlement));
    }
    if (op === "settlement_request_get_v1") return send(row());
    return route.fallback();
  });
  return {
    calls,
    revoke: () => {
      granted = false;
    },
  };
}

async function confirm(page: Page, title: string) {
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  const apply = dialog.getByRole("button", { name: common.settings.applyReview, exact: true });
  await expect(apply).toBeDisabled();
  await dialog.getByRole("checkbox").press("Space");
  await apply.click();
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
}

test("Business owner manages centers, reads native center resources, routes an application and reads a combined report", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const f = await businessFixture(page, "owner");
  await page.goto(centerUrl());
  const grid = page.getByRole("grid", { name: text.title, exact: true });
  await expect(grid.getByText("Sentetik Merkez A", { exact: true })).toBeVisible();
  await expect(grid.getByText("Sentetik Merkez B", { exact: true })).toBeVisible();
  await expect(page.getByText("2 / 5 aktif merkez kullanılıyor.", { exact: true })).toBeVisible();
  await testInfo.attach("E49 Merkezler", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: text.add, exact: true }).click();
  const form = page.getByRole("form", { name: text.add, exact: true });
  await form.getByLabel(text.center, { exact: true }).fill("Sentetik Merkez C");
  await form.getByLabel(text.timezone, { exact: true }).selectOption("Europe/Istanbul");
  await form.getByRole("button", { name: text.review, exact: true }).click();
  await confirm(page, text.add);
  await expect(grid.getByText("Sentetik Merkez C", { exact: true })).toBeVisible();
  await expect(page.getByText("3 / 5 aktif merkez kullanılıyor.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: text.tabs.managers, exact: true }).click();
  await expect(page.getByText("Sentetik yönetici", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: text.tabs.policies, exact: true }).click();
  await expect(
    page.getByText(common.settings.nativePolicies.keys.reservation_window, { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: text.tabs.disciplines, exact: true }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: text.tabs.disciplines })
      .getByRole("listitem")
      .filter({ hasText: "Tango" })
      .getByText(text.active, { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: text.tabs.people, exact: true }).click();
  await expect(
    page.getByRole("grid", { name: text.tabs.people }).getByText("Sentetik hesap", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: text.tabs.applications, exact: true }).click();
  await page.getByLabel(text.destination, { exact: true }).selectOption(second);
  await page.getByRole("button", { name: text.route, exact: true }).click();
  await confirm(page, text.route);
  await expect(page.getByText("Sentetik Merkez B", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: text.tabs.reports, exact: true }).click();
  const report = page.getByRole("grid", { name: text.tabs.reports });
  await expect(
    report.getByText("Sentetik Merkez B merkezine kullanım", { exact: true }),
  ).toBeVisible();
  expect(f.calls.filter(({ op }) => op === "report_get_v1").at(-1)?.request).toMatchObject({
    org_id: I.org,
    report: "cross_center_usage",
    filters: { center_ids: [I.center, second, third] },
  });
  expect(
    f.calls.filter(({ op }) => op === "report_get_v1").at(-1)?.request.center_id,
  ).toBeUndefined();
});

test("authorized Business managers submit a real movement in A, decide in B and lose the ledger after revocation", async ({
  page,
}) => {
  const f = await businessFixture(page, "center_manager");
  await page.goto(centerUrl());
  const openLedger = () =>
    page.getByRole("tab", { name: text.tabs.settlement, exact: true }).click();
  await openLedger();
  await page.getByLabel(common.platform.reason, { exact: true }).fill("Sentetik ödeme gerekçesi");
  await page.getByLabel(text.settlement.debit, { exact: true }).selectOption(movement);
  await page.getByLabel(text.settlement.minor, { exact: true }).fill("12000");
  await page.getByLabel(text.settlement.occurred, { exact: true }).fill("2026-01-10T10:00");
  await page
    .getByRole("form", { name: text.settlement.submit, exact: true })
    .getByRole("button", { name: text.review, exact: true })
    .click();
  await confirm(page, text.settlement.submit);
  await expect(page.getByText(text.settlement.requestState.pending, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: text.settlement.approve, exact: true }),
  ).toHaveCount(0);
  await page.goto(centerUrl(second));
  await openLedger();
  await page.getByLabel(common.platform.reason, { exact: true }).fill("Yetkili B kararı");
  await page.getByRole("button", { name: text.settlement.approve, exact: true }).click();
  await confirm(page, text.settlement.approve);
  await expect(
    page.getByText(text.settlement.requestState.approved, { exact: true }),
  ).toBeVisible();
  expect(f.calls.filter(({ op }) => op === "settlement_request_decide_v1")).toHaveLength(1);
  f.revoke();
  await page.reload();
  await openLedger();
  await expect(page.getByText(text.settlement.unauthorized, { exact: true })).toBeVisible();
  await expect(page.getByText(text.settlement.requestState.approved, { exact: true })).toHaveCount(
    0,
  );
});

test("Pro owner cannot open the Business centers or request Business data", async ({ page }) => {
  const f = await businessFixture(page, "owner", "pro");
  await page.goto(centerUrl());
  await expect(page.getByText(text.unavailable, { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: text.tabs.settlement, exact: true })).toHaveCount(0);
  expect(
    f.calls.filter(({ op }) => op === "report_get_v1" || op.startsWith("settlement_")),
  ).toEqual([]);
});

test("a Business organization manager can create a center without opening the owner's subscription", async ({
  page,
}) => {
  const f = await businessFixture(page, "org_manager");
  await page.goto(centerUrl());
  await page.getByRole("button", { name: text.add, exact: true }).click();
  const form = page.getByRole("form", { name: text.add, exact: true });
  await form.getByLabel(text.center, { exact: true }).fill("Yöneticinin yeni merkezi");
  await form.getByLabel(text.timezone, { exact: true }).selectOption("Europe/Istanbul");
  await form.getByRole("button", { name: text.review, exact: true }).click();
  await confirm(page, text.add);
  await expect(
    page
      .getByRole("grid", { name: text.title })
      .getByText("Yöneticinin yeni merkezi", { exact: true }),
  ).toBeVisible();
  expect(f.calls.filter(({ op }) => op === "center_create_v1")).toHaveLength(1);
  expect(f.calls.filter(({ op }) => op === "subscription_get_v1")).toEqual([]);
});
