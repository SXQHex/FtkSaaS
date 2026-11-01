import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { AccountDelete } from "../src/components/account/account-delete";
import { MfaManager } from "../src/components/account/mfa-manager";
import { ProfileForm } from "../src/components/account/profile-form";
import { IdentityForm } from "../src/components/account/identity-form";
import { InvitationAccept } from "../src/components/account/invitation-accept";
import { SessionManager } from "../src/components/account/session-manager";
import { DeletionProgress } from "../src/components/account/deletion-progress";
import { Providers } from "../src/components/providers";
import { ApiFailure } from "../src/lib/api";
import type { Preview } from "@ftksaas/api-contracts";
import { StrictMode, type ReactNode } from "react";
import type {
  AuthMFAEnrollTOTPResponse,
  AuthMFAListFactorsResponse,
  Factor,
} from "@supabase/supabase-js";
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  proof: vi.fn<() => Promise<string>>(),
  update: vi.fn<
    (
      attributes: {
        password?: string;
        current_password?: string;
        email?: string;
        phone?: string;
      },
      options?: unknown,
    ) => Promise<{ error: Error | null }>
  >(),
  factors: vi.fn<() => Promise<AuthMFAListFactorsResponse>>(),
  enroll: vi.fn<() => Promise<AuthMFAEnrollTOTPResponse>>(),
  refresh: vi.fn<() => Promise<{ error: Error | null }>>(),
  unenroll: vi.fn<() => Promise<{ error: null }>>(),
  verify: vi.fn<() => Promise<{ error: Error | null }>>(),
  saved: vi.fn<() => number>(() => 1),
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
      refreshSession: mocks.refresh,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      mfa: {
        listFactors: mocks.factors,
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
        challengeAndVerify: mocks.verify,
      },
    },
  }),
}));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
const actor = "019a2b3c-4d5e-7000-8000-000000000001";
const verifiedFactor: Factor<"totp", "verified"> = {
  id: "verified-factor",
  factor_type: "totp",
  status: "verified",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const pendingFactor: Factor<"totp", "unverified"> = {
  ...verifiedFactor,
  id: "pending-factor",
  status: "unverified",
};
const emptyFactors = { all: [], totp: [], phone: [], webauthn: [], recovery_code: [] };
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
  mocks.refresh.mockResolvedValue({ error: null });
  mocks.proof.mockResolvedValue("synthetic-proof");
  mocks.factors.mockResolvedValue({ error: null, data: emptyFactors });
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
test("verified TOTP removal challenges then unenrolls natively; enrollment cancellation stays native", async () => {
  mocks.factors.mockResolvedValue({
    error: null,
    data: {
      ...emptyFactors,
      all: [
        verifiedFactor,
        pendingFactor,
        { ...pendingFactor, id: "phone-factor", factor_type: "phone", friendly_name: "SMS factor" },
      ],
      totp: [verifiedFactor],
    },
  });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<MfaManager actorId={actor} />);
  await user.click(await screen.findByRole("button", { name: "Kurulumu iptal et" }));
  expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "pending-factor" });
  expect(screen.queryByText(/SMS factor/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Doğrulamayı kaldır" }));
  await user.type(screen.getByLabelText("Uygulamadaki doğrulama kodu"), "123456");
  await user.click(screen.getByRole("button", { name: "Doğrula ve kaldır" }));
  expect(await screen.findByRole("status")).toHaveTextContent("kaldırıldı");
  expect(mocks.verify).toHaveBeenCalledWith({ factorId: "verified-factor", code: "123456" });
  expect(mocks.unenroll).toHaveBeenLastCalledWith({ factorId: "verified-factor" });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.proof).not.toHaveBeenCalled();
  expect(mocks.call).not.toHaveBeenCalled();
});
test("new unverified TOTP enrollment can be cancelled and its setup key disappears", async () => {
  mocks.factors
    .mockResolvedValueOnce({ error: null, data: emptyFactors })
    .mockResolvedValueOnce({ error: null, data: { ...emptyFactors, all: [pendingFactor] } })
    .mockResolvedValue({ error: null, data: emptyFactors });
  mocks.enroll.mockResolvedValue({
    error: null,
    data: {
      id: pendingFactor.id,
      type: "totp",
      totp: {
        secret: "SYNTHETIC-SETUP-KEY",
        uri: "",
        qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg'></svg>",
      },
    },
  });
  mocks.unenroll.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<MfaManager actorId={actor} />);
  const enroll = screen.getByRole("button", { name: "Doğrulama uygulaması ekle" });
  await waitFor(() => expect(enroll).toBeEnabled());
  await user.click(enroll);
  expect(await screen.findByText("SYNTHETIC-SETUP-KEY")).toBeVisible();
  expect(
    screen.getByRole("img", { name: "Doğrulama uygulaması kurulumu için QR kodu" }),
  ).toHaveAttribute(
    "src",
    "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg'></svg>",
  );
  expect(screen.getByText(/6 haneli kodu/)).toBeVisible();
  await user.click(await screen.findByRole("button", { name: "Kurulumu iptal et" }));
  await waitFor(() => expect(screen.queryByText("SYNTHETIC-SETUP-KEY")).not.toBeInTheDocument());
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: pendingFactor.id });
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: "Doğrulama uygulaması ekle" })).toBeEnabled();
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
    render(
      <Providers>
        <SessionManager actorId={actor} />
      </Providers>,
    );
    await waitFor(() => expect(screen.getAllByText(/03:00/)).toHaveLength(2));
  } finally {
    timezone.mockRestore();
  }
});

async function fillPasswordForm(confirm = "Synthetic-new-42") {
  const user = userEvent.setup();
  render(
    <IdentityForm
      account={{ id: actor, state: "active", display_name: "Synthetic" }}
      onSaved={mocks.saved}
    />,
  );
  await user.click(screen.getByText("Parolayı değiştir", { selector: "summary" }));
  await user.type(screen.getByLabelText("Mevcut parola"), "Synthetic-old-42");
  await user.type(screen.getByLabelText("Yeni parola"), "Synthetic-new-42");
  await user.type(screen.getByLabelText("Yeni parolayı tekrar yaz"), confirm);
  await user.click(screen.getByRole("button", { name: "Parolayı kaydet" }));
}
test("password change verifies current password natively without a nonce challenge", async () => {
  mocks.update.mockResolvedValue({ error: null });
  await fillPasswordForm();
  expect(await screen.findByRole("status")).toHaveTextContent("Parolan değiştirildi");
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
    current_password: "Synthetic-old-42",
    password: "Synthetic-new-42",
  });
  expect(mocks.call).not.toHaveBeenCalled();
  expect(mocks.saved).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Mevcut parola")).toHaveValue("");
  expect(screen.getByLabelText("Yeni parola")).toHaveValue("");
  expect(screen.getByLabelText("Yeni parolayı tekrar yaz")).toHaveValue("");
  expect(screen.queryByText("Parola doğrulama kodu gönder")).not.toBeInTheDocument();
});
test("mismatching new passwords never update the account", async () => {
  await fillPasswordForm("Synthetic-other-42");
  expect(await screen.findByRole("alert")).toHaveTextContent("Parolalar eşleşmiyor");
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
});
test("rejected current password never announces a successful change", async () => {
  mocks.update.mockResolvedValue({ error: new Error("current password rejected") });
  await fillPasswordForm();
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(mocks.saved).not.toHaveBeenCalled();
});

test("identity lists only populated verified or pending contact records", () => {
  render(
    <IdentityForm
      account={{
        id: actor,
        state: "active",
        display_name: "Synthetic",
        identity: {
          email: "verified@example.invalid",
          email_verified_at: "2026-10-30T00:00:00Z",
          phone_verified_at: null,
          pending_email: "pending@example.invalid",
          phone: null,
          pending_phone: null,
          unverified_phone: null,
          given_name: null,
          family_name: null,
        },
      }}
      onSaved={mocks.saved}
    />,
  );
  expect(screen.getByText("verified@example.invalid")).toBeVisible();
  expect(screen.getByText("pending@example.invalid")).toBeVisible();
  expect(screen.queryByText("Doğrulanmış telefon")).not.toBeInTheDocument();
  expect(screen.queryByText("Doğrulama bekleyen telefon")).not.toBeInTheDocument();
  expect(screen.queryByText("Doğrulanmamış telefon")).not.toBeInTheDocument();
  expect(screen.queryByText("Kayıt yok")).not.toBeInTheDocument();
});
test("password mismatch belongs to the confirmation field", async () => {
  await fillPasswordForm("Synthetic-other-42");
  const confirm = screen.getByLabelText("Yeni parolayı tekrar yaz");
  expect(confirm).toHaveAttribute("aria-invalid", "true");
  expect(confirm).toHaveAccessibleDescription("Parolalar eşleşmiyor.");
  expect(screen.getByRole("alert")).toHaveClass("text-destructive");
});

function renderProfilePhone() {
  render(
    <ProfileForm
      readRevision={0}
      account={{
        id: actor,
        state: "active",
        display_name: "Synthetic",
        identity: {
          email: "verified@example.invalid",
          email_verified_at: "2026-10-30T00:00:00Z",
          phone_verified_at: null,
          pending_email: null,
          phone: null,
          pending_phone: null,
          unverified_phone: null,
          given_name: null,
          family_name: null,
        },
      }}
      version={1}
      onSaved={mocks.saved}
    />,
  );
}

test.each([
  ["0555 123 45 67", "+905551234567"],
  ["+44 20 7946 0018", "+442079460018"],
  ["", null],
] as const)(
  "profile phone %s saves only library E.164 or an explicit empty value",
  async (input, expected) => {
    mocks.call.mockResolvedValue({});
    const user = userEvent.setup();
    renderProfilePhone();
    const phone = screen.getByLabelText("Doğrulanmamış telefon") as HTMLInputElement;
    expect(phone).not.toBeRequired();
    expect(phone.checkValidity()).toBe(true);
    if (input) await user.type(phone, input);
    await user.click(screen.getByRole("button", { name: "Profili kaydet" }));
    await waitFor(() =>
      expect(mocks.call).toHaveBeenCalledWith(
        "account_profile_update_v1",
        expect.objectContaining({ unverified_phone: expected, expected_version: 1 }),
      ),
    );
  },
);

test("identity phone change normalizes a local Turkey number before native verification", async () => {
  mocks.update.mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(
    <IdentityForm
      account={{ id: actor, state: "active", display_name: "Synthetic" }}
      onSaved={mocks.saved}
    />,
  );
  await user.type(screen.getByLabelText("Yeni telefon"), "0555 123 45 67");
  await user.click(
    within(screen.getByLabelText("Yeni telefon").closest("form")!).getByRole("button"),
  );
  expect(mocks.update).toHaveBeenCalledWith({ phone: "+905551234567" }, undefined);
});
test("invalid phone stays inline and never starts native verification", async () => {
  const user = userEvent.setup();
  render(
    <IdentityForm
      account={{ id: actor, state: "active", display_name: "Synthetic" }}
      onSaved={mocks.saved}
    />,
  );
  const field = screen.getByLabelText("Yeni telefon");
  await user.type(field, "+901111111111");
  await user.click(within(field.closest("form")!).getByRole("button"));
  expect(field).toHaveAccessibleDescription("Geçerli bir telefon numarası gir.");
  expect(field).toHaveFocus();
  expect(mocks.update).not.toHaveBeenCalled();
});

test("invalid profile phone blocks saving and shows its own inline error", async () => {
  const user = userEvent.setup();
  renderProfilePhone();
  const phone = screen.getByLabelText("Doğrulanmamış telefon");
  await user.type(phone, "+901111111111");
  await user.click(screen.getByRole("button", { name: "Profili kaydet" }));
  expect(mocks.call).not.toHaveBeenCalled();
  expect(phone).toHaveAccessibleDescription("Geçerli bir telefon numarası gir.");
  expect(phone).toHaveFocus();
});

test("failed native MFA challenge never unenrolls and re-reads factors without a success notice", async () => {
  mocks.factors.mockResolvedValue({
    error: null,
    data: { ...emptyFactors, all: [verifiedFactor], totp: [verifiedFactor] },
  });
  mocks.verify.mockResolvedValue({ error: new Error("invalid code") });
  const user = userEvent.setup();
  render(<MfaManager actorId={actor} onSaved={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Doğrulamayı kaldır" }));
  await user.type(screen.getByLabelText("Uygulamadaki doğrulama kodu"), "123456");
  await user.click(screen.getByRole("button", { name: "Doğrula ve kaldır" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Kimlik sağlayıcısı");
  await waitFor(() => expect(mocks.factors).toHaveBeenCalledTimes(2));
  expect(mocks.unenroll).not.toHaveBeenCalled();
  expect(mocks.call).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("TOTP setup survives a rejected code and clears its QR and key after verification", async () => {
  mocks.enroll.mockResolvedValue({
    error: null,
    data: {
      id: pendingFactor.id,
      type: "totp",
      totp: {
        secret: "SYNTHETIC-SETUP-KEY",
        uri: "",
        qr_code: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg'></svg>",
      },
    },
  });
  mocks.verify
    .mockResolvedValueOnce({ error: new Error("invalid code") })
    .mockResolvedValue({ error: null });
  const user = userEvent.setup();
  render(<MfaManager actorId={actor} />);
  const enroll = screen.getByRole("button", { name: "Doğrulama uygulaması ekle" });
  await waitFor(() => expect(enroll).toBeEnabled());
  await user.click(enroll);
  const code = await screen.findByLabelText("Uygulamadaki doğrulama kodu");
  await user.type(code, "000000");
  await user.click(screen.getByRole("button", { name: "Kurulumu doğrula" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("img")).toBeVisible();
  expect(screen.getByText("SYNTHETIC-SETUP-KEY")).toBeVisible();
  await user.clear(code);
  await user.type(code, "123456");
  await user.click(screen.getByRole("button", { name: "Kurulumu doğrula" }));
  await waitFor(() => expect(screen.queryByRole("img")).not.toBeInTheDocument());
  expect(screen.queryByText("SYNTHETIC-SETUP-KEY")).not.toBeInTheDocument();
  expect(mocks.verify).toHaveBeenLastCalledWith({ factorId: pendingFactor.id, code: "123456" });
});

test("invitation handoff survives StrictMode and consumes tab proof before acceptance", async () => {
  window.history.replaceState(null, "", "/invite");
  sessionStorage.setItem("ftksaas:pending-invitation", "synthetic-handoff");
  mocks.call.mockResolvedValue({ id: actor, display_name: "Synthetic" });
  const user = userEvent.setup();
  render(
    <StrictMode>
      <InvitationAccept nativeUserId="native-owner" />
    </StrictMode>,
  );
  await screen.findByText("Kabul eden hesap: Synthetic");
  expect(screen.getByLabelText("Davet kodu")).toHaveValue("synthetic-handoff");
  expect(sessionStorage.getItem("ftksaas:pending-invitation")).toBeNull();
  expect(mocks.call.mock.calls.every(([operation]) => operation === "account_get_v1")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Daveti kabul et" }));
  expect(mocks.call).toHaveBeenCalledWith(
    "account_access_accept_v1",
    expect.objectContaining({ token: "synthetic-handoff" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent("Davet kabul edildi");
  expect(JSON.stringify(sessionStorage)).not.toContain("synthetic-handoff");
});

test("a fresh invitation fragment replaces stale tab proof and retains an explicit account-switch link", async () => {
  window.history.replaceState(null, "", "/invite#token=synthetic-new");
  sessionStorage.setItem("ftksaas:pending-invitation", "synthetic-old");
  mocks.call.mockResolvedValue({ id: actor, display_name: "Synthetic" });
  render(<InvitationAccept nativeUserId="native-owner" />);
  await screen.findByText("Kabul eden hesap: Synthetic");
  expect(screen.getByLabelText("Davet kodu")).toHaveValue("synthetic-new");
  expect(window.location.hash).toBe("");
  expect(sessionStorage.getItem("ftksaas:pending-invitation")).toBeNull();
  expect(screen.getByRole("link", { name: "Doğru hesapla yeniden giriş yap" })).toHaveAttribute(
    "href",
    "/login?next=/invite#token=synthetic-new",
  );
});

test("changing the native account remounts the invitation and never carries old proof", async () => {
  window.history.replaceState(null, "", "/invite#token=synthetic-first-account");
  mocks.call.mockResolvedValue({ id: actor, display_name: "Synthetic" });
  const view = render(<InvitationAccept nativeUserId="first-user" />);
  await screen.findByText("Kabul eden hesap: Synthetic");
  expect(screen.getByLabelText("Davet kodu")).toHaveValue("synthetic-first-account");
  view.rerender(
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      <InvitationAccept nativeUserId="second-user" />
    </NextIntlClientProvider>,
  );
  await screen.findByText("Kabul eden hesap: Synthetic");
  expect(screen.getByLabelText("Davet kodu")).toHaveValue("");
  expect(mocks.call.mock.calls.every(([operation]) => operation === "account_get_v1")).toBe(true);
});
