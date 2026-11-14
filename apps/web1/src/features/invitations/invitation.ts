import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError, createBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";

const storageKey = "ftk-invitation";
const intentSchema = z.object({ accountId: z.uuid(), operationKey: z.uuidv7() });
const stateSchema = z.object({
  version: z.literal(1),
  token: z.string().min(1),
  returnAfterAuth: z.boolean(),
  intent: intentSchema.optional(),
  attempted: z.boolean().optional(),
  acknowledged: z.boolean().optional(),
  finalized: z.boolean().optional(),
  conflictingLink: z.boolean().optional(),
});
export type AcceptanceIntent = z.infer<typeof intentSchema>;
type InvitationState = z.infer<typeof stateSchema>;

function readInvitation(): InvitationState | undefined {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return;
  try {
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("INVITE_STORAGE_INVALID");
  }
}
export function inspectInvitation() {
  const state = readInvitation();
  return (
    state && {
      intent: state.intent,
      acknowledged: !!state.acknowledged,
      finalized: !!state.finalized,
      conflictingLink: !!state.conflictingLink,
    }
  );
}
function save(state: InvitationState) {
  sessionStorage.setItem(storageKey, JSON.stringify(state));
}

// Called before Router/history observers; secrets never become search state or query keys.
export function captureInvitation():
  | "ignored"
  | "captured"
  | "restored"
  | "invalid"
  | "pending"
  | "unavailable" {
  if (window.location.pathname !== "/invite") return "ignored";
  const hash = window.location.hash;
  const query = new URLSearchParams(window.location.search);
  const params = new URLSearchParams(hash.slice(1));
  const tokens = params.getAll("token");
  window.history.replaceState(window.history.state, "", "/invite");
  try {
    const previous = readInvitation();
    if (!hash && !query.has("token")) return previous ? "restored" : "invalid";
    const token = !query.has("token") && tokens.length === 1 ? tokens[0] : undefined;
    if (
      previous?.intent &&
      !previous.acknowledged &&
      !previous.finalized &&
      token !== previous.token
    ) {
      save({ ...previous, conflictingLink: true });
      return "pending";
    }
    if (!token) {
      sessionStorage.removeItem(storageKey);
      return "invalid";
    }
    if (previous?.token !== token) save({ version: 1, token, returnAfterAuth: false });
    else if (previous.conflictingLink) save({ ...previous, conflictingLink: false });
    return "captured";
  } catch {
    return "unavailable";
  }
}

export function requestInvitationAuth() {
  const state = readInvitation();
  if (!state) throw new Error("INVITE_MISSING");
  save({ ...state, returnAfterAuth: true });
}
export function takeInvitationReturn() {
  try {
    const state = readInvitation();
    if (!state?.returnAfterAuth) return false;
    save({ ...state, returnAfterAuth: false });
    return true;
  } catch {
    // A broken invite must not prevent an unrelated account from opening.
    // The invite route retains the record and presents its explicit recovery state.
    return false;
  }
}
export function createAcceptanceIntent(accountId: string): AcceptanceIntent {
  const state = readInvitation();
  if (!state) throw new Error("INVITE_MISSING");
  if (state.intent) {
    if (state.intent.accountId !== accountId) throw new Error("INVITE_ACCOUNT_CHANGED");
    return state.intent;
  }
  const intent = intentSchema.parse({ accountId, operationKey: uuidv7() });
  save({ ...state, intent });
  return intent;
}
async function requireIntent(intent: AcceptanceIntent) {
  const state = readInvitation();
  if (
    !state?.intent ||
    state.intent.accountId !== intent.accountId ||
    state.intent.operationKey !== intent.operationKey
  )
    throw new Error("INVITE_INTENT_CHANGED");
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("INVITE_AUTH_REQUIRED");
  // Bind both calls to this invocation's native bearer; never re-read a different actor mid-flight.
  const token = data.session.access_token;
  const backend = createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => token,
  });
  const account = await backend.call("account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (account.id !== intent.accountId) throw new Error("INVITE_ACCOUNT_CHANGED");
  return { state, backend };
}
export async function acceptInvitation(intent: AcceptanceIntent) {
  const { state, backend } = await requireIntent(intent);
  if (state.acknowledged) throw new Error("INVITE_ALREADY_ACKNOWLEDGED");
  if (state.finalized) throw new Error("INVITE_ALREADY_FINAL");
  save({ ...state, attempted: true });
  try {
    const result = await backend.call("account_access_accept_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      operation_key: intent.operationKey,
      token: state.token,
    });
    save({ ...state, attempted: true, acknowledged: true });
    return result;
  } catch (error) {
    // Only a definite first-attempt rejection can release an actor binding.
    // A later denial cannot establish whether an earlier uncertain write committed.
    if (
      !state.attempted &&
      error instanceof BackendError &&
      !error.retryable &&
      ["FORBIDDEN", "INVITATION_UNAVAILABLE", "ACCOUNT_LINK_CONFLICT"].includes(error.code)
    ) {
      const current = readInvitation();
      if (current?.intent?.operationKey === intent.operationKey)
        save({ version: 1, token: state.token, returnAfterAuth: false });
    }
    throw error;
  }
}
export async function readAcceptanceStatus(intent: AcceptanceIntent) {
  const { state, backend } = await requireIntent(intent);
  const result = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    operation: "account_access_accept_v1",
    key: intent.operationKey,
  });
  if (result.status === "succeeded") save({ ...state, attempted: true, acknowledged: true });
  if (result.status === "failed_final") save({ ...state, attempted: true, finalized: true });
  return result;
}
export async function readAcceptedContext(intent: AcceptanceIntent) {
  const { backend } = await requireIntent(intent);
  const organizations = [];
  let cursor: string | undefined;
  do {
    const page = await backend.call("organizations_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    for (const organization of page.items) {
      const centers = [];
      let centerCursor: string | undefined;
      do {
        const result = await backend.call("centers_list_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: organization.id,
          page: { limit: 50, ...(centerCursor ? { cursor: centerCursor } : {}) },
        });
        centers.push(...result.items);
        centerCursor = result.next_cursor ?? undefined;
      } while (centerCursor);
      organizations.push({
        name: organization.name,
        centers: centers.filter((c) => c.accessible).map((c) => c.name),
      });
    }
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return organizations;
}
