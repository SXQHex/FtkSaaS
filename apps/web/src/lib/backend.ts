import type { Operations } from "@ftksaas/api-contracts";
import type { RuntimeOperationName } from "@ftksaas/api-contracts/runtime";
import type { SafeError } from "@ftksaas/api-contracts";
import { getSupabaseClient } from "./supabase";
import { fetchBackendOperation } from "./backend-read-transport";
import { requireSupabasePublishableKey, requireSupabaseUrl } from "./public-config";

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
  async function readOperation<K extends keyof Operations & RuntimeOperationName>(
    operation: K,
    request: Operations[K]["request"],
    signal?: AbortSignal,
  ): Promise<Operations[K]["response"]["data"]> {
    const data = await readEnvelope(
      await post(operation, request, signal ? { signal } : undefined),
      signal,
    );
    // The published contract provides the type for generic calls. Consumers of
    // critical data validate the fields they rely on at their feature boundary.
    return data as Operations[K]["response"]["data"];
  }
  return {
    // Only opt-in query readers take an AbortSignal. Native writes and operation
    // receipts still use call() and preserve their idempotency/recovery rules.
    async read<K extends keyof Operations & RuntimeOperationName>(
      operation: K,
      request: Operations[K]["request"],
      signal?: AbortSignal,
    ): Promise<Operations[K]["response"]["data"]> {
      return readOperation(operation, request, signal);
    },
    async call<K extends keyof Operations & RuntimeOperationName>(
      operation: K,
      request: Operations[K]["request"],
    ): Promise<Operations[K]["response"]["data"]> {
      return readOperation(operation, request);
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
    functionsUrl: `${requireSupabaseUrl()}/functions/v1/backend-v1`,
    publishableKey: requireSupabasePublishableKey(),
    getAccessToken: async () => {
      if (accessToken !== undefined) return accessToken;
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
  });
}

export async function readEnvelope(response: Response, signal?: AbortSignal): Promise<unknown> {
  signal?.throwIfAborted();
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    signal?.throwIfAborted();
    throw new BackendError();
  }
  signal?.throwIfAborted();
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
    result.data === null ||
    typeof result.data !== "object" ||
    !("trace_id" in result) ||
    typeof result.trace_id !== "string"
  )
    throw new BackendError();
  return result.data;
}
