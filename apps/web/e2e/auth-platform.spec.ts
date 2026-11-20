import { test, expect } from "./test.js";
import { mockNative } from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { nativeMutation, uid } from "./pro-completion-fixture.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import type { AccountView } from "@ftksaas/api-contracts";
import common from "../src/locales/tr/common.json" with { type: "json" };

const text = common.platform;
const activity = text.activity;
const activityLog = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: activity.title, exact: true });
const target = uid(210);
const list = (items: unknown[], next_cursor: string | null = null) => ({
  items,
  next_cursor,
  as_of: "2026-11-16T12:00:00Z",
});
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
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
}
async function platformFixture(
  page: import("@playwright/test").Page,
  role: "platform" | "owner" | "staff",
) {
  await mockNative(page);
  const calls: { operation: string; request: Record<string, unknown> }[] = [];
  let profile: Pick<AccountView, "display_name"> & Partial<Pick<AccountView, "identity">> = {
    display_name: "Sentetik Platform",
  };
  let permitted = role === "platform";
  let row = { ...initial };
  let changes = 0;
  let firstKey: string | undefined;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    calls.push({ operation, request });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    if (operation === "account_get_v1" && request.include_platform_scope) {
      return send({
        id: I.account,
        state: "active",
        ...profile,
        platform_scope: {
          organizations: permitted,
          organization_create: permitted,
          organization_suspend: permitted,
          owner_manage: permitted,
          payment_verify: permitted,
          grace_extend: permitted,
          operator_manage: permitted,
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
      if (request.view === "invoices") {
        expect(request.scope).toEqual({ org_id: target });
        return send(list([]));
      }
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
    if (operation === "studio_setup_list_v1" && request.platform_queue && permitted)
      return send(list([]));
    if (operation === "management_state_get_v1" && request.operation === "saas_grace_extend_v1") {
      const entity = { type: "saas_subscriptions", id: uid(238) };
      return send(
        list([
          {
            operation: request.operation,
            entity,
            exists: true,
            versions: [{ entity, version: 1 }],
            current: {
              operation: request.operation,
              values: { eligible: false, until_after: null },
            },
            as_of: "2026-11-16T12:00:00Z",
          },
        ]),
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
    setProfile: (next: typeof profile) => {
      profile = next;
    },
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
  await expect(page.getByText(activity.empty, { exact: true })).toBeAttached();
  await suspend.getByRole("button", { name: common.studio.retrySameRequest, exact: true }).click();
  await expect(suspend.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await suspend.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(page.getByText(text.suspended, { exact: true })).toBeVisible();
  await expect(page.getByText(text.subscriptions.active, { exact: true })).toBeVisible();
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(1);
  await expect(activityLog(page)).toContainText(activity.actions.suspended);
  await expect(activityLog(page)).not.toContainText("Sentetik askı nedeni");
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
  await page.getByRole("link", { name: text.organizations, exact: true }).click();
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(2);
  await expect(activityLog(page).getByRole("listitem").first()).toContainText(
    activity.actions.resumed,
  );
  await page.getByRole("link", { name: text.studioRequests.title, exact: true }).click();
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(2);
  f.revoke();
  await page.getByRole("link", { name: text.organizations, exact: true }).click();
  await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
  await expect(page.getByText(initial.name, { exact: true })).toHaveCount(0);
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(0);
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
    await page.goto("/platform?section=studio-requests");
    await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
    await page.goto("/platform?section=operators");
    await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
    expect(
      f.calls.filter(
        ({ operation }) =>
          operation.startsWith("platform_") || operation === "studio_setup_list_v1",
      ),
    ).toEqual([]);
  });

test("platform reads the live studio request queue with native pagination and hides revoked rows", async ({
  page,
}) => {
  await platformFixture(page, "platform");
  await page.setViewportSize({ width: 320, height: 900 });
  const queue = text.studioRequests;
  const rows = ["Birinci sentetik stüdyo", "İkinci sentetik stüdyo"].map((name, index) => ({
    id: uid(230 + index),
    account_id: uid(232 + index),
    name,
    state: "pending",
    organization_id: null,
    created_at: "2026-11-16T12:00:00Z",
  }));
  let permitted = true;
  await page.route("**/functions/v1/backend-v1/studio_setup_list_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.platform_queue).toBe(true);
    expect(request.page.limit).toBe(50);
    if (!permitted)
      return route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    const second = request.page.cursor === "second";
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: [rows[second ? 1 : 0]],
          as_of: rows[0]!.created_at,
          next_cursor: second ? null : "second",
        },
      },
    });
  });
  await signIn(page);
  await page.getByRole("link", { name: text.title, exact: true }).click();
  await page.getByRole("link", { name: queue.title, exact: true }).click();
  await expect(page).toHaveURL(/\/platform\?section=studio-requests$/);
  const region = page.getByRole("region", { name: queue.title, exact: true });
  await region.focus();
  await expect(region).toBeFocused();
  await expect(region.getByText(rows[0]!.name, { exact: true })).toBeVisible();
  await expect(region.getByText(rows[1]!.name, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: queue.more, exact: true }).click();
  await expect(region.getByText(rows[1]!.name, { exact: true })).toBeVisible();
  permitted = false;
  await page.getByRole("button", { name: queue.refresh, exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(text.denied);
  await expect(region).toHaveCount(0);
  await expect(page.getByText(rows[0]!.name, { exact: true })).toHaveCount(0);
});

const billing = text.billing;
const billingOrg = I.org;
const paymentsUrl = "/platform?section=payments&organization_id=" + billingOrg;
const billingOrgUrl = "/platform?organization_id=" + billingOrg;
const paymentIds = [uid(212), uid(213), uid(214)];
const paymentTime = "2026-11-16T12:00:00Z";
const initialPeriod = "2026-11-15T00:00:00Z";
const paidPeriod = "2026-12-15T00:00:00Z";
const initialGrace = "2026-11-22T12:00:00Z";
const extendedGrace = "2026-11-25T13:30:00Z";
const intendedGraceInput = "2026-11-25T13:30";

async function billingFixture(page: import("@playwright/test").Page) {
  const authority = await platformFixture(page, "platform");
  const subscription = {
    id: uid(215),
    version: 1,
    period_end: initialPeriod,
    grace_until: initialGrace,
  };
  const payments = paymentIds.map((id, index) => ({
    kind: "payment",
    id,
    org_id: billingOrg,
    version: 1,
    amount_minor: "100000",
    currency: "TRY",
    org_name: "Sentetik ödeme organizasyonu",
    quote_period: index === 2 ? null : { starts_at: initialPeriod, ends_at: paidPeriod },
    reference: "Sentetik bildirim " + (index + 1),
    state: "pending",
    occurred_at: paymentTime,
    verified_at: null as string | null,
  }));
  const writes: { operation: string; request: Record<string, unknown> }[] = [];
  let decisionKey: string | undefined;
  let operator = true;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    const list = (items: unknown[]) => send({ items, next_cursor: null, as_of: paymentTime });
    const deny = () =>
      route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (operation === "platform_directory_get_v1" && request.view === "payments") {
      if (!operator) return deny();
      if (request.scope) expect(request.scope).toEqual({ org_id: billingOrg });
      return list(
        payments.filter(
          (row) =>
            (!request.payment_id || row.id === request.payment_id) &&
            (!request.payment_state || row.state === request.payment_state),
        ),
      );
    }
    if (operation === "platform_directory_get_v1" && request.scope?.org_id === billingOrg) {
      if (!operator) return deny();
      const paid = subscription.period_end === paidPeriod;
      if (request.view === "owners" || request.view === "invoices") return list([]);
      expect(request.view).toBe("organizations");
      return list([
        {
          ...initial,
          id: billingOrg,
          version: subscription.version,
          name: "Sentetik ödeme organizasyonu",
          access_mode: paid ? "normal" : "grace",
          subscription_state: paid ? "active" : "grace",
          grace_until: subscription.grace_until,
        },
      ]);
    }
    if (operation === "management_state_get_v1" && request.operation === "saas_grace_extend_v1") {
      if (!operator) return deny();
      expect(request.org_id).toBe(billingOrg);
      expect(request.selector).toEqual({ operation: "saas_grace_extend_v1", key: {} });
      const entity = { type: "saas_subscriptions", id: subscription.id };
      return list([
        {
          operation: request.operation,
          exists: true,
          entity,
          state: "grace",
          as_of: paymentTime,
          versions: [{ entity, version: subscription.version }],
          current: {
            operation: request.operation,
            values: {
              until: subscription.grace_until,
              eligible: true,
              until_after: subscription.grace_until,
            },
          },
        },
      ]);
    }
    if (operation === "saas_payment_verify_v1") {
      writes.push({ operation, request });
      if (!operator) return deny();
      expect(request.org_id).toBe(billingOrg);
      const row = payments.find((item) => item.id === request.payment_id)!;
      if (decisionKey && decisionKey === request.operation_key)
        return send({ ...nativeMutation(row.id), version: row.version, replayed: true });
      expect(row.state).toBe("pending");
      expect(request.reason).toBe("Sentetik işlem gerekçesi");
      row.version++;
      row.state = request.accepted ? "accepted" : "rejected";
      row.verified_at = paymentTime;
      if (request.accepted) {
        subscription.period_end = paidPeriod;
        subscription.grace_until = "2026-12-22T00:00:00Z";
        subscription.version++;
        decisionKey = request.operation_key;
        return route.abort("failed");
      }
      return send({ ...nativeMutation(row.id), version: row.version });
    }
    if (operation === "saas_grace_extend_v1") {
      writes.push({ operation, request });
      if (!operator) return deny();
      expect(request).toMatchObject({
        org_id: billingOrg,
        until: extendedGrace,
        reason: "Sentetik işlem gerekçesi",
      });
      subscription.grace_until = request.until;
      subscription.version++;
      return send({ ...nativeMutation(subscription.id), version: subscription.version });
    }
    if (operation === "subscription_get_v1")
      throw Error("Platform session attempted a customer-only subscription read");
    return route.fallback();
  });
  return {
    writes,
    payments,
    subscription,
    revoke: () => {
      operator = false;
      authority.revoke();
    },
  };
}

async function applyBillingReview(page: import("@playwright/test").Page, action: string) {
  const dialog = page.getByRole("dialog", { name: action, exact: true });
  const apply = dialog.getByRole("button", { name: common.settings.applyReview, exact: true });
  await expect(apply).toBeDisabled();
  await dialog.getByRole("checkbox").press("Space");
  await apply.click();
  return dialog;
}

async function openDecision(page: import("@playwright/test").Page, index: number, action: string) {
  await page.getByRole("link", { name: "Sentetik bildirim " + (index + 1), exact: true }).click();
  await page.getByLabel(text.reason, { exact: true }).fill("Sentetik işlem gerekçesi");
  await page.getByRole("button", { name: action, exact: true }).click();
}

test("operator filters a native payment queue, rejects a report and replays one accepted report without a second period change", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const f = await billingFixture(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await signIn(page);
  await page.goto(paymentsUrl);
  const region = page.getByRole("region", { name: billing.payments, exact: true });
  await region.focus();
  await expect(region).toBeFocused();
  await expect(region.getByText("Sentetik ödeme organizasyonu", { exact: true })).toHaveCount(3);
  await expect(region.getByText(billing.noQuotePeriod, { exact: true })).toBeVisible();
  await testInfo.attach("E51 Platform ödemeleri", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.getByLabel(billing.state, { exact: true }).selectOption("pending");

  await openDecision(page, 1, billing.reject);
  const rejection = await applyBillingReview(page, billing.reject);
  await expect(rejection.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await rejection.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(page.getByText(billing.states.rejected, { exact: true })).toBeVisible();
  expect(f.subscription.period_end).toBe(initialPeriod);

  await page.getByRole("link", { name: billing.backToQueue, exact: true }).click();
  await openDecision(page, 0, billing.accept);
  const approval = await applyBillingReview(page, billing.accept);
  await expect(approval.getByRole("status")).toHaveText(common.events.commandStates.unknown);
  await approval.getByRole("button", { name: common.studio.retrySameRequest, exact: true }).click();
  await expect(approval.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await approval.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(page.getByText(billing.states.accepted, { exact: true })).toBeVisible();
  await expect(page.getByText(text.subscriptions.active, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: billing.accept, exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(3);
  expect(f.writes[1]!.request.operation_key).toBe(f.writes[2]!.request.operation_key);
  expect(f.subscription.version).toBe(2);
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(2);
  await expect(activityLog(page).getByRole("listitem").first()).toContainText(
    activity.actions.paymentAccepted,
  );
  await expect(activityLog(page).getByRole("listitem").last()).toContainText(
    activity.actions.paymentDeclined,
  );

  const customer = await browser.newPage({ baseURL });
  try {
    await mockSettingsCompletion(customer, { billingOwner: true });
    await customer.route("**/functions/v1/backend-v1/subscription_get_v1", (route) =>
      route.fulfill({
        json: {
          ok: true,
          trace_id: I.role,
          data: {
            state: "active",
            plan: "pro",
            period_start: initialPeriod,
            period_end: f.subscription.period_end,
            grace_until: f.subscription.grace_until,
            subscription_version: f.subscription.version,
            cancel_at_period_end: false,
            pending_change: null,
            limits: { entries: [] },
            usage: { entries: [] },
            billing: {
              current: { id: uid(216), period: "monthly", amount_minor: "100000", currency: "TRY" },
              period_change_options: [],
              downgrade_options: [],
              upgrade_options: [],
              pending_period_change: null,
            },
          },
        },
      }),
    );
    await customer.goto(`/o/${I.org}/c/${I.center}/settings?section=plan`);
    await customer.getByRole("combobox", { name: "Ayar kapsamı" }).selectOption("organization");
    await expect(customer.getByText(/15\.12\.2026/)).toBeVisible();
  } finally {
    await customer.close();
  }
});

test("operator detects a changed payment before writing and refuses a decision after platform access is revoked", async ({
  page,
}) => {
  const f = await billingFixture(page);
  await signIn(page);
  await page.goto(paymentsUrl);
  await openDecision(page, 2, billing.accept);
  f.payments[2]!.version++;
  const dialog = await applyBillingReview(page, billing.accept);
  await expect(dialog.getByRole("status")).toHaveText(billing.sourceChanged);
  expect(f.writes).toEqual([]);
  await dialog.getByRole("button", { name: common.profile.loadCurrent, exact: true }).click();
  await page.getByRole("button", { name: billing.accept, exact: true }).click();
  f.revoke();
  await applyBillingReview(page, billing.accept);
  await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sentetik bildirim 3", exact: true })).toHaveCount(
    0,
  );
  expect(f.writes).toEqual([]);
});

test("operator sees the live grace limit and only extends it after reviewing an absolute UTC deadline", async ({
  page,
}) => {
  const f = await billingFixture(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await signIn(page);
  await page.goto(billingOrgUrl);
  const form = page.getByRole("form", { name: billing.extend, exact: true });
  const until = form.getByLabel(billing.newUntil, { exact: true });
  const action = form.getByRole("button", { name: billing.extend, exact: true });
  await until.fill("2026-11-22T12:00");
  await action.click();
  await expect(until).toBeFocused();
  await expect(until).toHaveAccessibleDescription(billing.untilError);
  expect(f.writes).toEqual([]);
  await until.fill(intendedGraceInput);
  await form.getByLabel(text.reason, { exact: true }).fill("Sentetik işlem gerekçesi");
  await action.click();
  const dialog = await applyBillingReview(page, billing.extend);
  await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await expect(page.getByText(/25 Kas 2026.*13:30 UTC/)).toBeVisible();
  await expect(activityLog(page).getByRole("listitem")).toContainText(
    activity.actions.graceExtended,
  );
  expect(f.subscription.grace_until).toBe(extendedGrace);
  expect(f.writes).toHaveLength(1);
});

test("platform creates a queued studio and a direct organization with a published initial plan", async ({
  page,
}, testInfo) => {
  await platformFixture(page, "platform");
  const plan = {
    kind: "initial_plan",
    id: uid(240),
    name: "Pro",
    period: "monthly",
    currency: "TRY",
  };
  const queued = {
    id: uid(241),
    account_id: uid(242),
    name: "Sentetik bekleyen stüdyo",
    state: "pending",
    organization_id: null,
    created_at: paymentTime,
  };
  const created: { id: string; name: string; owner: string }[] = [];
  const writes: Record<string, unknown>[] = [];
  let accountLookups = 0;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    const list = (items: unknown[]) => send({ items, next_cursor: null, as_of: paymentTime });
    if (operation === "studio_setup_list_v1" && request.platform_queue)
      return list(created.length ? [] : [queued]);
    if (operation === "platform_directory_get_v1") {
      if (request.view === "initial_plans") return list([plan]);
      if (request.view === "verified_accounts") {
        accountLookups++;
        expect(request.account_email).toBe("kurulus@example.invalid");
        return list([{ kind: "verified_account", account_id: uid(243) }]);
      }
      const org = created.find((row) => row.id === request.scope?.org_id);
      if (org && request.view === "invoices") return list([]);
      if (org && request.view === "organizations")
        return list([
          {
            ...initial,
            id: org.id,
            name: org.name,
            access_mode: "bootstrap",
            subscription_state: "pending_payment",
          },
        ]);
      if (org && request.view === "owners")
        return list([
          {
            kind: "owner",
            org_id: org.id,
            person_id: uid(245),
            account_id: org.owner,
            display_name: "Sentetik sahip",
          },
        ]);
    }
    if (operation === "organization_create_v1") {
      writes.push(request);
      expect(request.initial_plan_id).toBe(plan.id);
      const id = uid(247 + created.length);
      created.push({ id, name: request.name, owner: request.verified_account_id });
      return send(nativeMutation(id));
    }
    if (operation === "management_state_get_v1" && request.operation === "saas_grace_extend_v1") {
      const entity = { type: "saas_subscriptions", id: uid(249) };
      return list([
        {
          operation: request.operation,
          current: { operation: request.operation, values: { eligible: false, until_after: null } },
          entity,
          versions: [{ entity, version: 1 }],
          exists: true,
          as_of: paymentTime,
        },
      ]);
    }
    return route.fallback();
  });
  await signIn(page);
  await page.goto("/platform?section=studio-requests");
  await page.getByRole("link", { name: queued.name, exact: true }).click();
  await expect(page.getByLabel(text.create.name, { exact: true })).toHaveValue(queued.name);
  await expect(page.getByLabel(text.create.name, { exact: true })).toHaveJSProperty(
    "readOnly",
    true,
  );
  await testInfo.attach("E50 Organizasyon oluşturma", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  const create = async () => {
    await page.getByLabel(text.create.plan, { exact: true }).selectOption(plan.id);
    await page.getByRole("button", { name: text.create.review, exact: true }).click();
    const dialog = await applyBillingReview(page, text.create.title);
    await expect(dialog.getByRole("status")).toHaveText(common.events.commandStates.saved);
    await dialog.getByRole("button", { name: common.settings.discard, exact: true }).click();
    await page.getByRole("link", { name: text.create.openCreated, exact: true }).click();
  };
  await create();
  await expect(page.getByRole("heading", { name: queued.name })).toBeVisible();
  await expect(activityLog(page).getByRole("listitem")).toContainText(activity.actions.created);
  await expect(activityLog(page).getByRole("listitem")).toContainText(queued.name);
  expect(writes[0]).toMatchObject({
    studio_setup_id: queued.id,
    verified_account_id: queued.account_id,
    name: queued.name,
  });

  await page.goto("/platform?section=create");
  const name = "Sentetik doğrudan kuruluş";
  await page.getByLabel(text.create.name, { exact: true }).fill(name);
  await page.getByLabel(text.verifiedEmail, { exact: true }).fill("kurulus@example.invalid");
  await page.getByRole("button", { name: text.findAccount, exact: true }).click();
  await expect(page.getByText(text.accountFound, { exact: true })).toBeVisible();
  await create();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(1);
  await expect(activityLog(page).getByRole("listitem")).toContainText(name);
  expect(writes[1]).toMatchObject({ verified_account_id: uid(243), name });
  expect(writes[1]?.studio_setup_id).toBeUndefined();
  expect(accountLookups).toBe(2);
});

test("platform operator protects the last eligible member, verifies an addition and loses access after self-removal", async ({
  page,
}, testInfo) => {
  const authority = await platformFixture(page, "platform");
  const other = uid(250);
  const operatorEmail =
    "verified.platform.operator.for.access.review@team.operations.example.invalid";
  type Operator = {
    kind: "operator";
    account_id: string;
    display_name: string | null;
    eligible: boolean;
    granted_at: string;
  };
  const operator = (account_id: string, display_name: string | null): Operator => ({
    kind: "operator",
    account_id,
    display_name,
    eligible: true,
    granted_at: paymentTime,
  });
  const roster = [operator(I.account, null)];
  const writes: { verified_account_id: string; enabled: boolean; reason: string }[] = [];
  let lookupCount = 0;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, trace_id: I.role, data } });
    const list = (items: unknown[]) => send({ items, next_cursor: null, as_of: paymentTime });
    if (operation === "platform_directory_get_v1" && request.view === "operators")
      return list(roster);
    if (operation === "platform_directory_get_v1" && request.view === "verified_accounts") {
      lookupCount++;
      expect(request.account_email).toBe(operatorEmail);
      return list([{ kind: "verified_account", account_id: other }]);
    }
    if (operation === "platform_operator_access_set_v1") {
      writes.push(request);
      if (request.enabled) roster.push(operator(other, "Sentetik Yeni Operatör"));
      else {
        expect(request.verified_account_id).toBe(I.account);
        roster.shift();
        authority.revoke();
      }
      return send({
        operation_id: uid(251),
        account_id: request.verified_account_id,
        enabled: request.enabled,
      });
    }
    return route.fallback();
  });
  await signIn(page);
  await page.goto("/platform?section=operators");
  const operatorList = page.getByRole("list", { name: text.operators.title, exact: true });
  await expect(operatorList.getByText("Sentetik Platform", { exact: true })).toBeVisible();
  await expect(operatorList).not.toContainText(I.account);
  await expect(page.getByText(text.operators.last, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Yetkiyi kaldır/ })).toHaveCount(0);
  await page.getByLabel(text.verifiedEmail, { exact: true }).fill(operatorEmail);
  await page.getByRole("button", { name: text.findAccount, exact: true }).click();
  await expect(page.getByText(text.accountFound, { exact: true })).toBeVisible();
  const reason = page.getByLabel(text.reason, { exact: true });
  await reason.fill("Açık yetki verme gerekçesi");
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: viewport.height });
  await page.getByRole("button", { name: text.operators.add, exact: true }).click();
  const review = page.getByRole("dialog", { name: text.operators.add, exact: true });
  const accountRow = review.getByRole("listitem").filter({ hasText: text.verifiedEmail });
  await expect(accountRow.locator("strong")).toHaveText(operatorEmail);
  await expect(accountRow).toBeVisible();
  expect(await review.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  expect(writes).toHaveLength(0);
  const grant = await applyBillingReview(page, text.operators.add);
  await expect(grant.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await grant.getByRole("button", { name: common.settings.discard, exact: true }).click();
  await page.setViewportSize(viewport);
  await expect(page.getByText("Sentetik Yeni Operatör", { exact: true })).toBeVisible();
  await expect(activityLog(page).getByRole("listitem")).toContainText(
    activity.actions.operatorAdded,
  );
  await expect(activityLog(page).getByRole("listitem")).not.toContainText(operatorEmail);
  await testInfo.attach("E52 Platform sahipleri", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await reason.fill("Kendi yetkimi kaldırıyorum");
  await page
    .getByRole("button", { name: "Yetkiyi kaldır (Sentetik Platform)", exact: true })
    .click();
  await applyBillingReview(page, text.operators.remove);
  await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
  await expect(page.getByText("Sentetik Yeni Operatör", { exact: true })).toHaveCount(0);
  await expect(activityLog(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
  expect(lookupCount).toBe(2);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toMatchObject({
    verified_account_id: other,
    enabled: true,
    reason: "Açık yetki verme gerekçesi",
  });
  expect(writes[1]).toMatchObject({
    verified_account_id: I.account,
    enabled: false,
    reason: "Kendi yetkimi kaldırıyorum",
  });
});

test("platform owner label prefers display name, full name, and verified email in order", async ({
  page,
}) => {
  const fixture = await platformFixture(page, "platform");
  const other = uid(253);
  let directoryName: string | null = null;
  await page.route("**/functions/v1/backend-v1/platform_directory_get_v1", async (route) => {
    if (route.request().postDataJSON().view !== "operators") return route.fallback();
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: list(
          [I.account, other].map((account_id) => ({
            kind: "operator",
            account_id,
            display_name: account_id === I.account ? directoryName : null,
            eligible: true,
            granted_at: paymentTime,
          })),
        ),
      },
    });
  });
  await signIn(page);
  const email = "verified.operator@example.invalid";
  const identity: NonNullable<AccountView["identity"]> = {
    email,
    given_name: "  Ada ",
    family_name: " Kaya ",
    email_verified_at: "2026-11-16T12:00:00Z",
    phone: null,
    pending_email: null,
    pending_phone: null,
    phone_verified_at: null,
    unverified_phone: null,
  };
  const withoutName = { ...identity, given_name: null, family_name: null };
  const cases = [
    { display_name: "Konsol Adı", identity, label: "Konsol Adı", directory: null },
    { display_name: email, identity, label: "Ada Kaya", directory: email },
    { display_name: "", identity: withoutName, label: email, directory: null },
    {
      display_name: email,
      identity: { ...withoutName, email_verified_at: null, pending_email: email },
      label: text.operators.currentAccount,
      directory: email,
    },
  ];
  for (const { label, directory, ...profile } of cases) {
    directoryName = directory;
    fixture.setProfile(profile);
    await page.goto("/platform?section=operators");
    const roster = page.getByRole("list", { name: text.operators.title, exact: true });
    await expect(roster.getByText(label, { exact: true })).toHaveCount(1);
    await expect(roster.getByText(text.operators.unnamed, { exact: true })).toHaveCount(1);
    await expect(roster).not.toContainText(I.account);
    await expect(roster).not.toContainText(other);
    if (label !== email) await expect(roster).not.toContainText(email);
  }
});

test("platform stages and publishes one exact private invoice through lost responses", async ({
  page,
}) => {
  const fixture = await platformFixture(page, "platform");
  const invoiceId = uid(280);
  const body = Buffer.from("%PDF-1.4\nSynthetic invoice fixture");
  const attempts: { preparation: string[]; publication: string[] } = {
    preparation: [],
    publication: [],
  };
  const invoice = text.invoices;
  let uploads = 0;
  let publishedAt: string | null = null;
  await page.route("**/functions/v1/backend-v1/platform_directory_get_v1", (route) => {
    const request = route.request().postDataJSON();
    if (request.view !== "invoices") return route.fallback();
    expect(request.scope).toEqual({ org_id: target });
    const row = {
      kind: "invoice",
      id: invoiceId,
      invoice_number: "WEB1-1",
      issued_on: "2026-11-19",
      mime: "application/pdf",
      bytes: body.length,
      published_at: publishedAt,
      checksum: "ab".repeat(32),
    };
    return route.fulfill({
      json: { ok: true, trace_id: target, data: list(uploads ? [row] : []) },
    });
  });
  await page.route(
    `**/storage/v1/object/upload/sign/ftksaas-invoices/${target}/${invoiceId}*`,
    (route) => {
      expect(route.request().method()).toBe("PUT");
      expect(route.request().postDataBuffer()).toEqual(body);
      expect(route.request().headers()["content-type"]).toBe("application/pdf");
      uploads++;
      return route.abort("failed");
    },
  );
  await page.route("**/functions/v1/backend-v1/platform_invoice_upload_prepare_v1", (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({
      org_id: target,
      invoice_number: "WEB1-1",
      issued_on: "2026-11-19",
      mime: "application/pdf",
      bytes: body.length,
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    attempts.preparation.push(request.operation_key);
    const capability = `/storage/v1/object/upload/sign/ftksaas-invoices/${target}/${invoiceId}?token=synthetic`;
    return route.fulfill({
      json: {
        ok: true,
        trace_id: target,
        data: {
          invoice_id: invoiceId,
          upload_url: uploads ? null : capability,
        },
      },
    });
  });
  await page.route("**/functions/v1/backend-v1/platform_invoice_publish_v1", (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({ org_id: target, invoice_id: invoiceId });
    attempts.publication.push(request.operation_key);
    if (attempts.publication.length === 1) return route.abort("failed");
    publishedAt = "2026-11-19T12:00:00Z";
    return route.fulfill({
      json: {
        ok: true,
        trace_id: target,
        data: {
          id: invoiceId,
          invoice_number: "WEB1-1",
          issued_on: "2026-11-19",
          mime: "application/pdf",
          bytes: body.length,
          published_at: publishedAt,
        },
      },
    });
  });
  await signIn(page);
  await page.goto(`/platform?organization_id=${target}`);
  const form = page.getByRole("form", { name: invoice.title });
  const upload = form.getByRole("button", { name: invoice.upload });
  await upload.click();
  await expect(form.getByLabel(invoice.number)).toBeFocused();
  await form.getByLabel(invoice.number).fill("WEB1-1");
  await form.getByLabel(invoice.date).fill("2026-11-19");
  const field = form.getByLabel(invoice.file);
  await field.setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await upload.click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(/Geçerli bir PDF veya ZIP dosyası seç/);
  expect(attempts.preparation).toHaveLength(0);
  await field.setInputFiles({ name: "invoice.pdf", mimeType: "application/pdf", buffer: body });
  await upload.click();
  await form.getByRole("button", { name: common.studio.retrySameRequest }).click();
  await expect(page.getByText(invoice.staged, { exact: true })).toBeVisible();
  expect(attempts.preparation).toHaveLength(2);
  expect(new Set(attempts.preparation).size).toBe(1);
  expect(uploads).toBe(1);
  expect(attempts.publication).toHaveLength(0);
  await page.getByRole("button", { name: invoice.publish, exact: true }).click();
  const review = await applyBillingReview(page, invoice.publish);
  await expect(review.getByRole("status")).toHaveText(common.events.commandStates.unknown);
  await review.getByRole("button", { name: common.studio.retrySameRequest }).click();
  await expect(review.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await review.getByRole("button", { name: common.settings.discard }).click();
  await expect(page.getByText(invoice.published, { exact: true })).toBeVisible();
  await expect(activityLog(page).getByRole("listitem")).toHaveCount(1);
  await expect(activityLog(page)).toContainText(text.activity.actions.invoicePublished);
  expect(attempts.publication).toHaveLength(2);
  expect(new Set(attempts.publication).size).toBe(1);
  expect(
    fixture.calls.filter(({ operation }) => operation === "organization_invoices_list_v1"),
  ).toEqual([]);
  await page.reload();
  await expect(page.getByRole("grid", { name: invoice.history })).toContainText(
    invoice.publishedStatus,
  );
  await expect(page.getByRole("rowheader", { name: "WEB1-1" })).toBeVisible();
});

test("platform invoices paginate and publish a pending invoice discovered after reload", async ({
  page,
}) => {
  await platformFixture(page, "platform");
  const invoice = text.invoices;
  let denied = false;
  const pending = {
    kind: "invoice",
    id: uid(281),
    invoice_number: "BEKLEYEN-1",
    issued_on: "2026-11-18",
    mime: "application/zip",
    bytes: 24,
    checksum: "cd".repeat(32),
    published_at: null as string | null,
  };
  const historical = {
    ...pending,
    id: uid(282),
    invoice_number: "ESKI-2",
    published_at: "2026-11-17T12:00:00Z",
  };
  await page.route("**/functions/v1/backend-v1/platform_directory_get_v1", (route) => {
    const request = route.request().postDataJSON();
    if (request.view !== "invoices") return route.fallback();
    expect(request.scope).toEqual({ org_id: target });
    if (denied)
      return route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: target } },
      });
    const data =
      request.page.cursor === "next-invoice" ? list([historical]) : list([pending], "next-invoice");
    return route.fulfill({ json: { ok: true, trace_id: target, data } });
  });
  await page.route("**/functions/v1/backend-v1/platform_invoice_publish_v1", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      org_id: target,
      invoice_id: pending.id,
    });
    pending.published_at = "2026-11-19T12:00:00Z";
    return route.fulfill({ json: { ok: true, trace_id: target, data: pending } });
  });
  await signIn(page);
  await page.goto(`/platform?organization_id=${target}`);
  const grid = page.getByRole("grid", { name: invoice.history });
  await expect(grid).toContainText(invoice.pendingStatus);
  await page.reload();
  await page.getByRole("button", { name: invoice.more }).click();
  await expect(grid.getByRole("rowheader", { name: historical.invoice_number })).toBeVisible();
  await grid.getByRole("button", { name: invoice.publish, exact: true }).click();
  const review = await applyBillingReview(page, invoice.publish);
  await expect(review.getByRole("status")).toHaveText(common.events.commandStates.saved);
  await review.getByRole("button", { name: common.settings.discard }).click();
  await expect(grid.getByRole("row").filter({ hasText: pending.invoice_number })).toContainText(
    invoice.publishedStatus,
  );
  denied = true;
  await page.reload();
  await expect(page.getByText(text.denied, { exact: true })).toBeVisible();
  await expect(grid).toHaveCount(0);
  await expect(page.getByRole("form", { name: invoice.title })).toHaveCount(0);
});
