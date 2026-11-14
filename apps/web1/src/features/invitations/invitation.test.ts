import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
const { native } = vi.hoisted(() => ({ native: { getSession: vi.fn() } }));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
import {
  captureInvitation,
  readInvitation,
  createAcceptanceIntent,
  acceptInvitation,
  readAcceptanceStatus,
  requestInvitationAuth,
  takeInvitationReturn,
} from "./invitation";
const actor = "019a7b00-0000-7000-8000-000000000001";
const other = "019a7b00-0000-7000-8000-000000000002";
const requests: { operation: string; body: Record<string, unknown>; bearer: string | null }[] = [];
let nativeBearer = "fixture-a";
let rejectNext = false;
let deferAccount: (() => Promise<void>) | undefined;
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://backend.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-fixture-key");
  nativeBearer = "fixture-a";
  rejectNext = false;
  deferAccount = undefined;
  requests.length = 0;
  native.getSession.mockImplementation(async () => ({
    data: { session: { access_token: nativeBearer } },
    error: null,
  }));
  server.use(
    http.post(
      "https://backend.invalid/functions/v1/backend-v1/:operation",
      async ({ request, params }) => {
        const operation = String(params.operation);
        const bearer = request.headers.get("authorization");
        const body = (await request.json()) as Record<string, unknown>;
        requests.push({ operation, body, bearer });
        if (operation === "account_get_v1") {
          const id = bearer === "Bearer fixture-a" ? actor : other;
          await deferAccount?.();
          return HttpResponse.json({
            ok: true,
            data: { id, state: "active", display_name: "Fixture" },
            trace_id: actor,
          });
        }
        if (operation === "account_access_accept_v1") {
          if (rejectNext) {
            rejectNext = false;
            return HttpResponse.error();
          }
          return HttpResponse.json({
            ok: true,
            data: { operation_id: actor, primary_id: other, replayed: true, related: [] },
            trace_id: actor,
          });
        }
        return HttpResponse.json({
          ok: true,
          data: {
            operation: "account_access_accept_v1",
            key: body.key,
            status: "in_progress",
            result_available: false,
            result_reference: null,
          },
          trace_id: actor,
        });
      },
    ),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
function capture(token = "fixture-invite") {
  window.history.replaceState({}, "", `/invite#token=${token}`);
  return captureInvitation();
}
it("captures only one fragment token, scrubs the URL and survives reload", () => {
  expect(capture()).toBe("captured");
  expect(location.pathname).toBe("/invite");
  expect(location.hash).toBe("");
  expect(location.search).toBe("");
  expect(readInvitation()?.token).toBe("fixture-invite");
  expect(captureInvitation()).toBe("restored");
});
it.each(["/invite?token=query-secret", "/invite#token=", "/invite#token=one&token=two"])(
  "fails closed for malformed or query-supplied token %s",
  (url) => {
    window.history.replaceState({}, "", url);
    expect(captureInvitation()).toBe("invalid");
    expect(location.href).not.toContain("token");
    expect(readInvitation()).toBeUndefined();
  },
);
it("keeps the same account-bound key across reload and refuses another account", () => {
  capture();
  const intent = createAcceptanceIntent(actor);
  expect(createAcceptanceIntent(actor)).toEqual(intent);
  expect(intent.operationKey).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-7/);
  expect(() => createAcceptanceIntent(other)).toThrow("INVITE_ACCOUNT_CHANGED");
  expect(capture("another-token")).toBe("pending");
  expect(readInvitation()?.token).toBe("fixture-invite");
});
it("returns to invite only after explicit authentication action and only once", () => {
  capture();
  expect(takeInvitationReturn()).toBe(false);
  requestInvitationAuth();
  expect(takeInvitationReturn()).toBe(true);
  expect(takeInvitationReturn()).toBe(false);
});
it("sends only the typed acceptance and retains the original payload/key after uncertain transport", async () => {
  capture();
  const intent = createAcceptanceIntent(actor);
  rejectNext = true;
  await expect(acceptInvitation(intent)).rejects.toThrow();
  await acceptInvitation(intent);
  const sent = requests.filter((r) => r.operation === "account_access_accept_v1");
  expect(sent).toHaveLength(2);
  for (const r of sent)
    expect(r.body).toEqual({
      client_api_version: 1,
      request_id: expect.any(String),
      operation_key: intent.operationKey,
      token: "fixture-invite",
    });
  expect(sent[0]!.body.request_id).not.toBe(sent[1]!.body.request_id);
});
it("does not send or inspect another account's intent", async () => {
  capture();
  const intent = createAcceptanceIntent(actor);
  nativeBearer = "fixture-b";
  await expect(acceptInvitation(intent)).rejects.toThrow("INVITE_ACCOUNT_CHANGED");
  await expect(readAcceptanceStatus(intent)).rejects.toThrow("INVITE_ACCOUNT_CHANGED");
  expect(requests.every((r) => r.operation === "account_get_v1")).toBe(true);
});
it("reads the original receipt without putting the token in status requests", async () => {
  capture();
  const intent = createAcceptanceIntent(actor);
  await readAcceptanceStatus(intent);
  expect(requests[1]!.body).toEqual({
    client_api_version: 1,
    request_id: expect.any(String),
    operation: "account_access_accept_v1",
    key: intent.operationKey,
  });
});
it.each(["accept", "status"])(
  "keeps one bearer snapshot across an in-flight actor change for %s",
  async (kind) => {
    capture();
    const intent = createAcceptanceIntent(actor);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let started!: () => void;
    const began = new Promise<void>((r) => (started = r));
    deferAccount = async () => {
      started();
      await gate;
    };
    const pending = kind === "accept" ? acceptInvitation(intent) : readAcceptanceStatus(intent);
    await began;
    nativeBearer = "fixture-b";
    release();
    await pending;
    expect(native.getSession).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.bearer)).toEqual(["Bearer fixture-a", "Bearer fixture-a"]);
  },
);
it("scrubs the URL even when private storage cannot persist the invitation", () => {
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  try {
    expect(capture()).toBe("unavailable");
    expect(location.hash).toBe("");
    expect(location.search).toBe("");
    expect(requests).toEqual([]);
  } finally {
    write.mockRestore();
  }
});
it("does not replace malformed saved intent with a new key or dispatch a command", () => {
  sessionStorage.setItem(
    "ftk-invitation",
    JSON.stringify({
      version: 1,
      token: "original",
      returnAfterAuth: false,
      intent: { accountId: actor, operationKey: "broken-key" },
    }),
  );
  expect(capture()).toBe("unavailable");
  expect(() => createAcceptanceIntent(actor)).toThrow("INVITE_STORAGE_INVALID");
  expect(requests).toEqual([]);
  expect(location.hash).toBe("");
});
