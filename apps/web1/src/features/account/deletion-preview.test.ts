import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import type { Preview, SuccessAccountDeletePreview } from "../../lib/api-contracts/generated";
const { native } = vi.hoisted(() => ({ native: { getSession: vi.fn() } }));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
import { readDeletionPreview } from "./deletion-preview";
const actor = "019a7b00-0000-7000-8000-000000000001";
const other = "019a7b00-0000-7000-8000-000000000002";
const fixture: Preview = {
  id: actor,
  token: "private-preview-token",
  scope_hash: "private-hash",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "private-permission" },
  effects: [{ entity: { type: "accounts", id: actor }, action: "delete" }],
  blockers: [{ code: "OWNER_TRANSFER_REQUIRED", retryable: false, trace_id: actor }],
  expires_at: "2026-11-14T08:00:00Z",
};
const requests: { operation: string; bearer: string | null; body: Record<string, unknown> }[] = [];
let bearer = "fixture-a";
let accountGate: (() => Promise<void>) | undefined;
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://backend.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-fixture-key");
  bearer = "fixture-a";
  accountGate = undefined;
  requests.length = 0;
  native.getSession.mockImplementation(async () => ({
    data: { session: { access_token: bearer } },
    error: null,
  }));
  server.use(
    http.post(
      "https://backend.invalid/functions/v1/backend-v1/:operation",
      async ({ request, params }) => {
        const operation = String(params.operation);
        const auth = request.headers.get("authorization");
        requests.push({
          operation,
          bearer: auth,
          body: (await request.json()) as Record<string, unknown>,
        });
        if (operation === "account_get_v1") {
          const id = auth === "Bearer fixture-a" ? actor : other;
          await accountGate?.();
          return HttpResponse.json({
            ok: true,
            data: { id, state: "active", display_name: "Fixture" },
            trace_id: actor,
          });
        }
        return HttpResponse.json({
          ok: true,
          data: fixture,
          trace_id: actor,
        } satisfies SuccessAccountDeletePreview);
      },
    ),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("reads only the current account preview and keeps secrets and entity IDs out of display data", async () => {
  const result = await readDeletionPreview(actor);
  expect(result.blockers).toEqual(["OWNER_TRANSFER_REQUIRED"]);
  expect(result.effects).toEqual([
    { entityType: "accounts", action: "delete", quantity: undefined },
  ]);
  expect(result.expiresAt).toBe(fixture.expires_at);
  expect(JSON.stringify(result)).not.toMatch(/private-|019a7b00/);
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1", "account_delete_preview_v1"]);
  expect(requests[1]!.body).toEqual({ client_api_version: 1, request_id: expect.any(String) });
});
it("does not read another account preview after the authenticated actor changes", async () => {
  bearer = "fixture-b";
  await expect(readDeletionPreview(actor)).rejects.toThrow("ACCOUNT_CHANGED");
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1"]);
});
it("pins one native bearer across a deferred account read and preview request", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let start!: () => void;
  const started = new Promise<void>((r) => (start = r));
  accountGate = async () => {
    start();
    await gate;
  };
  const pending = readDeletionPreview(actor);
  await started;
  bearer = "fixture-b";
  release();
  await pending;
  expect(native.getSession).toHaveBeenCalledTimes(1);
  expect(requests.map((r) => r.bearer)).toEqual(["Bearer fixture-a", "Bearer fixture-a"]);
});
it("requires a native session before any domain request", async () => {
  native.getSession.mockResolvedValue({ data: { session: null }, error: null });
  await expect(readDeletionPreview(actor)).rejects.toThrow("AUTH_REQUIRED");
  expect(requests).toEqual([]);
});
