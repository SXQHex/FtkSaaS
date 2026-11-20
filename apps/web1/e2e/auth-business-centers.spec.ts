import type { Page } from "@playwright/test";
import { test, expect } from "./test.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import { at, metadata, nativeMutation, nativePage, uid } from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import type {
  SettlementProposal,
  SettlementRequestView,
} from "../src/lib/api-contracts/generated.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

const text = common.businessCenters;
const second = uid(260);
const third = uid(261);
const application = uid(262);
const movement = uid(263);
const settlement = uid(264);
const centerUrl = (center = I.center) => `/o/${I.org}/c/${center}/centers`;
type Role = "owner" | "org_manager" | "center_manager" | "staff";
type Calls = { op: string; request: Record<string, unknown> }[];
async function businessFixture(page: Page, role: Role, plan = "business", activeCenters = 2) {
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
  for (let index = centers.length; index < activeCenters; index++) {
    centers.push({ ...centers[0]!, id: uid(280 + index), name: `Sentetik Merkez ${index + 1}` });
  }
  const centerLimit = 5;
  let targetCenter = null as string | null;
  let applicationVersion = 1;
  let state: SettlementRequestView["state"] | undefined;
  let proposal: SettlementProposal | undefined;
  let settlementReason = "";
  let approveBeforeRead = false;
  let loseDecisionResponse = false;
  let approvalKey: unknown;
  let granted = true;
  let discrepancy = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    calls.push({ op, request });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    if (op === "centers_list_v1") return send(nativePage(centers));
    if (!centers[1]!.accessible && request.center_id === I.center) {
      if (op === "finance_directory_get_v1") return send({ ...nativePage([]), view: request.view });
      if (
        op === "leads_list_v1" ||
        op === "management_work_list_v1" ||
        (op === "management_state_get_v1" && request.operation === "lead_save_v1")
      )
        return send(nativePage([]));
    }
    if (op === "disciplines_list_v1" && request.center_id === second)
      return send(
        nativePage([
          {
            id: uid(290),
            name: "Sentetik Salsa",
            state: "active",
            version: 1,
            presentation: {
              organization: {
                description: null,
                color: null,
                icon: null,
                display_order: 0,
                public_visible: false,
                allow_center_description: true,
              },
              center: {
                id: uid(291),
                state: "active",
                version: 1,
                presentation: { description: null, public_visible: false },
              },
            },
          },
        ]),
      );
    if (op === "management_state_get_v1" && request.center_id === second) {
      if (request.operation === "class_save_v1") return send(nativePage([]));
      if (request.operation === "room_save_v1") {
        const room = uid(292);
        return send(
          nativePage([
            metadata("room_save_v1", "rooms", room, {
              room_id: room,
              name: "Sentetik B salonu",
              capacity: 24,
            }),
          ]),
        );
      }
    }
    if (op === "roles_list_v1" && role === "owner" && request.person_id === I.self)
      return send(
        nativePage([
          {
            id: uid(296),
            person_id: I.self,
            role: "owner",
            state: "active",
            version: 1,
            scope_center_id: null,
          },
          ...[I.center, second].map((center, index) => ({
            id: uid(297 + index),
            person_id: I.self,
            role: "center_manager",
            state: "active",
            version: 1,
            scope_center_id: center,
          })),
        ]),
      );
    if (op === "roles_list_v1" && role !== "owner" && request.person_id === I.self)
      return send(
        nativePage(
          (role === "org_manager"
            ? [null]
            : centers.filter((center) => center.accessible).map((center) => center.id)
          ).map((center, index) => ({
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
            { key: "centers", value: centerLimit },
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
      if (centers.length >= centerLimit)
        return route.fulfill({
          status: 409,
          json: {
            ok: false,
            error: { code: "PLAN_LIMIT_REACHED", retryable: false, trace_id: I.role },
          },
        });
      centers.push({ ...centers[0]!, id: third, name: request.name, timezone: request.timezone });
      return send(nativeMutation(third));
    }
    if (op === "report_get_v1" && ["sales", "collections_debts"].includes(request.report)) {
      const requested: string[] = request.filters.center_ids;
      const amount = requested.reduce((sum, id) => sum + (id === second ? 200 : 100), 0);
      const delta = !request.center_id && discrepancy ? 50 : 0;
      return send({
        report_kind: request.report,
        as_of: at,
        filters: request.filters,
        rows: nativePage([]),
        totals:
          request.report === "sales"
            ? [
                {
                  group_key: "gross_sales:2026-11-09",
                  currency: "TRY",
                  count: 1,
                  amount_minor: String(amount + delta),
                },
                {
                  group_key: "gross_sales:2026-11-09",
                  currency: "EUR",
                  count: 1,
                  amount_minor: String(amount * 2),
                },
              ]
            : [
                {
                  group_key: "collections",
                  currency: "TRY",
                  count: 1,
                  amount_minor: String(amount * 2),
                },
                {
                  group_key: "outstanding_debt",
                  currency: "TRY",
                  count: 1,
                  amount_minor: String(amount * 3),
                },
              ],
      });
    }
    if (
      op === "management_state_get_v1" &&
      request.operation === "person_merge_preview_v1" &&
      (role === "center_manager" || request.page?.limit === 3)
    ) {
      expect(role).not.toBe("org_manager");
      expect(request.center_id).toBe(I.center);
      expect(request.selector.key).toMatchObject({ directory: "center", status: "suggested" });
      const source = { id: I.self, display_name: "Sentetik birinci kişi", version: 1 };
      const target = { id: I.instructor, display_name: "Sentetik ikinci kişi", version: 1 };
      return send({
        ...nativePage([
          {
            operation: "person_merge_preview_v1",
            exists: true,
            entity: { type: "people", id: target.id },
            state: "pending",
            as_of: at,
            versions: [source, target].map(({ id, version }) => ({
              entity: { type: "people", id },
              version,
            })),
            current: {
              operation: "person_merge_preview_v1",
              values: { source_id: source.id, target_id: target.id },
            },
            merge_review: {
              state: "suggested",
              source,
              target,
              matching_kinds: ["email"],
              reason: null,
              recorded_at: null,
            },
          },
        ]),
        merge_review_summary: {
          total: 1,
          filtered: 1,
          by_state: [{ state: "suggested", count: 1 }],
        },
      });
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
          ...(state === "approved"
            ? [
                {
                  id: uid(302),
                  version: 1,
                  debtor_center_id: second,
                  creditor_center_id: I.center,
                  kind: "payment",
                  currency: "TRY",
                  amount_minor: "12000",
                  open_minor: "0",
                  source_allocation_id: null,
                  source_sale_id: null,
                  previous_id: movement,
                  created_at: at,
                },
              ]
            : []),
        ]),
      );
    const row = (): SettlementRequestView => {
      if (!state || !proposal) throw Error("Missing settlement fixture data");
      const authority = {
        account_id: I.account,
        person_id: I.self,
        org_id: I.org,
        manager_role_version: 1,
        settlement_grant_version: 1,
        checked_at: at,
      };
      const decided = state === "approved" || state === "rejected";
      return {
        id: settlement,
        version: state === "pending" ? 1 : 2,
        from_center_id: I.center,
        to_center_id: second,
        currency: "TRY",
        state,
        reason: settlementReason,
        initiator_account_id: I.account,
        decision_account_id: decided ? I.account : null,
        previous_id: null,
        proposal,
        initiator_authority: {
          ...authority,
          center_id: I.center,
          permission: "settlement.request",
          manager_role_id: uid(265),
        },
        decision_authority: decided
          ? {
              ...authority,
              center_id: second,
              permission: "settlement.decide",
              manager_role_id: uid(266),
            }
          : null,
        record:
          state === "approved"
            ? {
                id: uid(300),
                version: 1,
                request_id: settlement,
                kind: "payment",
                amount_minor: "12000",
                currency: "TRY",
                approved_by_account_id: I.account,
                original_record_id: null,
                created_at: at,
                allocations: [
                  {
                    id: uid(301),
                    version: 1,
                    movement_id: movement,
                    side: "payment",
                    amount_minor: "12000",
                    unreversed_minor: "12000",
                  },
                ],
              }
            : null,
      };
    };
    if (op === "settlement_requests_list_v1") return send(nativePage(state ? [row()] : []));
    if (op === "settlement_request_submit_v1") {
      expect(request.from_center_id).toBe(I.center);
      expect(request.to_center_id).toBe(second);
      expect(request.center_id).toBe(I.center);
      proposal = request.proposal;
      settlementReason = request.reason;
      state = approveBeforeRead ? "approved" : "pending";
      return send(nativeMutation(settlement));
    }
    if (op === "settlement_request_decide_v1") {
      expect(request.settlement_request_id).toBe(settlement);
      expect(request.expected_version).toBe(1);
      expect(request.center_id).toBe(second);
      if (approvalKey) {
        expect(request.operation_key).toBe(approvalKey);
        return send({ ...nativeMutation(settlement), replayed: true });
      }
      approvalKey = request.operation_key;
      state = request.decision === "approve" ? "approved" : "rejected";
      settlementReason = request.reason;
      if (loseDecisionResponse) return route.abort("failed");
      return send(nativeMutation(settlement));
    }
    if (op === "settlement_request_withdraw_v1") {
      expect(request.center_id).toBe(I.center);
      expect(request.settlement_request_id).toBe(settlement);
      expect(request.expected_version).toBe(1);
      state = "withdrawn";
      settlementReason = request.reason;
      return send(nativeMutation(settlement));
    }
    if (op === "settlement_request_get_v1") return send(row());
    return route.fallback();
  });
  return {
    addConcurrentCenter: () => {
      centers.push({ ...centers[0]!, id: uid(294), name: "Başka oturumun merkezi" });
    },
    restrictSecondCenter: () => {
      centers[1]!.accessible = false;
    },
    approveBeforeFirstRead: () => {
      approveBeforeRead = true;
    },
    loseNextDecisionResponse: () => {
      loseDecisionResponse = true;
    },
    setDiscrepancy: () => {
      discrepancy = true;
    },
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

async function reviewSettlement(page: Page) {
  await page.getByLabel(common.platform.reason, { exact: true }).fill("Sentetik ödeme gerekçesi");
  await page.getByLabel(text.settlement.debit, { exact: true }).selectOption(movement);
  await page.getByLabel(text.settlement.minor, { exact: true }).fill("12000");
  await page.getByLabel(text.settlement.occurred, { exact: true }).fill("2026-01-10T10:00");
  await page
    .getByRole("form", { name: text.settlement.submit, exact: true })
    .getByRole("button", { name: text.review, exact: true })
    .click();
}

function settlementMovementRow(page: Page, name: string) {
  return page
    .getByRole("grid", { name: text.settlement.movements, exact: true })
    .getByRole("row")
    .filter({ has: page.getByRole("gridcell", { name, exact: true }) });
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
  const usageRequest = f.calls.findLast(
    ({ op, request }) =>
      op === "report_get_v1" &&
      request.report === "cross_center_usage" &&
      (request.page as { limit: number }).limit === 25,
  )?.request;
  expect(usageRequest).toMatchObject({
    org_id: I.org,
    filters: { center_ids: [I.center, second, third] },
  });
  expect(usageRequest?.center_id).toBeUndefined();
  const finance = page.getByRole("grid", { name: text.reportFinance.title });
  const centerB = finance.getByRole("row").filter({ hasText: "Sentetik Merkez B" });
  await expect(centerB.getByRole("gridcell", { name: "€4,00 · ₺2,00", exact: true })).toBeVisible();
  await expect(centerB.getByRole("gridcell", { name: "₺6,00", exact: true })).toBeVisible();
  await expect(page.getByText(text.reportFinance.match, { exact: true })).toBeVisible();
  const reads = f.calls.filter(
    ({ op, request }) =>
      op === "report_get_v1" && ["sales", "collections_debts"].includes(String(request.report)),
  );
  for (const id of [I.center, second, third]) {
    expect(reads.filter(({ request }) => request.center_id === id)).toHaveLength(2);
  }
  expect(reads.filter(({ request }) => request.center_id === undefined)).toHaveLength(2);
  expect(
    new Set(
      reads.map(({ request }) =>
        JSON.stringify((request.filters as { interval: unknown }).interval),
      ),
    ).size,
  ).toBe(1);
  f.setDiscrepancy();
  await page.getByLabel(text.reportPeriod, { exact: true }).selectOption("7");
  await expect(page.getByText(text.reportFinance.difference, { exact: true })).toBeVisible();
  await expect(page.getByText("Satış · ₺0,50", { exact: true })).toBeVisible();
});

test("Business keeps the open balance until B approves, retries a lost response once and hides the revoked ledger", async ({
  page,
}) => {
  const f = await businessFixture(page, "center_manager");
  await page.goto(centerUrl());
  const openLedger = () =>
    page.getByRole("tab", { name: text.tabs.settlement, exact: true }).click();
  const openBalance = settlementMovementRow(page, text.settlement.movementsState.accrual)
    .getByRole("gridcell")
    .last();
  await openLedger();
  await reviewSettlement(page);
  await confirm(page, text.settlement.submit);
  await expect(page.getByText(text.settlement.requestState.pending, { exact: true })).toBeVisible();
  await expect(openBalance).toHaveText("₺120,00");
  await expect(
    page.getByRole("button", { name: text.settlement.approve, exact: true }),
  ).toHaveCount(0);
  await page.goto(centerUrl(second));
  await openLedger();
  await expect(openBalance).toHaveText("₺120,00");
  await page.getByLabel(common.platform.reason, { exact: true }).fill("Yetkili B kararı");
  await page.getByRole("button", { name: text.settlement.approve, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: text.settlement.approve, exact: true });
  await dialog.getByRole("checkbox").press("Space");
  f.loseNextDecisionResponse();
  await dialog.getByRole("button", { name: common.settings.applyReview, exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.unknown);
  await dialog.getByRole("button", { name: common.studio.retrySameRequest }).click();
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(
    page.getByText(text.settlement.requestState.approved, { exact: true }),
  ).toBeVisible();
  await expect(openBalance).toHaveText("₺0,00");
  const payment = settlementMovementRow(page, text.settlement.movementsState.payment);
  await expect(payment).toHaveCount(1);
  await expect(payment.getByRole("gridcell", { name: "₺120,00", exact: true })).toBeVisible();
  const decisions = f.calls.filter(({ op }) => op === "settlement_request_decide_v1");
  expect(decisions).toHaveLength(2);
  expect(decisions[0]!.request.operation_key).toBe(decisions[1]!.request.operation_key);
  await page.goto(centerUrl());
  await openLedger();
  await expect(openBalance).toHaveText("₺0,00");
  await expect(payment).toHaveCount(1);
  await expect(
    page.getByText(text.settlement.requestState.approved, { exact: true }),
  ).toBeVisible();
  f.revoke();
  await page.goto(centerUrl(second));
  await openLedger();
  await expect(page.getByText(text.settlement.unauthorized, { exact: true })).toBeVisible();
  await expect(page.getByText(text.settlement.requestState.approved, { exact: true })).toHaveCount(
    0,
  );
});

test("Business confirms the submitted request when B decides before the first readback", async ({
  page,
}) => {
  const f = await businessFixture(page, "center_manager");
  await page.goto(centerUrl());
  await page.getByRole("tab", { name: text.tabs.settlement, exact: true }).click();
  await reviewSettlement(page);
  f.approveBeforeFirstRead();
  await confirm(page, text.settlement.submit);
  await expect(
    page.getByText(text.settlement.requestState.approved, { exact: true }),
  ).toBeVisible();
  expect(f.calls.filter(({ op }) => op === "settlement_request_submit_v1")).toHaveLength(1);
});

test("Business removes the pending request when B's delegated settlement grant is withdrawn", async ({
  page,
}) => {
  const f = await businessFixture(page, "center_manager");
  const openLedger = () =>
    page.getByRole("tab", { name: text.tabs.settlement, exact: true }).click();
  await page.goto(centerUrl());
  await openLedger();
  await reviewSettlement(page);
  await confirm(page, text.settlement.submit);
  await page.goto(centerUrl(second));
  await openLedger();
  const approve = page.getByRole("button", { name: text.settlement.approve, exact: true });
  await expect(approve).toBeEnabled();

  f.revoke();
  await page.getByRole("tab", { name: text.tabs.centers, exact: true }).click();
  await openLedger();
  await expect(page.getByText(text.settlement.unauthorized, { exact: true })).toBeVisible();
  await expect(approve).toHaveCount(0);
  await expect(page.getByText(text.settlement.requestState.pending, { exact: true })).toHaveCount(
    0,
  );
  expect(f.calls.filter(({ op }) => op === "settlement_request_decide_v1")).toEqual([]);
});

test("Business refreshes a revoked center in the same document and preserves A's authorized history", async ({
  page,
}) => {
  const f = await businessFixture(page, "center_manager");
  await page.clock.install();
  const openLedger = () =>
    page.getByRole("tab", { name: text.tabs.settlement, exact: true }).click();
  await page.goto(centerUrl());
  await openLedger();
  await reviewSettlement(page);
  await confirm(page, text.settlement.submit);
  await page.goto(centerUrl(second));
  await openLedger();
  const approve = page.getByRole("button", { name: text.settlement.approve, exact: true });
  await expect(approve).toBeEnabled();
  const documentStart = await page.evaluate(() => performance.timeOrigin);

  f.restrictSecondCenter();
  await page.clock.fastForward(31_000);
  await page.evaluate("window.dispatchEvent(new Event('visibilitychange'))");
  await expect(page).toHaveURL(new RegExp(`/c/${I.center}/centers$`));
  await expect(approve).toHaveCount(0);
  await openLedger();
  await expect(page.getByText(text.settlement.requestState.pending, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: text.settlement.withdraw, exact: true }),
  ).toBeEnabled();
  await expect(approve).toHaveCount(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
});

for (const [action, outcome, decidingCenter] of [
  ["reject", "rejected", second],
  ["withdraw", "withdrawn", I.center],
] as const) {
  test(`Business ${action} leaves both center balances intact and shows the reason`, async ({
    page,
  }) => {
    const f = await businessFixture(page, "center_manager");
    const openLedger = () =>
      page.getByRole("tab", { name: text.tabs.settlement, exact: true }).click();
    await page.goto(centerUrl());
    await openLedger();
    await reviewSettlement(page);
    await confirm(page, text.settlement.submit);
    if (decidingCenter === second) {
      await page.goto(centerUrl(second));
      await openLedger();
    }
    const reason = "Sentetik gerekçeli kapanış";
    await page.getByLabel(common.platform.reason, { exact: true }).fill(reason);
    await page.getByRole("button", { name: text.settlement[action], exact: true }).click();
    await confirm(page, text.settlement[action]);

    const expectClosedUnpaid = async () => {
      await expect(
        page.getByText(text.settlement.requestState[outcome], { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(reason, { exact: true })).toBeVisible();
      const movements = page.getByRole("grid", { name: text.settlement.movements, exact: true });
      await expect(movements.getByRole("row")).toHaveCount(2);
      await expect(
        settlementMovementRow(page, text.settlement.movementsState.accrual)
          .getByRole("gridcell")
          .last(),
      ).toHaveText("₺120,00");
    };
    await expectClosedUnpaid();
    await page.goto(centerUrl(decidingCenter === second ? I.center : second));
    await openLedger();
    await expectClosedUnpaid();
    expect(
      f.calls.filter(
        ({ op }) =>
          op === "settlement_request_decide_v1" || op === "settlement_request_withdraw_v1",
      ),
    ).toHaveLength(1);
  });
}

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
  await page.getByRole("tab", { name: text.tabs.people, exact: true }).click();
  await expect(page.getByRole("grid", { name: text.tabs.people })).toBeVisible();
  await expect(page.getByRole("heading", { name: text.mergeSuggestions.title })).toHaveCount(0);
  expect(
    f.calls.filter(
      ({ request }) =>
        request.operation === "person_merge_preview_v1" &&
        (request.page as { limit: number }).limit === 3,
    ),
  ).toHaveLength(0);
});

test("a Business owner sees why adding a sixth active center is unavailable", async ({ page }) => {
  const f = await businessFixture(page, "owner", "business", 4);
  await page.goto(centerUrl());
  const add = page.getByRole("button", { name: text.add, exact: true });
  const form = page.getByRole("form", { name: text.add, exact: true });
  await add.press("Enter");
  await form.getByLabel(text.center, { exact: true }).fill("Beşinci merkez");
  await form.getByLabel(text.timezone, { exact: true }).selectOption("Europe/Istanbul");
  await form.getByRole("button", { name: text.review, exact: true }).press("Enter");
  await confirm(page, text.add);

  const grid = page.getByRole("grid", { name: text.title });
  await expect(grid.getByRole("row", { name: /Beşinci merkez/ })).toBeVisible();
  await expect(grid.getByRole("row")).toHaveCount(6);
  await expect(page.getByText("5 / 5 aktif merkez kullanılıyor.", { exact: true })).toBeVisible();
  await expect(add).toBeDisabled();
  await expect(add).toHaveAccessibleDescription(text.quotaReached);
  await add.press("Enter");
  await expect(add).toBeFocused();
  await expect(form).toHaveCount(0);
  expect(f.calls.filter(({ op }) => op === "center_create_v1")).toHaveLength(1);
});

test("Business center switching keeps resource and policy reads scoped to the selected center", async ({
  page,
}) => {
  const f = await businessFixture(page, "owner");
  const readPolicyIn: string[] = [];
  await page.route("**/functions/v1/backend-v1/policies_get_v1", async (route) => {
    const { org_id, center_id } = route.request().postDataJSON();
    expect(org_id).toBe(I.org);
    readPolicyIn.push(center_id);
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: [
          {
            key: "debt_booking",
            scope: { kind: "organization" },
            value: { kind: "boolean", value: true },
            effective_at: at,
            mandatory: true,
            version: 2,
          },
          {
            key: "reservation_window",
            scope:
              center_id === second
                ? { kind: "center", center_id: second }
                : { kind: "organization" },
            value: {
              kind: "window",
              opens_minutes_before: 10080,
              closes_minutes_before: center_id === second ? 90 : 60,
              manager_exception: false,
            },
            effective_at: at,
            mandatory: false,
            version: 3,
          },
        ],
      },
    });
  });
  await page.goto(centerUrl());
  const selectTab = (name: string) => page.getByRole("tab", { name, exact: true }).click();
  await selectTab(text.tabs.managers);
  await expect(page.getByText("Sentetik yönetici", { exact: true })).toBeVisible();
  await page.getByLabel(text.center, { exact: true }).selectOption(second);
  await expect(page.getByText(text.empty, { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik yönetici", { exact: true })).toHaveCount(0);
  expect(
    f.calls
      .filter(({ op, request }) => op === "roles_list_v1" && request.role === "center_manager")
      .map(({ request }) => request.center_id),
  ).toEqual([I.center, second]);

  await selectTab(text.tabs.policies);
  const mandatory = page.getByRole("listitem").filter({ hasText: "Borçta rezervasyon engeli" });
  const advisory = page.getByRole("listitem").filter({ hasText: "Rezervasyon penceresi" });
  await expect(mandatory).toContainText("Organizasyon · Zorunlu");
  await expect(advisory).toContainText("Organizasyon · Tavsiye");
  await expect(advisory).toContainText("Kapanış: 60 dakika önce");
  await page.getByLabel(text.center, { exact: true }).selectOption(second);
  await expect(mandatory).toContainText("Organizasyon · Zorunlu");
  await expect(advisory).toContainText("Merkez · Tavsiye");
  await expect(advisory).toContainText("Kapanış: 90 dakika önce");
  expect(readPolicyIn).toEqual([I.center, second]);

  await selectTab(text.tabs.disciplines);
  const disciplines = page.getByRole("tabpanel", { name: text.tabs.disciplines });
  await expect(disciplines.getByRole("listitem").filter({ hasText: "Tango" })).toBeVisible();
  await page.getByLabel(text.center, { exact: true }).selectOption(second);
  await expect(
    disciplines.getByRole("listitem").filter({ hasText: "Sentetik Salsa" }),
  ).toBeVisible();
  await expect(disciplines.getByRole("listitem").filter({ hasText: "Tango" })).toHaveCount(0);
  expect(
    f.calls
      .filter(({ op }) => op === "disciplines_list_v1")
      .map(({ request }) => ({ center: request.center_id, include: request.include_presentation })),
  ).toEqual([
    { center: I.center, include: true },
    { center: second, include: true },
  ]);

  await page.getByRole("link", { name: text.edit, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${second}/settings\\?section=salonlar`));
  await expect(page.getByText("Sentetik B salonu", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      f.calls.some(
        ({ op, request }) =>
          op === "management_state_get_v1" &&
          request.operation === "room_save_v1" &&
          request.center_id === second,
      ),
    )
    .toBe(true);
  await selectTab(text.tabs.policies);
  const editPolicy = (label: string) =>
    page.getByRole("row", { name: new RegExp(label) }).getByRole("button", {
      name: common.settings.policyNative.edit,
      exact: true,
    });
  await expect(editPolicy(common.settings.nativePolicies.keys.debt_booking)).toBeDisabled();
  await expect(editPolicy(common.settings.nativePolicies.keys.reservation_window)).toBeEnabled();
  expect(f.calls.some(({ op }) => op === "policy_publish_v1")).toBe(false);
});

test("a Business organization manager sees the native sixth-center rejection", async ({ page }) => {
  const f = await businessFixture(page, "org_manager", "business", 4);
  await page.goto(centerUrl());
  await page.getByRole("button", { name: text.add, exact: true }).click();
  const form = page.getByRole("form", { name: text.add, exact: true });
  await form.getByLabel(text.center, { exact: true }).fill("Altıncı merkez");
  await form.getByLabel(text.timezone, { exact: true }).selectOption("Europe/Istanbul");
  await form.getByRole("button", { name: text.review, exact: true }).click();

  const dialog = page.getByRole("dialog", { name: text.add, exact: true });
  await dialog.getByRole("checkbox").press("Space");
  f.addConcurrentCenter();
  await dialog.getByRole("button", { name: common.settings.applyReview, exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(text.quotaReached);
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
  const grid = page.getByRole("grid", { name: text.title });
  await expect(grid.getByText("Başka oturumun merkezi", { exact: true })).toBeVisible();
  await expect(grid.getByRole("row")).toHaveCount(6);
  await expect(grid.getByText("Altıncı merkez", { exact: true })).toHaveCount(0);
  expect(f.calls.filter(({ op }) => op === "center_create_v1")).toHaveLength(1);
  expect(f.calls.filter(({ op }) => op === "subscription_get_v1")).toEqual([]);
});

test("a center manager sees scoped duplicate suggestions and opens the native merge queue", async ({
  page,
}) => {
  const fixture = await businessFixture(page, "center_manager");
  await page.goto(centerUrl());
  await page.getByRole("tab", { name: text.tabs.people, exact: true }).click();
  await expect(page.getByRole("heading", { name: text.mergeSuggestions.title })).toBeVisible();
  await expect(
    page.getByText("Sentetik birinci kişi · Sentetik ikinci kişi", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(text.mergeSuggestions.matches.email, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: text.mergeSuggestions.open }).click();
  await expect(page).toHaveURL(new RegExp(`/c/${I.center}/people/merge$`));
  expect(
    fixture.calls.find(
      ({ request }) =>
        request.operation === "person_merge_preview_v1" &&
        (request.page as { limit: number }).limit === 3,
    )?.request,
  ).toMatchObject({
    center_id: I.center,
    page: { limit: 3 },
  });
});

for (const role of ["center_manager", "staff"] as const) {
  test(`Business direct person, CRM and finance links stay in scope for ${role}`, async ({
    page,
  }) => {
    const f = await businessFixture(page, role);
    f.restrictSecondCenter();

    const personInB = uid(299);
    const destinations = [
      [`people/${personInB}`, "people", "people_list_v1"],
      ["leads", "leads", "leads_list_v1"],
      ["finance", "finance", "finance_directory_get_v1"],
    ];
    for (const [direct, safe, operation] of destinations) {
      await page.goto(`/o/${I.org}/c/${second}/${direct}`);
      await expect(page).toHaveURL(new RegExp(`/c/${I.center}/${safe}$`));
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: /Sentetik Merkez A/ })).toBeVisible();
      await expect
        .poll(() =>
          f.calls.some(({ op, request }) => op === operation && request.center_id === I.center),
        )
        .toBe(true);
    }

    expect(f.calls.filter(({ request }) => request.center_id === second)).toEqual([]);
    expect(f.calls.filter(({ request }) => request.person_id === personInB)).toEqual([]);
    expect(f.calls.filter(({ op }) => op === "center_create_v1")).toEqual([]);
  });
}
