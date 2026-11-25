import { v7 as uuidv7 } from "uuid";
import type { QueryFunctionContext } from "@tanstack/react-query";
import { verifiedAccountForId } from "../features/auth/account-query";
import { sameNativeSession } from "../features/auth/native-session-id";
import { getBackend } from "./backend";
import { getSupabaseClient } from "./supabase";

export interface ClientScope {
  accountId: string;
  orgId: string;
  centerId: string;
}

// Only a Query-owned reader supplies this context. Imperative preparation,
// native writes, receipts and mandatory readbacks retain a fresh account read.
export type AccountReadContext = Pick<QueryFunctionContext, "client" | "signal">;

async function nativeSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  return data.session;
}

async function verifiedBackend(
  scope: Pick<ClientScope, "accountId">,
  signal?: AbortSignal,
  context?: AccountReadContext,
) {
  signal?.throwIfAborted();
  context?.signal.throwIfAborted();
  const session = await nativeSession();
  const backend = getBackend(session.access_token);
  const request = { client_api_version: 1 as const, request_id: uuidv7() };
  const account = context
    ? await verifiedAccountForId(context.client, scope.accountId)
    : signal
      ? await backend.read("account_get_v1", request, signal)
      : await backend.call("account_get_v1", request);
  signal?.throwIfAborted();
  if (account.id !== scope.accountId) throw new Error("ACCOUNT_CHANGED");
  return { backend, session };
}

// Bind preflight and the first write to one verified, current native bearer.
// A refreshed bearer or an explicit retry receives a fresh account check.
export async function scopedCommandBackend(scope: Pick<ClientScope, "accountId">) {
  const { backend, session } = await verifiedBackend(scope);
  async function currentSession() {
    const latest = await nativeSession();
    if (!sameNativeSession(session, latest)) throw new Error("ACCOUNT_CHANGED");
    return latest;
  }
  async function renew() {
    const renewed = await verifiedBackend(scope);
    if (!sameNativeSession(session, renewed.session)) throw new Error("ACCOUNT_CHANGED");
    await currentSession();
    return renewed.backend;
  }
  let attempted = false;
  async function write<Result>(submit: (client: typeof backend) => Promise<Result>) {
    const latest = await currentSession();
    try {
      const writer =
        attempted || latest.access_token !== session.access_token ? await renew() : backend;
      attempted = true;
      return await submit(writer);
    } catch (error) {
      await currentSession();
      throw error;
    }
  }
  async function readback<Result>(load: (client: typeof backend) => Promise<Result>) {
    await currentSession();
    try {
      return await load(await renew());
    } finally {
      await currentSession();
    }
  }
  return { backend, currentSession, write, readback };
}

// Pin one native bearer across an operation and validate the domain account.
// A stale editor must never submit its draft as a newly selected native account.
export async function scopedBackend(
  scope: Pick<ClientScope, "accountId">,
  signal?: AbortSignal,
  context?: AccountReadContext,
) {
  const { backend, session } = await verifiedBackend(scope, signal, context);
  const readSignal = context?.signal ?? signal;
  if (readSignal) {
    const currentSession = async () => {
      readSignal.throwIfAborted();
      const latest = await getSupabaseClient().auth.getSession();
      if (latest.error) throw latest.error;
      readSignal.throwIfAborted();
      if (!latest.data.session || !sameNativeSession(session, latest.data.session))
        throw new Error("ACCOUNT_CHANGED");
    };
    await currentSession();
    const call: typeof backend.call = async (operation, body) => {
      await currentSession();
      try {
        return await backend.read(operation, body, readSignal);
      } finally {
        // A late denial from an old bearer must not revoke the new session.
        await currentSession();
      }
    };
    const read: typeof backend.read = async (operation, body, requestSignal) => {
      await currentSession();
      const requestLifetime =
        requestSignal && requestSignal !== readSignal
          ? AbortSignal.any([readSignal, requestSignal])
          : readSignal;
      try {
        return await backend.read(operation, body, requestLifetime);
      } finally {
        await currentSession();
      }
    };
    return { ...backend, call, read };
  }
  return backend;
}
