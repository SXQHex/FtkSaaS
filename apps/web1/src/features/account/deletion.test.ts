import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import type {
  Preview,
  SuccessAccountDeleteApply,
  SuccessJobStatusGet,
} from "../../lib/api-contracts/generated";
const { native } = vi.hoisted(() => ({
  native: { getSession: vi.fn(), mfa: { getAuthenticatorAssuranceLevel: vi.fn() } },
}));
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => ({ auth: native }) }));
import {
  prepareDeletion,
  recoverDeletion,
  hasDeletionReceipt,
  readDeletionStatus,
  deletionContext,
} from "./deletion";
const actor = "019a7b00-0000-7000-8000-000000000001";
const account = "019a7b00-0000-7000-8000-000000000002";
const other = "019a7b00-0000-7000-8000-000000000003";
const jobId = "019a7b00-0000-7000-8000-000000000004";
const preview: Preview = {
  id: account,
  token: "private-preview",
  scope_hash: "private-hash",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "private-permission" },
  effects: [],
  blockers: [],
  expires_at: "2026-11-14T12:00:00Z",
};
let user: string, proof: string, loseAck: boolean, rejected: boolean, complete: boolean;
const requests: { operation: string; body: Record<string, unknown>; bearer: string | null }[] = [];
beforeEach(() => {
  sessionStorage.clear();
  requests.length = 0;
  user = actor;
  proof = "native-proof-first";
  loseAck = false;
  rejected = false;
  complete = false;
  vi.stubEnv("VITE_SUPABASE_URL", "https://backend.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  native.getSession.mockImplementation(async () => ({
    data: { session: { user: { id: user }, access_token: proof } },
    error: null,
  }));
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
  server.use(
    http.post(
      "https://backend.invalid/functions/v1/backend-v1/:operation",
      async ({ request, params }) => {
        const operation = String(params.operation);
        const body = (await request.json()) as Record<string, unknown>;
        requests.push({ operation, body, bearer: request.headers.get("authorization") });
        if (operation === "account_get_v1")
          return HttpResponse.json({
            ok: true,
            data: { id: account, state: "active", display_name: "Fixture" },
            trace_id: actor,
          });
        if (operation === "account_delete_apply_v1") {
          if (loseAck) return HttpResponse.error();
          if (rejected)
            return HttpResponse.json({
              ok: false,
              error: { code: "PREVIEW_EXPIRED", retryable: false, trace_id: actor },
            });
          return HttpResponse.json({
            ok: true,
            data: { job_id: jobId, state: "pending" },
            trace_id: actor,
          } satisfies SuccessAccountDeleteApply);
        }
        return HttpResponse.json({
          ok: true,
          data: {
            id: jobId,
            state: "succeeded",
            progress_count: 0,
            total_count: null,
            result_reference: null,
            safe_error_code: null,
            privacy: {
              request_state: complete ? "completed" : "partial",
              completed_at: complete ? "2026-11-14T12:00:00Z" : null,
              pending_scopes: complete ? [] : ["auth", "backups"],
              profile_erasure: { state: "completed", policy_version: 1 },
            },
          },
          trace_id: actor,
        } satisfies SuccessJobStatusGet);
      },
    ),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});
it("does not persist preparation and denies blockers before any request", () => {
  prepareDeletion(actor, account, preview);
  expect(sessionStorage.length).toBe(0);
  expect(() =>
    prepareDeletion(actor, account, {
      ...preview,
      blockers: [{ code: "OWNER_TRANSFER_REQUIRED", retryable: false, trace_id: actor }],
    }),
  ).toThrow("DELETION_BLOCKED");
  expect(requests).toEqual([]);
});
it("snapshots native proof, keeps it out of storage and projects own privacy status", async () => {
  await prepareDeletion(actor, account, preview)();
  expect(hasDeletionReceipt(actor)).toBe(true);
  expect(hasDeletionReceipt(other)).toBe(false);
  const saved = sessionStorage.getItem("ftk-account-deletion")!;
  expect(saved).not.toContain(proof);
  expect(saved).not.toContain("password");
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1", "account_delete_apply_v1"]);
  expect(requests[1]!.body).toMatchObject({
    preview: { id: preview.id, token: preview.token },
    reauth: proof,
    operation_key: expect.any(String),
  });
  const status = await readDeletionStatus();
  expect(requests.at(-1)!.body).toMatchObject({ org_id: null, job_id: jobId });
  expect(status.complete).toBe(false);
  expect(status.privacy?.profile_erasure?.state).toBe("completed");
  expect(JSON.stringify(status)).not.toContain(jobId);
  complete = true;
  expect((await readDeletionStatus()).complete).toBe(true);
});
it("replays a lost acknowledgement with the same key/payload and fresh native proof", async () => {
  loseAck = true;
  await expect(prepareDeletion(actor, account, preview)()).rejects.toThrow();
  const first = requests.at(-1)!.body;
  expect((await deletionContext()).uncertain).toBe(true);
  await expect(readDeletionStatus()).rejects.toThrow("DELETION_RECEIPT_REQUIRED");
  loseAck = false;
  proof = "native-proof-new-login";
  await recoverDeletion();
  const second = requests.at(-1)!.body;
  expect(second.operation_key).toBe(first.operation_key);
  expect(second.preview).toEqual(first.preview);
  expect(second.reauth).toBe(proof);
  expect(second.request_id).not.toBe(first.request_id);
  expect((await deletionContext()).uncertain).toBe(false);
});
it("refuses another native actor's recovery and status without domain requests", async () => {
  await prepareDeletion(actor, account, preview)();
  const count = requests.length;
  user = other;
  expect(await deletionContext()).toEqual({ actor: other, owned: false, uncertain: false });
  await expect(recoverDeletion()).rejects.toThrow("ACCOUNT_CHANGED");
  await expect(readDeletionStatus()).rejects.toThrow("ACCOUNT_CHANGED");
  expect(requests).toHaveLength(count);
});
it("refuses actor change and AAL downgrade before creating a receipt", async () => {
  const confirm = prepareDeletion(actor, account, preview);
  user = other;
  await expect(confirm()).rejects.toThrow("ACCOUNT_CHANGED");
  user = actor;
  native.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal2" },
    error: null,
  });
  await expect(confirm()).rejects.toThrow("MFA_REQUIRED");
  expect(requests).toEqual([]);
  expect(sessionStorage.length).toBe(0);
});
it("does not overwrite an existing uncertain command or clear it on a later definitive replay failure", async () => {
  loseAck = true;
  await expect(prepareDeletion(actor, account, preview)()).rejects.toThrow();
  const original = sessionStorage.getItem("ftk-account-deletion");
  await expect(prepareDeletion(actor, account, preview)()).rejects.toThrow(
    "DELETION_ALREADY_PENDING",
  );
  loseAck = false;
  rejected = true;
  await expect(recoverDeletion()).rejects.toThrow("PREVIEW_EXPIRED");
  expect(sessionStorage.getItem("ftk-account-deletion")).toBe(original);
});
it("allows a new preview only after a first definitive rejection", async () => {
  rejected = true;
  await expect(prepareDeletion(actor, account, preview)()).rejects.toThrow("PREVIEW_EXPIRED");
  expect(hasDeletionReceipt(actor)).toBe(false);
  expect(sessionStorage.length).toBe(0);
});
it("fails closed on corrupted receipt data and failed private storage writes", async () => {
  sessionStorage.setItem("ftk-account-deletion", JSON.stringify({ actor, jobId }));
  expect(hasDeletionReceipt(actor)).toBe(false);
  sessionStorage.clear();
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("storage unavailable");
  });
  await expect(prepareDeletion(actor, account, preview)()).rejects.toThrow("storage unavailable");
  expect(requests.map((r) => r.operation)).toEqual(["account_get_v1"]);
  spy.mockRestore();
});
