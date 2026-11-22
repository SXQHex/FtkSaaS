import type { Operations } from "@ftksaas/api-contracts";
import type { RuntimeOperationName } from "@ftksaas/api-contracts/runtime";
import type { SafeError } from "@ftksaas/api-contracts";
import { getSupabaseClient } from "./supabase";
import { fetchBackendOperation } from "./backend-read-transport";

export class BackendError extends Error {
  readonly code: SafeError["code"] | "TRANSPORT_ERROR";
  readonly retryable: boolean;
  readonly traceId?: string;

  constructor(error?: SafeError) {
    super(error?.code ?? "TRANSPORT_ERROR");
    this.code = error?.code ?? "TRANSPORT_ERROR";
    this.retryable = error?.retryable ?? true;
    this.traceId = error?.trace_id;
  }
}

export function createBackend(config: {
  functionsUrl: string;
  publishableKey: string;
  getAccessToken: () => Promise<string | null>;
}) {
  async function post(path: string, request: { request_id: string }, options?: RequestInit) {
    options?.signal?.throwIfAborted();
    const token = await config.getAccessToken();
    options?.signal?.throwIfAborted();
    if (!token)
      throw new BackendError({
        code: "AUTH_REQUIRED",
        retryable: false,
        trace_id: request.request_id,
      });
    return fetchBackendOperation(config.functionsUrl, path, request, {
      ...options,
      method: "POST",
      credentials: "omit",
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    });
  }
  return {
    // Only opt-in query readers take an AbortSignal. Native writes and operation
    // receipts still use call() and preserve their idempotency/recovery rules.
    async read<K extends keyof Operations & RuntimeOperationName>(
      operation: K,
      request: Operations[K]["request"],
      signal?: AbortSignal,
    ): Promise<Operations[K]["response"]["data"]> {
      return readEnvelope<Operations[K]["response"]>(
        await post(operation, request, { signal }),
      );
    },
    async call<K extends keyof Operations & RuntimeOperationName>(
      operation: K,
      request: Operations[K]["request"],
    ): Promise<Operations[K]["response"]["data"]> {
      return readEnvelope<Operations[K]["response"]>(await post(operation, request));
    },
    downloadInvoice(request: Operations["organization_invoice_file_get_v1"]["request"]) {
      return post("organization_invoice_file_get_v1?download=original", request, {
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(30_000),
      });
    },
  };
}

// Keep un-cancelled standalone domain reads and native command validation
// compatible. Only Query-owned reads opt into transport cancellation.
export function queryBackendRead<K extends keyof Operations & RuntimeOperationName>(
  backend: ReturnType<typeof createBackend>,
  operation: K,
  request: Operations[K]["request"],
  signal?: AbortSignal,
): Promise<Operations[K]["response"]["data"]> {
  return signal ? backend.read(operation, request, signal) : backend.call(operation, request);
}

export function getBackend(accessToken?: string) {
  return createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => {
      if (accessToken) return accessToken;
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
  });
}

export async function readEnvelope<T extends { data: unknown }>(
  response: Response,
): Promise<T["data"]> {
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new BackendError();
  }
  if (!result || typeof result !== "object" || !("ok" in result)) throw new BackendError();
  if (
    result.ok === false &&
    "error" in result &&
    result.error &&
    typeof result.error === "object" &&
    "code" in result.error &&
    typeof result.error.code === "string" &&
    "retryable" in result.error &&
    typeof result.error.retryable === "boolean" &&
    "trace_id" in result.error &&
    typeof result.error.trace_id === "string"
  ) {
    throw new BackendError(result.error as SafeError);
  }
  if (
    !response.ok ||
    result.ok !== true ||
    !("data" in result) ||
    !("trace_id" in result) ||
    typeof result.trace_id !== "string"
  )
    throw new BackendError();
  return result.data as T["data"];
}
