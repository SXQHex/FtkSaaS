import { beforeEach, expect, it, vi } from "vitest";
import {
  readSettingsIdentity,
  settingsIdentityIntent,
  writeSettingsIdentity,
  readSettingsIdentityResult,
} from "./settings-identity";
import {
  readSettingsDocument,
  settingsDocumentIntent,
  settingsResetIntent,
  writeSettingsDocument,
  readSettingsDocumentResult,
} from "./settings-document";
import {
  readSettingsSubscription,
  subscriptionRenewalIntent,
  writeSubscriptionRenewal,
  readSubscriptionRenewalResult,
} from "./settings-subscription";
import {
  settingsPaymentIntent,
  writeSettingsPayment,
  readSettingsPaymentResult,
} from "./settings-payment";
import {
  settingsPeriodIntent,
  writeSettingsPeriod,
  readSettingsPeriodResult,
} from "./settings-period";
import {
  settingsUpgradeIntent,
  writeSettingsUpgrade,
  readSettingsUpgradeResult,
} from "./settings-upgrade";
import {
  readSettingsCancelSource,
  settingsCancelIntent,
  writeSettingsCancel,
  readSettingsCancelResult,
} from "./settings-change-cancel";
import { readSettingsHistory } from "./settings-history";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const at = "2026-11-17T12:00:00Z",
  end = "2099-01-01T00:00:00Z";
const target = { id: id(4), period: "yearly", amount_minor: "1000000", currency: "TRY" };
const initialSubscription = () => ({
  plan: "pro",
  state: "active",
  cancel_at_period_end: false,
  subscription_version: 4,
  period_start: at,
  period_end: end,
  grace_until: null,
  pending_change: null,
  limits: { entries: [{ key: "active_students", value: 250 }] },
  usage: { entries: [{ key: "active_students", value: 249 }] },
  billing: {
    current: { id: id(5), period: "monthly", amount_minor: "100000", currency: "TRY" },
    period_change_options: [target],
    pending_period_change: null,
    upgrade_options: [{ plan: "business", target }],
  },
});
function page(
  operation: string,
  type: string,
  entityId: string,
  values: unknown,
  version = 4,
  state = "active",
) {
  return {
    items: [
      {
        operation,
        entity: { type, id: entityId },
        exists: true,
        state,
        versions: [{ entity: { type, id: entityId }, version }],
        current: { operation, values },
      },
    ],
    next_cursor: null,
    as_of: at,
  };
}
beforeEach(() => {
  call.mockReset();
});
it("center identity keeps the live timezone, rejects a concurrent version and requires matching post-write identity", async () => {
  let version = 4,
    name = "Sentetik merkez";
  call.mockImplementation(async (op) =>
    op === "management_state_get_v1"
      ? page(
          "center_update_v1",
          "centers",
          scope.centerId,
          { name, timezone: "Europe/Istanbul" },
          version,
        )
      : { primary_id: scope.centerId },
  );
  const before = await readSettingsIdentity(scope, "center");
  version = 5;
  await expect(settingsIdentityIntent(before, "Yeni merkez")).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  version = 4;
  const intent = await settingsIdentityIntent(before, "Yeni merkez");
  await writeSettingsIdentity(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    center_id: scope.centerId,
    expected_version: 4,
    timezone: "Europe/Istanbul",
    name: "Yeni merkez",
  });
  await expect(readSettingsIdentityResult(intent, id(90))).rejects.toThrow();
  name = "Yeni merkez";
  version = 5;
  await expect(readSettingsIdentityResult(intent, scope.centerId)).resolves.toMatchObject({
    name,
    timezone: "Europe/Istanbul",
  });
});
it("settings save/reset uses live field authority, exact preview fields and a fresh source version without replacing unrelated values", async () => {
  let version = 4,
    writable = true,
    address = "Sentetik adres",
    expired = false;
  const values = () => ({
    address,
    lesson_reminders_enabled: true,
    lesson_reminder_hours: 24 as const,
  });
  call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? {
          scope: "center",
          fields: [
            { key: "address", writable },
            { key: "lesson_reminder_hours", writable: true },
            { key: "lesson_reminders_enabled", writable: true },
          ],
        }
      : op === "settings_get_v1"
        ? { scope: "center", version, as_of: at, values: values() }
        : op === "settings_reset_preview_v1"
          ? {
              id: id(6),
              token: "synthetic",
              scope: "center",
              version,
              fields: ["address"],
              before: { address },
              after: { address: "" },
              expires_at: expired ? at : end,
            }
          : { primary_id: scope.accountId },
  );
  const before = await readSettingsDocument(scope, "center");
  writable = false;
  await expect(
    settingsDocumentIntent(scope, "center", before, { address: "Yeni adres" }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  writable = true;
  version = 5;
  await expect(
    settingsDocumentIntent(scope, "center", before, { address: "Yeni adres" }),
  ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  version = 4;
  const update = await settingsDocumentIntent(scope, "center", before, {
    lesson_reminder_hours: 3,
  });
  await writeSettingsDocument(update);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    scope: "center",
    expected_version: 4,
    patch: { lesson_reminder_hours: 3 },
  });
  expect(call.mock.calls.at(-1)?.[1].patch).not.toHaveProperty("address");
  expired = true;
  await expect(settingsResetIntent(scope, "center", before, ["address"])).rejects.toMatchObject({
    code: "PREVIEW_STALE",
  });
  expired = false;
  const reset = await settingsResetIntent(scope, "center", before, ["address"]);
  await writeSettingsDocument(reset);
  expect(call.mock.calls.at(-1)?.[0]).toBe("settings_reset_apply_v1");
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    preview: { id: id(6), token: "synthetic" },
    expected_version: 4,
  });
  address = "";
  version = 5;
  await expect(readSettingsDocumentResult(reset, scope.accountId)).resolves.toMatchObject({
    document: {
      values: { address: "", lesson_reminders_enabled: true, lesson_reminder_hours: 24 },
    },
  });
});
it("organization branding accepts only authorized image metadata and preserves native removal as null", async () => {
  let logo: unknown = { id: id(8), mime: "image/png", bytes: 3, checksum: "a".repeat(64) },
    version = 4;
  call.mockImplementation(async (op) =>
    op === "settings_catalog_get_v1"
      ? {
          scope: "organization",
          fields: [
            { key: "address", writable: true },
            { key: "primary_color", writable: true },
          ],
        }
      : op === "settings_get_v1"
        ? { scope: "organization", version, as_of: at, values: { primary_color: "#123456" }, logo }
        : { primary_id: scope.accountId },
  );
  const before = await readSettingsDocument(scope, "organization");
  const intent = await settingsDocumentIntent(
    scope,
    "organization",
    before,
    { primary_color: "#654321" },
    null,
  );
  await writeSettingsDocument(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    scope: "organization",
    logo_image: null,
    patch: { primary_color: "#654321" },
  });
  expect(call.mock.calls.at(-1)?.[1]).not.toHaveProperty("center_id");
  version = 5;
  logo = null;
  // A higher version alone cannot confirm the changed color.
  await expect(readSettingsDocumentResult(intent, scope.accountId)).rejects.toThrow(
    "SETTINGS_RESULT_UNAVAILABLE",
  );
});
it("renewal changes only the period-end flag and cannot confirm from an unchanged source", async () => {
  const subscription = initialSubscription();
  call.mockImplementation(async (op) =>
    op === "subscription_get_v1"
      ? subscription
      : op === "management_state_get_v1"
        ? page(
            "subscription_renewal_set_v1",
            "saas_subscriptions",
            id(9),
            { renew: !subscription.cancel_at_period_end },
            subscription.subscription_version,
          )
        : { primary_id: id(9) },
  );
  const before = await readSettingsSubscription(scope),
    intent = await subscriptionRenewalIntent(before);
  await writeSubscriptionRenewal(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({ renew: false, expected_version: 4 });
  expect(call.mock.calls.at(-1)?.[1]).not.toHaveProperty("center_id");
  await expect(readSubscriptionRenewalResult(intent, id(9))).rejects.toThrow();
  subscription.cancel_at_period_end = true;
  subscription.subscription_version = 5;
  await expect(readSubscriptionRenewalResult(intent, id(9))).resolves.toMatchObject({
    subscription: { plan: "pro", cancel_at_period_end: true },
  });
});
it("manual payment keeps exact minor units and an explicit UTC time, and acknowledgement does not verify payment or upgrade the plan", async () => {
  const subscription = initialSubscription();
  call.mockImplementation(async (op) =>
    op === "subscription_get_v1" ? subscription : { primary_id: id(10) },
  );
  const before = await readSettingsSubscription(scope),
    draft = {
      amount: "90071992547409,93",
      reference: "Sentetik transfer",
      occurredAtUtc: "2026-11-17T12:34",
    };
  const intent = await settingsPaymentIntent(before, draft);
  await writeSettingsPayment(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    amount_minor: "9007199254740993",
    currency: "TRY",
    occurred_at: "2026-11-17T12:34:00Z",
  });
  await expect(readSettingsPaymentResult(intent, id(10))).resolves.toMatchObject({
    subscription: { plan: "pro", state: "active" },
  });
  await expect(settingsPaymentIntent(before, { ...draft, amount: "1,001" })).rejects.toThrow(
    "PAYMENT_AMOUNT",
  );
  await expect(
    settingsPaymentIntent(before, { ...draft, occurredAtUtc: "2026-11-17T12:34+03:00" }),
  ).rejects.toThrow("PAYMENT_TIME");
});
it("period requests retain current native terms, reject a changed offer and distinguish a scheduled request from the current plan", async () => {
  const subscription = initialSubscription();
  call.mockImplementation(async (op, r) =>
    op === "subscription_get_v1"
      ? subscription
      : op === "management_state_get_v1"
        ? page(r.operation, "saas_subscriptions", id(9), {
            target_plan_id: target.id,
            amount_minor: target.amount_minor,
            currency: target.currency,
            effective_at: end,
            expected_version: 4,
          })
        : { primary_id: id(11) },
  );
  const before = await readSettingsSubscription(scope),
    intent = await settingsPeriodIntent(before, target.id);
  subscription.billing.period_change_options = [{ ...target, amount_minor: "2000000" }];
  await expect(settingsPeriodIntent(before, target.id)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  subscription.billing.period_change_options = [target];
  await writeSettingsPeriod(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    expected_version: 4,
    target_plan_id: target.id,
    effective_at: end,
    amount_minor: "1000000",
  });
  await expect(readSettingsPeriodResult(intent, id(11))).rejects.toThrow(
    "SUBSCRIPTION_RESULT_UNAVAILABLE",
  );
  const pending = {
    ...subscription,
    subscription_version: 5,
    billing: {
      ...subscription.billing,
      pending_period_change: { id: id(11), target, effective_at: end },
    },
  };
  call.mockResolvedValue(pending);
  await expect(readSettingsPeriodResult(intent, id(11))).resolves.toMatchObject({
    subscription: {
      plan: "pro",
      billing: {
        current: { period: "monthly" },
        pending_period_change: { target: { period: "yearly" } },
      },
    },
  });
});
it("upgrade quotes cannot invent financial terms after a lost result and expired quotes cannot create a payment", async () => {
  const subscription = initialSubscription();
  const quote = {
    id: id(12),
    from_plan: "pro",
    to_plan: "business",
    amount_minor: "50000",
    currency: "TRY",
    period_start: at,
    period_end: end,
    expires_at: end,
  };
  call.mockImplementation(async (op, r) =>
    op === "subscription_get_v1"
      ? subscription
      : op === "management_state_get_v1"
        ? page(r.operation, "saas_subscriptions", id(9), { target_plan_id: target.id })
        : quote,
  );
  const before = await readSettingsSubscription(scope),
    intent = await settingsUpgradeIntent(before, target.id),
    saved = await writeSettingsUpgrade(intent);
  await expect(readSettingsUpgradeResult(intent, undefined, quote.id)).resolves.toMatchObject({
    quote: undefined,
    usable: false,
  });
  await expect(readSettingsUpgradeResult(intent, saved, quote.id)).resolves.toMatchObject({
    usable: true,
  });
  await expect(
    settingsPaymentIntent(
      before,
      { amount: "500", reference: "Sentetik teklif", occurredAtUtc: "2026-11-17T12:34" },
      { ...saved, quote: { ...saved.quote, expires_at: at } },
    ),
  ).rejects.toMatchObject({ code: "PREVIEW_STALE" });
  expect(call.mock.calls.some((row) => row[0] === "saas_payment_submit_v1")).toBe(false);
});
it("cancelling a scheduled change uses its own version and rejects a switched request rather than cancelling a different change", async () => {
  const subscription = initialSubscription();
  let changeVersion = 7,
    state = "scheduled";
  const current = { ...subscription, pending_change: { type: "saas_change_requests", id: id(13) } };
  call.mockImplementation(async (op, r) =>
    op === "subscription_get_v1"
      ? current
      : op === "management_state_get_v1"
        ? page(
            r.operation,
            "saas_change_requests",
            id(13),
            { change_id: id(13) },
            changeVersion,
            state,
          )
        : { primary_id: id(13) },
  );
  const before = await readSettingsCancelSource(await readSettingsSubscription(scope));
  changeVersion = 8;
  await expect(settingsCancelIntent(before)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  changeVersion = 7;
  const intent = await settingsCancelIntent(before);
  await writeSettingsCancel(intent);
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({ change_id: id(13), expected_version: 7 });
  await expect(readSettingsCancelResult(intent, id(13))).rejects.toThrow();
  state = "cancelled";
  changeVersion = 8;
  call.mockImplementation(async (op, r) =>
    op === "subscription_get_v1"
      ? subscription
      : page(
          r.operation,
          "saas_change_requests",
          id(13),
          { change_id: id(13) },
          changeVersion,
          state,
        ),
  );
  await expect(readSettingsCancelResult(intent, id(13))).resolves.toMatchObject({
    subscription: { pending_change: null, plan: "pro" },
  });
});
it("history binds the real scope and cursor, and rejects future or duplicate records", async () => {
  const record = {
    id: id(14),
    actor_account_id: id(15),
    at,
    before: { address: "Sentetik adres" },
    after: { address: "" },
    reason: "Sentetik değişiklik",
  };
  call.mockResolvedValue({ items: [record], next_cursor: "bc", as_of: at });
  await readSettingsHistory(scope, "organization", "ab");
  expect(call.mock.calls[0]?.[1]).toMatchObject({ scope: "organization", cursor: "ab" });
  expect(call.mock.calls[0]?.[1]).not.toHaveProperty("center_id");
  call.mockResolvedValue({ items: [record, record], next_cursor: null, as_of: at });
  await expect(readSettingsHistory(scope, "center")).rejects.toThrow(
    "SETTINGS_HISTORY_UNAVAILABLE",
  );
  call.mockResolvedValue({ items: [{ ...record, at: end }], next_cursor: null, as_of: at });
  await expect(readSettingsHistory(scope, "center")).rejects.toThrow(
    "SETTINGS_HISTORY_UNAVAILABLE",
  );
});
