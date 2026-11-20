import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { getSupabaseClient } from "../../lib/supabase";
import {
  freshPasswordSession,
  MfaRequiredError,
  retirePreviousPasswordSession,
} from "../account/fresh-session";
import type {
  Preview,
  RequestOrganizationCloseApply,
  RequestOrganizationDeleteApply,
} from "@ftksaas/api-contracts";
const common = (scope: ClientScope) => ({ client_api_version: 1 as const, org_id: scope.orgId });
const receiptSchema = z
  .object({
    key: z.uuid(),
    preview: z.object({ id: z.uuid(), token: z.string().min(1) }).strict(),
    reason: z.string().min(1).max(1000),
    jobId: z.uuid().optional(),
  })
  .strict();
export type OrganizationDeletionReceipt = z.infer<typeof receiptSchema>;
const receiptKey = (scope: ClientScope) =>
  `ftk.web1.organization-deletion:${scope.accountId}:${scope.orgId}`;
export function organizationDeletionReceipt(scope: ClientScope) {
  try {
    const raw = sessionStorage.getItem(receiptKey(scope));
    return raw ? receiptSchema.parse(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}
export function saveOrganizationDeletionReceipt(
  scope: ClientScope,
  receipt: OrganizationDeletionReceipt,
) {
  const parsed = receiptSchema.parse(receipt),
    current = organizationDeletionReceipt(scope);
  if (
    current &&
    (current.key !== parsed.key ||
      current.preview.id !== parsed.preview.id ||
      current.preview.token !== parsed.preview.token)
  )
    throw Error("ORGANIZATION_DELETE_ALREADY_PENDING");
  if (current?.jobId && !parsed.jobId) throw Error("ORGANIZATION_DELETE_ALREADY_ACKNOWLEDGED");
  sessionStorage.setItem(receiptKey(scope), JSON.stringify(parsed));
}
export function clearOrganizationDeletionReceipt(scope: ClientScope) {
  sessionStorage.removeItem(receiptKey(scope));
}
export type OrganizationLifecycleIntent =
  | {
      scope: ClientScope;
      operation: "organization_close_apply_v1";
      reason: string;
      request: Omit<RequestOrganizationCloseApply, "request_id">;
    }
  | {
      scope: ClientScope;
      operation: "organization_delete_apply_v1";
      reason: string;
      request: Omit<RequestOrganizationDeleteApply, "request_id">;
    };
export async function organizationDeletionProof(scope: ClientScope, password: string) {
  const auth = getSupabaseClient().auth;
  const initial = await auth.getSession();
  if (initial.error) throw initial.error;
  const actor = initial.data.session?.user.id;
  if (!actor) throw Error("AUTH_REQUIRED");
  if (password) await freshPasswordSession(password);
  const current = await auth.getSession();
  if (current.error) throw current.error;
  const session = current.data.session;
  if (!session || session.user.id !== actor) throw Error("ACCOUNT_CHANGED");
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel(session.access_token);
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    throw new MfaRequiredError();
  await scopedBackend(scope);
  await retirePreviousPasswordSession(session);
  return session.access_token;
}
export async function prepareOrganizationLifecycle(
  scope: ClientScope,
  mode: "close" | "delete",
  reason: string,
  proof?: string,
) {
  const text = z.string().trim().min(1).max(1000).parse(reason);
  const backend = await scopedBackend(scope);
  const organization = await backend.call("organization_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
  });
  if (organization.id !== scope.orgId) throw Error("ORGANIZATION_SOURCE_INVALID");
  z.number().int().positive().safe().parse(organization.version);
  if (
    mode === "close"
      ? organization.state !== "active"
      : !["active", "closed"].includes(organization.state)
  )
    throw Error("ORGANIZATION_STATE_INVALID");
  const preview =
    mode === "close"
      ? await backend.call("organization_close_preview_v1", {
          ...common(scope),
          request_id: uuidv7(),
          reason: text,
        })
      : await backend.call("organization_delete_preview_v1", {
          ...common(scope),
          request_id: uuidv7(),
          reason: text,
          all_data: true,
        });
  validateLifecyclePreview(preview);
  const base = {
    ...common(scope),
    operation_key: uuidv7(),
    preview: { id: preview.id, token: preview.token },
  };
  const intent: OrganizationLifecycleIntent =
    mode === "close"
      ? {
          scope: { ...scope },
          operation: "organization_close_apply_v1",
          reason: text,
          request: { ...base, expected_version: organization.version },
        }
      : {
          scope: { ...scope },
          operation: "organization_delete_apply_v1",
          reason: text,
          request: { ...base, all_data: true, reauth: z.string().min(1).parse(proof) },
        };
  return { organization, preview, intent };
}
function validateLifecyclePreview(preview: Preview) {
  z.uuid().parse(preview.id);
  z.string().min(1).parse(preview.token);
  z.iso.datetime({ offset: true }).parse(preview.expires_at);
  const impact = preview.lifecycle_impact;
  if (!impact || impact.physical_erasure_complete !== false)
    throw Error("ORGANIZATION_SOURCE_INVALID");
  for (const key of lifecycleImpactKeys) z.number().int().nonnegative().safe().parse(impact[key]);
}
export const lifecycleImpactKeys = [
  "active_account_links",
  "open_sessions",
  "open_requests",
  "active_reservations",
  "active_event_registrations",
  "open_debts",
  "student_credit_accounts",
] as const;
export function recoverOrganizationDeletion(
  scope: ClientScope,
  receipt: OrganizationDeletionReceipt,
  proof: string,
): OrganizationLifecycleIntent {
  const saved = receiptSchema.parse(receipt);
  if (saved.jobId) throw Error("ORGANIZATION_DELETE_ALREADY_ACKNOWLEDGED");
  return {
    scope: { ...scope },
    operation: "organization_delete_apply_v1",
    reason: saved.reason,
    request: {
      ...common(scope),
      operation_key: saved.key,
      preview: saved.preview,
      all_data: true,
      reauth: z.string().min(1).parse(proof),
    },
  };
}
export async function writeOrganizationLifecycle(intent: OrganizationLifecycleIntent) {
  const backend = await scopedBackend(intent.scope);
  if (intent.operation === "organization_close_apply_v1")
    return backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  // Save only this tenant/account's immutable intent before transport; native proof stays in memory.
  const current = organizationDeletionReceipt(intent.scope);
  if (current?.jobId) throw Error("ORGANIZATION_DELETE_ALREADY_ACKNOWLEDGED");
  if (!current)
    saveOrganizationDeletionReceipt(intent.scope, {
      key: intent.request.operation_key,
      preview: intent.request.preview,
      reason: intent.reason,
    });
  else if (
    current.key !== intent.request.operation_key ||
    current.preview.id !== intent.request.preview.id ||
    current.preview.token !== intent.request.preview.token
  )
    throw Error("ORGANIZATION_DELETE_ALREADY_PENDING");
  const result = await backend.call(intent.operation, { ...intent.request, request_id: uuidv7() });
  const jobId = z.uuid().parse(result.job_id);
  // An ACK is authoritative even if updating the local journal fails. The
  // confirmed job read retries journal persistence without submitting again.
  try {
    saveOrganizationDeletionReceipt(intent.scope, {
      key: intent.request.operation_key,
      preview: intent.request.preview,
      reason: intent.reason,
      jobId,
    });
  } catch {
    return { primary_id: jobId };
  }
  return { primary_id: jobId };
}
export async function organizationLifecycleReceipt(intent: OrganizationLifecycleIntent) {
  const result = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    ...common(intent.scope),
    request_id: uuidv7(),
    operation: intent.operation,
    key: intent.request.operation_key,
  });
  if (result.operation !== intent.operation || result.key !== intent.request.operation_key)
    throw Error("ORGANIZATION_RECEIPT_INVALID");
  return result;
}
export async function readOrganizationPrivacyJob(scope: ClientScope, jobId: string) {
  const result = await (
    await scopedBackend(scope)
  ).call("job_status_get_v1", {
    ...common(scope),
    request_id: uuidv7(),
    job_id: z.uuid().parse(jobId),
  });
  if (result.id !== jobId) throw Error("ORGANIZATION_JOB_INVALID");
  return result;
}
export async function readOrganizationLifecycleResult(
  intent: OrganizationLifecycleIntent,
  id?: string,
) {
  if (intent.operation === "organization_delete_apply_v1")
    return {
      kind: "delete" as const,
      job: await readOrganizationPrivacyJob(intent.scope, z.uuid().parse(id)),
    };
  if (id !== intent.scope.orgId) throw Error("ORGANIZATION_RESULT_INVALID");
  const organization = await (
    await scopedBackend(intent.scope)
  ).call("organization_get_v1", { ...common(intent.scope), request_id: uuidv7() });
  if (
    organization.id !== id ||
    organization.state !== "closed" ||
    organization.access_mode !== "closed" ||
    organization.version <= intent.request.expected_version
  )
    throw Error("ORGANIZATION_RESULT_INVALID");
  return { kind: "close" as const, organization };
}
export type OrganizationLifecyclePreview = Awaited<ReturnType<typeof prepareOrganizationLifecycle>>;
export type OrganizationLifecycleResult = Awaited<
  ReturnType<typeof readOrganizationLifecycleResult>
>;
