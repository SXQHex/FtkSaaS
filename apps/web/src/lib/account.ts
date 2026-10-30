import { v7 } from "uuid";
import type { Operations, SettingsImageUpload } from "@ftksaas/api-contracts";
import { apiClient, ApiFailure } from "./api";
import { browserClient } from "./supabase/client";

export type AccountOperation =
  | "account_get_v1"
  | "management_state_get_v1"
  | "account_profile_update_v1"
  | "account_sessions_list_v1"
  | "account_session_label_v1"
  | "account_sessions_revoke_v1"
  | "account_security_history_get_v1"
  | "account_totp_remove_v1"
  | "account_google_link_prepare_v1"
  | "account_password_change_v1"
  | "account_delete_preview_v1"
  | "account_delete_apply_v1"
  | "account_access_accept_v1"
  | "operation_status_get_v1"
  | "job_status_get_v1"
  | "media_get_v1";
export type AccountInput<K extends AccountOperation> = Omit<
  Operations[K]["request"],
  "client_api_version" | "request_id"
>;
export async function accountCall<K extends AccountOperation>(
  operation: K,
  input: AccountInput<K>,
) {
  const result = await apiClient().call(operation, {
    ...input,
    client_api_version: 1,
    request_id: v7(),
  } as Operations[K]["request"]);
  if (!result.ok) throw new ApiFailure(result);
  return result.data as Operations[K]["response"]["data"];
}
export async function accountProfile() {
  const [account, state] = await Promise.all([
    accountCall("account_get_v1", {}),
    accountCall("management_state_get_v1", {
      operation: "account_profile_update_v1",
      selector: { operation: "account_profile_update_v1", key: {} },
    }),
  ]);
  const profile = state.items.find(
    (item) => item.entity?.type === "accounts" && item.entity.id === account.id,
  );
  const version = profile?.versions.find(
    (item) => item.entity.type === "accounts" && item.entity.id === account.id,
  )?.version;
  if (!version) throw new Error("profileVersionUnavailable");
  return { account, version };
}
export function accountError(error: unknown) {
  if (error instanceof ApiFailure) {
    const code = error.failure.error.code;
    if (
      [
        "AUTH_REQUIRED",
        "SESSION_REVOKED",
        "FORBIDDEN",
        "VERSION_CONFLICT",
        "OWNER_TRANSFER_REQUIRED",
        "INVITATION_UNAVAILABLE",
        "ACCOUNT_LINK_CONFLICT",
        "ACCOUNT_ALREADY_LINKED",
        "PREVIEW_STALE",
        "RATE_LIMITED",
        "SERVICE_UNAVAILABLE",
        "VALIDATION_FAILED",
        "NOT_FOUND",
      ].includes(code)
    )
      return code;
  }
  return "failed";
}
export async function freshAccountProof(accountId: string, password: string, code: string) {
  const auth = browserClient().auth;
  const user = await auth.getUser();
  if (user.error || !user.data.user?.email) throw user.error ?? new Error("AUTH_REQUIRED");
  // Native identity is provider-owned; verify the Ftk account independently after signing in.
  if (password) {
    const signed = await auth.signInWithPassword({ email: user.data.user.email, password });
    if (signed.error) throw signed.error;
  }
  const factors = await auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  const factor = factors.data.totp.find((item) => item.status === "verified");
  if (factor && (password || code)) {
    const verified = await auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (verified.error) throw verified.error;
  }
  const current = await accountCall("account_get_v1", {});
  if (current.id !== accountId) throw new Error("AUTH_REQUIRED");
  const session = await auth.getSession();
  if (session.error || !session.data.session) throw session.error ?? new Error("AUTH_REQUIRED");
  return session.data.session.access_token;
}
export async function imageUpload(file: File): Promise<SettingsImageUpload> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 1048576
  )
    throw new Error("imageInvalid");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    mime: file.type as SettingsImageUpload["mime"],
    data_base64: btoa(binary),
    checksum: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
}
