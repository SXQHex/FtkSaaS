import { v7 as uuidv7 } from "uuid";
import type { QueryFunctionContext } from "@tanstack/react-query";
import { verifiedAccountForId } from "../features/auth/account-query";
import { sameNativeSession } from "../features/auth/native-session-id";
import { createBackend } from "./backend";
import { getSupabaseClient } from "./supabase";

export interface ClientScope {
  accountId: string;
  orgId: string;
  centerId: string;
}

// Only a Query-owned reader supplies this context. Imperative preparation,
// native writes, receipts and mandatory readbacks retain a fresh account read.
export type AccountReadContext = Pick<QueryFunctionContext, "client" | "signal">;

// Pin one native bearer across an operation and validate the domain account.
// A stale editor must never submit its draft as a newly selected native account.
export async function scopedBackend(
  scope: Pick<ClientScope, "accountId">,
  signal?: AbortSignal,
  context?: AccountReadContext,
) {
  signal?.throwIfAborted();
  context?.signal.throwIfAborted();
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
  const account = context
    ? await verifiedAccountForId(context.client, scope.accountId)
    : signal
      ? await backend.read("account_get_v1", request, signal)
      : await backend.call("account_get_v1", request);
  signal?.throwIfAborted();
  if (account.id !== scope.accountId) throw new Error("ACCOUNT_CHANGED");
  if (context) {
    const session = data.session;
    const currentSession = async () => {
      context.signal.throwIfAborted();
      const latest = await getSupabaseClient().auth.getSession();
      if (latest.error) throw latest.error;
      context.signal.throwIfAborted();
      if (!latest.data.session || !sameNativeSession(session, latest.data.session))
        throw new Error("ACCOUNT_CHANGED");
    };
    await currentSession();
    const call: typeof backend.call = async (operation, body) => {
      await currentSession();
      try {
        return await backend.call(operation, body);
      } finally {
        // A late denial from an old bearer must not revoke the new session.
        await currentSession();
      }
    };
    const read: typeof backend.read = async (operation, body, readSignal) => {
      await currentSession();
      try {
        return await backend.read(operation, body, readSignal);
      } finally {
        await currentSession();
      }
    };
    return { ...backend, call, read };
  }
  return backend;
}
