import { afterEach, expect, it, vi } from "vitest";
import { createBackend } from "./backend";

const request = {
  client_api_version: 1 as const,
  request_id: "019a7b00-0000-7000-8000-000000000001",
};

afterEach(() => vi.restoreAllMocks());

it("passes the Query abort signal to the native read transport", async () => {
  const controller = new AbortController();
  const transport = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        data: { id: "fixture-account" },
        trace_id: request.request_id,
      }),
      { status: 200 },
    ),
  );
  const backend = createBackend({
    functionsUrl: "https://backend.invalid/functions/v1/backend-v1",
    publishableKey: "public-fixture",
    getAccessToken: async () => "pinned-fixture",
  });
  const account = await backend.read("account_get_v1", request, controller.signal);
  expect(account).toMatchObject({ id: "fixture-account" });
  expect(transport).toHaveBeenCalledExactlyOnceWith(
    "https://backend.invalid/functions/v1/backend-v1/account_get_v1",
    expect.objectContaining({
      signal: controller.signal,
      headers: expect.objectContaining({ authorization: "Bearer pinned-fixture" }),
    }),
  );
});

it("aborts a read before dispatch if the actor token is still resolving", async () => {
  const controller = new AbortController();
  let releaseToken!: (token: string) => void;
  const transport = vi.spyOn(globalThis, "fetch");
  const backend = createBackend({
    functionsUrl: "https://backend.invalid/functions/v1/backend-v1",
    publishableKey: "public-fixture",
    getAccessToken: () =>
      new Promise<string>((resolve) => {
        releaseToken = resolve;
      }),
  });
  const pending = backend.read("account_get_v1", request, controller.signal);
  controller.abort();
  releaseToken("pinned-fixture");
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(transport).not.toHaveBeenCalled();
});

it("never treats a cancelled Query read as an acknowledged native write", async () => {
  const controller = new AbortController();
  controller.abort();
  const backend = createBackend({
    functionsUrl: "https://backend.invalid/functions/v1/backend-v1",
    publishableKey: "public-fixture",
    getAccessToken: async () => "pinned-fixture",
  });
  await expect(backend.read("account_get_v1", request, controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});
