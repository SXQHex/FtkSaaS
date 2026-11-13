import type { Operations } from "./api-contracts/operations";
import type { RuntimeOperationName } from "./api-contracts/runtime";
import type { SafeError } from "./api-contracts/generated";
import { getSupabaseClient } from "./supabase";

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
  return {
    async call<K extends keyof Operations & RuntimeOperationName>(
      operation: K,
      request: Operations[K]["request"],
    ): Promise<Operations[K]["response"]["data"]> {
      const token = await config.getAccessToken();
      if (!token)
        throw new BackendError({
          code: "AUTH_REQUIRED",
          retryable: false,
          trace_id: request.request_id,
        });
      const response = await fetch(`${config.functionsUrl.replace(/\/$/, "")}/${operation}`, {
        method: "POST",
        credentials: "omit",
        headers: {
          apikey: config.publishableKey,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      return readEnvelope<Operations[K]["response"]>(response);
    },
  };
}

export function getBackend() {
  const client = getSupabaseClient();
  return createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => {
      const { data, error } = await client.auth.getSession();
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
