import { beforeEach, expect, it, vi } from "vitest";
import {
  prepareOrganizationLifecycle,
  writeOrganizationLifecycle,
  readOrganizationLifecycleResult,
  organizationLifecycleReceipt,
  organizationDeletionProof,
  organizationDeletionReceipt,
  recoverOrganizationDeletion,
  saveOrganizationDeletionReceipt,
} from "./organization-lifecycle";
const { call, session, assurance, password } = vi.hoisted(() => ({
  call: vi.fn(),
  session: vi.fn(),
  assurance: vi.fn(),
  password: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: { getSession: session, mfa: { getAuthenticatorAssuranceLevel: assurance } },
  }),
}));
vi.mock("../account/fresh-session", async (original) => ({
  ...(await original<typeof import("../account/fresh-session")>()),
  freshPasswordSession: password,
}));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const impact = {
  active_account_links: 2,
  open_sessions: 1,
  open_requests: 0,
  active_reservations: 4,
  active_event_registrations: 0,
  open_debts: 3,
  student_credit_accounts: 2,
  export_operation: "report_export_start_v1",
  export_requires_scope_check: true,
  export_before_closure: true,
  physical_erasure_complete: false,
};
const org = {
  id: scope.orgId,
  name: "Sentetik",
  state: "active",
  access_mode: "normal",
  version: 4,
};
const preview = {
  id: id(4),
  token: "synthetic",
  scope_hash: "synthetic",
  dependencies: {
    versions: [{ entity: { type: "organizations", id: scope.orgId }, version: 4 }],
    policy_hashes: [],
    permission_hash: "synthetic",
  },
  effects: [],
  blockers: [],
  expires_at: "2099-01-01T00:00:00Z",
  lifecycle_impact: impact,
};
beforeEach(() => {
  call.mockReset();
  session.mockReset();
  assurance.mockReset();
  password.mockReset();
  sessionStorage.clear();
  call.mockImplementation(async (op) =>
    op === "organization_get_v1" ? structuredClone(org) : structuredClone(preview),
  );
  session.mockResolvedValue({
    data: { session: { user: { id: id(9) }, access_token: "synthetic-native-proof" } },
    error: null,
  });
  assurance.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
});
it("close preview pins organization scope/version, retains nonzero impact and does not execute a write", async () => {
  const prepared = await prepareOrganizationLifecycle(scope, "close", "Sentetik kapanış");
  expect(prepared.preview.lifecycle_impact).toMatchObject({
    active_reservations: 4,
    open_debts: 3,
  });
  expect(prepared.intent.request).toMatchObject({
    org_id: scope.orgId,
    expected_version: 4,
    preview: { id: preview.id, token: preview.token },
  });
  expect(call.mock.calls.map((row) => row[0])).toEqual([
    "organization_get_v1",
    "organization_close_preview_v1",
  ]);
  expect(call.mock.calls.every((row) => !("center_id" in row[1]))).toBe(true);
});
it("malformed impact or a wrong organization never becomes an empty safe preview", async () => {
  call.mockResolvedValue({ ...org, id: id(99) });
  await expect(prepareOrganizationLifecycle(scope, "close", "gerekçe")).rejects.toThrow(
    "ORGANIZATION_SOURCE_INVALID",
  );
  call.mockImplementation(async (op) =>
    op === "organization_get_v1" ? org : { ...preview, lifecycle_impact: undefined },
  );
  await expect(prepareOrganizationLifecycle(scope, "close", "gerekçe")).rejects.toThrow(
    "ORGANIZATION_SOURCE_INVALID",
  );
});
it("close retries retain one payload/key; ACK readback rejects an active or unchanged version and never rewrites", async () => {
  const p = await prepareOrganizationLifecycle(scope, "close", "gerekçe");
  call.mockResolvedValue({ primary_id: scope.orgId });
  await writeOrganizationLifecycle(p.intent);
  await writeOrganizationLifecycle(p.intent);
  const requests = call.mock.calls.filter((row) => row[0] === "organization_close_apply_v1");
  expect(requests).toHaveLength(2);
  expect(requests[0]![1].operation_key).toBe(requests[1]![1].operation_key);
  expect(requests[0]![1].preview).toEqual(requests[1]![1].preview);
  call.mockResolvedValue(org);
  await expect(readOrganizationLifecycleResult(p.intent, scope.orgId)).rejects.toThrow(
    "ORGANIZATION_RESULT_INVALID",
  );
  call.mockResolvedValue({ ...org, state: "closed", access_mode: "closed", version: 5 });
  await expect(readOrganizationLifecycleResult(p.intent, scope.orgId)).resolves.toMatchObject({
    kind: "close",
    organization: { state: "closed", version: 5 },
  });
  expect(call.mock.calls.filter((row) => row[0] === "organization_close_apply_v1")).toHaveLength(2);
});
it("deletion persists only the immutable intent before transport and replays it with renewed native proof after a lost ACK", async () => {
  const p = await prepareOrganizationLifecycle(scope, "delete", "gerekçe", "synthetic-proof-first");
  call.mockRejectedValueOnce(Error("TRANSPORT_ERROR"));
  await expect(writeOrganizationLifecycle(p.intent)).rejects.toThrow("TRANSPORT_ERROR");
  const receipt = organizationDeletionReceipt(scope)!;
  expect(receipt).toMatchObject({
    key: p.intent.request.operation_key,
    preview: p.intent.request.preview,
  });
  expect(JSON.stringify(receipt)).not.toContain("synthetic-proof-first");
  expect(organizationDeletionReceipt({ ...scope, accountId: id(99) })).toBeUndefined();
  expect(organizationDeletionReceipt({ ...scope, orgId: id(98) })).toBeUndefined();
  const recovered = recoverOrganizationDeletion(scope, receipt, "synthetic-proof-second");
  call.mockResolvedValue({ job_id: id(5), state: "pending" });
  await expect(writeOrganizationLifecycle(recovered)).resolves.toEqual({ primary_id: id(5) });
  const bodies = call.mock.calls
    .filter((row) => row[0] === "organization_delete_apply_v1")
    .map((row) => row[1]);
  expect(bodies[1]).toMatchObject({
    operation_key: bodies[0].operation_key,
    preview: bodies[0].preview,
    all_data: true,
    reauth: "synthetic-proof-second",
  });
  expect(bodies[1]).not.toHaveProperty("center_id");
});
it("an acknowledged privacy job can be reread without applying again and cannot be recovered as an unacknowledged intent", async () => {
  const p = await prepareOrganizationLifecycle(scope, "delete", "gerekçe", "synthetic-proof");
  saveOrganizationDeletionReceipt(scope, {
    key: p.intent.request.operation_key,
    preview: p.intent.request.preview,
    reason: "gerekçe",
    jobId: id(5),
  });
  expect(() =>
    recoverOrganizationDeletion(scope, organizationDeletionReceipt(scope)!, "synthetic-proof"),
  ).toThrow("ORGANIZATION_DELETE_ALREADY_ACKNOWLEDGED");
  const job = {
    id: id(5),
    state: "retry_wait",
    progress_count: 0,
    total_count: null,
    result_reference: { type: "privacy_requests", id: id(6) },
    safe_error_code: null,
    privacy: {
      request_state: "partial",
      completed_at: null,
      pending_scopes: ["database", "storage", "exports", "backups"],
    },
  };
  call.mockResolvedValue(job);
  await expect(readOrganizationLifecycleResult(p.intent, id(5))).resolves.toMatchObject({
    kind: "delete",
    job: { privacy: { request_state: "partial", completed_at: null } },
  });
  expect(call.mock.calls.at(-1)?.[0]).toBe("job_status_get_v1");
  expect(call.mock.calls.some((row) => row[0] === "organization_delete_apply_v1")).toBe(false);
});
it("a receipt belonging to a different key or operation cannot confirm this lifecycle change", async () => {
  const p = await prepareOrganizationLifecycle(scope, "close", "gerekçe");
  call.mockResolvedValue({
    operation: "organization_close_apply_v1",
    key: id(99),
    status: "succeeded",
    result_available: true,
  });
  await expect(organizationLifecycleReceipt(p.intent)).rejects.toThrow(
    "ORGANIZATION_RECEIPT_INVALID",
  );
});
it("native proof checks the same actor and current MFA before exposing a proof to the organization command", async () => {
  await expect(organizationDeletionProof(scope, "Fixture123")).resolves.toBe(
    "synthetic-native-proof",
  );
  expect(password).toHaveBeenCalledWith("Fixture123");
  session
    .mockResolvedValueOnce({
      data: { session: { user: { id: id(9) }, access_token: "first" } },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { session: { user: { id: id(10) }, access_token: "second" } },
      error: null,
    });
  await expect(organizationDeletionProof(scope, "")).rejects.toThrow("ACCOUNT_CHANGED");
  assurance.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
  await expect(organizationDeletionProof(scope, "")).rejects.toThrow("MFA_REQUIRED");
});
