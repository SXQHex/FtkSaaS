import { v7 as uuidv7 } from "uuid";
import { createBackend } from "./backend";
import { getSupabaseClient } from "./supabase";

export interface ClientScope {
  accountId: string;
  orgId: string;
  centerId: string;
}

// Pin one native bearer across an operation and validate the domain account.
// A stale editor must never submit its draft as a newly selected native account.
export async function scopedBackend(
  scope: Pick<ClientScope, "accountId">,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const bearer = data.session.access_token;
  const backend = createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => bearer,
  });
  const request = { client_api_version: 1 as const, request_id: uuidv7() };
  // Query reads may be cancelled, but writers never pass a signal.
  const account = signal
    ? await backend.read("account_get_v1", request, signal)
    : await backend.call("account_get_v1", request);
  signal?.throwIfAborted();
  if (account.id !== scope.accountId) throw new Error("ACCOUNT_CHANGED");
  return backend;
}
