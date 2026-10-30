import { beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { accountCall, accountProfile, freshAccountProof, imageUpload } from "../src/lib/account";
const mocks = vi.hoisted(() => ({
  user: vi.fn<
    () => Promise<{ error: Error | null; data: { user: { email: string; id?: string } } }>
  >(),
  signIn: vi.fn<(input: { email: string; password: string }) => Promise<{ error: Error | null }>>(),
  factors:
    vi.fn<
      () => Promise<{ error: Error | null; data: { totp: { id: string; status: string }[] } }>
    >(),
  verify: vi.fn<(input: { factorId: string; code: string }) => Promise<{ error: Error | null }>>(),
  session: vi.fn<
    () => Promise<{
      error: Error | null;
      data: { session: { access_token: string; user?: { id: string } } };
    }>
  >(),
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: mocks.session,
      getUser: mocks.user,
      signInWithPassword: mocks.signIn,
      mfa: { listFactors: mocks.factors, challengeAndVerify: mocks.verify },
    },
  }),
}));
const base = "https://account.example.invalid/functions/v1/backend-v1";
const actor = "019a2b3c-4d5e-7000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://account.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable");
  mocks.session.mockResolvedValue({
    error: null,
    data: { session: { access_token: "synthetic-current-proof" } },
  });
});
test("account writes preserve key/payload, renew request ID and never send a tenant scope", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${base}/account_session_label_v1`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return HttpResponse.json({
        ok: true,
        data: { operation_id: actor, primary_id: actor, replayed: bodies.length > 1, related: [] },
        trace_id: body.request_id,
      });
    }),
  );
  const input = {
    operation_key: actor,
    expected_version: 0,
    session_id: "provider-session",
    label: null,
  };
  await accountCall("account_session_label_v1", input);
  await accountCall("account_session_label_v1", input);
  expect(bodies[0].request_id).not.toBe(bodies[1].request_id);
  expect(bodies.map(({ request_id: _id, ...body }) => body)).toEqual(
    [1, 2].map(() => ({ ...input, client_api_version: 1 })),
  );
});
test("profile version is read from the exact own account management entity", async () => {
  server.use(
    http.post(`${base}/account_get_v1`, () =>
      HttpResponse.json({
        ok: true,
        data: { id: actor, state: "active", display_name: "Synthetic" },
      }),
    ),
    http.post(`${base}/management_state_get_v1`, async ({ request }) => {
      const body = await request.json();
      expect(body).toMatchObject({
        operation: "account_profile_update_v1",
        selector: { operation: "account_profile_update_v1", key: {} },
      });
      return HttpResponse.json({
        ok: true,
        data: {
          items: [
            {
              entity: { type: "accounts", id: actor },
              versions: [
                { entity: { type: "accounts", id: "another-account" }, version: 99 },
                { entity: { type: "accounts", id: actor }, version: 3 },
              ],
            },
          ],
        },
      });
    }),
  );
  expect((await accountProfile()).version).toBe(3);
});
test("missing profile write version fails closed", async () => {
  server.use(
    http.post(`${base}/account_get_v1`, () => HttpResponse.json({ ok: true, data: { id: actor } })),
    http.post(`${base}/management_state_get_v1`, () =>
      HttpResponse.json({ ok: true, data: { items: [] } }),
    ),
  );
  await expect(accountProfile()).rejects.toThrow("profileVersionUnavailable");
});
test("fresh proof adopts native sign-in, verifies the enrolled factor, then uses the latest session", async () => {
  mocks.user.mockResolvedValue({
    error: null,
    data: { user: { email: "synthetic@example.invalid" } },
  });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.factors.mockResolvedValue({
    error: null,
    data: { totp: [{ id: "native-factor", status: "verified" }] },
  });
  mocks.verify.mockResolvedValue({ error: null });
  server.use(
    http.post(`${base}/account_get_v1`, () => HttpResponse.json({ ok: true, data: { id: actor } })),
  );
  expect(await freshAccountProof(actor, "synthetic-password", "123456")).toBe(
    "synthetic-current-proof",
  );
  expect(mocks.signIn).toHaveBeenCalledWith({
    email: "synthetic@example.invalid",
    password: "synthetic-password",
  });
  expect(mocks.verify).toHaveBeenCalledWith({ factorId: "native-factor", code: "123456" });
});
test("failed MFA cannot yield a proof or attempt the sensitive command", async () => {
  mocks.user.mockResolvedValue({
    error: null,
    data: { user: { email: "synthetic@example.invalid" } },
  });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.factors.mockResolvedValue({
    error: null,
    data: { totp: [{ id: "native-factor", status: "verified" }] },
  });
  mocks.verify.mockResolvedValue({ error: new Error("invalid code") });
  await expect(freshAccountProof(actor, "synthetic-password", "999999")).rejects.toThrow(
    "invalid code",
  );
});
test("photo validation rejects oversized or unsupported files before processing", async () => {
  await expect(
    imageUpload(new File(["data"], "script.svg", { type: "image/svg+xml" })),
  ).rejects.toThrow("imageInvalid");
  await expect(
    imageUpload(new File([new Uint8Array(1048577)], "large.png", { type: "image/png" })),
  ).rejects.toThrow("imageInvalid");
});

test("deletion recovery verifies the server-selected native identity without requiring an active account projection", async () => {
  let accountReads = 0;
  mocks.user.mockResolvedValue({
    error: null,
    data: { user: { id: "native-user", email: "synthetic@example.invalid" } },
  });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.factors.mockResolvedValue({ error: null, data: { totp: [] } });
  mocks.session.mockResolvedValue({
    error: null,
    data: { session: { access_token: "fresh-native-proof", user: { id: "native-user" } } },
  });
  server.use(
    http.post(`${base}/account_get_v1`, () => {
      accountReads++;
      return HttpResponse.json({
        ok: false,
        error: { code: "SESSION_REVOKED", retryable: false, trace_id: actor },
      });
    }),
  );
  expect(await freshAccountProof(actor, "synthetic-password", "", "native-user")).toBe(
    "fresh-native-proof",
  );
  expect(accountReads).toBe(0);
});

test("deletion recovery refuses a different native user before attempting reauthentication", async () => {
  mocks.user.mockResolvedValue({
    error: null,
    data: { user: { id: "other-native-user", email: "synthetic@example.invalid" } },
  });
  await expect(
    freshAccountProof(actor, "synthetic-password", "", "expected-native-user"),
  ).rejects.toThrow("AUTH_REQUIRED");
  expect(mocks.signIn).not.toHaveBeenCalled();
});
