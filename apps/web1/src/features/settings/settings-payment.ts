import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import type { SettingsUpgradeQuote } from "./settings-upgrade";
import { scopedBackend } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import { readSettingsSubscription, type SettingsSubscriptionSource } from "./settings-subscription";
import type { PaymentDraft } from "./payment-sheet";

function amountMinor(value: string, currency: string, allowZero: boolean) {
  const digits =
    new Intl.NumberFormat("tr-TR", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 0;
  const match = /^([0-9]+)(?:[.,]([0-9]+))?$/.exec(value.trim());
  const whole = match?.[1]?.replace(/^0+(?=[0-9])/, "");
  if (!match || !whole || whole.length > 19 || (match[2]?.length ?? 0) > digits)
    throw Error("PAYMENT_AMOUNT");
  const minor =
    BigInt(whole) * 10n ** BigInt(digits) + BigInt((match[2] ?? "").padEnd(digits, "0") || "0");
  if (minor < 0n || (!allowZero && minor === 0n) || minor > 9223372036854775807n)
    throw Error("PAYMENT_AMOUNT");
  return minor.toString();
}
export async function settingsPaymentIntent(
  before: SettingsSubscriptionSource,
  draft: PaymentDraft,
  quoted?: SettingsUpgradeQuote,
) {
  if (
    quoted &&
    (quoted.scope.accountId !== before.scope.accountId ||
      quoted.scope.orgId !== before.scope.orgId ||
      quoted.scope.centerId !== before.scope.centerId)
  )
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  if (quoted) {
    z.uuid().parse(quoted.quote.id);
    z.iso.datetime({ offset: true }).parse(quoted.quote.expires_at);
  }
  const currency = quoted?.quote.currency ?? before.subscription.billing?.current.currency;
  if (!currency) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  const amount_minor = amountMinor(draft.amount, currency, quoted?.quote.amount_minor === "0");
  const reference = draft.reference.trim();
  if (!reference) throw Error("PAYMENT_REFERENCE");
  let occurred_at: string;
  try {
    z.string()
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?$/)
      .parse(draft.occurredAtUtc);
    const temporal = await getTemporal();
    occurred_at = temporal.Instant.from(`${draft.occurredAtUtc}Z`).toString();
  } catch {
    throw Error("PAYMENT_TIME");
  }
  const current = await readSettingsSubscription(before.scope);
  if (current.subscription.billing?.current.currency !== currency)
    throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
  if (
    quoted &&
    (Date.parse(quoted.quote.expires_at) <= Date.now() ||
      current.subscription.plan !== quoted.quote.from_plan)
  )
    throw new BackendError({ code: "PREVIEW_STALE", retryable: false, trace_id: uuidv7() });
  return {
    scope: { ...before.scope },
    key: uuidv7(),
    amount_minor,
    currency,
    reference,
    occurred_at,
    ...(quoted ? { quoteId: quoted.quote.id } : {}),
  };
}
export type SettingsPaymentIntent = Awaited<ReturnType<typeof settingsPaymentIntent>>;
export async function writeSettingsPayment(intent: SettingsPaymentIntent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("saas_payment_submit_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation_key: intent.key,
    amount_minor: intent.amount_minor,
    currency: intent.currency,
    reference: intent.reference,
    occurred_at: intent.occurred_at,
    ...(intent.quoteId ? { quote_id: intent.quoteId } : {}),
  });
  z.uuid().parse(result.primary_id);
  return result;
}
export async function readSettingsPaymentReceipt(intent: SettingsPaymentIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "saas_payment_submit_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "saas_payment_submit_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "saas_payment_verifications")
  )
    throw Error("SUBSCRIPTION_RECEIPT_UNAVAILABLE");
  if (receipt.result_reference) z.uuid().parse(receipt.result_reference.id);
  return receipt;
}
export async function readSettingsPaymentResult(intent: SettingsPaymentIntent, id?: string) {
  z.uuid().parse(id);
  // Success is the acknowledged notification, not platform verification or a plan upgrade.
  return readSettingsSubscription(intent.scope);
}
