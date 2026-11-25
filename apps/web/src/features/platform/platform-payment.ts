import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import {
  scopedBackend,
  scopedCommandBackend,
  type AccountReadContext,
} from "../../lib/scoped-backend";
import { organizationAt, platformRequest, readDirectory } from "./platform-directory";

const instant = z.iso.datetime({ offset: true });
export const paymentState = z.enum(["pending", "accepted", "rejected", "cancelled"]);
const payment = z.object({
  kind: z.literal("payment"),
  id: z.uuid(),
  org_id: z.uuid(),
  version: z.number().int().positive().safe(),
  amount_minor: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  state: paymentState,
  reference: z.string(),
  occurred_at: instant,
  verified_at: instant.nullable(),
  org_name: z.string().min(1).optional(),
  quote_period: z
    .object({ starts_at: instant, ends_at: instant })
    .refine((period) => Date.parse(period.starts_at) < Date.parse(period.ends_at))
    .nullish(),
});
export const billingReason = z.string().trim().min(1).max(1000);
export const platformPaymentsKey = (accountId: string) => ["platform-payments", accountId];
export function paymentHref(orgId?: string, paymentId?: string) {
  const search = new URLSearchParams({ section: "payments" });
  if (orgId) search.set("organization_id", orgId);
  if (paymentId) search.set("payment_id", paymentId);
  return "/platform?" + search.toString();
}

type Backend = Awaited<ReturnType<typeof scopedBackend>>;
export async function readPayments(
  accountId: string,
  orgId?: string,
  state?: z.infer<typeof paymentState>,
  cursor?: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend({ accountId }, undefined, readContext);
  const result = await readDirectory(
    backend,
    {
      view: "payments",
      ...(orgId ? { scope: { org_id: orgId } } : {}),
      ...(state ? { payment_state: state } : {}),
    },
    payment,
    cursor,
  );
  if (result.items.some((row) => (orgId && row.org_id !== orgId) || (state && row.state !== state)))
    throw Error("PLATFORM_PAYMENT_PAGE_INVALID");
  return result;
}
async function paymentAt(backend: Backend, orgId: string, id: string) {
  const result = await readDirectory(
    backend,
    { view: "payments", scope: { org_id: orgId }, payment_id: id },
    payment,
  );
  if (
    result.next_cursor ||
    result.items.length > 1 ||
    result.items.some((row) => row.id !== id || row.org_id !== orgId)
  )
    throw Error("PLATFORM_PAYMENT_SOURCE_INVALID");
  return result.items[0];
}
export async function readPaymentDetail(
  accountId: string,
  orgId: string,
  id: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend({ accountId }, undefined, readContext);
  return readPaymentDetailFrom(backend, orgId, id);
}

async function readPaymentDetailFrom(backend: Backend, orgId: string, id: string) {
  const [row, organization] = await Promise.all([
    paymentAt(backend, orgId, id),
    organizationAt(backend, orgId),
  ]);
  return row && organization ? { row, organization } : null;
}

const graceOperation = "saas_grace_extend_v1";
async function graceAt(backend: Backend, orgId: string) {
  const result = await backend.call("management_state_get_v1", {
    ...platformRequest(),
    org_id: orgId,
    operation: graceOperation,
    selector: { operation: graceOperation, key: {} },
    page: { limit: 1 },
  });
  const row = result.items[0];
  if (
    result.next_cursor ||
    result.items.length !== 1 ||
    row?.exists !== true ||
    row.operation !== graceOperation ||
    row.current?.operation !== graceOperation ||
    row.entity?.type !== "saas_subscriptions"
  )
    throw Error("PLATFORM_GRACE_SOURCE_INVALID");
  const id = z.uuid().parse(row.entity.id);
  const versions = row.versions.filter(
    (entry) => entry.entity.type === "saas_subscriptions" && entry.entity.id === id,
  );
  if (versions.length !== 1) throw Error("PLATFORM_GRACE_SOURCE_INVALID");
  const values = row.current.values;
  const eligible = z.boolean().parse(values.eligible);
  const untilAfter = instant.nullable().parse(values.until_after);
  if (eligible !== (untilAfter !== null)) throw Error("PLATFORM_GRACE_SOURCE_INVALID");
  return {
    id,
    version: z.number().int().positive().safe().parse(versions[0]?.version),
    until: instant.nullish().parse(values.until) ?? null,
    untilAfter,
  };
}
export async function readGraceDetail(
  accountId: string,
  orgId: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend({ accountId }, undefined, readContext);
  const organization = await organizationAt(backend, orgId);
  if (
    !organization ||
    organization.state !== "active" ||
    organization.platform_suspended ||
    !organization.subscription_state
  )
    return { organization, grace: null };
  return { organization, grace: await graceAt(backend, orgId) };
}
type PaymentIntent = {
  kind: "payment";
  id: string;
  version: number;
  accepted: boolean;
  reason: string;
};
type GraceIntent = {
  kind: "grace";
  id: string;
  version: number;
  until: string;
  previous: string | null;
  reason: string;
};
export type BillingIntent = { accountId: string; orgId: string; key: string } & (
  | PaymentIntent
  | GraceIntent
);
export function billingIntent(
  accountId: string,
  orgId: string,
  command: PaymentIntent | GraceIntent,
): BillingIntent {
  return { ...command, accountId, orgId, key: uuidv7() };
}
export function parseGraceUntil(
  value: string,
  current: NonNullable<Awaited<ReturnType<typeof readGraceDetail>>["grace"]>,
) {
  const until = z.iso.datetime({ precision: 0 }).parse(`${value}:00Z`);
  if (!current.untilAfter || Date.parse(until) <= Date.parse(current.untilAfter))
    throw Error("PLATFORM_GRACE_UNTIL_INVALID");
  return until;
}
function stale(requestId: string) {
  return new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: requestId });
}
async function submitBilling(intent: BillingIntent, backend: Backend) {
  const request = { ...platformRequest(), org_id: intent.orgId, operation_key: intent.key };
  if (intent.kind === "payment")
    return backend.call("saas_payment_verify_v1", {
      ...request,
      payment_id: intent.id,
      accepted: intent.accepted,
      reason: intent.reason,
    });
  return backend.call("saas_grace_extend_v1", {
    ...request,
    until: intent.until,
    reason: intent.reason,
  });
}

export async function writePlatformBilling(intent: BillingIntent) {
  return submitBilling(intent, await scopedBackend(intent));
}

// Verify the version immediately before the first write. Recovery replays the same key without a new preflight.
async function assertBillingSource(intent: BillingIntent, backend: Backend) {
  if (intent.kind === "payment") {
    const row = await paymentAt(backend, intent.orgId, intent.id);
    if (row?.version !== intent.version || row.state !== "pending") throw stale(uuidv7());
  } else {
    const source = await graceAt(backend, intent.orgId);
    if (
      source.id !== intent.id ||
      source.version !== intent.version ||
      source.until !== intent.previous ||
      !source.untilAfter ||
      Date.parse(intent.until) <= Date.parse(source.untilAfter)
    )
      throw stale(uuidv7());
  }
}

export async function confirmBillingSource(intent: BillingIntent) {
  return assertBillingSource(intent, await scopedBackend(intent));
}

export async function preparePaymentDecision(source: BillingIntent & PaymentIntent) {
  const intent = structuredClone(source);
  const command = await scopedCommandBackend(intent);
  await command.currentSession();
  try {
    await assertBillingSource(intent, command.backend);
  } finally {
    await command.currentSession();
  }
  return {
    key: intent.key,
    write: () => command.write((backend) => submitBilling(intent, backend)),
    read: (id?: string) => command.readback((backend) => readBillingResult(intent, id, backend)),
  };
}

export async function readBillingResult(intent: BillingIntent, id?: string, backend?: Backend) {
  if (id !== intent.id) throw Error("PLATFORM_BILLING_RESULT_INVALID");
  if (intent.kind === "payment") {
    const result = await readPaymentDetailFrom(
      backend ?? (await scopedBackend(intent)),
      intent.orgId,
      id,
    );
    if (
      !result ||
      result.row.version <= intent.version ||
      result.row.state !== (intent.accepted ? "accepted" : "rejected")
    )
      throw Error("PLATFORM_BILLING_RESULT_INVALID");
    return { kind: intent.kind, data: result } as const;
  } else {
    const result = await readGraceDetail(intent.accountId, intent.orgId);
    if (
      result.grace?.id !== intent.id ||
      result.grace.version <= intent.version ||
      !result.grace.until ||
      Date.parse(result.grace.until) !== Date.parse(intent.until)
    )
      throw Error("PLATFORM_BILLING_RESULT_INVALID");
    return { kind: intent.kind, data: result } as const;
  }
}
