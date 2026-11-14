import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError, createBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import type { Preview } from "../../lib/api-contracts/generated";
import { MfaRequiredError } from "./fresh-session";

// Private, tab-scoped recovery data. Neither proof nor password is persisted.
const storageKey = "ftk-account-deletion";
const receiptSchema = z
  .object({
    actor: z.string().uuid(),
    operationKey: z.string().uuid(),
    preview: z.object({ id: z.string().uuid(), token: z.string().min(1) }).strict(),
    jobId: z.string().uuid().optional(),
  })
  .strict();
type Receipt = z.infer<typeof receiptSchema>;
function receipt(): Receipt | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    const parsed = receiptSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
function save(value: Receipt) {
  sessionStorage.setItem(storageKey, JSON.stringify(value));
}
export function hasDeletionReceipt(actor: string) {
  return receipt()?.actor === actor;
}
async function sessionFor(actor?: string) {
  const auth = getSupabaseClient().auth;
  const { data, error } = await auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  if (actor && data.session.user.id !== actor) throw new Error("ACCOUNT_CHANGED");
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel(data.session.access_token);
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    throw new MfaRequiredError();
  return data.session;
}
function backendFor(token: string) {
  return createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => token,
  });
}
export function prepareDeletion(actor: string, accountId: string, preview: Preview) {
  if (preview.blockers.length) throw new Error("DELETION_BLOCKED");
  const intent: Receipt = {
    actor,
    operationKey: uuidv7(),
    preview: { id: preview.id, token: preview.token },
  };
  return async () => {
    if (receipt()) throw new Error("DELETION_ALREADY_PENDING");
    const session = await sessionFor(actor);
    const backend = backendFor(session.access_token);
    const account = await backend.call("account_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
    });
    if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
    // Commit recovery intent before transport; a lost ACK can only replay this key/payload.
    save(intent);
    try {
      await apply(intent, session.access_token);
    } catch (error) {
      if (
        error instanceof BackendError &&
        !error.retryable &&
        !["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)
      )
        sessionStorage.removeItem(storageKey);
      throw error;
    }
  };
}
async function apply(intent: Receipt, proof: string) {
  const result = await backendFor(proof).call("account_delete_apply_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    operation_key: intent.operationKey,
    preview: intent.preview,
    reauth: proof,
  });
  // A different account/tab intent cannot receive this asynchronous result.
  const current = receipt();
  if (current?.actor !== intent.actor || current.operationKey !== intent.operationKey)
    throw new Error("ACCOUNT_CHANGED");
  save({ ...intent, jobId: result.job_id });
}
export async function recoverDeletion() {
  const intent = receipt();
  if (!intent) throw new Error("DELETION_RECEIPT_REQUIRED");
  const session = await sessionFor(intent.actor);
  if (!intent.jobId) await apply(intent, session.access_token);
}
export async function deletionContext() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session) return { actor: null, owned: false, uncertain: false };
  const intent = receipt();
  const owned = intent?.actor === data.session.user.id;
  return { actor: data.session.user.id, owned, uncertain: owned && !intent?.jobId };
}
export async function readDeletionStatus() {
  const intent = receipt();
  if (!intent?.jobId) throw new Error("DELETION_RECEIPT_REQUIRED");
  const session = await sessionFor(intent.actor);
  const job = await backendFor(session.access_token).call("job_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: null,
    job_id: intent.jobId,
  });
  return {
    state: job.state,
    privacy: job.privacy,
    complete:
      job.privacy?.request_state === "completed" &&
      job.privacy.pending_scopes.length === 0 &&
      job.privacy.completed_at !== null,
  };
}
