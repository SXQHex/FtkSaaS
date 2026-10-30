import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { AccountDelete } from "../src/components/account/account-delete";
import { MfaManager } from "../src/components/account/mfa-manager";
import { IdentityForm } from "../src/components/account/identity-form";
import { InvitationAccept } from "../src/components/account/invitation-accept";
import { SessionManager } from "../src/components/account/session-manager";
import { DeletionProgress } from "../src/components/account/deletion-progress";
import { ApiFailure } from "../src/lib/api";
import type { Preview } from "@ftksaas/api-contracts";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  proof: vi.fn<() => Promise<string>>(),
  update: vi.fn<() => Promise<{ error: Error | null }>>(),
  factors:
    vi.fn<() => Promise<{ error: null; data: { totp: { id: string; status: string }[] } }>>(),
  unenroll: vi.fn<() => Promise<{ error: null }>>(),
  verify: vi.fn<() => Promise<{ error: Error | null }>>(),
  saved: vi.fn<() => void>(),
  remember: vi.fn<() => Promise<void>>(),
}));
vi.mock("../src/lib/account", async (load) => ({
  ...(await load<typeof import("../src/lib/account")>()),
  accountCall: mocks.call,
  freshAccountProof: mocks.proof,
}));
vi.mock("../src/lib/auth-return", () => ({ rememberAuthReturn: mocks.remember }));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      updateUser: mocks.update,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      mfa: {
        listFactors: mocks.factors,
        unenroll: mocks.unenroll,
        challengeAndVerify: mocks.verify,
      },
    },
  }),
}));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
const actor = "019a2b3c-4d5e-7000-8000-000000000001";
const preview: Preview = {
  id: actor,
  token: "synthetic-preview",
  scope_hash: "scope",
  expires_at: "2099-01-01T00:00:00Z",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "hash" },
  effects: [],
  blockers: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.proof.mockResolvedValue("synthetic-proof");
  mocks.factors.mockResolvedValue({ error: null, data: { totp: [] } });
  vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.example.invalid");
});
test("ownership blockers prevent account deletion and fresh authentication", async () => {
  mocks.call.mockResolvedValue({
    ...preview,
    blockers: [{ code: "OWNER_TRANSFER_REQUIRED", retryable: false, trace_id: actor }],
  });
  const user = userEvent.setup();
  render(<AccountDelete actorId={actor} nativeUserId="native-owner" />);
  await user.click(screen.getByRole("button", { name: "Silme etkilerini incele" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("sahipliğini devretmelisin");
  expect(
    screen.queryByRole("button", { name: "Hesabı silme talebini onayla" }),
  ).not.toBeInTheDocument();
  expect(mocks.proof).not.toHaveBeenCalled();
});
test("expired deletion preview requires a new review before fresh sign-in", async () => {
  mocks.call.mockResolvedValue({ ...preview, expires_at: "2000-01-01T00:00:00Z" });
  const user = userEvent.setup();
  render(<AccountDelete actorId={actor} nativeUserId="native-owner" />);
  await user.click(screen.getByRole("button", { name: "Silme etkilerini incele" }));
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Hesabı silme talebini onayla" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Önizleme artık geçerli değil");
  expect(mocks.proof).not.toHaveBeenCalled();
});
test("deletion persists only preview/key and a native-user-scoped job reference, never proof", async () => {
  mocks.call
    .mockResolvedValueOnce(preview)
    .mockResolvedValueOnce({ job_id: actor, state: "pending" });
  const user = userEvent.setup();
  render(<AccountDelete actorId={actor} nativeUserId="native-owner" />);
  await user.click(screen.getByRole("button", { name: "Silme etkilerini incele" }));
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Hesabı silme talebini onayla" }));
  expect(await screen.findByText(/Silme talebi kabul edildi/)).toHaveTextContent(
    "fiziksel veri imhasının tamamlandığı anlamına gelmez",
  );
  expect(mocks.call.mock.calls[1]).toMatchObject([
    "account_delete_apply_v1",
    { preview: { id: actor, token: "synthetic-preview" }, reauth: "synthetic-proof" },
  ]);
  expect(sessionStorage.getItem("ftksaas:account-deletion-job:native-owner")).toBe(actor);
  expect(JSON.stringify(sessionStorage)).not.toContain("synthetic-proof");
});
test("verified TOTP removal uses backend approval, unverified enrollment cancellation stays native", async () => {
  mocks.factors.mockResolvedValue({
    error: null,
    data: {
      totp: [
        { id: "verified-factor", status: "verified" },
        { id: "pending-factor", status: "unverified" },
      ],
    },
  });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.call.mockResolvedValue({ removed: true });
  const user = userEvent.setup();
  render(<MfaManager actorId={actor} />);
  await user.click(await screen.findByRole("button", { name: "Kurulumu iptal et" }));
  expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "pending-factor" });
  await user.click(screen.getByRole("button", { name: "Doğrulamayı kaldır" }));
  await user.click(screen.getByRole("button", { name: "Doğrula ve kaldır" }));
  expect(await screen.findByRole("status")).toHaveTextContent("kaldırıldı");
  expect(mocks.call).toHaveBeenCalledWith("account_totp_remove_v1", {
    factor_id: "verified-factor",
    reauth: "synthetic-proof",
  });
  expect(mocks.unenroll).toHaveBeenCalledOnce();
});
test("failed native contact changes show provider errors without a success notification", async () => {
  mocks.update.mockResolvedValue({ error: new Error("provider unavailable") });
  const user = userEvent.setup();
  render(
    <IdentityForm
      account={{ id: actor, state: "active", display_name: "Synthetic" }}
      onSaved={mocks.saved}
    />,
  );
  await user.type(screen.getByLabelText("Yeni e-posta"), "new@example.invalid");
  await user.click(
    within(screen.getByLabelText("Yeni e-posta").closest("form")!).getByRole("button"),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("invitation retries preserve key while keeping the raw invitation token out of storage", async () => {
  mocks.call
    .mockResolvedValueOnce({ id: actor, display_name: "Synthetic" })
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValueOnce({ primary_id: actor });
  const user = userEvent.setup();
  render(<InvitationAccept nativeUserId="native-owner" />);
  await screen.findByText("Kabul eden hesap: Synthetic");
  await user.type(screen.getByLabelText("Davet kodu"), "synthetic-invitation-token");
  await user.click(screen.getByRole("button", { name: "Daveti kabul et" }));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Daveti kabul et" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Davet kabul edildi");
  expect(mocks.call.mock.calls[2]).toEqual(mocks.call.mock.calls[1]);
  expect(JSON.stringify(sessionStorage)).not.toContain("synthetic-invitation-token");
});
test("global deletion tracking reads only the current native user's receipt", async () => {
  sessionStorage.setItem("ftksaas:account-deletion-job:another-user", actor);
  const user = userEvent.setup();
  render(<DeletionProgress nativeUserId="current-user" />);
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  expect(await screen.findByRole("status")).toHaveTextContent("kayıtlı talep yok");
  expect(mocks.call).not.toHaveBeenCalled();
});
test("forbidden global job read never reports completed deletion", async () => {
  sessionStorage.setItem("ftksaas:account-deletion-job:current-user", actor);
  mocks.call.mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: actor } }),
  );
  const user = userEvent.setup();
  render(<DeletionProgress nativeUserId="current-user" />);
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() =>
    expect(mocks.call).toHaveBeenCalledWith("job_status_get_v1", { org_id: null, job_id: actor }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("yetkin yok");
});

test("a completed job with partial privacy work shows remaining backup scope without claiming erasure", async () => {
  sessionStorage.setItem("ftksaas:account-deletion-job:current-user", actor);
  mocks.call.mockResolvedValue({
    id: actor,
    state: "succeeded",
    progress_count: 2,
    total_count: 3,
    result_reference: null,
    safe_error_code: null,
    privacy: { request_state: "partial", completed_at: null, pending_scopes: ["backups"] },
  });
  const user = userEvent.setup();
  render(<DeletionProgress nativeUserId="current-user" />);
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "tek başına tüm fiziksel kopyaların imha edildiğini doğrulamaz",
  );
  expect(screen.getByText("İmha talebinin durumu: Kısmen tamamlandı")).toBeVisible();
  expect(screen.getByText("Yedekler")).toBeVisible();
});

test("a lost deletion response can be resumed from tracking without opening a new preview or active profile", async () => {
  sessionStorage.setItem("ftksaas:account-deletion-recovery:native-owner", actor);
  const original = {
    operation: "account_delete_apply_v1",
    input: { operation_key: actor, preview: { id: actor, token: "synthetic-preview" } },
  };
  sessionStorage.setItem(`ftksaas:account:${actor}:delete`, JSON.stringify({ command: original }));
  mocks.call.mockResolvedValue({ job_id: actor, state: "pending" });
  const user = userEvent.setup();
  render(<DeletionProgress nativeUserId="native-owner" />);
  await user.click(screen.getByRole("button", { name: "Yanıtı kaybolan silme işlemini bul" }));
  expect(screen.queryByRole("button", { name: "Silme etkilerini incele" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Hesabı silme talebini onayla" }));
  expect(await screen.findByText(/Silme talebi kabul edildi/)).toBeVisible();
  expect(mocks.call).toHaveBeenCalledExactlyOnceWith(original.operation, {
    ...original.input,
    reauth: "synthetic-proof",
  });
  expect(sessionStorage.getItem("ftksaas:account-deletion-job:native-owner")).toBe(actor);
});

test("another native user's pending deletion is not offered as a recovery action", async () => {
  sessionStorage.setItem("ftksaas:account-deletion-recovery:another-user", actor);
  const user = userEvent.setup();
  render(<DeletionProgress nativeUserId="native-owner" />);
  await user.click(screen.getByRole("button", { name: "Yanıtı kaybolan silme işlemini bul" }));
  expect(await screen.findByRole("status")).toHaveTextContent("bekleyen silme işlemi yok");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(mocks.call).not.toHaveBeenCalled();
});

test("session dates use the stated device timezone instead of the provider's UTC default", async () => {
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  const timezone = vi
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...original.call(this), timeZone: "Europe/Istanbul" };
    });
  mocks.call.mockImplementation(async (operation) =>
    operation === "account_sessions_list_v1"
      ? {
          items: [
            {
              session_id: "native-session",
              current: true,
              created_at: "2030-01-01T00:00:00Z",
              last_refreshed_at: "2030-01-01T00:00:00Z",
              expires_at: null,
              aal: "aal1",
              user_agent: null,
              label: null,
              version: 0,
            },
          ],
          next_cursor: null,
          as_of: "2030-01-01T00:00:00Z",
        }
      : { items: [], next_cursor: null, as_of: "2030-01-01T00:00:00Z" },
  );
  try {
    render(<SessionManager actorId={actor} />);
    expect((await screen.findAllByText(/03:00/)).length).toBeGreaterThan(0);
  } finally {
    timezone.mockRestore();
  }
});
